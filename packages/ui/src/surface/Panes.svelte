<script lang="ts">
	/**
	 * The detail region: an optional tab strip, then stacked panes.
	 *
	 * ⚑ Stacked rather than side by side, and that is the decision this
	 * component carries: two panes beside each other need WIDTH, the one axis a
	 * list-plus-detail surface has already spent, and they collapse on any
	 * narrow screen. Stacking costs height, which a viewport has more of and
	 * which no breakpoint has to gate — so the arrangement survives at phone
	 * widths where a horizontal split could not.
	 *
	 * The strip sits FLUSH against the first pane (no gap), because the active
	 * tab's `border-b-card` has to meet the card's edge to blend; the gap
	 * applies only between panes. That is the whole reason the strip is a slot
	 * here rather than something the app stacks itself — one wrapper with two
	 * different spacings inside it is exactly the thing that gets rebuilt
	 * slightly wrong in every consumer.
	 */
	import type { Snippet } from 'svelte';

	let {
		strip,
		class: klass = '',
		children
	}: {
		/** The tab strip, flush above the first pane. Omit for a single
		 *  untabbed pane — the region is then just the panes. */
		strip?: Snippet;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<div class="flex h-full min-h-0 flex-col {klass}">
	{#if strip}{@render strip()}{/if}
	<div class="flex min-h-0 flex-1 flex-col gap-3">
		{@render children()}
	</div>
</div>
