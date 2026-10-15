import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { dishes } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const items = await db
		.select({
			id: dishes.id,
			name: dishes.name,
			cuisine: dishes.cuisine,
			description: dishes.description
		})
		.from(dishes)
		.orderBy(asc(dishes.name));

	return { dishes: items };
};
