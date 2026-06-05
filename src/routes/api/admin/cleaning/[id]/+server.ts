import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCleaningReport, reviewCleaningReport } from '$lib/server/db';
import { verifySession } from '$lib/server/auth';

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	if (!platform) throw error(500, 'Platform unavailable');
	const env = platform.env;

	const adminId = await verifySession(request.headers.get('cookie'), env.SESSION_SECRET ?? 'dev-secret');
	if (!adminId) throw error(401, 'No autorizado');

	let body: { approved: boolean };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const cleaning = await getCleaningReport(env.DB, params.id);
	if (!cleaning) throw error(404, 'No encontrado');

	await reviewCleaningReport(env.DB, params.id, cleaning.report_id, body.approved);

	return json({ ok: true });
};
