import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { adaptRequestSchema } from '$lib/schemas';
import { createAdaptationResponse } from '$lib/server/ai/adapt';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { dishes } from '$lib/server/db/schema';
import { getProfile } from '$lib/server/profile';
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
		return json({ error: 'A valid dishId is required' }, { status: 400 });
	}

	const parsed = adaptRequestSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: 'A valid dishId is required' }, { status: 400 });
	}

	const [dish] = await db.select().from(dishes).where(eq(dishes.id, parsed.data.dishId)).limit(1);
	if (!dish) {
		return json({ error: 'Dish not found' }, { status: 404 });
	}

	const profile = await getProfile(user.id);
	return createAdaptationResponse(dish, profile);
};
