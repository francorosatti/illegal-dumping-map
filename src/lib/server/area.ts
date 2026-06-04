import { CITY, type CityArea } from '$lib/config/city';

function isInBbox(lat: number, lng: number, area: CityArea & { type: 'bbox' }): boolean {
	return lat >= area.minLat && lat <= area.maxLat && lng >= area.minLng && lng <= area.maxLng;
}

export function isInArea(lat: number, lng: number): boolean {
	const area = CITY.area;
	if (area.type === 'bbox') {
		return isInBbox(lat, lng, area);
	}
	return false;
}
