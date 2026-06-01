# Plan: Illegal Dumping Map (Mapa de Microbasurales)

## Context

Greenfield project (empty repo, no code). Goal: a public, mobile-first web app where **anyone, without logging in**, can report illegal dumping sites with a GPS location, up to 5 photos, and a description. Reports become pins on a public map. Photos are **private by default** — only admins (who log in) can review them and flag individual photos as public. The whole thing must run **as cheaply as possible** (single-person sponsored) and feel **fast on low-end phones**, which are the primary devices.

This file is the agreed analysis/spec — build from it.

## Confirmed product decisions

| Topic | Decision |
|---|---|
| Hosting/stack | Cloudflare: SvelteKit on **Pages**, **D1** (SQLite) DB, **R2** image storage, one scheduled **Worker** for cleanup |
| Frontend | **SvelteKit** (smallest bundle for low-end devices), TypeScript, SSR, Spanish-only UI |
| Map | **Leaflet** + free raster tiles (lightest on low-end). Map is **NOT** the default view |
| Anti-abuse | **Cloudflare Turnstile** on submit + per-IP rate limiting |
| Admin auth | **Multiple admins** in DB (email + password hash), signed HTTP-only session cookie |
| Uploader photo access | Uploader can see own photos + own description for **24h** via a stateless signed token (cookie), no login |
| Pin visibility | Pin (location + date + status) is **public immediately**. Description and photos are **hidden until an admin approves** them |
| Public pin contents | Location, date, **status** badge |
| Retention | Rejected/deleted images → deleted from R2 **immediately**. Reports never reviewed by an admin → images **purged after 90 days** (pin kept) |
| Geographic scope | App is scoped to **one city per deployment** (first: **Mar del Plata**). Reports are restricted to the city's allowed **area** (bounding box now, swappable to polygon later). Expansion = new deploy + new city config |

## Cost expectation

Everything fits Cloudflare free tiers at low volume: D1 (5GB / 5M reads-day), R2 (10GB storage, **zero egress** — key for public images), Pages/Workers (100k req/day), Turnstile (free). Only recurring cost is the domain (~US$10/yr). No paid map tiles, no email service.

## Geographic scope (city limiting + multi-city)

**One city per deployment.** A new city = a new Cloudflare deployment (own D1/R2/subdomain, e.g. `mardelplata.…`, `otracity.…`) with its own **city config**. No multi-tenant complexity now; data stays isolated and costs stay near-zero.

City config lives in `src/lib/config/city.ts` (values from env/`wrangler.toml` vars so each deploy differs):
```ts
export const CITY = {
  slug: 'mar-del-plata',
  name: 'Mar del Plata',
  center: { lat: -38.0055, lng: -57.5426 },   // map default center
  defaultZoom: 12,
  // "Box now, polygon later": area check sits behind isInArea()
  area: { type: 'bbox', minLat: -38.20, maxLat: -37.88, minLng: -57.70, maxLng: -57.47 }, // tune to real limits
};
```
- **Area check behind an interface** so swapping to a polygon later is a one-function change:
  `isInArea(lat, lng): boolean` — `'bbox'` → point-in-rectangle; future `'polygon'` → ray-casting on a GeoJSON ring (no PostGIS needed). Lives in `src/lib/server/area.ts` (+ a client copy/shared module for UX).
- **Server enforcement (authoritative):** `POST /api/reports` rejects any point where `!isInArea(lat,lng)` with HTTP 422 + Spanish message (e.g. *"El punto está fuera del área de Mar del Plata."*). This is the real guard — never trust the client.
- **Client UX:** map defaults to `CITY.center`/`defaultZoom`; set Leaflet `maxBounds` to the area so panning stays local. If `navigator.geolocation` returns a point outside the area, don't auto-submit — show a notice and ask the user to pick manually within the map.
- **Bounds bonus:** the `/api/pins` bbox query is naturally constrained to the city; optionally intersect requested bbox with the city area.

## Architecture

```
Browser (SvelteKit SSR + Leaflet)
   │
   ├── GET  /            report form  (DEFAULT view)
   ├── GET  /mapa        public map of pins
   ├── GET  /admin/*     admin dashboard (login-gated)
   │
   └── SvelteKit server endpoints (+server.ts) running as Pages Functions
         │  bindings via event.platform.env:  DB (D1), BUCKET (R2), KV (rate limit), secrets
         ├── POST /api/reports          create report (Turnstile + rate limit)
         ├── POST /api/reports/:id/photos   upload photo (≤5, Turnstile-gated)
         ├── GET  /api/pins?bbox=...    public pins in bounding box
         ├── GET  /api/img/:photoId     serve image (authz: public OR admin OR 24h uploader token)
         ├── admin: login, list/queue, approve desc, set status, photo public/delete, report delete, merge, CSV
         └── ...
Scheduled Worker (cron, daily): purge images of unreviewed reports older than 90d
```

