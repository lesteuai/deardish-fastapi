<script lang="ts">
	import Button from '$lib/ui/Button.svelte';
</script>

<section class="hero">
	<img class="hero-logo" src="/deardish.jpg" alt="DearDish logo" />
	<h1>DearDish</h1>
	<p class="mission">DearDish makes restaurant-style meals accessible to people facing health challenges.</p>
	<div class="actions">
		<Button href="/auth/register" variant="primary">Register</Button>
		<Button href="/auth/login">Sign in</Button>
	</div>
</section>
