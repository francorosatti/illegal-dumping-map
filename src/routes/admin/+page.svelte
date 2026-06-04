<script lang="ts">
	import { es } from '$lib/i18n/es';
	import { invalidateAll } from '$app/navigation';
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

	let reports = $derived(data.reports as Report[]);
	let actionError = $state('');
	let mergeTargetId = $state('');
	let mergingId = $state('');

	async function logout() {
		await fetch('/api/admin/logout', { method: 'POST' });
		window.location.href = '/admin/login';
	}

	async function patchReport(id: string, body: Record<string, unknown>) {
		actionError = '';
		const res = await fetch(`/api/admin/reports/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		if (!res.ok) actionError = es.errorGeneric;
		else await invalidateAll();
	}

	async function deleteReport(id: string) {
		if (!confirm(es.adminConfirmDelete)) return;
		const res = await fetch(`/api/admin/reports/${id}`, { method: 'DELETE' });
		if (!res.ok) actionError = es.errorGeneric;
		else await invalidateAll();
	}

	async function patchPhoto(id: string, isPublic: boolean) {
		const res = await fetch(`/api/admin/photos/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ is_public: isPublic }),
		});
		if (!res.ok) actionError = es.errorGeneric;
		else await invalidateAll();
	}

	async function deletePhoto(id: string) {
		if (!confirm(es.adminConfirmDeletePhoto)) return;
		const res = await fetch(`/api/admin/photos/${id}`, { method: 'DELETE' });
		if (!res.ok) actionError = es.errorGeneric;
		else await invalidateAll();
	}

	async function mergeReport(sourceId: string) {
		if (!mergeTargetId.trim()) return;
		await patchReport(sourceId, { merge_into: mergeTargetId.trim() });
		mergingId = '';
		mergeTargetId = '';
	}
</script>

<svelte:head>
	<title>{es.adminTitle} — {es.appName}</title>
</svelte:head>

<div class="header">
	<h1>{es.adminTitle}</h1>
	<div class="header-actions">
		<a href="/api/admin/export.csv" class="btn-sm">{es.adminExportCsv}</a>
		<button class="btn-sm btn-danger" onclick={logout}>{es.adminLogout}</button>
	</div>
</div>

