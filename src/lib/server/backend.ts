import { env } from '$env/dynamic/private';
import { error, redirect } from '@sveltejs/kit';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import type { AuthUser } from '$lib/types';

export const SESSION_COOKIE = 'deardish_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export class BackendError extends Error {
	constructor(
		public status: number,
		message: string,
		public fieldErrors: Record<string, string> = {}
	) {
		super(message);
		this.name = 'BackendError';
	}
}

function backendOrigin(event: RequestEvent): string {
	if (env.BACKEND_URL) return env.BACKEND_URL.replace(/\/$/, '');
	if (import.meta.env.DEV) return 'http://127.0.0.1:8000';
	return event.url.origin;
}

function updateSessionCookie(event: RequestEvent, cookies: Cookies, response: Response): void {
	const setCookies = response.headers.getSetCookie();
	for (const setCookie of setCookies) {
		const [pair, ...attributes] = setCookie.split(';');
		const separator = pair.indexOf('=');
		if (separator < 0 || pair.slice(0, separator).trim() !== SESSION_COOKIE) continue;

		const value = pair.slice(separator + 1).trim();
		const expires = attributes.some((attribute) => /^\s*max-age=0\s*$/i.test(attribute));
		const options = {
			path: '/',
			httpOnly: true,
			sameSite: 'lax' as const,
			secure: event.url.protocol === 'https:'
		};
		if (expires || value.length === 0) {
			cookies.delete(SESSION_COOKIE, options);
		} else {
			cookies.set(SESSION_COOKIE, value, { ...options, maxAge: SESSION_MAX_AGE });
		}
	}
}

export async function requestBackend(
	event: RequestEvent,
	path: string,
	options: { method?: string; body?: unknown } = {}
): Promise<Response> {
	const headers = new Headers();
	const session = event.cookies.get(SESSION_COOKIE);
	if (session) headers.set('cookie', `${SESSION_COOKIE}=${session}`);
	if (options.body !== undefined) headers.set('content-type', 'application/json');
	if (options.method && options.method !== 'GET') headers.set('origin', event.url.origin);

	let response: Response;
	try {
		response = await fetch(`${backendOrigin(event)}${path}`, {
			method: options.method ?? 'GET',
			headers,
			...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
		});
	} catch {
		throw new BackendError(502, 'DearDish services are temporarily unavailable. Please try again shortly.');
	}

	updateSessionCookie(event, event.cookies, response);
	return response;
}

export async function backendJson<T>(
	event: RequestEvent,
	path: string,
	options: { method?: string; body?: unknown } = {}
): Promise<T> {
	const response = await requestBackend(event, path, options);
	let payload: unknown;
	try {
		payload = response.status === 204 ? undefined : await response.json();
	} catch {
		throw new BackendError(502, 'DearDish services returned an unreadable response. Please try again shortly.');
	}

	if (!response.ok) {
		const result = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
		const fieldErrors = typeof result.errors === 'object' && result.errors !== null
			? Object.fromEntries(Object.entries(result.errors).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
			: {};
		const message = typeof result.error === 'string' ? result.error : 'DearDish services could not complete the request.';
		throw new BackendError(response.status, message, fieldErrors);
	}
	return payload as T;
}

export async function getSessionUser(event: RequestEvent): Promise<AuthUser | null> {
	const result = await backendJson<{ user: AuthUser | null }>(event, '/api/auth/session');
	return result.user;
}

export function throwBackendError(backendError: unknown): never {
	if (backendError instanceof BackendError) {
		if (backendError.status === 401) redirect(303, '/auth/login');
		error(backendError.status, backendError.message);
	}
	throw backendError;
}
