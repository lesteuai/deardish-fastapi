import { error } from '@sveltejs/kit';
import { getMeal } from '$lib/server/meals';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const meal = await getMeal(locals.user!.id, params.id);
	if (!meal) {
		error(404, 'Meal not found');
	}

	return { meal };
};