{#if actionError}
	<p class="error banner">{actionError}</p>
{/if}

<div class="report-list">
	{#if reports.length === 0}
		<p class="empty">{es.adminNoReports}</p>
	{/if}

	{#each reports as report (report.id)}
		<div class="report-card" class:unreviewed={!report.reviewed_at}>
			<div class="report-meta">
				<span class="status {report.status}">{es.pinStatus[report.status as keyof typeof es.pinStatus] ?? report.status}</span>
				<span class="date">{es.dateFormat(report.created_at)}</span>
				<span class="coords">{report.lat.toFixed(4)}, {report.lng.toFixed(4)}</span>
				{#if !report.reviewed_at}
					<span class="badge-new">Sin revisar</span>
				{/if}
			</div>

			<!-- Description -->
			<div class="desc-section">
				{#if report.description}
					<p class="desc">{report.description}</p>
					<div class="btn-row">
						{#if !report.description_approved}
							<button class="btn-sm btn-green" onclick={() => patchReport(report.id, { description_approved: true })}>{es.adminApproveDesc}</button>
						{:else}
							<button class="btn-sm" onclick={() => patchReport(report.id, { description_approved: false })}>{es.adminRejectDesc}</button>
						{/if}
					</div>
				{:else}
					<p class="empty-desc">Sin descripción</p>
				{/if}
			</div>

			<!-- Photos -->
			{#if report.photos.length > 0}
				<div class="photos">
					{#each report.photos as photo (photo.id)}
						<div class="photo-item">
							<img src="/api/img/{photo.id}" alt="Foto" />
							<div class="photo-actions">
								{#if !photo.is_public}
									<button class="btn-sm btn-green" onclick={() => patchPhoto(photo.id, true)}>{es.adminMakePhotoPublic}</button>
								{:else}
									<button class="btn-sm" onclick={() => patchPhoto(photo.id, false)}>Privar</button>
								{/if}
								<button class="btn-sm btn-danger" onclick={() => deletePhoto(photo.id)}>{es.adminDeletePhoto}</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Status change -->
			<div class="action-row">
				<select
					value={report.status}
					onchange={(e) => patchReport(report.id, { status: (e.target as HTMLSelectElement).value })}
				>
					<option value="reported">{es.statusReported}</option>
					<option value="confirmed">{es.statusConfirmed}</option>
					<option value="cleaned">{es.statusCleaned}</option>
				</select>
			</div>

			<!-- Merge -->
			{#if mergingId === report.id}
				<div class="merge-row">
					<input bind:value={mergeTargetId} placeholder="ID del reporte destino" />
					<button class="btn-sm btn-green" onclick={() => mergeReport(report.id)}>Fusionar</button>
					<button class="btn-sm" onclick={() => { mergingId = ''; mergeTargetId = ''; }}>Cancelar</button>
				</div>
			{:else}
				<button class="btn-sm" onclick={() => { mergingId = report.id; mergeTargetId = ''; }}>{es.adminMergeReport}</button>
			{/if}

			<button class="btn-sm btn-danger" onclick={() => deleteReport(report.id)}>{es.adminDeleteReport}</button>
		</div>
	{/each}
</div>

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

	.report-list {
		max-width: 860px;
		margin: 1.5rem auto;
		padding: 0 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.report-card {
		background: #fff;
		border-radius: 10px;
		padding: 1rem;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
		border-left: 4px solid #ccc;
	}

	.report-card.unreviewed {
		border-left-color: #e67e22;
	}

	.report-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.75rem;
		font-size: 0.8rem;
		color: #555;
	}

	.status {
		font-weight: 700;
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		border-radius: 99px;
		background: #eee;
	}

	.status.confirmed { background: #fde8e8; color: #c0392b; }
	.status.cleaned { background: #e8f7ee; color: #27ae60; }
	.status.reported { background: #fef3e2; color: #e67e22; }

	.badge-new {
		background: #e67e22;
		color: #fff;
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
	}

	.desc {
		font-size: 0.9rem;
		margin-bottom: 0.5rem;
		white-space: pre-wrap;
	}

	.empty-desc {
		font-size: 0.8rem;
		color: #999;
	}

	.photos {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 0.75rem 0;
	}

	.photo-item img {
		width: 100px;
		height: 100px;
		object-fit: cover;
		border-radius: 6px;
		display: block;
	}

	.photo-actions {
		display: flex;
		gap: 0.25rem;
		margin-top: 0.25rem;
		flex-wrap: wrap;
	}

	.btn-row, .action-row, .merge-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 0.5rem;
	}

	.btn-sm {
		padding: 0.3rem 0.65rem;
		font-size: 0.8rem;
		border: 1px solid #ccc;
		border-radius: 5px;
		background: #fff;
		cursor: pointer;
	}

	.btn-sm.btn-green {
		background: #e8f7ee;
		border-color: #27ae60;
		color: #1a6b3c;
	}

	.btn-sm.btn-danger {
		background: #fde8e8;
		border-color: #c0392b;
		color: #c0392b;
	}

	select {
		padding: 0.3rem 0.5rem;
		font-size: 0.85rem;
		border: 1px solid #ccc;
		border-radius: 5px;
	}

	.merge-row input {
		padding: 0.3rem 0.5rem;
		font-size: 0.85rem;
		border: 1px solid #ccc;
		border-radius: 5px;
		width: 220px;
	}

	.error.banner {
		max-width: 860px;
		margin: 0.5rem auto;
		padding: 0.5rem 1rem;
		background: #fde8e8;
		border-radius: 6px;
	}

	.empty {
		text-align: center;
		color: #999;
		padding: 2rem;
	}
</style>
