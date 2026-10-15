<script lang="ts">
	import RecipeCard from '$lib/ui/RecipeCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDate(value: string | Date): string {
		return new Date(value).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
</script>

<section>
	<a class="back" href="/meals">Back to my meals</a>

	<article class="card">
		<h1>{data.meal.title}</h1>
		<p class="muted">Saved {formatDate(data.meal.createdAt)}</p>
	</article>

	<RecipeCard content={data.meal.content} title="Your saved meal" />
</section>

<style>
	.back {
		display: inline-block;
		margin-bottom: 1rem;
		padding: 0.35rem 0.9rem;
		border: 2px solid var(--berry);
		border-radius: var(--radius-pill);
		text-decoration: none;
		font-weight: 600;
	}

	article h1 {
		margin: 0.25rem 0 0.5rem;
	}

	article .muted {
		margin: 0;
	}
</style>
