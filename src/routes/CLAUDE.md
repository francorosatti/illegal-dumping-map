# src/routes/

SvelteKit file-system router. Each `+page.svelte` / `+page.server.ts` pair is a route. API endpoints use `+server.ts`.

## Route map

| Path | Description |
|---|---|
| `/` | Report form (default view) |
| `/mapa` | Public map of pins (Leaflet loaded lazily here) |
| `/confirmacion/[id]` | Post-submit confirmation — shows uploader's own photos for 24h |
| `/admin` | Moderation dashboard (requires admin session) |
| `/admin/login` | Admin login |
| `/api/reports` | `POST` — create report |
| `/api/reports/[id]` | `GET` — public report detail |
| `/api/reports/[id]/photos` | `POST` — upload photo (uploader-token gated) |
| `/api/pins` | `GET` — bbox pin query |
| `/api/img/[photoId]` | `GET` — serve image with auth |
| `/api/admin/login` | `POST` — admin login |
| `/api/admin/logout` | `POST` — admin logout |
| `/api/admin/reports` | `GET` — list reports (admin) |
| `/api/admin/reports/[id]` | `PATCH/DELETE` — moderate report |
| `/api/admin/photos/[id]` | `PATCH/DELETE` — moderate photo |
| `/api/admin/export.csv` | `GET` — CSV export |

## Rules

- Leaflet must NOT be imported on `/` (report form) — only on `/mapa` and the location picker. Use dynamic `import()`.
- All `+server.ts` files must validate auth before any DB/R2 write.
- Use `event.platform.env` for all bindings — never import them from config.
