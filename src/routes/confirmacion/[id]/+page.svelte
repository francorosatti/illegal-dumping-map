<script lang="ts">
	import { es } from '$lib/i18n/es';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{es.confirmTitle} — {es.appName}</title>
</svelte:head>

<main class="container">
	<div class="card">
		<div class="icon">✅</div>
		<h1>{es.confirmTitle}</h1>
		<p>{es.confirmSubtitle}</p>

		{#if data.isUploader}
			<p class="note">{es.confirmVisibleFor}</p>
			{#if data.photos.length > 0}
				<div class="photos">
					{#each data.photos as photo}
						<img src="/api/img/{photo.id}" alt="Foto del reporte" />
					{/each}
				</div>
			{/if}
		{/if}

		<div class="actions">
			<a href="/mapa" class="btn-outline">{es.confirmViewMap}</a>
			<a href="/" class="btn-primary">{es.confirmNewReport}</a>
		</div>
	</div>
</main>

<style>
	.container {
		max-width: 480px;
		margin: 3rem auto;
		padding: 1rem;
	}

	.card {
		background: #fff;
		border-radius: 12px;
		padding: 2rem;
		text-align: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	h1 {
		font-size: 1.4rem;
		font-weight: 700;
		color: #1a6b3c;
		margin-bottom: 0.5rem;
	}

	p {
		color: #444;
		margin-bottom: 0.75rem;
	}

	.note {
		font-size: 0.85rem;
		color: #666;
		background: #f0f7f3;
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
	}

	.photos {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
		margin: 1rem 0;
	}

	.photos img {
		width: 100px;
		height: 100px;
		object-fit: cover;
		border-radius: 8px;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		margin-top: 1.5rem;
		flex-wrap: wrap;
	}

	.btn-primary,
	.btn-outline {
		padding: 0.625rem 1.25rem;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 600;
		text-decoration: none;
	}

	.btn-primary {
		background: #1a6b3c;
		color: #fff;
	}

	.btn-outline {
		border: 1px solid #1a6b3c;
		color: #1a6b3c;
		background: #fff;
	}
</style>
