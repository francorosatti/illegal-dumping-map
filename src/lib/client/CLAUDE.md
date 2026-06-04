# src/lib/client/

Client-only modules. Safe to import from `.svelte` files.

| File | Purpose |
|---|---|
| `image-compress.ts` | EXIF strip + resize via `browser-image-compression` |
| `geolocate.ts` | Wraps `navigator.geolocation`, validates against city area |
| `area.ts` | Client copy of `isInArea` — used for UX feedback only (server is authoritative) |

## Important

- `image-compress.ts` strips EXIF client-side before upload. GPS in images must come from the explicit location pick only.
- `area.ts` is a UX hint, not a security check. The server enforces area limits in `POST /api/reports`.
- Never import `$lib/server/*` from these modules.
