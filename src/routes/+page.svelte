<script lang="ts">
	import Button from '$lib/ui/Button.svelte';
</script>

<section class="hero">
	<img class="hero-logo" src="/deardish.jpg" alt="DearDish logo" />
	<h1>DearDish</h1>
	<p class="mission">DearDish makes restaurant-style meals accessible to people facing health challenges.</p>
	<div class="actions">
		<Button href="/auth/login" variant="primary" class="home-sign-in">Sign in</Button>
	</div>
	<a
		class="feedback-link"
		href="https://tally.so/r/YjDQvd"
		target="_blank"
		rel="noopener noreferrer"
	>Share your feedback</a>
</section>

<style>
	.hero :global(.home-sign-in) {
		width: 12rem;
	}

	.feedback-link {
		margin-top: 1rem;
		display: inline-block;
		color: var(--berry);
		text-decoration: underline;
	}
</style>
