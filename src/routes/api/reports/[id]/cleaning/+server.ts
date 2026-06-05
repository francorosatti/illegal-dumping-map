import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPublicReportDetail, getPendingCleaningByReport, insertCleaningReport } from '$lib/server/db';
import { uploadPhoto, isAllowedPhotoType, isWithinSizeCap } from '$lib/server/r2';
import { verifyTurnstile } from '$lib/server/turnstile';
import { checkCleaningRateLimit } from '$lib/server/ratelimit';

export const POST: RequestHandler = async ({ params, request, platform }) => {
	if (!platform) throw error(500, 'Platform unavailable');
	const env = platform.env;

	const ip =
		request.headers.get('cf-connecting-ip') ??
		request.headers.get('x-forwarded-for') ??
		'unknown';

	const allowed = await checkCleaningRateLimit(env.KV, ip);
	if (!allowed) {
		return json({ error: 'rate_limit' }, { status: 429 });
	}

	const report = await getPublicReportDetail(env.DB, params.id);
	if (!report) throw error(404, 'Reporte no encontrado');

	if (report.status !== 'confirmed') {
		return json({ error: 'not_confirmed' }, { status: 422 });
	}

	const pending = await getPendingCleaningByReport(env.DB, params.id);
	if (pending) {
		return json({ error: 'already_pending' }, { status: 409 });
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		throw error(400, 'Invalid form data');
	}

	const turnstileToken = formData.get('turnstileToken');
	if (typeof turnstileToken !== 'string') {
		return json({ error: 'turnstile' }, { status: 403 });
	}

	const photo = formData.get('photo');
	if (!(photo instanceof File) || photo.size === 0) {
		return json({ error: 'photo_required' }, { status: 422 });
	}

	const turnstileSecret = env.TURNSTILE_SECRET ?? '1x0000000000000000000000000000000AA';
	const valid = await verifyTurnstile(turnstileToken, turnstileSecret);
	if (!valid) {
		return json({ error: 'turnstile' }, { status: 403 });
	}

	if (!isAllowedPhotoType(photo.type)) {
		return json({ error: 'invalid_type' }, { status: 422 });
	}
	if (!isWithinSizeCap(photo.size)) {
		return json({ error: 'too_large' }, { status: 422 });
	}

	const id = crypto.randomUUID();
	const r2Key = `cleaning/${id}/${id}`;
	const buffer = await photo.arrayBuffer();
	await uploadPhoto(env.BUCKET, r2Key, buffer, photo.type);

	await insertCleaningReport(env.DB, {
		id,
		report_id: params.id,
		r2_key: r2Key,
		is_photo_public: 0,
		reviewed_at: null,
		rejected: 0,
		created_at: new Date().toISOString(),
	});

	return json({ ok: true });
};
