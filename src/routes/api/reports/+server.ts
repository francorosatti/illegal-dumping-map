import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isInArea } from '$lib/server/area';
import { verifyTurnstile } from '$lib/server/turnstile';
import { checkReportRateLimit } from '$lib/server/ratelimit';
import { insertReport } from '$lib/server/db';
import { createUploaderCookie } from '$lib/server/auth';
import { CITY } from '$lib/config/city';

function uuid(): string {
	return crypto.randomUUID();
}

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform) throw error(500, 'Platform unavailable');
	const env = platform.env;

	const ip =
		request.headers.get('cf-connecting-ip') ??
		request.headers.get('x-forwarded-for') ??
		'unknown';

	const allowed = await checkReportRateLimit(env.KV, ip);
	if (!allowed) {
		return json({ error: 'rate_limit' }, { status: 429 });
	}

	let body: { lat: number; lng: number; description?: string; turnstileToken: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { lat, lng, description, turnstileToken } = body;

	if (typeof lat !== 'number' || typeof lng !== 'number') {
		throw error(400, 'lat/lng requeridos');
	}

	if (!isInArea(lat, lng)) {
		return json(
			{ error: 'outside_area', message: `El punto está fuera del área de ${CITY.name}.` },
			{ status: 422 }
		);
	}

	const turnstileSecret =
		env.TURNSTILE_SECRET ?? '1x0000000000000000000000000000000AA';
	const valid = await verifyTurnstile(turnstileToken ?? '', turnstileSecret);
	if (!valid) {
		return json({ error: 'turnstile' }, { status: 403 });
	}

	const reportId = uuid();
	const createdAt = new Date().toISOString();

	await insertReport(env.DB, {
		id: reportId,
		lat,
		lng,
		description: description?.trim() || null,
		description_approved: 0,
		status: 'reported',
		hidden: 0,
		reviewed_at: null,
		merged_into: null,
		created_at: createdAt,
	});

	const hmacSecret = env.HMAC_SECRET ?? 'dev-secret';
	const uploaderCookie = await createUploaderCookie(reportId, createdAt, hmacSecret);

	return json(
		{ id: reportId, createdAt },
		{
			headers: {
				'Set-Cookie': uploaderCookie,
			},
		}
	);
};
