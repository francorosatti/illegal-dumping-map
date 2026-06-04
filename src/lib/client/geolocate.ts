import { isInAreaClient } from './area';

export type GeoResult =
	| { ok: true; lat: number; lng: number }
	| { ok: false; outsideArea: boolean; error?: string };

export function getCurrentPosition(): Promise<GeoResult> {
	return new Promise((resolve) => {
		if (!navigator.geolocation) {
			resolve({ ok: false, outsideArea: false, error: 'unavailable' });
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				const lat = pos.coords.latitude;
				const lng = pos.coords.longitude;
				if (!isInAreaClient(lat, lng)) {
					resolve({ ok: false, outsideArea: true });
				} else {
					resolve({ ok: true, lat, lng });
				}
			},
			() => {
				resolve({ ok: false, outsideArea: false, error: 'denied' });
			},
			{ enableHighAccuracy: true, timeout: 10_000 }
		);
	});
}
