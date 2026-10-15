<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let error = $state('');
	let deletingId = $state<string | null>(null);

	function preview(content: string): string {
		const trimmed = content.trim();
		return trimmed.length > 160 ? `${trimmed.slice(0, 160)}...` : trimmed;
	}

	function formatDate(value: string | Date): string {
		return new Date(value).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	async function handleDelete(id: string) {
		error = '';
		deletingId = id;

		try {
			const response = await fetch(`/api/meals/${id}`, { method: 'DELETE' });
			if (response.status !== 204) {
				error = 'Could not delete this meal. Please try again.';
				return;
			}
			await invalidateAll();
		} catch {
			error = 'Could not delete this meal. Please try again.';
		} finally {
			deletingId = null;
		}
	}
</script>

<section>
	<h1>My Meals</h1>
	<p class="muted">Recipes you have saved from your adaptations.</p>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	{#if data.meals.length === 0}
		<p class="muted">You have not saved any meals yet.</p>
		<a class="button primary" href="/menu">Browse the menu</a>
	{:else}
		{#each data.meals as meal (meal.id)}
			<article class="card">
				<h2>{meal.title}</h2>
				<p class="muted">Saved {formatDate(meal.createdAt)}</p>
				<p>{preview(meal.content)}</p>
				<button
					class="button"
					type="button"
					disabled={deletingId === meal.id}
					onclick={() => handleDelete(meal.id)}
				>
					{deletingId === meal.id ? 'Deleting...' : 'Delete'}
				</button>
			</article>
		{/each}
	{/if}
</section>
