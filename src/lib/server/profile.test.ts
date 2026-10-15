import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbMock = vi.hoisted(() => {
	const selectLimit = vi.fn();
	const makeSelectChain = () => {
		const chain: Record<string, unknown> = { limit: selectLimit };
		chain.where = vi.fn(() => chain);
		return chain;
	};
	const insertReturning = vi.fn();
	const onConflictDoUpdate = vi.fn(() => ({ returning: insertReturning }));
	const insertValues = vi.fn(() => ({ onConflictDoUpdate }));
	const db = {
		select: vi.fn(() => ({ from: vi.fn(() => makeSelectChain()) })),
		insert: vi.fn(() => ({ values: insertValues }))
	};
	return { db, selectLimit, insertReturning, insertValues, onConflictDoUpdate };
});

vi.mock('./db', () => ({ db: dbMock.db }));

import { getProfile, saveProfile } from './profile';

const userId = '11111111-1111-1111-1111-111111111111';

const stored = {
	userId,
	conditions: 'Diabetes',
	allergies: 'Peanuts',
	dietaryPreferences: 'Vegetarian',
	notes: 'Low salt please',
	updatedAt: new Date()
};

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.selectLimit.mockResolvedValue([]);
	dbMock.insertReturning.mockResolvedValue([]);
});

describe('saveProfile', () => {
	it('persists a valid profile exactly once with trimmed values', async () => {
		dbMock.insertReturning.mockResolvedValueOnce([stored]);

		const result = await saveProfile(userId, {
			conditions: '  Diabetes  ',
			allergies: ' Peanuts ',
			dietaryPreferences: ' Vegetarian ',
			notes: '  Low salt please  '
		});

		expect(result).toEqual({
			ok: true,
			profile: {
				conditions: 'Diabetes',
				allergies: 'Peanuts',
				dietaryPreferences: 'Vegetarian',
				notes: 'Low salt please'
			}
		});
		expect(dbMock.db.insert).toHaveBeenCalledTimes(1);
		expect(dbMock.onConflictDoUpdate).toHaveBeenCalledTimes(1);
		expect(dbMock.insertValues).toHaveBeenCalledTimes(1);
		expect(dbMock.insertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				userId,
				conditions: 'Diabetes',
				allergies: 'Peanuts',
				dietaryPreferences: 'Vegetarian',
				notes: 'Low salt please',
				updatedAt: expect.any(Date)
			})
		);
		expect(dbMock.onConflictDoUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				set: expect.objectContaining({
					conditions: 'Diabetes',
					allergies: 'Peanuts',
					dietaryPreferences: 'Vegetarian',
					notes: 'Low salt please'
				})
			})
		);
	});

	it('defaults omitted optional fields to empty strings', async () => {
		dbMock.insertReturning.mockResolvedValueOnce([
			{ userId, conditions: '', allergies: '', dietaryPreferences: '', notes: '', updatedAt: new Date() }
		]);

		const result = await saveProfile(userId, {});

		expect(result.ok).toBe(true);
		expect(dbMock.insertValues).toHaveBeenCalledWith(
			expect.objectContaining({ conditions: '', allergies: '', dietaryPreferences: '', notes: '' })
		);
	});

	it('rejects conditions over 200 characters without touching the database', async () => {
		const result = await saveProfile(userId, {
			conditions: 'a'.repeat(201),
			allergies: '',
			dietaryPreferences: '',
			notes: ''
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.conditions).toBeTruthy();
		expect(dbMock.db.insert).not.toHaveBeenCalled();
	});

	it('rejects allergies over 200 characters without touching the database', async () => {
		const result = await saveProfile(userId, {
			conditions: '',
			allergies: 'a'.repeat(201),
			dietaryPreferences: '',
			notes: ''
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.allergies).toBeTruthy();
		expect(dbMock.db.insert).not.toHaveBeenCalled();
	});

	it('rejects dietaryPreferences over 200 characters without touching the database', async () => {
		const result = await saveProfile(userId, {
			conditions: '',
			allergies: '',
			dietaryPreferences: 'a'.repeat(201),
			notes: ''
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.dietaryPreferences).toBeTruthy();
		expect(dbMock.db.insert).not.toHaveBeenCalled();
	});

	it('rejects notes over 2000 characters without touching the database', async () => {
		const result = await saveProfile(userId, {
			conditions: '',
			allergies: '',
			dietaryPreferences: '',
			notes: 'a'.repeat(2001)
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.notes).toBeTruthy();
		expect(dbMock.db.insert).not.toHaveBeenCalled();
	});

	it('persists a valid profile at exactly the boundary limits', async () => {
		dbMock.insertReturning.mockResolvedValueOnce([stored]);

		const result = await saveProfile(userId, {
			conditions: 'c'.repeat(200),
			allergies: 'a'.repeat(200),
			dietaryPreferences: 'd'.repeat(200),
			notes: 'n'.repeat(2000)
		});

		expect(result.ok).toBe(true);
		expect(dbMock.db.insert).toHaveBeenCalledTimes(1);
		expect(dbMock.insertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				conditions: 'c'.repeat(200),
				allergies: 'a'.repeat(200),
				dietaryPreferences: 'd'.repeat(200),
				notes: 'n'.repeat(2000)
			})
		);
	});
});

describe('getProfile', () => {
	it('returns all-empty strings when no row is stored', async () => {
		dbMock.selectLimit.mockResolvedValueOnce([]);

		await expect(getProfile(userId)).resolves.toEqual({
			conditions: '',
			allergies: '',
			dietaryPreferences: '',
			notes: ''
		});
		expect(dbMock.db.select).toHaveBeenCalledTimes(1);
	});

	it('normalizes null columns to empty strings', async () => {
		dbMock.selectLimit.mockResolvedValueOnce([
			{ userId, conditions: null, allergies: null, dietaryPreferences: null, notes: null, updatedAt: new Date() }
		]);

		await expect(getProfile(userId)).resolves.toEqual({
			conditions: '',
			allergies: '',
			dietaryPreferences: '',
			notes: ''
		});
	});

	it('returns the stored profile values when a row exists', async () => {
		dbMock.selectLimit.mockResolvedValueOnce([stored]);

		await expect(getProfile(userId)).resolves.toEqual({
			conditions: 'Diabetes',
			allergies: 'Peanuts',
			dietaryPreferences: 'Vegetarian',
			notes: 'Low salt please'
		});
	});
});
