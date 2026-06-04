<script lang="ts">
	import { es } from '$lib/i18n/es';
	let { children } = $props();
</script>

<svelte:head>
	<title>{es.appName}</title>
	<meta name="description" content={es.appDescription} />
</svelte:head>

{@render children()}

<style>
	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family: system-ui, -apple-system, sans-serif;
		font-size: 16px;
		line-height: 1.5;
		color: #111;
		background: #f8f9fa;
	}

	:global(a) {
		color: #1a6b3c;
	}

	:global(button) {
		cursor: pointer;
	}
</style>
