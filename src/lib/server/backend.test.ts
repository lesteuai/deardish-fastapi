import { afterEach, describe, expect, it, vi } from 'vitest';

const privateEnv = vi.hoisted(() => ({ BACKEND_URL: undefined as string | undefined }));

vi.mock('$env/dynamic/private', () => ({ env: privateEnv }));

import { BackendError, backendJson, requestBackend, SESSION_COOKIE } from './backend';

function makeEvent(options: { url?: string; token?: string; headers?: HeadersInit } = {}) {
	const calls = { set: vi.fn(), delete: vi.fn() };
	const event = {
		url: new URL(options.url ?? 'https://deardish.example/auth/login'),
		cookies: {
			get: vi.fn((name: string) => name === SESSION_COOKIE ? options.token : undefined),
			set: calls.set,
			delete: calls.delete
		},
		request: new Request(options.url ?? 'https://deardish.example/auth/login', {
			headers: options.headers
		})
	};
	return { event: event as never, calls, cookies: event.cookies };
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	privateEnv.BACKEND_URL = undefined;
});

describe('backend bridge', () => {
	it('uses native fetch, forwards only the known session cookie and public Origin', async () => {
		const { event, cookies } = makeEvent({
			token: 'known-session',
			headers: {
				'authorization': 'Bearer browser-secret',
				'cookie': 'deardish_session=known-session; unrelated=private',
				'x-forwarded-for': '203.0.113.7'
			}
		});
		const fetchMock = vi.fn(async () => Response.json({ ok: true }));
		vi.stubGlobal('fetch', fetchMock);

		await requestBackend(event, '/api/auth/login', {
			method: 'POST',
			body: { email: 'chef@example.com', password: 'secret' }
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('http://127.0.0.1:8000/api/auth/login');
		expect(init.method).toBe('POST');
		const headers = new Headers(init.headers);
		expect(headers.get('cookie')).toBe('deardish_session=known-session');
		expect(headers.get('origin')).toBe('https://deardish.example');
		expect(headers.get('content-type')).toBe('application/json');
		expect(headers.has('authorization')).toBe(false);
		expect(headers.has('x-forwarded-for')).toBe(false);
		expect(String(init.body)).toContain('secret');
		expect(cookies.get).toHaveBeenCalledWith(SESSION_COOKIE);
	});

	it('omits an absent cookie and uses configured backend URL', async () => {
		const { event } = makeEvent({ url: 'http://localhost:5173/profile' });
		const fetchMock = vi.fn(async () => Response.json({ ok: true }));
		vi.stubGlobal('fetch', fetchMock);
		privateEnv.BACKEND_URL = 'http://backend.internal:9000/';

		await requestBackend(event, '/api/profile');

		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('http://backend.internal:9000/api/profile');
		expect(new Headers(init.headers).has('cookie')).toBe(false);
		expect(new Headers(init.headers).has('origin')).toBe(false);
	});

	it('uses the incoming public origin as the production target', async () => {
		const { event } = makeEvent({ url: 'https://deardish.example/menu' });
		const fetchMock = vi.fn(async () => Response.json({ ok: true }));
		vi.stubGlobal('fetch', fetchMock);
		privateEnv.BACKEND_URL = '';
		vi.stubEnv('DEV', false);

		await requestBackend(event, '/api/auth/session');

		expect((fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0]?.[0]).toBe(
			'https://deardish.example/api/auth/session'
		);
	});

	it('relays only session cookie set and clear responses with fixed policy', async () => {
		const { event, calls } = makeEvent({ url: 'https://deardish.example/auth/register' });
		const response = new Response(null, { status: 201 });
		response.headers.append('set-cookie', 'other=value; Path=/');
		response.headers.append('set-cookie', 'deardish_session=issued-token; Path=/; HttpOnly; SameSite=Lax; Max-Age=600');
		vi.stubGlobal('fetch', vi.fn(async () => response));

		await requestBackend(event, '/api/auth/register', { method: 'POST', body: {} });

		expect(calls.set).toHaveBeenCalledTimes(1);
		expect(calls.set).toHaveBeenCalledWith(SESSION_COOKIE, 'issued-token', {
			path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 7
		});
		expect(calls.delete).not.toHaveBeenCalled();

		const clear = new Response(null, { status: 204 });
		clear.headers.append('set-cookie', 'deardish_session=; Max-Age=0; Path=/; HttpOnly');
		vi.stubGlobal('fetch', vi.fn(async () => clear));
		await requestBackend(event, '/api/auth/logout', { method: 'POST' });
		expect(calls.delete).toHaveBeenCalledWith(SESSION_COOKIE, {
			path: '/', httpOnly: true, sameSite: 'lax', secure: true
		});
	});

	it('uses insecure cookie policy for local HTTP and friendly errors for failed fetches', async () => {
		const { event, calls } = makeEvent({ url: 'http://localhost:5173/auth/login' });
		const response = new Response(null, { status: 200 });
		response.headers.append('set-cookie', 'deardish_session=token; Path=/');
		vi.stubGlobal('fetch', vi.fn(async () => response));
		await requestBackend(event, '/api/auth/login');
		expect(calls.set).toHaveBeenCalledWith(SESSION_COOKIE, 'token', expect.objectContaining({ secure: false }));

		vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('connection details'); }));
		await expect(requestBackend(event, '/api/auth/session')).rejects.toMatchObject({
			name: 'BackendError', status: 502,
			message: 'DearDish services are temporarily unavailable. Please try again shortly.'
		});
	});

	it('translates backend field errors and hides unreadable or non-JSON failure details', async () => {
		const { event } = makeEvent();
		vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Invalid request', errors: { email: 'Bad email', password: 12 } }, { status: 400 })));
		await expect(backendJson(event, '/api/auth/register')).rejects.toMatchObject({
			status: 400, message: 'Invalid request', fieldErrors: { email: 'Bad email' }
		});

		vi.stubGlobal('fetch', vi.fn(async () => new Response('provider internals', { status: 503 })));
		await expect(backendJson(event, '/api/auth/session')).rejects.toBeInstanceOf(BackendError);

		vi.stubGlobal('fetch', vi.fn(async () => new Response('secret failure', { status: 200 })));
		await expect(backendJson(event, '/api/auth/session')).rejects.toMatchObject({
			status: 502,
			message: 'DearDish services returned an unreadable response. Please try again shortly.'
		});
	});
});
