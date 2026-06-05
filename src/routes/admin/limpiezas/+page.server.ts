import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { listPendingCleaningReports, getPhotosByReport } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.adminId) throw redirect(303, '/admin/login');
	if (!platform) return { cleanings: [] };

	const rows = await listPendingCleaningReports(platform.env.DB);
	const withPhotos = await Promise.all(
		rows.map(async (cr) => ({
			...cr,
			report: {
				...cr.report,
				photos: (await getPhotosByReport(platform.env.DB, cr.report.id)).filter(
					(p) => p.is_public === 1
				),
			},
		}))
	);

	return { cleanings: withPhotos };
};
