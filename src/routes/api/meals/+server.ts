import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { saveMeal } from '$lib/server/meals';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get(SESSION_COOKIE);
	const user = token ? await validateSession(token) : null;
	if (!user) {
		return json({ error: 'Sign in required' }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const record = (body ?? {}) as Record<string, unknown>;
	const sourceDishId =
		typeof record.sourceDishId === 'string' && z.uuid().safeParse(record.sourceDishId).success
			? record.sourceDishId
			: null;

	const result = await saveMeal(user.id, body, sourceDishId);
	if (!result.ok) {
		const first = Object.values(result.errors)[0];
		return json({ error: first, errors: result.errors }, { status: 400 });
	}

	return json({ id: result.id }, { status: 201 });
};
