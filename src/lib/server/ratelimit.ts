import type { KVNamespace } from '@cloudflare/workers-types';

const REPORT_LIMIT = 5;
const REPORT_WINDOW_S = 3600; // 1 hour
const PHOTO_LIMIT = 20;
const PHOTO_WINDOW_S = 60; // 1 minute

function ipKey(prefix: string, ip: string): string {
	return `rl:${prefix}:${ip}`;
}

async function checkLimit(
	kv: KVNamespace,
	key: string,
	limit: number,
	windowSecs: number
): Promise<boolean> {
	const raw = await kv.get(key);
	const count = raw ? parseInt(raw, 10) : 0;
	if (count >= limit) return false;
	await kv.put(key, String(count + 1), { expirationTtl: windowSecs });
	return true;
}

export async function checkReportRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
	return checkLimit(kv, ipKey('report', ip), REPORT_LIMIT, REPORT_WINDOW_S);
}

export async function checkPhotoRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
	return checkLimit(kv, ipKey('photo', ip), PHOTO_LIMIT, PHOTO_WINDOW_S);
}

export async function checkCleaningRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
	return checkLimit(kv, ipKey('cleaning', ip), REPORT_LIMIT, REPORT_WINDOW_S);
}
