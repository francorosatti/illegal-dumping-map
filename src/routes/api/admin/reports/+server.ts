import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listReports, getPhotosByReport } from '$lib/server/db';
import { verifySession } from '$lib/server/auth';

export const GET: RequestHandler = async ({ url, platform, request }) => {
	if (!platform) throw error(500);
	const env = platform.env;

	const adminId = await verifySession(
		request.headers.get('cookie'),
		env.SESSION_SECRET ?? 'dev-secret'
	);
	if (!adminId) throw error(401, 'No autorizado');

	const unreviewed = url.searchParams.get('unreviewed') === '1';
	const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100);
	const offset = parseInt(url.searchParams.get('offset') ?? '0');

	const reports = await listReports(env.DB, { unreviewed, limit, offset });

	// Attach photo lists
	const withPhotos = await Promise.all(
		reports.map(async (r) => ({
			...r,
			photos: await getPhotosByReport(env.DB, r.id),
		}))
	);

	return json(withPhotos);
};
