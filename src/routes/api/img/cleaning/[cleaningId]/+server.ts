import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCleaningReport } from '$lib/server/db';
import { getPhoto as getPhotoR2 } from '$lib/server/r2';
import { verifySession } from '$lib/server/auth';

export const GET: RequestHandler = async ({ params, platform, request }) => {
	if (!platform) throw error(500, 'Platform unavailable');
	const env = platform.env;

	const cleaning = await getCleaningReport(env.DB, params.cleaningId);
	if (!cleaning) throw error(404, 'No encontrado');

	const cookieHeader = request.headers.get('cookie');
	const sessionSecret = env.SESSION_SECRET ?? 'dev-secret';

	let authorized = false;
	let cacheControl = 'private, no-store';

	if (cleaning.is_photo_public === 1) {
		authorized = true;
		cacheControl = 'public, max-age=31536000, immutable';
	} else {
		const adminId = await verifySession(cookieHeader, sessionSecret);
		if (adminId) authorized = true;
	}

	if (!authorized) throw error(403, 'No autorizado');

	const obj = await getPhotoR2(env.BUCKET, cleaning.r2_key);
	if (!obj) throw error(404, 'Imagen no encontrada');

	return new Response(obj.body, {
		headers: {
			'Content-Type': obj.contentType,
			'Content-Length': String(obj.size),
			'Cache-Control': cacheControl,
		},
	});
};
