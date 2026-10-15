import { json } from '@sveltejs/kit';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { deleteMeal } from '$lib/server/meals';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const token = cookies.get(SESSION_COOKIE);
	const user = token ? await validateSession(token) : null;
	if (!user) {
		return json({ error: 'Sign in required' }, { status: 401 });
	}

	const result = await deleteMeal(user.id, params.id);
	if (!result.ok) {
		return json({ error: 'Meal not found' }, { status: 404 });
	}

	return new Response(null, { status: 204 });
};
