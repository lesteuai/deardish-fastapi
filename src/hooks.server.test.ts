import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.hoisted(() => ({ validateSession: vi.fn() }));

vi.mock('$lib/server/auth', () => ({ ...authMock, SESSION_COOKIE: 'deardish_session' }));

import { handle } from './hooks.server';

const user = { id: 'user-1', email: 'chef@example.com' };

async function runHandle(token: string | undefined) {
	const locals: { user?: unknown } = {};
	const event = {
		cookies: { get: vi.fn(() => token) },
		locals
	};
	const resolve = vi.fn(async () => new Response('ok'));

	const run = handle as unknown as (input: {
		event: unknown;
		resolve: unknown;
	}) => Promise<Response>;
	const response = await run({ event, resolve });

	return { locals, response, resolve };
}

beforeEach(() => {
	vi.clearAllMocks();
	authMock.validateSession.mockResolvedValue(user);
});

describe('hooks.server handle', () => {
	it('leaves locals.user null when the cookie is absent', async () => {
		const { locals, resolve } = await runHandle(undefined);

		expect(locals.user).toBeNull();
		expect(authMock.validateSession).not.toHaveBeenCalled();
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it('sets locals.user for a valid token', async () => {
		const { locals } = await runHandle('session-token');

		expect(authMock.validateSession).toHaveBeenCalledWith('session-token');
		expect(locals.user).toEqual(user);
	});

	it('sets locals.user null for an invalid token', async () => {
		authMock.validateSession.mockResolvedValue(null);

		const { locals } = await runHandle('bad-token');

		expect(authMock.validateSession).toHaveBeenCalledWith('bad-token');
		expect(locals.user).toBeNull();
	});
});
