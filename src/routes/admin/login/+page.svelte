<script lang="ts">
	import { es } from '$lib/i18n/es';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		const res = await fetch('/api/admin/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password }),
		});
		loading = false;
		if (res.ok) {
			goto('/admin');
		} else {
			error = es.adminLoginError;
		}
	}
</script>

<svelte:head>
	<title>{es.adminLogin} — {es.appName}</title>
</svelte:head>

<main class="container">
	<div class="card">
		<h1>{es.adminTitle}</h1>
		<form onsubmit={handleSubmit}>
			<label for="email">{es.adminEmail}</label>
			<input id="email" type="email" bind:value={email} required autocomplete="email" />

			<label for="password">{es.adminPassword}</label>
			<input id="password" type="password" bind:value={password} required autocomplete="current-password" />

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<button type="submit" disabled={loading}>
				{loading ? '...' : es.adminLoginButton}
			</button>
		</form>
	</div>
</main>

<style>
	.container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		padding: 1rem;
	}

	.card {
		background: #fff;
		border-radius: 12px;
		padding: 2rem;
		width: 100%;
		max-width: 380px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
	}

	h1 {
		font-size: 1.25rem;
		font-weight: 700;
		color: #1a6b3c;
		margin-bottom: 1.5rem;
		text-align: center;
	}

	label {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	input {
		width: 100%;
		padding: 0.625rem;
		border: 1px solid #ccc;
		border-radius: 6px;
		font-size: 0.95rem;
		margin-bottom: 1rem;
	}

	.error {
		color: #c00;
		font-size: 0.875rem;
		margin-bottom: 0.75rem;
	}

	button {
		width: 100%;
		padding: 0.75rem;
		background: #1a6b3c;
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.7;
	}
</style>