- **Why SvelteKit server endpoints instead of a separate API Worker:** `@sveltejs/adapter-cloudflare` exposes D1/R2/KV bindings via `event.platform.env`, so one deployable handles UI + API. A **separate small Worker** is needed only for the cron cleanup (Pages has no cron triggers); it binds the same D1 + R2.

## Data model (D1 / SQLite)

```sql
admins(
  id TEXT PK, email TEXT UNIQUE, password_hash TEXT, created_at TEXT
)

reports(
  id TEXT PK,                  -- uuid
  lat REAL, lng REAL,
  description TEXT,
  description_approved INTEGER DEFAULT 0,   -- public only when 1
  status TEXT DEFAULT 'reported',           -- reported | confirmed | cleaned
  hidden INTEGER DEFAULT 0,                  -- 1 = spam/removed, excluded from map
  reviewed_at TEXT,                          -- NULL = no admin ever acted (drives 90d purge)
  merged_into TEXT,                          -- if merged duplicate, points to surviving report
  created_at TEXT, updated_at TEXT
)
CREATE INDEX idx_reports_bbox ON reports(lat, lng);
CREATE INDEX idx_reports_created ON reports(created_at);
CREATE INDEX idx_reports_review ON reports(reviewed_at, created_at);

photos(
  id TEXT PK, report_id TEXT REFERENCES reports(id),
  r2_key TEXT,                 -- object key in R2 bucket
  is_public INTEGER DEFAULT 0,
  width INTEGER, height INTEGER, bytes INTEGER,
  created_at TEXT
)
CREATE INDEX idx_photos_report ON photos(report_id);
```

- **No `uploader_token` column.** Uploader 24h access uses a **stateless signed token**: `HMAC(secret, reportId)` + the report's `created_at`. Server validates signature and that `now - created_at < 24h`. Token set as HTTP-only cookie on report creation (and returned for the confirmation page).
- **Status workflow** (public badge): `reported` (default), `confirmed` (admin verified), `cleaned` (site cleaned). `hidden=1` removes from map.

## Key flows

### 1. Report submission (default page `/`)
1. User lands on the **report form** (not the map).
2. Location: `navigator.geolocation` one-tap, **or** pick on a small Leaflet map (centered on `CITY.center`, panning bounded to the city area). Points outside the area are blocked with a Spanish notice.
3. Add up to **5 photos**. **Client-side**: resize to ~1600px max, compress (target ~200–500KB, WebP/JPEG), and **strip EXIF metadata** (privacy — GPS comes from the explicit location pick, not photo EXIF). Use a tiny lib (e.g. `browser-image-compression`) or a hand-rolled canvas resize to keep bundle small.
4. Description (free text, optional).
5. **Turnstile** widget; token sent with submit.
6. `POST /api/reports`: verify Turnstile server-side, check rate limit, **validate `isInArea(lat,lng)` (422 if outside)**, insert report → returns `reportId` + sets signed 24h uploader cookie.
7. Client uploads each photo to `POST /api/reports/:id/photos` (photo passes through the Function and is written to R2 via the binding — acceptable after client compression; avoids presigned-URL complexity). Cap at 5 server-side.
8. Confirmation page shows the uploaded photos + description, with a note: *visible to you for 24h, then private until approved.*

### 2. Public map (`/mapa`, secondary)
- `GET /api/pins?bbox=minLat,minLng,maxLat,maxLng` → D1 bounding-box query, returns only `{id, lat, lng, status, created_at}` for non-hidden reports. Description/photos NOT included here.
- Client renders with Leaflet + `leaflet.markercluster` (light) for clustering.
- Clicking a pin fetches detail: description shown **only if `description_approved=1`**; public photos shown **only if `is_public=1`**.

### 3. Image serving (`GET /api/img/:photoId`)
Authorize in this order, else 403:
- `photo.is_public = 1` → serve to anyone (set long `Cache-Control`, leverage CF cache).
- Valid **admin** session → serve.
- Valid **uploader token** cookie for that report **and** within 24h of `created_at` → serve.
Stream bytes from R2 binding. Private images get `Cache-Control: private, no-store`.

