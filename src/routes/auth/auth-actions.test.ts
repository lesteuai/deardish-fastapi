import { beforeEach, describe, expect, it, vi } from 'vitest';

const backendMock = vi.hoisted(() => ({ backendJson: vi.fn() }));

vi.mock('$lib/server/backend', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/backend')>()),
	backendJson: backendMock.backendJson
}));

import { BackendError } from '$lib/server/backend';
import { actions as loginActions } from './login/+page.server';
import { actions as registerActions } from './register/+page.server';
import { actions as logoutActions } from './logout/+page.server';

function makeEvent(fields: Record<string, string> = {}, token?: string) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.append(key, value);
	const cookies = { get: vi.fn(() => token), set: vi.fn(), delete: vi.fn() };
	return {
		event: {
			request: { formData: async () => formData },
			cookies,
			url: new URL('https://deardish.example/auth')
		} as never,
		cookies
	};
}

type ActionFailure = { status: number; data: { errors: Record<string, string>; values: Record<string, string> } };

async function captureRedirect(action: (input: never) => Promise<unknown>, event: never) {
	try {
		await action(event);
	} catch (error) {
		return error as { status?: number; location?: string };
	}
	throw new Error('Expected action to redirect');
}

beforeEach(() => vi.clearAllMocks());

describe('authentication actions through the backend bridge', () => {
	it('returns backend login field errors without returning a password', async () => {
		backendMock.backendJson.mockRejectedValue(new BackendError(400, 'Invalid request', {
			email: 'Enter a valid email address', password: 'Required'
		}));
		const { event } = makeEvent({ email: 'typed@example.com', password: 'private-login-secret' });

		const result = await loginActions.default(event) as ActionFailure;

		expect(result.status).toBe(400);
		expect(result.data.errors).toEqual({ email: 'Enter a valid email address', password: 'Required' });
		expect(result.data.values).toEqual({ email: 'typed@example.com' });
		expect(JSON.stringify(result)).not.toContain('private-login-secret');
		expect(backendMock.backendJson).toHaveBeenCalledWith(event, '/api/auth/login', {
			method: 'POST', body: { email: 'typed@example.com', password: 'private-login-secret' }
		});
	});

	it('maps invalid credentials and backend failure to safe form errors', async () => {
		const { event } = makeEvent({ email: 'chef@example.com', password: 'wrong-secret' });
		backendMock.backendJson.mockRejectedValueOnce(new BackendError(401, 'Invalid email or password'));
		const invalid = await loginActions.default(event) as ActionFailure;
		expect(invalid.data.errors.form).toBe('Invalid email or password');
		expect(JSON.stringify(invalid)).not.toContain('wrong-secret');

		backendMock.backendJson.mockRejectedValueOnce(new TypeError('connection secret'));
		const unavailable = await loginActions.default(event) as ActionFailure;
		expect(unavailable.status).toBe(502);
		expect(unavailable.data.errors.form).toContain('temporarily unavailable');
		expect(JSON.stringify(unavailable)).not.toContain('connection secret');
	});

	it('redirects after a successful backend login', async () => {
		const { event } = makeEvent({ email: 'chef@example.com', password: 'login-secret' });
		backendMock.backendJson.mockResolvedValue({ user: { id: 'user-1', email: 'chef@example.com' } });

		const redirect = await captureRedirect(loginActions.default as never, event);

		expect(redirect.status).toBe(302);
		expect(redirect.location).toBe('/menu');
	});

	it('passes registration policy errors through without returning either password', async () => {
		const { event } = makeEvent({
			email: 'bad-email', password: 'registration-secret', confirmPassword: 'different-secret'
		});
		backendMock.backendJson.mockRejectedValueOnce(new BackendError(400, 'Invalid request', {
			email: 'Enter a valid email address', confirmPassword: 'Passwords do not match'
		}));

		const invalid = await registerActions.default(event) as ActionFailure;

		expect(invalid.data.errors).toEqual({
			email: 'Enter a valid email address', confirmPassword: 'Passwords do not match'
		});
		expect(invalid.data.values).toEqual({ email: 'bad-email' });
		expect(JSON.stringify(invalid)).not.toContain('registration-secret');
		expect(JSON.stringify(invalid)).not.toContain('different-secret');
	});

	it('maps duplicate email errors and returns a safe unavailable error', async () => {
		const { event } = makeEvent({
			email: 'duplicate@example.com', password: 'registration-secret', confirmPassword: 'registration-secret'
		});
		backendMock.backendJson.mockRejectedValueOnce(new BackendError(400, 'Invalid request', {
			email: 'An account with this email already exists'
		}));
		const duplicate = await registerActions.default(event) as ActionFailure;
		expect(duplicate.data.errors.email).toContain('already exists');
		expect(JSON.stringify(duplicate)).not.toContain('registration-secret');

		backendMock.backendJson.mockRejectedValueOnce(new TypeError('database connection secret'));
		const unavailable = await registerActions.default(event) as ActionFailure;
		expect(unavailable.status).toBe(502);
		expect(unavailable.data.errors.form).toContain('temporarily unavailable');
		expect(JSON.stringify(unavailable)).not.toContain('database connection secret');
	});

	it('redirects after registration and logout backend operations', async () => {
		const registerEvent = makeEvent({
			email: 'chef@example.com', password: 'register-secret', confirmPassword: 'register-secret'
		}).event;
		backendMock.backendJson.mockResolvedValue({ user: { id: 'user-1', email: 'chef@example.com' } });
		const registerRedirect = await captureRedirect(registerActions.default as never, registerEvent);
		expect(registerRedirect.status).toBe(302);
		expect(registerRedirect.location).toBe('/menu');

		const logout = makeEvent({}, 'session-token');
		const logoutEvent = logout.event as never;
		backendMock.backendJson.mockResolvedValueOnce(undefined);
		const logoutRedirect = await captureRedirect(logoutActions.default as never, logoutEvent);
		expect(backendMock.backendJson).toHaveBeenLastCalledWith(logoutEvent, '/api/auth/logout', { method: 'POST' });
		expect(logoutRedirect.status).toBe(302);
		expect(logoutRedirect.location).toBe('/');
	});
});
