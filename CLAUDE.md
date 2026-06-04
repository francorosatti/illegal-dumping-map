# CLAUDE.md — Mapa de Microbasurales

## What this is

A mobile-first, anonymous illegal-dumping reporting app for a single city (Mar del Plata).
Anyone can report without logging in. Admins moderate reports and images via a private dashboard.
Full spec: `docs/PLAN.md`.

## Stack

| Layer | Technology |
|---|---|
| Frontend + API | SvelteKit (TypeScript, SSR) on Cloudflare Pages |
| Database | Cloudflare D1 (SQLite) |
| Image storage | Cloudflare R2 |
| Rate limiting | Cloudflare KV |
| Anti-spam | Cloudflare Turnstile (free) |
| Map | Leaflet + free raster tiles |
| Cleanup job | Separate Cloudflare Worker (cron, daily) |
| Local dev | `wrangler pages dev` — emulates D1, R2, KV locally, no Docker needed |

## Project structure

```
docs/PLAN.md              full product spec — read before implementing any feature
CLAUDE.md                 this file
src/
  routes/                 CLAUDE.md inside — SvelteKit routes and server endpoints
  lib/
    config/               CLAUDE.md inside — city config (one city per deployment)
    server/               CLAUDE.md inside — server-only modules (db, auth, r2, area…)
    client/               CLAUDE.md inside — client-only modules (image compress, map…)
    i18n/                 Spanish strings only — no i18n framework
schema.sql                D1 migrations — source of truth for the data model
worker-cleanup/           CLAUDE.md inside — scheduled cron Worker
wrangler.toml             Cloudflare bindings and secrets config
```

Each subdirectory has its own `CLAUDE.md` with module-specific guidance. Read the relevant one before touching that area.

## Guardrails

### Privacy
- Strip EXIF from photos **client-side** before upload. GPS comes from the explicit location pick only.
- Never expose GPS coordinates alongside unmoderated images in the same public response.
- Images are private by default. Only admin action makes them public.

### Security
- Verify Cloudflare Turnstile **server-side** on every anonymous write.
- Enforce rate limits (KV counters) on `POST /api/reports` and photo uploads.
- Hard server caps: ≤5 photos/report, allowed MIME types only, max bytes/photo.
- Use Web Crypto PBKDF2 for admin password hashing (bcrypt not available on Workers).
- Session and uploader tokens are HMAC-signed HTTP-only cookies. Never store raw tokens.
- Uploader 24h access is stateless — validated via `HMAC(secret, reportId)` + `created_at` age check. No token column in DB.
- Image serving auth order: public flag → admin session → valid uploader token → 403.

### Performance
- Minimize JS shipped to the browser. Prefer SSR + progressive enhancement.
- Lazy-load Leaflet **only** on `/mapa` and the location picker — never on the report form SSR shell.
- Target fast first paint on a throttled mobile profile (Lighthouse mobile ≥ 90).

### Visibility model (do not break)
- Pin (location + date + status) → **public immediately** on submit.
- Description → hidden until `description_approved = 1` (admin action).
- Photos → hidden until `is_public = 1` per photo (admin action).
- Uploader sees own description + photos for **24h** via signed cookie, no login.

### Data retention
- Rejected/deleted images → delete from R2 **immediately**.
- Reports with `reviewed_at IS NULL` older than 90 days → delete R2 objects + photo rows; keep the report row/pin.

### Secrets
- `.env*` is gitignored. Never commit secrets.
- All secrets go in `wrangler.toml` `[vars]` (non-secret) or Cloudflare dashboard secrets (`SESSION_SECRET`, `TURNSTILE_SECRET`, `HMAC_SECRET`).

## Local dev setup

```bash
npm install
# Apply DB schema to local D1
npx wrangler d1 execute DB --local --file=schema.sql
# Run everything locally (D1 + R2 + KV emulated automatically)
npm run dev   # wraps: wrangler pages dev
```

Turnstile: use the test site key (`1x00000000000000000000AA`) and secret key (`1x0000000000000000000000000000000AA`) locally — always passes without a widget.

## Adding a new city

1. Create a new Cloudflare Pages project + D1 database + R2 bucket.
2. Copy `src/lib/config/city.ts` and update `slug`, `name`, `center`, `defaultZoom`, and `area` bbox.
3. Set city-specific env vars in `wrangler.toml` and Cloudflare dashboard.
4. Deploy — fully isolated from other cities.

## After every change

Always run before considering a task done:

```bash
npm run lint   # must pass with zero errors
npm run build  # must complete without errors
```

Never leave a task in a state that fails either check.

## TypeScript

- Strict mode (`"strict": true` in `tsconfig.json`).
- No `any` unless genuinely unavoidable (add a comment explaining why).
- All UI copy goes through `src/lib/i18n/es.ts` — no hardcoded Spanish strings in components.
