import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { dishes } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	if (!z.uuid().safeParse(params.id).success) {
		error(400, 'Invalid dish id');
	}

	const [dish] = await db.select().from(dishes).where(eq(dishes.id, params.id)).limit(1);
	if (!dish) {
		error(404, 'Dish not found');
	}

	return { dish };
};
