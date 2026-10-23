<script lang="ts">
	import Button from '$lib/ui/Button.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<section class="auth card">
	<h1>Create your account</h1>

	<form method="POST">
		{#if form?.errors?.form}
			<p class="error">{form.errors.form}</p>
		{/if}

		<label for="email">Email</label>
		<input
			id="email"
			name="email"
			type="email"
			autocomplete="email"
			value={form?.values?.email ?? ''}
		/>
		{#if form?.errors?.email}
			<p class="error">{form.errors.email}</p>
		{/if}

		<label for="password">Password</label>
		<input
			id="password"
				name="password"
				type="password"
				autocomplete="new-password"
			/>
		{#if form?.errors?.password}
			<p class="error">{form.errors.password}</p>
		{/if}

		<label for="confirmPassword">Confirm password</label>
		<input
			id="confirmPassword"
				name="confirmPassword"
				type="password"
				autocomplete="new-password"
			/>
		{#if form?.errors?.confirmPassword}
			<p class="error">{form.errors.confirmPassword}</p>
		{/if}

		<Button type="submit" variant="primary">Register</Button>
	</form>

	<p class="muted">Already have an account? <a href="/auth/login">Sign in</a></p>
</section>

<style>
	.auth {
		max-width: 28rem;
		margin: 1.5rem auto;
		border-top: 4px solid var(--aqua);
		padding: 1.75rem 2rem;
	}

	.auth h1 {
		color: var(--berry);
		margin-top: 0;
	}
</style>
