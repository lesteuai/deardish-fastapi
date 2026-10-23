import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

const backendMock = vi.hoisted(() => ({ backendJson: vi.fn() }));

vi.mock('$lib/server/backend', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/backend')>()),
	backendJson: backendMock.backendJson
}));

import ProfilePage from './+page.svelte';
import { BackendError } from '$lib/server/backend';
import { actions, load } from './+page.server';

const profile = {
	conditions: 'Diabetes',
	allergies: 'Peanuts',
	dietaryPreferences: 'Vegetarian',
	notes: 'Low salt please'
};

function makeEvent(options: { user?: { id: string; email: string } | null; fields?: Record<string, string> } = {}) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(options.fields ?? {})) formData.append(key, value);
	return {
		locals: { user: 'user' in options ? options.user : { id: 'user-1', email: 'chef@example.com' } },
		request: { formData: async () => formData },
		url: new URL('https://deardish.example/profile')
	};
}

async function captureRedirect(run: () => unknown) {
	try {
		await run();
	} catch (error) {
		return error as { status?: number; location?: string };
	}
	throw new Error('Expected redirect');
}

beforeEach(() => vi.clearAllMocks());

describe('profile page', () => {
	it('loads the backend profile for the authenticated user', async () => {
		backendMock.backendJson.mockResolvedValue({ profile });
		const event = makeEvent();

		await expect(load(event as never)).resolves.toEqual({ email: 'chef@example.com', profile });
		expect(backendMock.backendJson).toHaveBeenCalledWith(event, '/api/profile');
	});

	it('redirects anonymous profile loads and actions before calling the backend', async () => {
		const event = makeEvent({ user: null });
		const loadRedirect = await captureRedirect(async () => load(event as never));
		const actionRedirect = await captureRedirect(async () => actions.default(event as never));

		expect(loadRedirect).toMatchObject({ status: 303, location: '/auth/login' });
		expect(actionRedirect).toMatchObject({ status: 303, location: '/auth/login' });
		expect(backendMock.backendJson).not.toHaveBeenCalled();
	});

	it('submits the complete profile and returns the established success shape', async () => {
		backendMock.backendJson.mockResolvedValue({ profile });
		const fields = {
			conditions: '  Diabetes  ', allergies: 'Peanuts', dietaryPreferences: 'Vegetarian', notes: 'Low salt please'
		};
		const event = makeEvent({ fields });

		await expect(actions.default(event as never)).resolves.toEqual({ saved: true, values: fields });
		expect(backendMock.backendJson).toHaveBeenCalledWith(event, '/api/profile', {
			method: 'PUT', body: fields
		});
	});

	it('preserves profile field errors and values from backend validation', async () => {
		backendMock.backendJson.mockRejectedValue(new BackendError(400, 'Invalid request', {
			conditions: 'Conditions must be 200 characters or fewer',
			notes: 'Notes must be 2000 characters or fewer'
		}));
		const fields = { conditions: 'x'.repeat(201), allergies: '', dietaryPreferences: '', notes: 'y'.repeat(2001) };

		const failure = await actions.default(makeEvent({ fields }) as never) as {
			status: number;
			data: { errors: Record<string, string>; values: typeof fields };
		};

		expect(failure.status).toBe(400);
		expect(failure.data.errors).toEqual({
			conditions: 'Conditions must be 200 characters or fewer',
			notes: 'Notes must be 2000 characters or fewer'
		});
		expect(failure.data.values).toEqual(fields);
	});

	it('returns a friendly form error when the backend is unavailable', async () => {
		backendMock.backendJson.mockRejectedValue(new TypeError('private connection detail'));
		const failure = await actions.default(makeEvent({ fields: profile }) as never) as {
			status: number;
			data: { errors: Record<string, string>; values: typeof profile };
		};

		expect(failure.status).toBe(502);
		expect(failure.data.errors.form).toContain('temporarily unavailable');
		expect(JSON.stringify(failure)).not.toContain('private connection detail');
		expect(failure.data.values).toEqual(profile);
	});

	it('prefills the form with the stored profile values', () => {
		const { getByLabelText } = render(ProfilePage, {
			props: { data: { profile }, form: undefined } as never
		});

		expect((getByLabelText('Conditions') as HTMLInputElement).value).toBe('Diabetes');
		expect((getByLabelText('Allergies') as HTMLInputElement).value).toBe('Peanuts');
		expect((getByLabelText('Dietary preferences') as HTMLInputElement).value).toBe('Vegetarian');
		expect((getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('Low salt please');
	});

	it('renders visible field errors from the form prop', () => {
		const form = {
			errors: {
				conditions: 'Conditions must be 200 characters or fewer',
				notes: 'Notes must be 2000 characters or fewer'
			},
			values: { ...profile, conditions: 'over-limit text' }
		};

		const { getByText, getByLabelText } = render(ProfilePage, {
			props: { data: { profile }, form } as never
		});

		expect(getByText('Conditions must be 200 characters or fewer')).toBeTruthy();
		expect(getByText('Notes must be 2000 characters or fewer')).toBeTruthy();
		expect((getByLabelText('Conditions') as HTMLInputElement).value).toBe('over-limit text');
	});

	it('wraps the profile form in a card container', () => {
		const { getByLabelText } = render(ProfilePage, {
			props: { data: { profile }, form: undefined } as never
		});

		const form = getByLabelText('Conditions').closest('form');
		expect(form).not.toBeNull();
		expect(form!.closest('.card')).not.toBeNull();
	});
});
