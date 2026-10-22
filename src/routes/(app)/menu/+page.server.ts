import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { dishes, images } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const items = await db
		.select({
			id: dishes.id,
			name: dishes.name,
			cuisine: dishes.cuisine,
			description: dishes.description,
			image: images.location
		})
		.from(dishes)
		.leftJoin(images, eq(dishes.imageId, images.id))
		.orderBy(asc(dishes.name));

	return { dishes: items };
};
