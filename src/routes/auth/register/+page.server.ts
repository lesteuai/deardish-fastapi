import { fail, redirect } from '@sveltejs/kit';
import { registerSchema, zodFieldErrors } from '$lib/schemas';
import { createSession, registerUser, setSessionCookie } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const values = {
			email: String(form.get('email') ?? ''),
			password: String(form.get('password') ?? ''),
			confirmPassword: String(form.get('confirmPassword') ?? '')
		};

		const parsed = registerSchema.safeParse(values);
		if (!parsed.success) {
			return fail(400, { errors: zodFieldErrors(parsed.error.issues), values });
		}

		if (parsed.data.password !== values.confirmPassword) {
			const errors: Record<string, string> = { confirmPassword: 'Passwords do not match' };
			return fail(400, { errors, values });
		}

		const result = await registerUser(parsed.data.email, parsed.data.password);
		if ('conflict' in result) {
			const errors: Record<string, string> = {
				email: 'An account with this email already exists'
			};
			return fail(400, { errors, values });
		}

		const token = await createSession(result.user.id);
		setSessionCookie(cookies, token);
		redirect(302, '/menu');
	}
};
