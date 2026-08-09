<script lang="ts">
	/**
	 * The anchored-panel base — extracted from its two derivations
	 * (`Surface.FilterButton`, `Notify.Center`) once they disagreed about
	 * dismissal: one had an outside-click catcher and no Escape, the other
	 * neither. The base owns the semantics so a consumer cannot get them
	 * half-right:
	 *
	 *   - outside click closes (a transparent catcher, so the click that
	 *     closes does NOT also activate what it landed on)
	 *   - Escape closes
	 *   - focus returns to the trigger when closing dropped it on <body> —
	 *     and only then, so a close that moved focus deliberately keeps it
	 *
	 * The panel is position: absolute inside the consumer's `relative`
	 * wrapper. `position` REPLACES the default anchor classes rather than
	 * merging — two `top-*` utilities on one element resolve by stylesheet
	 * order, not author intent. Collision-aware placement (flip/shift via
	 * floating-ui, portalling out of overflow clips) is the planned upgrade
	 * INSIDE this component; it changes no consumer's API, which is the
	 * point of the extraction.
	 */
	import type { Snippet } from 'svelte';

	let {
		open = false,
		onclose,
		position = undefined,
		label = undefined,
		class: klass = '',
		children
	}: {
		open?: boolean;
		onclose: () => void;
		/** Anchor classes, replacing the default `top-full left-0 mt-2`
		 *  (below the trigger, left-aligned). */
		position?: string;
		/** Accessible name for the panel. */
		label?: string;
		/** Sizing and padding — width is the consumer's call. */
		class?: string;
		children: Snippet;
	} = $props();

	const anchor = $derived(position || 'top-full left-0 mt-2');

	let lastFocus: HTMLElement | null = null;

	$effect(() => {
		if (open) {
			lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		} else if (lastFocus) {
			// Restore only when closing stranded focus on <body> (Escape, or the
			// catcher unmounting under the pointer). If focus landed somewhere
			// real, the user put it there.
			if (document.activeElement === document.body || document.activeElement === null) {
				lastFocus.focus();
			}
			lastFocus = null;
		}
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
		}
	}
</script>

<svelte:window onkeydown={open ? onkeydown : undefined} />

{#if open}
	<button
		type="button"
		class="fixed inset-0 z-40 cursor-default"
		tabindex="-1"
		aria-hidden="true"
		onclick={onclose}
	></button>

	<div
		role="dialog"
		aria-label={label}
		class="absolute z-50 rounded-lg border border-border bg-popover text-popover-foreground
		       shadow-lg {anchor} {klass}"
	>
		{@render children()}
	</div>
{/if}
