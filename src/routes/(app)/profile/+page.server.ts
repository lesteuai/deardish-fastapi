import { fail, redirect } from '@sveltejs/kit';
import { BackendError, backendJson, throwBackendError } from '$lib/server/backend';
import type { HealthProfile } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(303, '/auth/login');
	try {
		const { profile } = await backendJson<{ profile: HealthProfile }>(event, '/api/profile');
		return { email: event.locals.user.email, profile };
	} catch (error) {
		throwBackendError(error);
	}
};

export const actions: Actions = {
	default: async (event) => {
		if (!event.locals.user) redirect(303, '/auth/login');
		const form = await event.request.formData();
		const values: HealthProfile = {
			conditions: String(form.get('conditions') ?? ''),
			allergies: String(form.get('allergies') ?? ''),
			dietaryPreferences: String(form.get('dietaryPreferences') ?? ''),
			notes: String(form.get('notes') ?? '')
		};

		try {
			await backendJson<{ profile: HealthProfile }>(event, '/api/profile', {
				method: 'PUT',
				body: values
			});
		} catch (error) {
			const backendError = error instanceof BackendError ? error : new BackendError(502, 'DearDish services are temporarily unavailable. Please try again shortly.');
			const errors: { conditions?: string; allergies?: string; dietaryPreferences?: string; notes?: string; form?: string } = {
				...backendError.fieldErrors
			};
			if (Object.keys(backendError.fieldErrors).length === 0) errors.form = backendError.message;
			return fail(backendError.status === 400 ? 400 : 502, {
				errors,
				values
			});
		}

		return { saved: true, values };
	}
};
