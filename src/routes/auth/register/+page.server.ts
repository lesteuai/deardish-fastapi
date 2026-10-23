import { fail, redirect } from '@sveltejs/kit';
import { BackendError, backendJson } from '$lib/server/backend';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const credentials = {
			email: String(form.get('email') ?? ''),
			password: String(form.get('password') ?? ''),
			confirmPassword: String(form.get('confirmPassword') ?? '')
		};
		try {
			await backendJson<{ user: { id: string; email: string } }>(event, '/api/auth/register', {
				method: 'POST',
				body: credentials
			});
		} catch (error) {
			const backendError = error instanceof BackendError ? error : new BackendError(502, 'DearDish services are temporarily unavailable. Please try again shortly.');
			const errors = backendError.fieldErrors;
			if (backendError.status >= 500 || Object.keys(errors).length === 0) errors.form = backendError.message;
			return fail(backendError.status >= 500 ? 502 : 400, {
				errors,
				values: { email: credentials.email }
			});
		}

		redirect(302, '/menu');
	}
};
