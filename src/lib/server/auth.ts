// Admin session and uploader token management using HMAC-signed HTTP-only cookies

const SESSION_COOKIE = 'admin_session';
const UPLOADER_COOKIE = 'uploader_token';
const UPLOADER_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── PBKDF2 password hashing ─────────────────────────────────────────────────

async function importKey(secret: string): Promise<CryptoKey> {
	const enc = new TextEncoder();
	return crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const key = await importKey(password);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, hash: 'SHA-256', iterations: 100_000 },
		key,
		256
	);
	const saltHex = Array.from(salt)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	const hashHex = Array.from(new Uint8Array(bits))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	return `pbkdf2:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parts = stored.split(':');
	if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
	const salt = Uint8Array.from(parts[1].match(/.{2}/g)!.map((b) => parseInt(b, 16)));
	const expectedHash = parts[2];
	const key = await importKey(password);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, hash: 'SHA-256', iterations: 100_000 },
		key,
		256
	);
	const actualHash = Array.from(new Uint8Array(bits))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	// Constant-time comparison
	if (actualHash.length !== expectedHash.length) return false;
	let diff = 0;
	for (let i = 0; i < actualHash.length; i++) {
		diff |= actualHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
	}
	return diff === 0;
}

// ── HMAC utilities ──────────────────────────────────────────────────────────

async function importHmacKey(secret: string): Promise<CryptoKey> {
	const enc = new TextEncoder();
	return crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

async function sign(payload: string, secret: string): Promise<string> {
	const key = await importHmacKey(secret);
	const enc = new TextEncoder();
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
	return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verifyHmac(payload: string, signature: string, secret: string): Promise<boolean> {
	const expected = await sign(payload, secret);
	if (expected.length !== signature.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) {
		diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
	}
	return diff === 0;
}

// ── Admin session cookie ────────────────────────────────────────────────────

export async function createSessionCookie(
	adminId: string,
	secret: string
): Promise<string> {
	const payload = `${adminId}:${Date.now()}`;
	const sig = await sign(payload, secret);
	const token = btoa(`${payload}|${sig}`);
	return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`;
}

export async function verifySession(
	cookieHeader: string | null,
	secret: string
): Promise<string | null> {
	if (!cookieHeader) return null;
	const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
	if (!match) return null;
	try {
		const decoded = atob(match[1]);
		const pipeIdx = decoded.lastIndexOf('|');
		const payload = decoded.slice(0, pipeIdx);
		const sig = decoded.slice(pipeIdx + 1);
		if (!(await verifyHmac(payload, sig, secret))) return null;
		const [adminId] = payload.split(':');
		return adminId;
	} catch {
		return null;
	}
}

export function clearSessionCookie(): string {
	return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

// ── Uploader token (stateless, 24h) ────────────────────────────────────────

export async function createUploaderCookie(
	reportId: string,
	createdAt: string,
	secret: string
): Promise<string> {
	const payload = `${reportId}:${createdAt}`;
	const sig = await sign(payload, secret);
	const token = btoa(`${payload}|${sig}`);
	return `${UPLOADER_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`;
}

export async function verifyUploaderToken(
	cookieHeader: string | null,
	reportId: string,
	reportCreatedAt: string,
	secret: string
): Promise<boolean> {
	if (!cookieHeader) return false;
	const match = cookieHeader.match(new RegExp(`(?:^|; )${UPLOADER_COOKIE}=([^;]+)`));
	if (!match) return false;
	try {
		const decoded = atob(match[1]);
		const pipeIdx = decoded.lastIndexOf('|');
		const payload = decoded.slice(0, pipeIdx);
		const sig = decoded.slice(pipeIdx + 1);
		if (!(await verifyHmac(payload, sig, secret))) return false;
		const sepIdx = payload.indexOf(':');
		const tokenReportId = payload.slice(0, sepIdx);
		const tokenCreatedAt = payload.slice(sepIdx + 1);
		if (tokenReportId !== reportId || tokenCreatedAt !== reportCreatedAt) return false;
		const created = new Date(reportCreatedAt).getTime();
		if (Date.now() - created > UPLOADER_TTL_MS) return false;
		return true;
	} catch {
		return false;
	}
}
