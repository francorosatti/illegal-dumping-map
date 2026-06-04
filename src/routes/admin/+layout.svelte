<script lang="ts">
	let { children } = $props();
</script>

<div class="admin-shell">
	{@render children()}
</div>

<style>
	:global(body) {
		background: #f1f3f5;
	}

	.admin-shell {
		min-height: 100vh;
	}
</style>
