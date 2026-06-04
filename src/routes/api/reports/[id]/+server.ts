import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPublicReportDetail, getPhotosByReport } from '$lib/server/db';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform) throw error(500);
	const env = platform.env;

	const report = await getPublicReportDetail(env.DB, params.id);
	if (!report) throw error(404, 'Reporte no encontrado');

	const allPhotos = await getPhotosByReport(env.DB, params.id);
	const publicPhotos = allPhotos
		.filter((p) => p.is_public === 1)
		.map((p) => ({ id: p.id, bytes: p.bytes }));

	return json({
		id: report.id,
		lat: report.lat,
		lng: report.lng,
		status: report.status,
		created_at: report.created_at,
		description: report.description_approved ? report.description : null,
		photos: publicPhotos,
	});
};
