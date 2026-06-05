import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { listPendingCleaningReports, getPhotosByReport } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.adminId) throw redirect(303, '/admin/login');
	if (!platform) return { groups: [] };

	const groups = await listPendingCleaningReports(platform.env.DB);
	const withPhotos = await Promise.all(
		groups.map(async (g) => ({
			...g,
			report: {
				...g.report,
				photos: (await getPhotosByReport(platform.env.DB, g.report.id)).filter(
					(p) => p.is_public === 1
				),
			},
		}))
	);

	return { groups: withPhotos };
};
