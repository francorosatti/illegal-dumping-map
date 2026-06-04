import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPhoto as getPhotoMeta, getReport } from '$lib/server/db';
import { getPhoto as getPhotoR2 } from '$lib/server/r2';
import { verifySession, verifyUploaderToken } from '$lib/server/auth';

export const GET: RequestHandler = async ({ params, platform, request }) => {
	if (!platform) throw error(500, 'Platform unavailable');
	const env = platform.env;

	const photo = await getPhotoMeta(env.DB, params.photoId);
	if (!photo) throw error(404, 'Foto no encontrada');

	const cookieHeader = request.headers.get('cookie');
	const sessionSecret = env.SESSION_SECRET ?? 'dev-secret';
	const hmacSecret = env.HMAC_SECRET ?? 'dev-secret';

	let authorized = false;
	let cacheControl = 'private, no-store';

	if (photo.is_public === 1) {
		authorized = true;
		cacheControl = 'public, max-age=31536000, immutable';
	} else {
		// Admin session
		const adminId = await verifySession(cookieHeader, sessionSecret);
		if (adminId) {
			authorized = true;
		} else {
			// Uploader token
			const report = await getReport(env.DB, photo.report_id);
			if (report) {
				authorized = await verifyUploaderToken(
					cookieHeader,
					photo.report_id,
					report.created_at,
					hmacSecret
				);
			}
		}
	}

	if (!authorized) throw error(403, 'No autorizado');

	const obj = await getPhotoR2(env.BUCKET, photo.r2_key);
	if (!obj) throw error(404, 'Imagen no encontrada');

	return new Response(obj.body, {
		headers: {
			'Content-Type': obj.contentType,
			'Content-Length': String(obj.size),
			'Cache-Control': cacheControl,
		},
	});
};
