export type CityArea = {
	type: 'bbox';
	minLat: number;
	maxLat: number;
	minLng: number;
	maxLng: number;
};

export type CityConfig = {
	slug: string;
	name: string;
	center: { lat: number; lng: number };
	defaultZoom: number;
	area: CityArea;
};

export const CITY: CityConfig = {
	slug: 'mar-del-plata',
	name: 'Mar del Plata',
	center: { lat: -38.0055, lng: -57.5426 },
	defaultZoom: 12,
	area: {
		type: 'bbox',
		minLat: -38.2,
		maxLat: -37.88,
		minLng: -57.7,
		maxLng: -57.47,
	},
};
