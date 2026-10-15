import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.hoisted(() => ({ validateSession: vi.fn() }));
const mealsMock = vi.hoisted(() => ({ saveMeal: vi.fn(), deleteMeal: vi.fn() }));

vi.mock('$lib/server/auth', () => ({ ...authMock, SESSION_COOKIE: 'deardish_session' }));
vi.mock('$lib/server/meals', () => mealsMock);

import { POST } from './+server';
import { DELETE } from './[id]/+server';

const user = { id: 'user-1', email: 'chef@example.com' };
const mealId = '22222222-2222-4222-8222-222222222222';
const dishId = '33333333-3333-4333-8333-333333333333';

type EventOverrides = {
	session?: string;
	body?: unknown;
	params?: Record<string, string>;
};

function makeEvent({ session, body, params }: EventOverrides) {
	return {
		cookies: { get: vi.fn(() => session) },
		request: { json: vi.fn(async () => body) },
		params: params ?? {}
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	authMock.validateSession.mockResolvedValue(user);
});

describe('POST /api/meals', () => {
	it('returns 401 when there is no session', async () => {
		const response = await POST(makeEvent({ body: { title: 'T', content: 'C' } }) as never);

		expect(response.status).toBe(401);
		expect(((await response.json()) as { error?: unknown }).error).toBeTruthy();
		expect(authMock.validateSession).not.toHaveBeenCalled();
		expect(mealsMock.saveMeal).not.toHaveBeenCalled();
	});

	it('returns 400 with field errors when the meal is invalid', async () => {
		mealsMock.saveMeal.mockResolvedValue({
			ok: false,
			errors: { title: 'Title is required' }
		});

		const body = { title: '', content: '' };
		const response = await POST(makeEvent({ session: 'token', body }) as never);

		expect(response.status).toBe(400);
		const payload = (await response.json()) as { error?: unknown; errors?: Record<string, string> };
		expect(payload.error).toBe('Title is required');
		expect(payload.errors?.title).toBe('Title is required');
		expect(mealsMock.saveMeal).toHaveBeenCalledWith(user.id, body, null);
	});

	it('returns 201 with the new meal id on success', async () => {
		mealsMock.saveMeal.mockResolvedValue({ ok: true, id: mealId });

		const response = await POST(
			makeEvent({ session: 'token', body: { title: 'Paneer', content: 'Curry.' } }) as never
		);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ id: mealId });
	});

	it('passes a valid source dish id through to the service', async () => {
		mealsMock.saveMeal.mockResolvedValue({ ok: true, id: mealId });

		await POST(
			makeEvent({
				session: 'token',
				body: { title: 'Paneer', content: 'Curry.', sourceDishId: dishId }
			}) as never
		);

		expect(mealsMock.saveMeal).toHaveBeenCalledWith(
			user.id,
			expect.objectContaining({ sourceDishId: dishId }),
			dishId
		);
	});

	it('ignores a malformed source dish id', async () => {
		mealsMock.saveMeal.mockResolvedValue({ ok: true, id: mealId });

		await POST(
			makeEvent({
				session: 'token',
				body: { title: 'Paneer', content: 'Curry.', sourceDishId: 'not-a-uuid' }
			}) as never
		);

		expect(mealsMock.saveMeal).toHaveBeenCalledWith(
			user.id,
			expect.objectContaining({ sourceDishId: 'not-a-uuid' }),
			null
		);
	});
});

describe('DELETE /api/meals/[id]', () => {
	it('returns 401 when there is no session', async () => {
		const response = await DELETE(makeEvent({ params: { id: mealId } }) as never);

		expect(response.status).toBe(401);
		expect(((await response.json()) as { error?: unknown }).error).toBeTruthy();
		expect(mealsMock.deleteMeal).not.toHaveBeenCalled();
	});

	it('returns 404 when nothing was deleted for this user', async () => {
		mealsMock.deleteMeal.mockResolvedValue({ ok: false });

		const response = await DELETE(
			makeEvent({ session: 'token', params: { id: mealId } }) as never
		);

		expect(response.status).toBe(404);
		expect(((await response.json()) as { error?: unknown }).error).toBeTruthy();
		expect(mealsMock.deleteMeal).toHaveBeenCalledWith(user.id, mealId);
	});

	it('returns 204 with no body on success', async () => {
		mealsMock.deleteMeal.mockResolvedValue({ ok: true });

		const response = await DELETE(
			makeEvent({ session: 'token', params: { id: mealId } }) as never
		);

		expect(response.status).toBe(204);
		expect(await response.text()).toBe('');
	});
});
