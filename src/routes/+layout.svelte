<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';

	type LayoutProps = {
		data: { user?: App.Locals['user'] };
		children: Snippet;
	};

	let { data, children }: LayoutProps = $props();
</script>

<header class="site-header">
	<a class="brand" href="/">DearDish</a>
	<nav>
		<a href="/menu">Menu</a>
		<a href="/meals">My Meals</a>
		<a href="/profile">Profile</a>
		{#if data.user}
			<span class="muted">{data.user.email}</span>
		{:else}
			<a href="/auth/login">Sign in</a>
		{/if}
	</nav>
</header>

<main>
	{@render children()}
</main>
