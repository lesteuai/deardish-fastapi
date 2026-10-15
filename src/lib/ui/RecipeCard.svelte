<script lang="ts">
	import SvelteMarkdown from '@humanspeak/svelte-markdown';

	type Props = {
		content: string;
		title?: string;
		streaming?: boolean;
	};

	let { content, title = 'Your adapted recipe', streaming = false }: Props = $props();
</script>

<article class="card recipe-card">
	<h2>{title}</h2>
	<div class="recipe">
		<SvelteMarkdown source={content} {streaming} />
	</div>
</article>

<style>
	.recipe-card {
		background: var(--leaf-soft);
		border: 2px dashed var(--leaf);
	}

	.recipe-card h2 {
		color: var(--leaf-dark);
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
</style>
