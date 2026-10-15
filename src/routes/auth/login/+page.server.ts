import { fail, redirect } from '@sveltejs/kit';
import { loginSchema, zodFieldErrors } from '$lib/schemas';
import { authenticate, createSession, setSessionCookie } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const values = {
			email: String(form.get('email') ?? ''),
			password: String(form.get('password') ?? '')
		};

		const parsed = loginSchema.safeParse(values);
		if (!parsed.success) {
			return fail(400, { errors: zodFieldErrors(parsed.error.issues), values });
		}

		const user = await authenticate(parsed.data.email, parsed.data.password);
		if (!user) {
			const errors: Record<string, string> = { form: 'Invalid email or password' };
			return fail(400, { errors, values });
		}

		const token = await createSession(user.id);
		setSessionCookie(cookies, token);
		redirect(302, '/menu');
	}
};
