# Mapa de Microbasurales

A mobile-first, anonymous illegal dumping reporting app for a single city. Anyone can report a dumping site without logging in — reports appear as pins on a public map immediately. Admins review photos and descriptions through a private dashboard before they become visible to the public.

Built to run at near-zero cost on Cloudflare's free tier.

## Features

- **Anonymous reporting** — no account required. Submit a location, up to 5 photos, and an optional description.
- **GPS or map pick** — one-tap location from the browser, or manual pick on an interactive map bounded to the city area.
- **Privacy-first photos** — photos are compressed and EXIF-stripped client-side before upload. They stay private until an admin approves them individually.
- **Public map** — pins appear immediately on submit with status and date. Description and photos are hidden until moderated.
- **24-hour uploader access** — reporters can see their own photos and description for 24 hours via a signed cookie, no login needed.
- **Anti-abuse** — Cloudflare Turnstile on every submit + per-IP rate limiting via KV.
- **City-scoped** — reports are restricted to a configured bounding box. Out-of-area submissions are blocked server-side with a clear message.
- **Admin dashboard** — approve/reject descriptions, make photos public or delete them, change report status (reported → confirmed → cleaned), merge duplicates, delete reports, and export all data as CSV.
- **Automatic cleanup** — a daily cron Worker purges images from unreviewed reports older than 90 days (pins are kept).

## Running locally

### Prerequisites

- Node.js 18+

No Cloudflare account is needed to run locally. `wrangler` emulates D1, R2, and KV on your machine using local SQLite and filesystem.

### 1. Install dependencies

```bash
npm install
```

### 2. Apply the database schema

```bash
npx wrangler d1 execute DB --local --file=schema.sql
```

This creates the local D1 database with all tables and indexes.

### 3. Seed an admin user

The app ships with no default admin. Run this once to create one:

```bash
# 1. Generate a password hash
node scripts/hash-password.mjs your-password

# 2. Insert the admin into the local DB (paste the hash from step 1)
npx wrangler d1 execute DB --local --command "INSERT INTO admins (id, email, password_hash) VALUES ('admin-1', 'admin@example.com', '43e782e5f008652b6a0db7cd13492e64:b00d768ce2e284a243f08e8c8cb56afaec6411d07d979b72474aea74cdf576fe')"
```

### 4. Start the dev server

```bash
npm run dev
```

This runs SvelteKit via `wrangler pages dev`, which emulates D1, R2, and KV locally — no Docker or external services needed.

Open [http://localhost:5173](http://localhost:5173).

> **Turnstile:** local dev uses the test site key (`1x00000000000000000000AA`) which always passes without showing a widget. No configuration needed.

### 5. Verify the setup

| URL | What to check |
|---|---|
| `http://localhost:5173/` | Report form — submit a location and photos |
| `http://localhost:5173/mapa` | Public map — the new pin should appear |
| `http://localhost:5173/admin` | Admin dashboard — log in with the seeded credentials |

## Deploying to Cloudflare

1. Create a Cloudflare Pages project, a D1 database, an R2 bucket, and a KV namespace in the Cloudflare dashboard.
2. Update `wrangler.toml` with the real `database_id` and resource IDs.
3. Set these secrets in the Cloudflare dashboard (Pages → Settings → Environment variables):
   - `SESSION_SECRET` — random string, at least 32 chars
   - `TURNSTILE_SECRET` — from the Turnstile dashboard (use the real secret key)
   - `HMAC_SECRET` — random string, at least 32 chars
4. Set `TURNSTILE_SITE_KEY` as a plain var in `wrangler.toml` (the public site key from Turnstile).
5. Apply the schema to the production database:
   ```bash
   npx wrangler d1 execute DB --file=schema.sql
   ```
6. Deploy:
   ```bash
   npm run build
   npx wrangler pages deploy
   ```
7. Deploy the cleanup worker separately:
   ```bash
   cd worker-cleanup
   npx wrangler deploy
   ```

## Adding a new city

Each city is a separate deployment with its own D1/R2/KV resources.

1. Create a new Cloudflare Pages project + D1 + R2 + KV.
2. Copy `src/lib/config/city.ts` and update `slug`, `name`, `center`, `defaultZoom`, and `area` (bounding box).
3. Set the city-specific vars in `wrangler.toml`.
4. Deploy following the steps above.

Data stays fully isolated between deployments.
