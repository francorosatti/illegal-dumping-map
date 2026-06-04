import type { D1Database, R2Bucket, KVNamespace } from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				BUCKET: R2Bucket;
				KV: KVNamespace;
				SESSION_SECRET: string;
				TURNSTILE_SECRET: string;
				HMAC_SECRET: string;
				TURNSTILE_SITE_KEY: string;
				DEV_SKIP_TURNSTILE?: string;
				CITY_SLUG: string;
				CITY_NAME: string;
				CITY_CENTER_LAT: string;
				CITY_CENTER_LNG: string;
				CITY_DEFAULT_ZOOM: string;
				CITY_AREA_MIN_LAT: string;
				CITY_AREA_MAX_LAT: string;
				CITY_AREA_MIN_LNG: string;
				CITY_AREA_MAX_LNG: string;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & { default: Cache };
		}

		interface Locals {
			adminId?: string;
			adminEmail?: string;
			uploaderReportId?: string;
		}
	}
}

export {};
