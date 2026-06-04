import { CITY } from '$lib/config/city';

export function isInAreaClient(lat: number, lng: number): boolean {
	const { area } = CITY;
	if (area.type === 'bbox') {
		return (
			lat >= area.minLat && lat <= area.maxLat && lng >= area.minLng && lng <= area.maxLng
		);
	}
	return false;
}
