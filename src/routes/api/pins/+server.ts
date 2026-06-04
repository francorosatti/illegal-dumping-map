import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPublicPins } from '$lib/server/db';
import { CITY } from '$lib/config/city';

export const GET: RequestHandler = async ({ url, platform }) => {
	if (!platform) throw error(500, 'Platform unavailable');

	const bbox = url.searchParams.get('bbox');
	if (!bbox) throw error(400, 'bbox requerido');

	const parts = bbox.split(',').map(Number);
	if (parts.length !== 4 || parts.some(isNaN)) {
		throw error(400, 'bbox inválido (minLat,minLng,maxLat,maxLng)');
	}

	let [minLat, minLng, maxLat, maxLng] = parts;

	// Intersect with city area for security / perf
	const area = CITY.area;
	minLat = Math.max(minLat, area.minLat);
	maxLat = Math.min(maxLat, area.maxLat);
	minLng = Math.max(minLng, area.minLng);
	maxLng = Math.min(maxLng, area.maxLng);

	const pins = await getPublicPins(platform.env.DB, minLat, minLng, maxLat, maxLng);
	return json(pins);
};
