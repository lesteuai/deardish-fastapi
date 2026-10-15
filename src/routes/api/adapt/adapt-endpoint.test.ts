import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.hoisted(() => ({ validateSession: vi.fn() }));
vi.mock('$lib/server/auth', () => ({
	...authMock,
	SESSION_COOKIE: 'deardish_session'
}));

const profileMock = vi.hoisted(() => ({ getProfile: vi.fn() }));
vi.mock('$lib/server/profile', () => ({ ...profileMock }));

const serviceMock = vi.hoisted(() => ({ createAdaptationResponse: vi.fn() }));
vi.mock('$lib/server/ai/adapt', () => ({ ...serviceMock }));

const dbMock = vi.hoisted(() => {
	const limit = vi.fn();
	const makeChain = () => {
		const chain: Record<string, unknown> = { limit };
		chain.where = vi.fn(() => chain);
		return chain;
	};
	const db = { select: vi.fn(() => ({ from: vi.fn(() => makeChain()) })) };
	return { db, limit };
});
vi.mock('$lib/server/db', () => ({ db: dbMock.db }));

import { POST } from './+server';

const user = { id: 'user-1', email: 'chef@example.com' };
const dish = {
	id: '123e4567-e89b-12d3-a456-426614174000',
	name: 'Miso Glazed Salmon',
	cuisine: 'Japanese',
	description: 'Sweet and savory roasted salmon.',
	ingredients: ['salmon', 'miso', 'mirin']
};
const profile = {
	conditions: 'hypertension',
	allergies: '',
	dietaryPreferences: 'low sodium',
	notes: ''
};

type CookieStub = { get: ReturnType<typeof vi.fn> };

function makeEvent(options: { cookie?: string; rawBody?: string }): {
	request: Request;
	cookies: CookieStub;
} {
	return {
		request: new Request('http://localhost/api/adapt', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: options.rawBody ?? JSON.stringify({ dishId: dish.id })
		}),
		cookies: { get: vi.fn(() => options.cookie) }
	};
}

async function bodyJson(response: Response): Promise<{ error?: string }> {
	return (await response.json()) as { error?: string };
}

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.limit.mockResolvedValue([]);
});

describe('POST /api/adapt', () => {
	it('returns 401 JSON when no session cookie is present and never validates', async () => {
		const event = makeEvent({});

		const response = await POST(event as never);

		expect(response.status).toBe(401);
		expect(await bodyJson(response)).toEqual({ error: 'Sign in required' });
		expect(authMock.validateSession).not.toHaveBeenCalled();
		expect(dbMock.db.select).not.toHaveBeenCalled();
		expect(serviceMock.createAdaptationResponse).not.toHaveBeenCalled();
	});

	it('returns 401 JSON when the session token is invalid', async () => {
		authMock.validateSession.mockResolvedValue(null);
		const event = makeEvent({ cookie: 'stale-token' });

		const response = await POST(event as never);

		expect(response.status).toBe(401);
		expect(await bodyJson(response)).toEqual({ error: 'Sign in required' });
		expect(authMock.validateSession).toHaveBeenCalledWith('stale-token');
		expect(dbMock.db.select).not.toHaveBeenCalled();
	});

	it('returns 400 JSON for a malformed JSON body', async () => {
		authMock.validateSession.mockResolvedValue(user);
		const event = makeEvent({ cookie: 'good-token', rawBody: 'not json at all' });

		const response = await POST(event as never);

		expect(response.status).toBe(400);
		expect(await bodyJson(response)).toEqual({ error: 'A valid dishId is required' });
		expect(dbMock.db.select).not.toHaveBeenCalled();
	});

	it('returns 400 JSON when dishId is missing', async () => {
		authMock.validateSession.mockResolvedValue(user);
		const event = makeEvent({ cookie: 'good-token', rawBody: JSON.stringify({}) });

		const response = await POST(event as never);

		expect(response.status).toBe(400);
		expect(await bodyJson(response)).toEqual({ error: 'A valid dishId is required' });
		expect(dbMock.db.select).not.toHaveBeenCalled();
	});

	it('returns 400 JSON when dishId is not a uuid', async () => {
		authMock.validateSession.mockResolvedValue(user);
		const event = makeEvent({
			cookie: 'good-token',
			rawBody: JSON.stringify({ dishId: 'not-a-uuid' })
		});

		const response = await POST(event as never);

		expect(response.status).toBe(400);
		expect(await bodyJson(response)).toEqual({ error: 'A valid dishId is required' });
		expect(dbMock.db.select).not.toHaveBeenCalled();
	});

	it('returns 404 JSON when the dish lookup finds no row', async () => {
		authMock.validateSession.mockResolvedValue(user);
		dbMock.limit.mockResolvedValueOnce([]);
		const event = makeEvent({ cookie: 'good-token' });

		const response = await POST(event as never);

		expect(response.status).toBe(404);
		expect(await bodyJson(response)).toEqual({ error: 'Dish not found' });
		expect(profileMock.getProfile).not.toHaveBeenCalled();
		expect(serviceMock.createAdaptationResponse).not.toHaveBeenCalled();
	});

	it('delegates to the adaptation service with the loaded dish and profile', async () => {
		authMock.validateSession.mockResolvedValue(user);
		profileMock.getProfile.mockResolvedValue(profile);
		dbMock.limit.mockResolvedValueOnce([dish]);
		const fakeResponse = new Response('Miso Glazed Salmon adapted', {
			status: 200,
			headers: { 'content-type': 'text/plain' }
		});
		serviceMock.createAdaptationResponse.mockResolvedValue(fakeResponse);
		const event = makeEvent({ cookie: 'good-token' });

		const response = await POST(event as never);

		expect(response).toBe(fakeResponse);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/plain');
		expect(profileMock.getProfile).toHaveBeenCalledWith(user.id);
		expect(serviceMock.createAdaptationResponse).toHaveBeenCalledWith(dish, profile);
	});
});
