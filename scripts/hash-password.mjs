#!/usr/bin/env node
const password = process.argv[2];
if (!password) {
	console.error('Usage: node scripts/hash-password.mjs <password>');
	process.exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey(
	'raw',
	new TextEncoder().encode(password),
	'PBKDF2',
	false,
	['deriveBits']
);
const bits = await crypto.subtle.deriveBits(
	{ name: 'PBKDF2', salt, hash: 'SHA-256', iterations: 100_000 },
	key,
	256
);
const saltHex = [...salt].map((b) => b.toString(16).padStart(2, '0')).join('');
const hashHex = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
console.log(`pbkdf2:${saltHex}:${hashHex}`);
