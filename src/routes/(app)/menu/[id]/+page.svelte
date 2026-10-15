<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<section>
	<a class="back" href="/menu">Back to menu</a>

	<article class="card">
		<span class="cuisine">{data.dish.cuisine}</span>
		<h1>{data.dish.name}</h1>
		<p>{data.dish.description}</p>

		<h2>Ingredients</h2>
		<ul>
			{#each data.dish.ingredients as ingredient (ingredient)}
				<li>{ingredient}</li>
			{/each}
		</ul>

		<a class="button primary" href={`/adapt/${data.dish.id}`}>Adapt this dish</a>
	</article>
</section>

<style>
	.back {
		display: inline-block;
		margin-bottom: 1rem;
	}

	article h1 {
		margin: 0.25rem 0 0.5rem;
	}
</style>
