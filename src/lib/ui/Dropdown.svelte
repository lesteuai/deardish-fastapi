<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		label = 'Toggle menu',
		children
	}: { open?: boolean; label?: string; children: Snippet } = $props();
</script>

<div class="dropdown">
	<button
		class="dropdown-toggle"
		type="button"
		aria-label={label}
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<span aria-hidden="true">☰</span>
	</button>
	<div class="dropdown-menu" class:open>
		{@render children()}
	</div>
</div>

<style>
	.dropdown {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.dropdown-toggle {
		display: none;
	}

	.dropdown-menu {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	@media (max-width: 640px) {
		.dropdown-toggle {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 44px;
			height: 44px;
			border: 2px solid var(--aqua);
			border-radius: 12px;
			background: var(--cream);
			color: var(--ink);
			font-size: 1.25rem;
			cursor: pointer;
		}

		.dropdown-menu {
			position: absolute;
			top: 100%;
			right: 1rem;
			display: none;
			flex-direction: column;
			align-items: stretch;
			gap: 0.35rem;
			min-width: 200px;
			padding: 0.75rem;
			background: rgba(255, 253, 249, 0.98);
			border: 2px solid var(--aqua);
			border-radius: var(--radius);
			box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
		}

		.dropdown-menu.open {
			display: flex;
		}

		.dropdown-menu :global(form) {
			width: 100%;
		}

		.dropdown-menu :global(.button) {
			width: 100%;
			text-align: center;
		}
	}
</style>