### 4. Admin (`/admin`, login-gated)
- **Login:** email + password against `admins`; verify hash with Web Crypto **PBKDF2** (or scrypt) — no native bcrypt needed on Workers. Issue signed HTTP-only session cookie (HMAC/JWT with `SESSION_SECRET`).
- **Moderation queue:** list reports (filter: unreviewed first). Any admin action sets `reviewed_at` (exempts from 90d purge).
- Actions: **approve description**; **set status** (confirmed/cleaned); **make photo public / keep private**; **delete photo** (removes R2 object immediately); **delete report** (hide + delete its R2 objects immediately); **merge duplicates** (re-point source `photos.report_id` to the surviving report — keeps all photos — set source `merged_into` + `hidden=1`).
- **CSV export:** `GET /api/admin/export.csv` streams all reports — columns: `id, created_at, lat, lng, description, status, description_approved, photo_count, reviewed_at`. **No images.**

### 5. Scheduled cleanup (separate cron Worker, daily)
- Find reports where `reviewed_at IS NULL AND created_at < now-90d` that still have photos → delete R2 objects + photo rows; **keep the report row/pin**.
- (Belt-and-suspenders) reconcile any orphan R2 objects.

## Anti-abuse details
- **Turnstile** verified server-side on `POST /api/reports` (and gating uploads).
- **Rate limiting**: per-IP counters in **KV** (or Cloudflare WAF rate-limit rule) — e.g. N reports / hour / IP, M photo uploads / minute.
- Hard server caps: ≤5 photos/report, max bytes/photo, allowed mime types.

## Repository layout (target)
```
docs/PLAN.md            # this file, committed
CLAUDE.md               # contribution guidelines (see below)
src/
  routes/
    +page.svelte                  # report form (default)
    mapa/+page.svelte             # public map
    admin/...                     # login + dashboard
    api/.../+server.ts            # endpoints above
  lib/
    config/city.ts                # per-deploy city config (name, center, zoom, area)
    server/{db,r2,auth,turnstile,ratelimit,csv,area}.ts
    client/{image-compress,geolocate,map}.ts
    i18n/es.ts                    # Spanish strings
schema.sql                        # D1 migrations
worker-cleanup/                   # scheduled Worker (cron) for 90d purge
wrangler.toml                     # D1/R2/KV bindings, Turnstile keys, secrets
```

## CLAUDE.md (to be created by implementation)
Must include: project purpose; the confirmed decisions table above; **performance budget** (minimize JS shipped to phones — prefer SSR + progressive enhancement, lazy-load Leaflet only on `/mapa` and the picker); **privacy rules** (images private by default, strip EXIF client-side, never log GPS+image together publicly); **security rules** (Turnstile + rate limit on all anonymous writes, authz order for image serving, PBKDF2 hashing, signed cookies); coding conventions (TS strict, Spanish UI copy in `i18n/es.ts`); how to run locally with `wrangler` + local D1/R2; how migrations work; **how to launch a new city** (copy config in `src/lib/config/city.ts` / env, set area, new D1/R2/subdomain, deploy); never commit secrets (`.env*` is gitignored).

## Verification (end-to-end, local with `wrangler`)
1. `npm run dev` (SvelteKit + `wrangler pages dev` with local D1/R2/KV bindings). Apply `schema.sql` to local D1.
2. **Report flow:** open `/` on a throttled mobile profile → grant geolocation (and test manual map pick) → add 5 images (verify they're client-compressed & EXIF-stripped via network panel sizes) → pass Turnstile (test key) → submit → confirmation shows photos.
2b. **Area limiting:** submit a point inside the Mar del Plata bbox → accepted; submit one outside (e.g. Buenos Aires) → 422 with Spanish message; confirm the picker map can't pan far outside the city (`maxBounds`) and an out-of-area geolocation prompts manual pick.
3. **24h access:** with the uploader cookie, `GET /api/img/:id` returns the image; clear cookie → 403. (Optionally fast-forward `created_at` to confirm expiry.)
4. **Public map:** `/mapa` shows the new pin immediately with status+date; description and photos are hidden (403 / not shown) pre-approval; bbox API returns only minimal fields.
5. **Admin:** seed an admin row; log in; approve description (now public on pin); mark a photo public (now served to anonymous); delete a photo (R2 object gone); delete a report (pin gone, objects gone); merge two reports (all photos survive under one). Download CSV → opens with correct columns, no image data.
6. **Rate limit:** rapid repeated submits from one IP get throttled.
7. **Cleanup Worker:** run the scheduled handler locally against a report with `reviewed_at NULL` and backdated `created_at` → its photos/R2 objects removed, pin remains.
8. **Perf check:** Lighthouse mobile on `/` — confirm small JS payload and fast first paint; verify Leaflet is not loaded on `/`.

## Open items deferred (sane defaults chosen, revisit later if needed)
- No report categories/types (free-text description only).
- Exact GPS shown publicly (not fuzzed) — reporting locations is the app's purpose.
- Single locale (`es`); no i18n framework, just a strings module.
