<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<header class="site-header">
	<a class="brand" href={data.user ? '/menu' : '/'}>
		<img class="brand-logo" src="/deardish.jpg" alt="" />
		<span>DearDish</span>
	</a>
	<nav>
		{#if data.user}
			<a href="/menu">Menu</a>
			<a href="/meals">My Meals</a>
			<a href="/profile">Profile</a>
			<span class="muted">{data.user.email}</span>
			<form method="POST" action="/auth/logout">
				<button class="button" type="submit">Log out</button>
			</form>
		{:else}
			<a href="/auth/login">Sign in</a>
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
