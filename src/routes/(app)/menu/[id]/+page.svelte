<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/ui/Button.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<section>
	<Button class="back" onclick={() => goto('/menu')}>Back to menu</Button>

	<article class="card">
		<span class="cuisine">{data.dish.cuisine}</span>
		<h1>{data.dish.name}</h1>
		<p>{data.dish.description}</p>

		<h2>Ingredients</h2>
		<ul class="ingredients">
			{#each data.dish.ingredients as ingredient (ingredient)}
				<li>{ingredient}</li>
			{/each}
		</ul>

		<Button href={`/adapt/${data.dish.id}`} variant="primary">Adapt this dish</Button>
	</article>
</section>

<style>
	.ingredients {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		list-style: none;
		padding: 0;
		margin: 0.75rem 0 1.25rem;
	}

	.ingredients li {
		background: var(--sun-soft);
		border: 1px solid var(--sun);
		border-radius: var(--radius-pill);
		padding: 0.25rem 0.75rem;
		font-weight: 600;
		font-size: 0.9rem;
	}

	article h1 {
		margin: 0.25rem 0 0.5rem;
	}
</style>
