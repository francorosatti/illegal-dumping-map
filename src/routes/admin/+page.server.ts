import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { listReports, getPhotosByReport } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.adminId) throw redirect(303, '/admin/login');
	if (!platform) return { reports: [] };

	const reports = await listReports(platform.env.DB, { limit: 50 });
	const withPhotos = await Promise.all(
		reports.map(async (r) => ({
			...r,
			photos: await getPhotosByReport(platform.env.DB, r.id),
		}))
	);

	return { reports: withPhotos };
};
