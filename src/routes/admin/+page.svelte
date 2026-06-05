<script lang="ts">
	import { es } from '$lib/i18n/es';
	import { untrack, tick } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Photo = { id: string; is_public: number; bytes: number | null; r2_key: string; report_id: string; created_at: string };
	type Report = {
		id: string;
		lat: number;
		lng: number;
		description: string | null;
		description_approved: number;
		status: string;
		hidden: number;
		reviewed_at: string | null;
		created_at: string;
		photos: Photo[];
	};

	let queue = $state(untrack(() => (data.reports as Report[]).filter((r) => !r.reviewed_at)));
	let index = $state(0);
	let actionError = $state('');
	let submitting = $state(false);
	let lightboxSrc = $state<string | null>(null);
	let mapModalOpen = $state(false);
	let mapDiv = $state<HTMLDivElement | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let leafletMap = $state<any>(null);

	// Per-card approval state — true = approved, false = rejected
	let descApproved = $state(true);
	let photoApprovals = $state<Record<string, boolean>>({});

	let current = $derived(queue[index] ?? null);

	function resetApprovals(report: Report | null) {
		descApproved = true;
		const next: Record<string, boolean> = {};
		if (report) report.photos.forEach((p) => (next[p.id] = true));
		photoApprovals = next;
	}

	$effect(() => {
		resetApprovals(current);
	});

	// Swipe state
	let dragX = $state(0);
	let dragging = $state(false);
	let startX = 0;
	const THRESHOLD = 80;

	function onPointerDown(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('button, a')) return;
		dragging = true;
		startX = e.clientX;
		dragX = 0;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		dragX = e.clientX - startX;
	}

	async function onPointerUp() {
		if (!dragging) return;
		dragging = false;
		if (dragX > THRESHOLD) await decide(true);
		else if (dragX < -THRESHOLD) await decide(false);
		dragX = 0;
	}

	async function decide(approved: boolean) {
		if (!current || submitting) return;
		submitting = true;
		actionError = '';
		const body = {
			action: 'review',
			approved,
			description_approved: descApproved,
			photo_approvals: photoApprovals,
		};
		const res = await fetch(`/api/admin/reports/${current.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			actionError = es.errorGeneric;
		} else {
			index += 1;
		}
		submitting = false;
	}

	async function logout() {
		await fetch('/api/admin/logout', { method: 'POST' });
		window.location.href = '/admin/login';
	}

	function cardStyle(dx: number) {
		const rotate = dx * 0.06;
		return `transform: translateX(${dx}px) rotate(${rotate}deg);`;
	}

	let swipeHint = $derived(dragX > 30 ? 'approve' : dragX < -30 ? 'reject' : null);

	async function openMapModal() {
		mapModalOpen = true;
		await tick();
		if (!mapDiv || !current) return;
		if (leafletMap) { leafletMap.remove(); leafletMap = null; }
		const L = await import('leaflet');
		await import('leaflet/dist/leaflet.css');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		delete (L.Icon.Default.prototype as any)._getIconUrl;
		L.Icon.Default.mergeOptions({
			iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
			iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
			shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
		});
		const map = L.map(mapDiv, { center: [current.lat, current.lng], zoom: 16 });
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap',
		}).addTo(map);
		L.marker([current.lat, current.lng]).addTo(map);
		leafletMap = map;
	}

	function closeMapModal() {
		mapModalOpen = false;
		if (leafletMap) { leafletMap.remove(); leafletMap = null; }
	}
</script>

<svelte:head>
	<title>{es.adminTitle} — {es.appName}</title>
</svelte:head>

<svelte:window
	onkeydown={(e) => {
		if (lightboxSrc) { if (e.key === 'Escape') lightboxSrc = null; return; }
		if (e.key === 'ArrowRight') decide(true);
		if (e.key === 'ArrowLeft') decide(false);
	}}
/>

<div class="header">
	<h1>{es.adminTitle}</h1>
	<div class="header-actions">
		<a href="/admin/limpiezas" class="btn-sm">{es.adminCleaningsLink}</a>
		<a href="/api/admin/export.csv" class="btn-sm">{es.adminExportCsv}</a>
		<button class="btn-sm btn-danger" onclick={logout}>{es.adminLogout}</button>
	</div>
</div>

{#if actionError}
	<p class="error-banner">{actionError}</p>
{/if}

<div class="stage">
	{#if current}
		<p class="counter">{es.adminPending(queue.length - index)}</p>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="card"
			style={cardStyle(dragX)}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
		>
			{#if swipeHint === 'approve'}
				<div class="swipe-hint approve">✓ {es.adminApprove}</div>
			{:else if swipeHint === 'reject'}
				<div class="swipe-hint reject">✕ {es.adminReject}</div>
			{/if}

			<!-- Meta -->
			<div class="report-meta">
				<span class="date">{es.dateFormat(current.created_at)}</span>
				<button class="coords-link" onclick={openMapModal}>
					📍 {current.lat.toFixed(4)}, {current.lng.toFixed(4)}
				</button>
			</div>

			<!-- Description -->
			<div class="section">
				<div class="section-header">
					<span class="section-label">Descripción</span>
					{#if current.description}
						<button
							class="toggle-btn"
							class:approved={descApproved}
							onclick={() => (descApproved = !descApproved)}
						>
							{descApproved ? es.adminPhotoApproved : es.adminPhotoRejected}
						</button>
					{/if}
				</div>
				{#if current.description}
					<p class="desc" class:dimmed={!descApproved}>{current.description}</p>
				{:else}
					<p class="empty-desc">Sin descripción</p>
				{/if}
			</div>

			<!-- Photos -->
			{#if current.photos.length > 0}
				<div class="section">
					<div class="section-label">Fotos</div>
					<div class="photos">
						{#each current.photos as photo (photo.id)}
							<div class="photo-item" class:dimmed={!photoApprovals[photo.id]}>
								<button
									type="button"
									class="photo-btn"
									onclick={() => (lightboxSrc = `/api/img/${photo.id}`)}
								>
									<img src="/api/img/{photo.id}" alt="Foto" />
								</button>
								<button
									class="photo-toggle"
									class:approved={photoApprovals[photo.id]}
									onclick={() => (photoApprovals[photo.id] = !photoApprovals[photo.id])}
								>
									{photoApprovals[photo.id] ? es.adminPhotoApproved : es.adminPhotoRejected}
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Action buttons -->
		<div class="actions">
			<button
				class="action-btn reject-btn"
				disabled={submitting}
				onclick={() => decide(false)}
				aria-label={es.adminReject}
			>
				✕
			</button>
			<button
				class="action-btn approve-btn"
				disabled={submitting}
				onclick={() => decide(true)}
				aria-label={es.adminApprove}
			>
				✓
			</button>
		</div>
	{:else}
		<div class="empty-state">
			<p class="empty-icon">✓</p>
			<p>{es.adminAllDone}</p>
			<a href="/api/admin/export.csv" class="btn-sm">{es.adminExportCsv}</a>
		</div>
	{/if}
</div>

{#if mapModalOpen}
	<button class="modal-backdrop" onclick={closeMapModal} aria-label="Cerrar mapa"></button>
	<div class="map-modal">
		<button class="map-modal-close" onclick={closeMapModal} aria-label="Cerrar">✕</button>
		<div class="map-container" bind:this={mapDiv}></div>
	</div>
{/if}

{#if lightboxSrc}
	<button class="lightbox" onclick={() => (lightboxSrc = null)} aria-label="Cerrar">
		<img src={lightboxSrc} alt="Foto ampliada" />
	</button>
{/if}

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.5rem;
		background: #1a6b3c;
		color: #fff;
	}

	h1 {
		font-size: 1.1rem;
		font-weight: 700;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
	}

	.error-banner {
		max-width: 480px;
		margin: 0.75rem auto;
		padding: 0.5rem 1rem;
		background: #fde8e8;
		border-radius: 6px;
		text-align: center;
		font-size: 0.9rem;
	}

	.stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem 1rem 2rem;
		min-height: calc(100vh - 60px);
	}

	.counter {
		font-size: 0.85rem;
		color: #888;
		margin-bottom: 0.75rem;
	}

	.card {
		position: relative;
		background: #fff;
		border-radius: 16px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
		padding: 1.25rem;
		width: 100%;
		max-width: 480px;
		cursor: grab;
		user-select: none;
		touch-action: pan-y;
		will-change: transform;
	}

	.card:active {
		cursor: grabbing;
	}

	.swipe-hint {
		position: absolute;
		top: 1rem;
		font-size: 1rem;
		font-weight: 700;
		padding: 0.3rem 0.8rem;
		border-radius: 8px;
		pointer-events: none;
	}

	.swipe-hint.approve {
		right: 1rem;
		background: #e8f7ee;
		color: #1a6b3c;
		border: 2px solid #27ae60;
	}

	.swipe-hint.reject {
		left: 1rem;
		background: #fde8e8;
		color: #c0392b;
		border: 2px solid #c0392b;
	}

	.report-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 1rem;
		font-size: 0.8rem;
		color: #666;
	}

	.coords-link {
		color: #1a6b3c;
		font-size: 0.78rem;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-decoration: underline dotted;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 900;
		border: none;
		cursor: pointer;
	}

	.map-modal {
		position: fixed;
		inset: 1rem;
		max-width: 600px;
		max-height: 480px;
		margin: auto;
		background: #fff;
		border-radius: 12px;
		overflow: hidden;
		z-index: 901;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
	}

	.map-modal-close {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		z-index: 10;
		background: #fff;
		border: 1px solid #ccc;
		border-radius: 50%;
		width: 32px;
		height: 32px;
		cursor: pointer;
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.map-container {
		flex: 1;
		width: 100%;
		height: 100%;
	}

	.section {
		margin-top: 1rem;
		border-top: 1px solid #f0f0f0;
		padding-top: 0.75rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.section-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.toggle-btn {
		font-size: 0.75rem;
		padding: 0.2rem 0.6rem;
		border-radius: 99px;
		border: 1.5px solid #c0392b;
		background: #fde8e8;
		color: #c0392b;
		cursor: pointer;
		font-weight: 600;
	}

	.toggle-btn.approved {
		border-color: #27ae60;
		background: #e8f7ee;
		color: #1a6b3c;
	}

	.desc {
		font-size: 0.9rem;
		white-space: pre-wrap;
		color: #222;
		transition: opacity 0.15s;
	}

	.desc.dimmed {
		opacity: 0.35;
		text-decoration: line-through;
	}

	.empty-desc {
		font-size: 0.85rem;
		color: #aaa;
	}

	.photos {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.photo-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		transition: opacity 0.15s;
	}

	.photo-item.dimmed {
		opacity: 0.35;
	}

	.photo-btn {
		padding: 0;
		border: none;
		background: none;
		cursor: zoom-in;
		border-radius: 8px;
		overflow: hidden;
	}

	.photo-btn img {
		width: 100px;
		height: 100px;
		object-fit: cover;
		display: block;
		border-radius: 8px;
	}

	.photo-toggle {
		font-size: 0.7rem;
		padding: 0.15rem 0.5rem;
		border-radius: 99px;
		border: 1.5px solid #c0392b;
		background: #fde8e8;
		color: #c0392b;
		cursor: pointer;
		font-weight: 600;
	}

	.photo-toggle.approved {
		border-color: #27ae60;
		background: #e8f7ee;
		color: #1a6b3c;
	}

	.actions {
		display: flex;
		gap: 3rem;
		margin-top: 2rem;
	}

	.action-btn {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		border: none;
		font-size: 1.6rem;
		cursor: pointer;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
		transition: transform 0.1s;
	}

	.action-btn:active {
		transform: scale(0.92);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.reject-btn {
		background: #fff;
		color: #c0392b;
		border: 2.5px solid #c0392b;
	}

	.approve-btn {
		background: #27ae60;
		color: #fff;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		margin-top: 4rem;
		color: #555;
	}

	.empty-icon {
		font-size: 3rem;
		color: #27ae60;
	}

	.lightbox {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		border: none;
		cursor: zoom-out;
		padding: 1rem;
	}

	.lightbox img {
		max-width: 100%;
		max-height: 90vh;
		border-radius: 6px;
		object-fit: contain;
	}

	.btn-sm {
		padding: 0.3rem 0.65rem;
		font-size: 0.8rem;
		border: 1px solid #ccc;
		border-radius: 5px;
		background: #fff;
		cursor: pointer;
		text-decoration: none;
		color: inherit;
	}

	.btn-sm.btn-danger {
		background: #fde8e8;
		border-color: #c0392b;
		color: #c0392b;
	}

	.header .btn-sm {
		color: #1a6b3c;
		border-color: rgba(255, 255, 255, 0.6);
	}
</style>
