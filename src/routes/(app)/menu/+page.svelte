<script lang="ts">
	import dishImages from '$lib/data/dish-images.json';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<section>
	<h1>Menu</h1>
	<p class="muted">Restaurant-style dishes you can adapt to your health profile.</p>

	<div class="grid">
		{#each data.dishes as dish (dish.id)}
			<a class="card dish-card" href={`/menu/${dish.id}`}>
				<img
					class="dish-image"
					src={dishImages[dish.name as keyof typeof dishImages].src}
					alt={dish.name}
				/>
				<span class="cuisine">{dish.cuisine}</span>
				<h2>{dish.name}</h2>
				<p>{dish.description}</p>
			</a>
		{/each}
	</div>
</section>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 1rem;
	}

	.dish-card {
		display: block;
		color: inherit;
		text-decoration: none;
		transition:
			transform 0.15s ease,
			border-color 0.15s ease;
	}

	.dish-image {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 10;
		object-fit: cover;
		border-radius: var(--radius, 0.5rem);
		margin-bottom: 0.9rem;
	}

	.dish-card:hover {
		transform: translateY(-3px);
		border-color: var(--aqua);
	}

	.dish-card h2 {
		margin: 0.25rem 0 0.5rem;
		color: var(--berry);
	}
</style>
