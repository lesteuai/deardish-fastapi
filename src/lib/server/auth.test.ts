import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbMock = vi.hoisted(() => {
	const selectLimit = vi.fn();
	const makeSelectChain = () => {
		const chain: Record<string, unknown> = { limit: selectLimit };
		chain.where = vi.fn(() => chain);
		chain.innerJoin = vi.fn(() => chain);
		return chain;
	};
	const insertReturning = vi.fn();
	const insertValues = vi.fn(() => ({ returning: insertReturning }));
	const deleteWhere = vi.fn();
	const db = {
		select: vi.fn(() => ({ from: vi.fn(() => makeSelectChain()) })),
		insert: vi.fn(() => ({ values: insertValues })),
		delete: vi.fn(() => ({ where: deleteWhere }))
	};
	return { db, selectLimit, insertReturning, insertValues, deleteWhere };
});

vi.mock('./db', () => ({ db: dbMock.db }));

import {
	SESSION_COOKIE,
	SESSION_MAX_AGE,
	authenticate,
	clearSessionCookie,
	createSession,
	destroySession,
	hashPassword,
	hashToken,
	registerUser,
	setSessionCookie,
	validateSession,
	verifyPassword
} from './auth';
import { sessions } from './db/schema';

const user = { id: '11111111-1111-1111-1111-111111111111', email: 'chef@example.com' };

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.selectLimit.mockResolvedValue([]);
	dbMock.insertReturning.mockResolvedValue([]);
	dbMock.deleteWhere.mockResolvedValue(undefined);
});

describe('hashPassword / verifyPassword', () => {
	it('round-trips a password', () => {
		const stored = hashPassword('correct horse battery staple');

		expect(verifyPassword('correct horse battery staple', stored)).toBe(true);
	});

	it('produces a salted hash that differs each time', () => {
		expect(hashPassword('same-password')).not.toBe(hashPassword('same-password'));
	});

	it('rejects a wrong password', () => {
		const stored = hashPassword('correct horse battery staple');

		expect(verifyPassword('wrong password', stored)).toBe(false);
	});

	it('rejects a malformed stored hash without throwing', () => {
		expect(verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
	});
});

describe('hashToken', () => {
	it('is deterministic for the same token', () => {
		expect(hashToken('token-abc')).toBe(hashToken('token-abc'));
	});

	it('produces different hashes for different tokens', () => {
		expect(hashToken('token-abc')).not.toBe(hashToken('token-xyz'));
	});
});

describe('registerUser', () => {
	it('returns the created user', async () => {
		dbMock.insertReturning.mockResolvedValueOnce([user]);

		const result = await registerUser('Chef@Example.com', 'supersecret');

		expect(result).toEqual({ user });
		expect(dbMock.db.insert).toHaveBeenCalledTimes(1);
	});

	it('returns a conflict result on a unique violation without throwing', async () => {
		dbMock.insertReturning.mockRejectedValueOnce({ code: '23505' });

		const result = await registerUser('chef@example.com', 'supersecret');

		expect(result).toEqual({ conflict: true });
	});

	it('rethrows non-unique database errors', async () => {
		dbMock.insertReturning.mockRejectedValueOnce(new Error('connection reset'));

		await expect(registerUser('chef@example.com', 'supersecret')).rejects.toThrow('connection reset');
	});
});

describe('authenticate', () => {
	it('returns null for an unknown email', async () => {
		dbMock.selectLimit.mockResolvedValueOnce([]);

		await expect(authenticate('nobody@example.com', 'supersecret')).resolves.toBeNull();
	});

	it('returns null for a wrong password', async () => {
		dbMock.selectLimit.mockResolvedValueOnce([
			{ ...user, passwordHash: hashPassword('the-right-password') }
		]);

		await expect(authenticate(user.email, 'the-wrong-password')).resolves.toBeNull();
	});

	it('returns the user for correct credentials', async () => {
		dbMock.selectLimit.mockResolvedValueOnce([
			{ ...user, passwordHash: hashPassword('the-right-password') }
		]);

		await expect(authenticate(user.email, 'the-right-password')).resolves.toEqual(user);
	});
});

describe('createSession / validateSession', () => {
	it('creates a session and returns the user for the issued token', async () => {
		const token = await createSession(user.id);

		expect(typeof token).toBe('string');
		expect(token.length).toBeGreaterThan(0);
		expect(dbMock.db.insert).toHaveBeenCalledWith(sessions);

		dbMock.selectLimit.mockResolvedValueOnce([user]);

		await expect(validateSession(token)).resolves.toEqual(user);
	});

	it('returns null when the lookup finds no valid session (expired or unknown)', async () => {
		dbMock.selectLimit.mockResolvedValueOnce([]);

		await expect(validateSession('expired-token')).resolves.toBeNull();
	});
});

describe('destroySession', () => {
	it('deletes the session row by hashed token', async () => {
		await destroySession('some-token');

		expect(dbMock.db.delete).toHaveBeenCalledWith(sessions);
		expect(dbMock.deleteWhere).toHaveBeenCalledTimes(1);
	});
});

describe('session cookie helpers', () => {
	it('sets an httpOnly lax cookie at path /', () => {
		const cookies = { set: vi.fn() } as unknown as Parameters<typeof setSessionCookie>[0];

		setSessionCookie(cookies, 'session-token');

		expect(cookies.set).toHaveBeenCalledWith(
			SESSION_COOKIE,
			'session-token',
			expect.objectContaining({
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: SESSION_MAX_AGE
			})
		);
	});

	it('clears the session cookie at path /', () => {
		const cookies = { delete: vi.fn() } as unknown as Parameters<typeof clearSessionCookie>[0];

		clearSessionCookie(cookies);

		expect(cookies.delete).toHaveBeenCalledWith(SESSION_COOKIE, { path: '/' });
	});
});
