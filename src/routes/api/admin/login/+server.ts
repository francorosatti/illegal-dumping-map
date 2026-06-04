import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAdminByEmail } from '$lib/server/db';
import { verifyPassword, createSessionCookie } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform) return json({ error: 'unavailable' }, { status: 500 });
	const env = platform.env;

	let body: { email: string; password: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'invalid' }, { status: 400 });
	}

	const admin = await getAdminByEmail(env.DB, body.email?.trim() ?? '');
	if (!admin) return json({ error: 'credentials' }, { status: 401 });

	const ok = await verifyPassword(body.password, admin.password_hash);
	if (!ok) return json({ error: 'credentials' }, { status: 401 });

	const sessionSecret = env.SESSION_SECRET ?? 'dev-secret';
	const cookie = await createSessionCookie(admin.id, sessionSecret);

	return json(
		{ ok: true },
		{
			headers: { 'Set-Cookie': cookie },
		}
	);
};
