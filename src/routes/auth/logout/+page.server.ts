import { redirect } from '@sveltejs/kit';
import { backendJson, throwBackendError } from '$lib/server/backend';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async (event) => {
		try {
			await backendJson<void>(event, '/api/auth/logout', { method: 'POST' });
		} catch (error) {
			throwBackendError(error);
		}
		redirect(302, '/');
	}
};
