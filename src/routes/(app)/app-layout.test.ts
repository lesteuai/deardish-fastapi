import { describe, it, expect } from 'vitest';
import { load } from './+layout.server';

type LoadEvent = {
	parent: () => Promise<{ user: { id: string; email: string } | null }>;
	locals: { user?: unknown };
};

const runLoad = (user: { id: string; email: string } | null, locals: LoadEvent['locals'] = {}) =>
	(load as unknown as (event: LoadEvent) => Promise<{ user: unknown }>)({
		parent: async () => ({ user }),
		locals
	});

describe('(app) layout protection', () => {
	it('redirects signed-out visitors to /auth/login', async () => {
		let thrown: { status?: number; location?: string } | undefined;
		try {
			await runLoad(null);
		} catch (error) {
			thrown = error as { status?: number; location?: string };
		}

		expect(thrown?.status).toBe(302);
		expect(thrown?.location).toBe('/auth/login');
	});

	it('exposes the signed-in user to the layout', async () => {
		const user = { id: 'user-1', email: 'chef@example.com' };
		const locals: LoadEvent['locals'] = {};

		const result = await runLoad(user, locals);

		expect(result).toEqual({ user });
		expect(locals.user).toEqual(user);
	});
});
