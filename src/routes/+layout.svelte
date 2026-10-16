<script lang="ts">
	import '../app.css';
	import Button from '$lib/ui/Button.svelte';
	import Dropdown from '$lib/ui/Dropdown.svelte';
	import { isPostHogReady } from '../hooks.client';
	import posthog from 'posthog-js';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
	let menuOpen = $state(false);

	onMount(() => {
		if (!data.user || !isPostHogReady()) return;

		const identifiedUserId = posthog.get_property('$user_id');
		if (typeof identifiedUserId === 'string' && identifiedUserId !== data.user.id) {
			posthog.reset();
		}

		posthog.identify(data.user.id, { email: data.user.email });
	});

	function handleLogout() {
		if (isPostHogReady()) posthog.reset();
	}
</script>

<header class="site-header">
	<a class="brand" href={data.user ? '/menu' : '/'}>
		<img class="brand-logo" src="/deardish.jpg" alt="" />
		<span>DearDish</span>
	</a>
	<nav>
		{#if data.user}
			<Dropdown bind:open={menuOpen}>
				<a href="/menu" onclick={() => (menuOpen = false)}>Menu</a>
				<a href="/meals" onclick={() => (menuOpen = false)}>My Meals</a>
				<a href="/profile" onclick={() => (menuOpen = false)}>Profile</a>
				<a
					href="https://tally.so/r/YjDQvd?email={encodeURIComponent(data.user.email)}"
					target="_blank"
					rel="noopener noreferrer"
					onclick={() => (menuOpen = false)}
				>Feedback</a>
				<span class="nav-email muted">{data.user.email}</span>
				<form method="POST" action="/auth/logout" onsubmit={handleLogout}>
					<Button type="submit">Log out</Button>
				</form>
			</Dropdown>
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

	@media (max-width: 640px) {
		.nav-email {
			padding: 0.4rem 0.9rem;
		}
	}
</style>
