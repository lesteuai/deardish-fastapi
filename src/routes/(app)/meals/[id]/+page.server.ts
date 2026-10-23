import { redirect } from '@sveltejs/kit';
import { backendJson, throwBackendError } from '$lib/server/backend';
import type { Meal } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(303, '/auth/login');
	try {
		const { meal } = await backendJson<{ meal: Meal }>(event, `/api/meals/${event.params.id}`);
		return { meal };
	} catch (backendError) {
		throwBackendError(backendError);
	}
};
