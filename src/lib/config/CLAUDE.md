# src/lib/config/

City-specific configuration. One deployment = one city.

`city.ts` exports `CITY` with hardcoded values for Mar del Plata. To add a city:

1. Create a new Cloudflare Pages project + D1 + R2.
2. Copy `city.ts`, update `slug`, `name`, `center`, `defaultZoom`, `area`.
3. Set env vars in the new `wrangler.toml`.
4. Deploy.

The `area` field drives `isInArea()` in both server and client. Swap `type: 'bbox'` for a polygon later — only `area.ts` (server + client) changes.
