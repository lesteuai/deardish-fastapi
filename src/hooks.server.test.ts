import { describe, it, expect, vi, beforeEach } from 'vitest';

const backendMock = vi.hoisted(() => ({ getSessionUser: vi.fn() }));

vi.mock('$lib/server/backend', () => ({ ...backendMock, SESSION_COOKIE: 'deardish_session' }));

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
	backendMock.getSessionUser.mockResolvedValue(user);
});

describe('hooks.server handle', () => {
	it('leaves locals.user null when the cookie is absent', async () => {
		const { locals, resolve } = await runHandle(undefined);

		expect(locals.user).toBeNull();
		expect(backendMock.getSessionUser).not.toHaveBeenCalled();
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it('sets locals.user for a valid token', async () => {
		const { locals } = await runHandle('session-token');

		expect(backendMock.getSessionUser).toHaveBeenCalledWith(expect.objectContaining({ cookies: expect.any(Object) }));
		expect(locals.user).toEqual(user);
	});

	it('sets locals.user null for an invalid token', async () => {
		backendMock.getSessionUser.mockResolvedValue(null);

		const { locals } = await runHandle('bad-token');

		expect(backendMock.getSessionUser).toHaveBeenCalledTimes(1);
		expect(locals.user).toBeNull();
	});

	it('continues anonymously when the backend cannot validate a cookie', async () => {
		backendMock.getSessionUser.mockRejectedValue(new Error('backend unavailable'));

		const { locals, resolve } = await runHandle('stale-token');

		expect(locals.user).toBeNull();
		expect(resolve).toHaveBeenCalledTimes(1);
	});
});
