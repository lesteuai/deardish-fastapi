import { fail, redirect } from '@sveltejs/kit';
import { getProfile, saveProfile } from '$lib/server/profile';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { profile: await getProfile(locals.user!.id) };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const values = {
			conditions: String(form.get('conditions') ?? ''),
			allergies: String(form.get('allergies') ?? ''),
			dietaryPreferences: String(form.get('dietaryPreferences') ?? ''),
			notes: String(form.get('notes') ?? '')
		};

		const result = await saveProfile(locals.user!.id, values);
		if (!result.ok) {
			return fail(400, { errors: result.errors, values });
		}

		redirect(302, '/profile');
	}
};
