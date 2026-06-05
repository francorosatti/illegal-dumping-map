<script lang="ts">
	import { es } from '$lib/i18n/es';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let mapDiv = $state<HTMLDivElement | null>(null);
	let mapReady = $state(false);

	type PinStatus = 'reported' | 'confirmed' | 'cleaned';

	type Pin = {
		id: string;
		lat: number;
		lng: number;
		status: PinStatus;
		created_at: string;
	};

	type ReportDetail = {
		id: string;
		status: PinStatus;
		created_at: string;
		description: string | null;
		photos: { id: string }[];
	};

	const STATUS_COLORS: Record<PinStatus, string> = {
		reported: '#e67e22',
		confirmed: '#c0392b',
		cleaned: '#27ae60',
	};

	onMount(async () => {
		if (!mapDiv) return;
		const L = await import('leaflet');
		await import('leaflet/dist/leaflet.css');
		await Promise.all([
			import('leaflet.markercluster/dist/MarkerCluster.css'),
			import('leaflet.markercluster/dist/MarkerCluster.Default.css'),
			import('leaflet.markercluster'),
		]);

		// Fix default icon paths for bundled Leaflet
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		delete (L.Icon.Default.prototype as any)._getIconUrl;
		L.Icon.Default.mergeOptions({
			iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
			iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
			shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
		});

		const city = data.city;
		const map = L.map(mapDiv, {
			center: [city.center.lat, city.center.lng],
			zoom: city.defaultZoom,
			maxBounds: L.latLngBounds(
				[city.area.minLat, city.area.minLng],
				[city.area.maxLat, city.area.maxLng]
			),
			maxBoundsViscosity: 0.9,
		});

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap contributors',
			maxZoom: 19,
		}).addTo(map);

		// leaflet.markercluster attaches itself to L when imported
		const cluster = L.markerClusterGroup();

		map.addLayer(cluster);
		mapReady = true;

		async function loadPins() {
			const bounds = map.getBounds();
			const bbox = [
				bounds.getSouth(),
				bounds.getWest(),
				bounds.getNorth(),
				bounds.getEast(),
			].join(',');

			const res = await fetch(`/api/pins?bbox=${bbox}`);
			if (!res.ok) return;
			const pins: Pin[] = await res.json();

			cluster.clearLayers();

			for (const pin of pins) {
				const color = STATUS_COLORS[pin.status] ?? '#999';
				const icon = L.divIcon({
					className: '',
					html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
					iconSize: [14, 14],
					iconAnchor: [7, 7],
				});
				const marker = L.marker([pin.lat, pin.lng], { icon });
				marker.on('click', () => openPopup(map, L, pin));
				cluster.addLayer(marker);
			}
		}

		map.on('moveend', loadPins);
		await loadPins();
	});

	async function openPopup(
		map: import('leaflet').Map,
		L: typeof import('leaflet'),
		pin: Pin
	) {
		const res = await fetch(`/api/reports/${pin.id}`);
		const detail: ReportDetail = await res.json();

		const statusLabel = es.pinStatus[detail.status] ?? detail.status;
		const dateLabel = es.pinDate(es.dateFormat(detail.created_at));

		let photosHtml = '';
		if (detail.photos.length > 0) {
			photosHtml = detail.photos
				.map((p) => `<img src="/api/img/${p.id}" alt="foto" style="width:80px;height:80px;object-fit:cover;border-radius:4px;margin:2px">`)
				.join('');
		}

		const descHtml = detail.description
			? `<p style="margin:0.5rem 0;font-size:0.85rem">${detail.description}</p>`
			: `<p style="margin:0.5rem 0;font-size:0.8rem;color:#888">${detail.photos.length === 0 && !detail.description ? es.pinDescriptionHidden : ''}</p>`;

		const content = `
			<div style="min-width:180px">
				<strong>${statusLabel}</strong>
				<p style="font-size:0.8rem;color:#666;margin:0.25rem 0">${dateLabel}</p>
				${descHtml}
				<div style="display:flex;flex-wrap:wrap;gap:4px">${photosHtml}</div>
			</div>`;

		L.popup()
			.setLatLng([pin.lat, pin.lng])
			.setContent(content)
			.openOn(map);
	}
</script>

<svelte:head>
	<title>{es.mapTitle} — {es.appName}</title>
</svelte:head>

<div class="map-wrap">
	<div class="top-bar">
		<a href="/" class="report-btn">{es.mapReportButton}</a>
		<h1>{es.mapTitle}</h1>
	</div>
	<div bind:this={mapDiv} class="map" aria-label={es.mapTitle}>
		{#if !mapReady}
			<p class="loading">{es.mapLoading}</p>
		{/if}
	</div>
</div>

<style>
	.map-wrap {
		display: flex;
		flex-direction: column;
		height: 100dvh;
	}

	.top-bar {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.625rem 1rem;
		background: #1a6b3c;
		color: #fff;
	}

	h1 {
		font-size: 1rem;
		font-weight: 600;
	}

	.report-btn {
		padding: 0.375rem 0.875rem;
		background: #fff;
		color: #1a6b3c;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	.map {
		flex: 1;
		position: relative;
	}

	.loading {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: #666;
	}
</style>
