import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent, locals }) => {
	const { user } = (await parent()) as { user: App.Locals['user'] };
	if (!user) redirect(302, '/auth/login');
	locals.user = user;
	return { user };
};
