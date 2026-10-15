import { describe, it, expect } from 'vitest';
import { load } from './+layout.server';

type AuthUser = { id: string; email: string };
type LoadEvent = { locals: { user: AuthUser | null } };

const runLoad = (user: AuthUser | null) =>
	(load as unknown as (event: LoadEvent) => Promise<{ user: AuthUser | null }>)({
		locals: { user }
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

		const result = await runLoad(user);

		expect(result).toEqual({ user });
	});
});
