import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getReport, getPhotosByReport } from '$lib/server/db';
import { verifyUploaderToken } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, platform, request }) => {
	if (!platform) throw error(500);
	const env = platform.env;

	const report = await getReport(env.DB, params.id);
	if (!report || report.hidden) throw error(404);

	const cookieHeader = request.headers.get('cookie');
	const hmacSecret = env.HMAC_SECRET ?? 'dev-secret';
	const isUploader = await verifyUploaderToken(cookieHeader, params.id, report.created_at, hmacSecret);

	const photos = await getPhotosByReport(env.DB, params.id);

	return {
		report: {
			id: report.id,
			lat: report.lat,
			lng: report.lng,
			description: report.description,
			created_at: report.created_at,
		},
		photos: isUploader ? photos.map((p) => ({ id: p.id })) : [],
		isUploader,
	};
};
