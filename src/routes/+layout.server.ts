import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
	const token = cookies.get(SESSION_COOKIE);
	const user = token ? await validateSession(token) : null;
	locals.user = user;
	return { user };
};
