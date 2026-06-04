<script lang="ts">
	import { es } from '$lib/i18n/es';
	import { isAllowedType, compressAndStrip } from '$lib/client/image-compress';
	import { getCurrentPosition } from '$lib/client/geolocate';
	import { isInAreaClient } from '$lib/client/area';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data: pageData }: { data: PageData } = $props();

	// Location state
	let lat = $state<number | null>(null);
	let lng = $state<number | null>(null);
	let locationError = $state('');
	let locationLoading = $state(false);
	let showMapPicker = $state(false);

	// Photos
	let photos = $state<File[]>([]);
	let photoErrors = $state('');
	let compressing = $state(false);

	// Form state
	let description = $state('');
	let submitting = $state(false);
	let submitError = $state('');
	let turnstileReady = $state(false);

	function onTurnstileVerified() {
		turnstileReady = true;
	}

	let turnstileDiv = $state<HTMLDivElement | null>(null);

	onMount(() => {
		document.addEventListener('turnstile-verified', onTurnstileVerified);
		// If Turnstile script already loaded from a previous navigation, render manually
		const w = (window as unknown as { turnstile?: { render(el: HTMLElement, opts: object): void } });
		if (w.turnstile && turnstileDiv) {
			w.turnstile.render(turnstileDiv, {
				sitekey: pageData.turnstileSiteKey,
				theme: 'light',
				callback: onTurnstileVerified,
			});
		}
		return () => document.removeEventListener('turnstile-verified', onTurnstileVerified);
	});

	// Map picker reference
	let mapPickerDiv = $state<HTMLDivElement | null>(null);
	let mapInitialized = $state(false);
	let leafletMap: { setView(c: [number, number], z: number): void; remove(): void } | null = null;
	let leafletMarker: { setLatLng(c: [number, number]): void } | null = null;

	function destroyMap() {
		if (leafletMap) { leafletMap.remove(); leafletMap = null; }
		leafletMarker = null;
		mapInitialized = false;
	}

	async function handleGps() {
		locationLoading = true;
		locationError = '';
		const result = await getCurrentPosition();
		locationLoading = false;
		if (result.ok) {
			lat = result.lat;
			lng = result.lng;
			// Always reinitialize map centered on GPS location
			destroyMap();
			await initMap(lat, lng, 16);
		} else if (result.outsideArea) {
			locationError = es.locationOutsideArea(pageData.city.name);
		} else {
			locationError = es.locationGpsError;
		}
	}

	async function openMapPicker() {
		// Always reset to city-centered view with no pin
		destroyMap();
		lat = null;
		lng = null;
		locationError = '';
		showMapPicker = true;
		// Leaflet loaded lazily only when needed
		await tick();
		if (!mapPickerDiv || mapInitialized) return;
		await initMap(null, null, pageData.city.defaultZoom);
	}

	async function initMap(initLat: number | null, initLng: number | null, zoom: number) {
		showMapPicker = true;
		await tick();
		if (!mapPickerDiv) return;
		const L = await import('leaflet');
		await import('leaflet/dist/leaflet.css');
		const city = pageData.city;
		const map = L.map(mapPickerDiv, {
			center: initLat !== null && initLng !== null ? [initLat, initLng] : [city.center.lat, city.center.lng],
			zoom,
			maxBounds: L.latLngBounds(
				[city.area.minLat, city.area.minLng],
				[city.area.maxLat, city.area.maxLng]
			),
			maxBoundsViscosity: 1.0,
		});
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap',
			maxZoom: 19,
		}).addTo(map);

		let marker: ReturnType<typeof L.marker> | null = null;
		if (initLat !== null && initLng !== null) {
			marker = L.marker([initLat, initLng]).addTo(map);
		}

		map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
			const { lat: clickLat, lng: clickLng } = e.latlng;
			if (!isInAreaClient(clickLat, clickLng)) {
				locationError = es.locationOutsideArea(pageData.city.name);
				return;
			}
			locationError = '';
			lat = clickLat;
			lng = clickLng;
			if (marker) marker.setLatLng([clickLat, clickLng]);
			else marker = L.marker([clickLat, clickLng]).addTo(map);
			leafletMarker = marker;
		});

		leafletMap = map;
		leafletMarker = marker;
		mapInitialized = true;
	}

	async function handlePhotoInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files) return;
		photoErrors = '';
		const newFiles = Array.from(input.files);

		if (photos.length + newFiles.length > 5) {
			photoErrors = es.photosMaxReached;
			return;
		}

		for (const f of newFiles) {
			if (!isAllowedType(f)) {
				photoErrors = es.photosInvalidType;
				return;
			}
		}

		compressing = true;
		const compressed: File[] = [];
		for (const f of newFiles) {
			try {
				compressed.push(await compressAndStrip(f));
			} catch {
				compressed.push(f);
			}
		}
		compressing = false;
		photos = [...photos, ...compressed];
		input.value = '';
	}

	function removePhoto(i: number) {
		photos = photos.filter((_, idx) => idx !== i);
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		submitError = '';

		if (lat === null || lng === null) {
			submitError = es.locationRequired;
			return;
		}

		submitting = true;

		// Get Turnstile token
		let turnstileToken = '';
		const widget = document.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]');
		if (widget) turnstileToken = widget.value;

		try {
			const res = await fetch('/api/reports', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lat, lng, description: description.trim() || undefined, turnstileToken }),
			});

			const data = await res.json() as { id?: string; error?: string; message?: string };

			if (!res.ok) {
				if (data.error === 'rate_limit') submitError = es.errorRateLimit;
				else if (data.error === 'turnstile') submitError = es.errorTurnstile;
				else if (data.error === 'outside_area') submitError = es.errorOutsideArea(pageData.city.name);
				else submitError = es.errorGeneric;
				submitting = false;
				turnstileReady = false;
				(window as unknown as { turnstile?: { reset(): void } }).turnstile?.reset();
				return;
			}

			const reportId = data.id!;

			// Upload photos
			for (const photo of photos) {
				const fd = new FormData();
				fd.append('photo', photo);
				await fetch(`/api/reports/${reportId}/photos`, { method: 'POST', body: fd });
			}

			goto(`/confirmacion/${reportId}`);
		} catch {
			submitError = es.errorGeneric;
			submitting = false;
			turnstileReady = false;
			(window as unknown as { turnstile?: { reset(): void } }).turnstile?.reset();
		}
	}

	function tick(): Promise<void> {
		return new Promise((r) => setTimeout(r, 0));
	}
