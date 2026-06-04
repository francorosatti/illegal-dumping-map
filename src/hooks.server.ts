import type { Handle } from '@sveltejs/kit';
import { verifySession } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	if (!event.platform) return resolve(event);

	const cookieHeader = event.request.headers.get('cookie');
	const sessionSecret = event.platform.env.SESSION_SECRET ?? 'dev-secret';
	const adminId = await verifySession(cookieHeader, sessionSecret);

	if (adminId) {
		event.locals.adminId = adminId;
	}

	return resolve(event);
};
