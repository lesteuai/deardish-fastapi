import { getSessionUser, SESSION_COOKIE } from '$lib/server/backend';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	if (!event.cookies.get(SESSION_COOKIE)) {
		event.locals.user = null;
		return resolve(event);
	}

	try {
		event.locals.user = await getSessionUser(event);
	} catch {
		event.locals.user = null;
	}
	return resolve(event);
};
