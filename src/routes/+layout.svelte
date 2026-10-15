<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<header class="site-header">
	<a class="brand" href="/">DearDish</a>
	<nav>
		<a href="/menu">Menu</a>
		{#if data.user}
			<a href="/meals">My Meals</a>
			<a href="/profile">Profile</a>
			<span class="muted">{data.user.email}</span>
			<form method="POST" action="/auth/logout">
				<button class="button" type="submit">Log out</button>
			</form>
		{:else}
			<a href="/auth/login">Sign in</a>
			<a href="/auth/register">Register</a>
		{/if}
	</nav>
</header>

<main>
	{@render children()}
</main>

<style>
	.site-header form {
		flex-direction: row;
		max-width: none;
		margin: 0;
	}
</style>
