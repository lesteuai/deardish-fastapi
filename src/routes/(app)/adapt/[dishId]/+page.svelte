<script lang="ts">
	import { goto } from '$app/navigation';
	import SvelteMarkdown from '@humanspeak/svelte-markdown';
	import Button from '$lib/ui/Button.svelte';
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
	<a class="back" href={`/menu/${data.dish.id}`}>Back to dish</a>

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
		<article class="card recipe-card">
			<h2>Your adapted recipe</h2>
			<div class="recipe">
				<SvelteMarkdown source={content} streaming />
			</div>
		</article>
	{/if}

	<article class="card save">
		<h2>Save as meal</h2>
		<label for="meal-title">Title</label>
		<input id="meal-title" bind:value={title} maxlength="200" />
		<Button variant="primary" onclick={handleSave} disabled={!canSave}>Save as meal</Button>
	</article>
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

	.recipe-card {
		background: var(--leaf-soft);
		border: 2px dashed var(--leaf);
	}

	.recipe-card h2 {
		color: var(--leaf-dark);
	}

	article h1 {
		margin: 0.25rem 0 0.5rem;
	}

	/* SvelteMarkdown renders its own child components, so scoped selectors
	   cannot reach them; :global targets the markdown output inside .recipe. */
	.recipe {
		word-break: break-word;
	}

	/* Long recipe headings would otherwise size like page headings. */
	.recipe :global(h1),
	.recipe :global(h2),
	.recipe :global(h3) {
		margin: 1.25rem 0 0.5rem;
		color: var(--leaf-dark);
	}

	/* Drop the leading gap when the recipe opens with a heading. */
	.recipe :global(h1:first-child),
	.recipe :global(h2:first-child),
	.recipe :global(h3:first-child) {
		margin-top: 0;
	}

	.recipe :global(p) {
		margin: 0 0 0.75rem;
	}

	/* Keep steps and ingredient lists tight and clearly indented. */
	.recipe :global(ul),
	.recipe :global(ol) {
		margin: 0 0 0.75rem;
		padding-left: 1.25rem;
	}

	.recipe :global(li) {
		margin-bottom: 0.25rem;
	}

	/* Inline code chips read against the soft green recipe card. */
	.recipe :global(code) {
		padding: 0.1rem 0.35rem;
		border-radius: 6px;
		background: var(--cream);
		font-size: 0.95em;
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
