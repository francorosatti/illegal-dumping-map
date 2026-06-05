import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listPendingCleaningReports, getPhotosByReport } from '$lib/server/db';
import { verifySession } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request, platform }) => {
	if (!platform) throw error(500, 'Platform unavailable');
	const env = platform.env;

	const adminId = await verifySession(request.headers.get('cookie'), env.SESSION_SECRET ?? 'dev-secret');
	if (!adminId) throw error(401, 'No autorizado');

	const rows = await listPendingCleaningReports(env.DB);
	const withPhotos = await Promise.all(
		rows.map(async (cr) => ({
			...cr,
			report: {
				...cr.report,
				photos: (await getPhotosByReport(env.DB, cr.report.id)).filter((p) => p.is_public === 1),
			},
		}))
	);

	return json(withPhotos);
};
