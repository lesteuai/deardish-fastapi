<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	type Props = {
		href?: string;
		variant?: 'primary' | 'secondary';
		class?: string;
		children: Snippet;
	} & HTMLAnchorAttributes &
		HTMLButtonAttributes;

	let { href, variant = 'secondary', class: className = '', children, ...rest }: Props = $props();
</script>

{#if href}
	<a {href} class="button {className}" class:primary={variant === 'primary'} {...rest}>
		{@render children()}
	</a>
{:else}
	<button type="button" class="button {className}" class:primary={variant === 'primary'} {...rest}>
		{@render children()}
	</button>
{/if}
