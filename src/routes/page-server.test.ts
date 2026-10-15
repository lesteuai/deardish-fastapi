import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

type AuthUser = { id: string; email: string };
type LoadEvent = { locals: { user: AuthUser | null } };

const runLoad = (user: AuthUser | null) =>
	(load as unknown as (event: LoadEvent) => Promise<unknown>)({ locals: { user } });

describe('landing page redirect', () => {
	it('redirects signed-in visitors to /menu', async () => {
		let thrown: { status?: number; location?: string } | undefined;
		try {
			await runLoad({ id: 'user-1', email: 'chef@example.com' });
		} catch (error) {
			thrown = error as { status?: number; location?: string };
		}

		expect(thrown?.status).toBe(302);
		expect(thrown?.location).toBe('/menu');
	});

	it('renders the landing page for signed-out visitors', async () => {
		const result = await runLoad(null);

		expect(result).toBeUndefined();
	});
});
