<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/ui/Button.svelte';
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
		<div class="card empty">
			<p class="muted">You have not saved any meals yet.</p>
			<Button href="/menu" variant="primary">Browse the menu</Button>
		</div>
	{:else}
		{#each data.meals as meal (meal.id)}
			<article class="card">
				<div class="meal-head">
					<h2>{meal.title}</h2>
					<span class="date-pill">Saved {formatDate(meal.createdAt)}</span>
				</div>
				<p>{preview(meal.content)}</p>
				<Button
					type="button"
					disabled={deletingId === meal.id}
					onclick={() => handleDelete(meal.id)}
				>
					{deletingId === meal.id ? 'Deleting...' : 'Delete'}
				</Button>
			</article>
		{/each}
	{/if}
</section>

<style>
	.meal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.date-pill {
		display: inline-block;
		background: var(--sun-soft);
		color: var(--sun-dark);
		border: 1px solid var(--sun);
		border-radius: var(--radius-pill);
		padding: 0.2rem 0.7rem;
		font-size: 0.85rem;
		font-weight: 700;
	}

	.empty {
		text-align: center;
	}
</style>
