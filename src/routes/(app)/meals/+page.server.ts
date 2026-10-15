import { listMeals } from '$lib/server/meals';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { meals: await listMeals(locals.user!.id) };
};
