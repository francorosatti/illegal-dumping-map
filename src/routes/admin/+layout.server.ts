import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isLoginPage = url.pathname === '/admin/login';
	if (!locals.adminId && !isLoginPage) {
		throw redirect(303, '/admin/login');
	}
	if (locals.adminId && isLoginPage) {
		throw redirect(303, '/admin');
	}
	return { adminId: locals.adminId };
};
