import { redirect } from '@sveltejs/kit';
import { backendJson, throwBackendError } from '$lib/server/backend';
import type { Meal } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(303, '/auth/login');
	try {
		const { meals } = await backendJson<{ meals: Meal[] }>(event, '/api/meals');
		return { meals };
	} catch (error) {
		throwBackendError(error);
	}
};
