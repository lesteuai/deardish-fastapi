import { redirect } from '@sveltejs/kit';
import { backendJson, throwBackendError } from '$lib/server/backend';
import type { DishSummary } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(303, '/auth/login');
	try {
		const { dishes } = await backendJson<{ dishes: DishSummary[] }>(event, '/api/dishes');
		return { dishes };
	} catch (error) {
		throwBackendError(error);
	}
};
