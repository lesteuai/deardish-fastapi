<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/ui/Button.svelte';
	import RecipeCard from '$lib/ui/RecipeCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function getInitialTitle() {
		return data.dish.name;
	}

	type Status = 'idle' | 'streaming' | 'complete' | 'saving';

	let status = $state<Status>('idle');
	let content = $state('');
	let errorMessage = $state('');
	let title = $state(getInitialTitle());

	const busy = $derived(status === 'streaming' || status === 'saving');
	const canSave = $derived(status === 'complete' && content.length > 0);

	async function readErrorMessage(response: Response): Promise<string> {
		if (response.status === 401) return 'Please sign in again.';
		try {
			const body = (await response.json()) as { error?: unknown };
			if (typeof body.error === 'string' && body.error) {
				return `The recipe could not be prepared: ${body.error}`;
			}
		} catch {
			// fall back to the generic message below
		}
		return 'The recipe could not be prepared. Please try again.';
	}

	async function handleAdapt() {
		status = 'streaming';
		content = '';
		errorMessage = '';

		let response: Response;
		try {
			response = await fetch('/api/adapt', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ dishId: data.dish.id })
			});
		} catch {
			status = 'idle';
			errorMessage = 'Could not reach the server. Please try again.';
			return;
		}

		if (!response.ok || !response.body) {
			status = 'idle';
			errorMessage = await readErrorMessage(response);
			return;
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				content += decoder.decode(value, { stream: true });
			}
			content += decoder.decode();
			status = 'complete';
		} catch {
			status = 'idle';
			errorMessage = 'The recipe stream was interrupted. Please try again.';
		}
	}

	async function handleSave() {
		status = 'saving';
		errorMessage = '';
		try {
			const response = await fetch('/api/meals', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title, content, sourceDishId: data.dish.id })
			});
			if (response.status === 201) {
				await goto('/meals');
				return;
			}
			status = 'complete';
			errorMessage = await readErrorMessage(response);
		} catch {
			status = 'complete';
			errorMessage = 'Could not save the meal. Please try again.';
		}
	}
</script>

<section>
	<Button class="back" onclick={() => goto(`/menu/${data.dish.id}`)}>Back to dish</Button>

	<article class="card">
		<span class="cuisine">{data.dish.cuisine}</span>
		<h1>{data.dish.name}</h1>
		<p>{data.dish.description}</p>

		<Button variant="primary" onclick={handleAdapt} disabled={busy}>Adapt this dish</Button>
	</article>

	{#if status === 'streaming'}
		<p class="muted" aria-live="polite">Adapting your dish to your health profile...</p>
	{/if}

	{#if errorMessage}
		<p class="error" role="alert">{errorMessage}</p>
	{/if}

	{#if content}
		<RecipeCard {content} streaming />
	{/if}

	<article class="card save">
		<h2>Save as meal</h2>
		<label for="meal-title">Title</label>
		<input id="meal-title" bind:value={title} maxlength="200" />
		<Button variant="primary" onclick={handleSave} disabled={!canSave}>Save as meal</Button>
	</article>
</section>

<style>
	article h1 {
		margin: 0.25rem 0 0.5rem;
	}

	.save {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.save h2 {
		margin: 0;
	}

	.save :global(button) {
		align-self: flex-start;
	}
</style>
