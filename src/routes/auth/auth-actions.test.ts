import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.hoisted(() => ({
	authenticate: vi.fn(),
	registerUser: vi.fn(),
	createSession: vi.fn(),
	setSessionCookie: vi.fn(),
	clearSessionCookie: vi.fn(),
	destroySession: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({
	...authMock,
	SESSION_COOKIE: 'deardish_session'
}));

import { actions as loginActions } from './login/+page.server';
import { actions as registerActions } from './register/+page.server';
import { actions as logoutActions } from './logout/+page.server';

type CookieStub = {
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
};

function makeCookies(session?: string): CookieStub {
	return {
		get: vi.fn(() => session),
		set: vi.fn(),
		delete: vi.fn()
	};
}

function makeRequest(fields: Record<string, string>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.append(key, value);
	return { formData: async () => formData };
}

type ActionFailure = { status: number; data: { errors: Record<string, string>; values: Record<string, string> } };

beforeEach(() => {
	vi.clearAllMocks();
});

describe('login action', () => {
	it('rejects an empty email with a field error and no cookie', async () => {
		const cookies = makeCookies();

		const result = await loginActions.default({
			request: makeRequest({ email: '', password: 'secret' }),
			cookies
		} as never);

		const failure = result as ActionFailure;
		expect(failure.status).toBe(400);
		expect(failure.data.errors.email).toBeTruthy();
		expect(cookies.set).not.toHaveBeenCalled();
		expect(authMock.authenticate).not.toHaveBeenCalled();
	});

	it('rejects an empty password with a field error and no cookie', async () => {
		const cookies = makeCookies();

		const result = await loginActions.default({
			request: makeRequest({ email: 'chef@example.com', password: '' }),
			cookies
		} as never);

		const failure = result as ActionFailure;
		expect(failure.status).toBe(400);
		expect(failure.data.errors.password).toBeTruthy();
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('rejects wrong or unknown credentials with a form error and no cookie', async () => {
		authMock.authenticate.mockResolvedValue(null);
		const cookies = makeCookies();

		const result = await loginActions.default({
			request: makeRequest({ email: 'chef@example.com', password: 'wrong-password' }),
			cookies
		} as never);

		const failure = result as ActionFailure;
		expect(failure.status).toBe(400);
		expect(failure.data.errors.form).toBeTruthy();
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('creates a session and redirects to /menu on success', async () => {
		authMock.authenticate.mockResolvedValue({ id: 'user-1', email: 'chef@example.com' });
		authMock.createSession.mockResolvedValue('session-token');
		const cookies = makeCookies();

		let thrown: { status?: number; location?: string } | undefined;
		try {
			await loginActions.default({
				request: makeRequest({ email: 'chef@example.com', password: 'right-password' }),
				cookies
			} as never);
		} catch (error) {
			thrown = error as { status?: number; location?: string };
		}

		expect(thrown?.status).toBe(302);
		expect(thrown?.location).toBe('/menu');
		expect(authMock.createSession).toHaveBeenCalledWith('user-1');
		expect(authMock.setSessionCookie).toHaveBeenCalledWith(cookies, 'session-token');
		expect(thrown).toBeDefined();
	});
});

describe('register action', () => {
	it('rejects an invalid email with a field error and creates no user', async () => {
		const cookies = makeCookies();

		const result = await registerActions.default({
			request: makeRequest({
				email: 'not-an-email',
				password: 'supersecret',
				confirmPassword: 'supersecret'
			}),
			cookies
		} as never);

		const failure = result as ActionFailure;
		expect(failure.status).toBe(400);
		expect(failure.data.errors.email).toBeTruthy();
		expect(authMock.registerUser).not.toHaveBeenCalled();
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('rejects a short password with a field error', async () => {
		const cookies = makeCookies();

		const result = await registerActions.default({
			request: makeRequest({
				email: 'chef@example.com',
				password: 'short',
				confirmPassword: 'short'
			}),
			cookies
		} as never);

		const failure = result as ActionFailure;
		expect(failure.status).toBe(400);
		expect(failure.data.errors.password).toBeTruthy();
		expect(authMock.registerUser).not.toHaveBeenCalled();
	});

	it('rejects a password mismatch without creating a user', async () => {
		const cookies = makeCookies();

		const result = await registerActions.default({
			request: makeRequest({
				email: 'chef@example.com',
				password: 'supersecret',
				confirmPassword: 'different-secret'
			}),
			cookies
		} as never);

		const failure = result as ActionFailure;
		expect(failure.status).toBe(400);
		expect(failure.data.errors.confirmPassword).toBeTruthy();
		expect(authMock.registerUser).not.toHaveBeenCalled();
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('reports a duplicate email as a field error and sets no cookie', async () => {
		authMock.registerUser.mockResolvedValue({ conflict: true });
		const cookies = makeCookies();

		const result = await registerActions.default({
			request: makeRequest({
				email: 'chef@example.com',
				password: 'supersecret',
				confirmPassword: 'supersecret'
			}),
			cookies
		} as never);

		const failure = result as ActionFailure;
		expect(failure.status).toBe(400);
		expect(failure.data.errors.email).toBeTruthy();
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('creates a session and redirects to /menu on success', async () => {
		authMock.registerUser.mockResolvedValue({ user: { id: 'user-1', email: 'chef@example.com' } });
		authMock.createSession.mockResolvedValue('session-token');
		const cookies = makeCookies();

		let thrown: { status?: number; location?: string } | undefined;
		try {
			await registerActions.default({
				request: makeRequest({
					email: 'Chef@Example.com',
					password: 'supersecret',
					confirmPassword: 'supersecret'
				}),
				cookies
			} as never);
		} catch (error) {
			thrown = error as { status?: number; location?: string };
		}

		expect(thrown?.location).toBe('/menu');
		expect(authMock.registerUser).toHaveBeenCalledWith('chef@example.com', 'supersecret');
		expect(authMock.setSessionCookie).toHaveBeenCalledWith(cookies, 'session-token');
		expect(thrown).toBeDefined();
	});
});

describe('logout action', () => {
	it('destroys the session, clears the cookie, and redirects to the root page', async () => {
		const cookies = makeCookies('session-token');

		let thrown: { status?: number; location?: string } | undefined;
		try {
			await logoutActions.default({ cookies } as never);
		} catch (error) {
			thrown = error as { status?: number; location?: string };
		}

		expect(thrown?.location).toBe('/');
		expect(authMock.destroySession).toHaveBeenCalledWith('session-token');
		expect(authMock.clearSessionCookie).toHaveBeenCalledWith(cookies);
		expect(thrown).toBeDefined();
	});

	it('does not destroy a session when no cookie is present', async () => {
		const cookies = makeCookies(undefined);

		try {
			await logoutActions.default({ cookies } as never);
		} catch {
			// redirect is expected
		}

		expect(authMock.destroySession).not.toHaveBeenCalled();
		expect(authMock.clearSessionCookie).toHaveBeenCalledWith(cookies);
	});
});
