import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exportAllReports } from '$lib/server/db';
import { rowsToCsv } from '$lib/server/csv';
import { verifySession } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request, platform }) => {
	if (!platform) throw error(500);
	const env = platform.env;

	const adminId = await verifySession(
		request.headers.get('cookie'),
		env.SESSION_SECRET ?? 'dev-secret'
	);
	if (!adminId) throw error(401, 'No autorizado');

	const rows = await exportAllReports(env.DB);
	const csv = rowsToCsv(rows);

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': 'attachment; filename="reportes.csv"',
		},
	});
};
