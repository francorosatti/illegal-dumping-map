# src/lib/server/

Server-only modules. Never import these from `.svelte` files or `$lib/client/`.

| File | Purpose |
|---|---|
| `db.ts` | D1 query helpers — typed wrappers, no raw SQL in routes |
| `r2.ts` | R2 upload/download/delete — enforces MIME type + size caps |
| `auth.ts` | PBKDF2 password hashing; HMAC-signed session + uploader cookies |
| `turnstile.ts` | Server-side Turnstile verification |
| `ratelimit.ts` | KV-based per-IP counters |
| `area.ts` | `isInArea(lat, lng)` — authoritative area check (server-side guard) |
| `csv.ts` | CSV serialization for admin export |

## Auth flow

- Admin: `verifySession(cookieHeader, SESSION_SECRET)` → `adminId | null`
- Uploader: `verifyUploaderToken(cookieHeader, reportId, createdAt, HMAC_SECRET)` → `boolean`
- Passwords: `hashPassword` / `verifyPassword` using PBKDF2 (100k iterations, SHA-256)

## Secrets

Always read from `platform.env`, never from env vars or config objects.
