import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPhoto, setPhotoPublic, deletePhoto as deletePhotoDb } from '$lib/server/db';
import { deletePhoto as deletePhotoR2 } from '$lib/server/r2';
import { verifySession } from '$lib/server/auth';

async function requireAdmin(request: Request, env: App.Platform['env']): Promise<string> {
	const adminId = await verifySession(
		request.headers.get('cookie'),
		env.SESSION_SECRET ?? 'dev-secret'
	);
	if (!adminId) throw error(401, 'No autorizado');
	return adminId;
}

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	if (!platform) throw error(500);
	const env = platform.env;
	await requireAdmin(request, env);

	const photo = await getPhoto(env.DB, params.id);
	if (!photo) throw error(404);

	const body = await request.json() as { is_public: boolean };
	await setPhotoPublic(env.DB, params.id, body.is_public);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, request, platform }) => {
	if (!platform) throw error(500);
	const env = platform.env;
	await requireAdmin(request, env);

	const photo = await getPhoto(env.DB, params.id);
	if (!photo) throw error(404);

	await deletePhotoR2(env.BUCKET, photo.r2_key);
	await deletePhotoDb(env.DB, params.id);
	return json({ ok: true });
};
