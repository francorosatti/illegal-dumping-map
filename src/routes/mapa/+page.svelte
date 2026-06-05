<script lang="ts">
	import { es } from '$lib/i18n/es';
	import { onMount, tick } from 'svelte';
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
		has_pending_cleaning: boolean;
	};

	// Cleaning modal state
	let cleaningModalOpen = $state(false);
	let cleaningTargetId = $state<string | null>(null);
	let cleaningFile = $state<File | null>(null);
	let cleaningSubmitting = $state(false);
	let cleaningSuccess = $state(false);
	let cleaningError = $state('');
	let cleaningTurnstileToken = $state('');
	let cleaningTurnstileDiv = $state<HTMLDivElement | null>(null);

	const STATUS_COLORS: Record<PinStatus, string> = {
		reported: '#e67e22',
		confirmed: '#c0392b',
		cleaned: '#27ae60',
	};

	onMount(() => {
		(window as unknown as Record<string, unknown>).__openCleaning = (id: string) => {
			cleaningTargetId = id;
			cleaningFile = null;
			cleaningSuccess = false;
			cleaningError = '';
			cleaningTurnstileToken = '';
			cleaningModalOpen = true;
		};
		return () => {
			delete (window as unknown as Record<string, unknown>).__openCleaning;
		};
	});

	$effect(() => {
		if (cleaningModalOpen && cleaningTurnstileDiv) {
			tick().then(() => {
				const w = window as unknown as { turnstile?: { render(el: HTMLElement, opts: object): void } };
				if (w.turnstile && cleaningTurnstileDiv) {
					w.turnstile.render(cleaningTurnstileDiv, {
						sitekey: data.turnstileSiteKey,
						theme: 'light',
						callback: (token: string) => { cleaningTurnstileToken = token; },
					});
				}
			});
		}
	});

	async function handleCleaningPhoto(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		cleaningError = '';
		const { isAllowedType, compressAndStrip } = await import('$lib/client/image-compress');
		if (!isAllowedType(file)) {
			cleaningError = es.errorPhotoType;
			return;
		}
		cleaningFile = await compressAndStrip(file);
	}

	async function submitCleaning() {
		if (!cleaningTargetId || cleaningSubmitting || !cleaningFile) return;
		if (!cleaningTurnstileToken) return;
		cleaningSubmitting = true;
		cleaningError = '';
		try {
			const fd = new FormData();
			fd.append('turnstileToken', cleaningTurnstileToken);
			fd.append('photo', cleaningFile);
			const res = await fetch(`/api/reports/${cleaningTargetId}/cleaning`, {
				method: 'POST',
				body: fd,
			});
			if (res.ok) {
				cleaningSuccess = true;
			} else if (res.status === 409) {
				cleaningError = es.cleaningAlreadyPending;
			} else if (res.status === 429) {
				cleaningError = es.errorRateLimit;
			} else {
				cleaningError = es.errorGeneric;
			}
		} catch {
			cleaningError = es.errorGeneric;
		}
		cleaningSubmitting = false;
	}

	onMount(async () => {
		if (!mapDiv) return;
		const L = await import('leaflet');
		await import('leaflet/dist/leaflet.css');
		await Promise.all([
			import('leaflet.markercluster/dist/MarkerCluster.css'),
			import('leaflet.markercluster/dist/MarkerCluster.Default.css'),
		]);
		// markercluster is a UMD plugin that patches window.L — expose it before importing
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(window as any).L = L;
		await import('leaflet.markercluster');

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

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const cluster = (L as any).markerClusterGroup();

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

		const showCleaningBtn = detail.status === 'confirmed' && !detail.has_pending_cleaning;
		const cleaningBtnHtml = showCleaningBtn
			? `<button
					onclick="window.__openCleaning('${detail.id}')"
					style="margin-top:0.75rem;width:100%;padding:0.4rem 0.6rem;background:#1a6b3c;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600"
				>${es.cleaningButton}</button>`
			: '';

		const content = `
			<div style="min-width:180px">
				<strong>${statusLabel}</strong>
				<p style="font-size:0.8rem;color:#666;margin:0.25rem 0">${dateLabel}</p>
				${descHtml}
				<div style="display:flex;flex-wrap:wrap;gap:4px">${photosHtml}</div>
				${cleaningBtnHtml}
			</div>`;

		L.popup().setLatLng([pin.lat, pin.lng]).setContent(content).openOn(map);
	}
</script>

<svelte:head>
	<title>{es.mapTitle} — {es.appName}</title>
	<script>window.onTurnstileVerified = function() {}</script>
	<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</svelte:head>

{#if cleaningModalOpen}
	<button class="modal-backdrop" onclick={() => { cleaningModalOpen = false; }} aria-label="Cerrar"></button>
	<div class="cleaning-modal" role="dialog" aria-modal="true" aria-label={es.cleaningModalTitle}>
		<div class="cleaning-modal-header">
			<h2>{es.cleaningModalTitle}</h2>
			<button class="modal-close" onclick={() => { cleaningModalOpen = false; }} aria-label="Cerrar">✕</button>
		</div>

		{#if cleaningSuccess}
			<p class="cleaning-success">{es.cleaningSuccess}</p>
			<button class="btn-primary" onclick={() => { cleaningModalOpen = false; }}>Cerrar</button>
		{:else}
			<p class="cleaning-subtitle">{es.cleaningModalSubtitle}</p>

			<label class="file-label">
				<span>{es.cleaningPhotoLabel}</span>
				<input
					type="file"
					accept="image/jpeg,image/png,image/webp"
					onchange={handleCleaningPhoto}
					disabled={cleaningSubmitting}
				/>
			</label>
			{#if cleaningFile}
				<p class="file-chosen">✓ {cleaningFile.name}</p>
			{/if}

			<div class="turnstile-wrap" bind:this={cleaningTurnstileDiv}></div>

			{#if cleaningError}
				<p class="cleaning-error">{cleaningError}</p>
			{/if}

			<button
				class="btn-primary"
				disabled={!cleaningFile || !cleaningTurnstileToken || cleaningSubmitting}
				onclick={submitCleaning}
			>
				{cleaningSubmitting ? '...' : es.cleaningSubmitButton}
			</button>
		{/if}
	</div>
{/if}

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

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 900;
		border: none;
		cursor: pointer;
	}

	.cleaning-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: #fff;
		border-radius: 14px;
		padding: 1.25rem 1.5rem 1.5rem;
		width: min(92vw, 380px);
		z-index: 901;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.cleaning-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.cleaning-modal-header h2 {
		font-size: 1rem;
		font-weight: 700;
		color: #1a1a1a;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 1.1rem;
		cursor: pointer;
		color: #666;
		padding: 0.25rem;
		line-height: 1;
	}

	.cleaning-subtitle {
		font-size: 0.85rem;
		color: #666;
		margin: 0;
	}

	.file-label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: #333;
	}

	.file-label input {
		font-size: 0.8rem;
	}

	.file-chosen {
		font-size: 0.8rem;
		color: #1a6b3c;
		margin: 0;
	}

	.turnstile-wrap {
		min-height: 65px;
	}

	.cleaning-error {
		font-size: 0.85rem;
		color: #c0392b;
		margin: 0;
	}

	.cleaning-success {
		font-size: 0.9rem;
		color: #1a6b3c;
		font-weight: 600;
		margin: 0;
	}

	.btn-primary {
		padding: 0.55rem 1rem;
		background: #1a6b3c;
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.1s;
	}

	.btn-primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
