import type { R2Bucket } from '@cloudflare/workers-types';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB (after client compression, target <500KB)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function isAllowedPhotoType(contentType: string): boolean {
	return ALLOWED_TYPES.includes(contentType);
}

export function isWithinSizeCap(bytes: number): boolean {
	return bytes <= MAX_PHOTO_BYTES;
}

export async function uploadPhoto(
	bucket: R2Bucket,
	key: string,
	data: ArrayBuffer,
	contentType: string
): Promise<void> {
	await bucket.put(key, data, {
		httpMetadata: { contentType },
	});
}

export async function getPhoto(
	bucket: R2Bucket,
	key: string
): Promise<{ body: ReadableStream<Uint8Array>; contentType: string; size: number } | null> {
	const obj = await bucket.get(key);
	if (!obj) return null;
	return {
		body: obj.body as unknown as ReadableStream<Uint8Array>,
		contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream',
		size: obj.size,
	};
}

export async function deletePhoto(bucket: R2Bucket, key: string): Promise<void> {
	await bucket.delete(key);
}

export async function deletePhotos(bucket: R2Bucket, keys: string[]): Promise<void> {
	await Promise.all(keys.map((k) => bucket.delete(k)));
}
