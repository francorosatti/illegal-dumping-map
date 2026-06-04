import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getReport,
	getPhotosByReport,
	updateReportStatus,
	approveDescription,
	hideReport,
	mergeReports,
	deletePhotosByReports,
	type ReportStatus,
} from '$lib/server/db';
import { deletePhotos } from '$lib/server/r2';
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

	const report = await getReport(env.DB, params.id);
	if (!report) throw error(404, 'Reporte no encontrado');

	const body = await request.json() as Record<string, unknown>;

	if ('status' in body) {
		const s = body.status as ReportStatus;
		if (!['reported', 'confirmed', 'cleaned'].includes(s)) throw error(400, 'Estado inválido');
		await updateReportStatus(env.DB, params.id, s);
	}

	if ('description_approved' in body) {
		await approveDescription(env.DB, params.id, Boolean(body.description_approved));
	}

	if ('merge_into' in body && typeof body.merge_into === 'string') {
		const target = await getReport(env.DB, body.merge_into);
		if (!target) throw error(404, 'Reporte destino no encontrado');
		await mergeReports(env.DB, params.id, body.merge_into);
	}

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, request, platform }) => {
	if (!platform) throw error(500);
	const env = platform.env;
	await requireAdmin(request, env);

	const report = await getReport(env.DB, params.id);
	if (!report) throw error(404);

	const photos = await getPhotosByReport(env.DB, params.id);
	await deletePhotos(env.BUCKET, photos.map((p) => p.r2_key));
	await deletePhotosByReports(env.DB, [params.id]);
	await hideReport(env.DB, params.id);

	return json({ ok: true });
};
