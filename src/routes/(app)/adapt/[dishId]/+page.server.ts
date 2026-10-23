import { redirect } from '@sveltejs/kit';
import { backendJson, throwBackendError } from '$lib/server/backend';
import type { DishDetail } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(303, '/auth/login');
	try {
		const { dish } = await backendJson<{ dish: DishDetail }>(event, `/api/dishes/${event.params.dishId}`);
		return { dish };
	} catch (error) {
		throwBackendError(error);
	}
};
