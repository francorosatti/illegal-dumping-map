import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getReport, countPhotosByReport, insertPhoto } from '$lib/server/db';
import { uploadPhoto, isAllowedPhotoType, isWithinSizeCap } from '$lib/server/r2';
import { verifyUploaderToken } from '$lib/server/auth';
import { checkPhotoRateLimit } from '$lib/server/ratelimit';

const MAX_PHOTOS = 5;

export const POST: RequestHandler = async ({ request, platform, params }) => {
	if (!platform) throw error(500, 'Platform unavailable');
	const env = platform.env;
	const { id: reportId } = params;

	const ip =
		request.headers.get('cf-connecting-ip') ??
		request.headers.get('x-forwarded-for') ??
		'unknown';

	const allowed = await checkPhotoRateLimit(env.KV, ip);
	if (!allowed) {
		return json({ error: 'rate_limit' }, { status: 429 });
	}

	const report = await getReport(env.DB, reportId);
	if (!report) throw error(404, 'Reporte no encontrado');

	// Verify uploader token
	const cookieHeader = request.headers.get('cookie');
	const hmacSecret = env.HMAC_SECRET ?? 'dev-secret';
	const isUploader = await verifyUploaderToken(
		cookieHeader,
		reportId,
		report.created_at,
		hmacSecret
	);
	if (!isUploader) throw error(403, 'No autorizado');

	const count = await countPhotosByReport(env.DB, reportId);
	if (count >= MAX_PHOTOS) {
		return json({ error: 'max_photos' }, { status: 422 });
	}

	const formData = await request.formData();
	const file = formData.get('photo');
	if (!(file instanceof File)) throw error(400, 'Foto requerida');

	const contentType = file.type || 'application/octet-stream';
	if (!isAllowedPhotoType(contentType)) {
		return json({ error: 'invalid_type' }, { status: 422 });
	}

	const buffer = await file.arrayBuffer();
	if (!isWithinSizeCap(buffer.byteLength)) {
		return json({ error: 'too_large' }, { status: 422 });
	}

	const photoId = crypto.randomUUID();
	const r2Key = `photos/${reportId}/${photoId}`;
	const createdAt = new Date().toISOString();

	await uploadPhoto(env.BUCKET, r2Key, buffer, contentType);
	await insertPhoto(env.DB, {
		id: photoId,
		report_id: reportId,
		r2_key: r2Key,
		is_public: 0,
		width: null,
		height: null,
		bytes: buffer.byteLength,
		created_at: createdAt,
	});

	return json({ id: photoId });
};