</script>

<svelte:head>
	<title>{es.reportTitle} — {es.appName}</title>
	<!-- Turnstile script — loaded only on this page -->
	<script>window.onTurnstileVerified = function() { document.dispatchEvent(new Event('turnstile-verified')); }</script>
	<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</svelte:head>

<main class="container">
	<header>
		<h1>{es.reportTitle}</h1>
		<p>{es.reportSubtitle}</p>
		<nav>
			<a href="/mapa">{es.mapTitle} →</a>
		</nav>
	</header>

	<form onsubmit={handleSubmit} novalidate>
		<!-- Location -->
		<section>
			<p class="section-label">{es.locationLabel}</p>
			<p class="help">{es.locationHelp}</p>
			<div class="btn-row">
				<button type="button" onclick={handleGps} disabled={locationLoading}>
					{locationLoading ? '...' : es.locationUseGps}
				</button>
				<button type="button" onclick={openMapPicker}>
					{es.locationPickMap}
				</button>
			</div>
			{#if lat !== null && lng !== null && !showMapPicker}
				<p class="coords">📍 {lat.toFixed(5)}, {lng.toFixed(5)}</p>
			{/if}
			{#if locationError}
				<p class="error">{locationError}</p>
			{/if}
		</section>

		<!-- Map picker -->
		{#if showMapPicker}
			<div bind:this={mapPickerDiv} class="map-picker" aria-label="Mapa para elegir ubicación">
				{#if !mapInitialized}
					<p class="map-loading">{es.mapLoading}</p>
				{/if}
			</div>
			{#if lat !== null && lng !== null}
				<p class="coords">📍 {lat.toFixed(5)}, {lng.toFixed(5)}</p>
			{/if}
		{/if}

		<!-- Photos -->
		<section>
			<p class="section-label">{es.photosLabel}</p>
			<p class="help">{es.photosHelp}</p>
			<div class="photo-list">
				{#each photos as photo, i}
					<div class="photo-thumb">
						<img src={URL.createObjectURL(photo)} alt="Foto {i + 1}" />
						<button type="button" aria-label="Eliminar" onclick={() => removePhoto(i)}>✕</button>
					</div>
				{/each}
			</div>
			{#if photos.length < 5}
				<label class="file-btn">
					{compressing ? es.photosCompressing : es.photosAdd}
					<input
						type="file"
						accept="image/jpeg,image/png,image/webp"
						multiple
						onchange={handlePhotoInput}
						disabled={compressing}
					/>
				</label>
			{/if}
			{#if photoErrors}
				<p class="error">{photoErrors}</p>
			{/if}
		</section>

		<!-- Description -->
		<section>
			<label for="desc">{es.descriptionLabel}</label>
			<p class="help">{es.descriptionHelp}</p>
			<textarea
				id="desc"
				bind:value={description}
				placeholder={es.descriptionPlaceholder}
				rows="4"
			></textarea>
		</section>

		<!-- Turnstile -->
		<section>
			<div
				bind:this={turnstileDiv}
				class="cf-turnstile"
				data-sitekey={pageData.turnstileSiteKey}
				data-theme="light"
				data-callback="onTurnstileVerified"
			></div>
		</section>

		{#if submitError}
			<p class="error">{submitError}</p>
		{/if}

		<button type="submit" class="submit-btn" disabled={submitting || !turnstileReady}>
			{submitting ? es.submitting : es.submitButton}
		</button>
	</form>
</main>

<style>
	.container {
		max-width: 540px;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
	}

	header {
		margin-bottom: 1.5rem;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: #1a6b3c;
		margin-bottom: 0.25rem;
	}

	nav {
		margin-top: 0.5rem;
		font-size: 0.875rem;
	}

	section {
		margin-bottom: 1.5rem;
	}

	label,
	.section-label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.help {
		font-size: 0.8rem;
		color: #666;
		margin-bottom: 0.5rem;
	}

	.btn-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	button {
		padding: 0.5rem 1rem;
		border: 1px solid #ccc;
		border-radius: 6px;
		background: #fff;
		font-size: 0.9rem;
	}

	button:disabled {
		opacity: 0.6;
	}

	.coords {
		font-size: 0.8rem;
		color: #444;
		margin-top: 0.5rem;
	}

	.error {
		color: #c00;
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.map-picker {
		width: 100%;
		height: 280px;
		border: 1px solid #ccc;
		border-radius: 8px;
		margin-bottom: 0.5rem;
		position: relative;
		overflow: hidden;
	}

	.map-loading {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: #666;
		font-size: 0.875rem;
	}

	.photo-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.photo-thumb {
		position: relative;
		width: 80px;
		height: 80px;
	}

	.photo-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 6px;
	}

	.photo-thumb button {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 20px;
		height: 20px;
		padding: 0;
		border-radius: 50%;
		font-size: 0.7rem;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		border: none;
	}

	.file-btn {
		display: inline-block;
		padding: 0.5rem 1rem;
		border: 1px dashed #999;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: normal;
	}

	.file-btn input {
		display: none;
	}

	textarea {
		width: 100%;
		padding: 0.625rem;
		border: 1px solid #ccc;
		border-radius: 6px;
		font-size: 0.95rem;
		resize: vertical;
	}

	.submit-btn {
		width: 100%;
		padding: 0.75rem;
		background: #1a6b3c;
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
	}

	.submit-btn:disabled {
		opacity: 0.7;
	}
</style>
