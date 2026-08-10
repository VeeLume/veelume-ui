<script lang="ts">
	/**
	 * A detail pane's card — the surface for whatever the detail region shows.
	 *
	 * Extracted because the demo was writing
	 * `flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card`
	 * three times on one page (the record pane, the second pane, the compare
	 * view), which is the `Bar` lesson in its purest form: three copies of one
	 * geometry, none of which can be corrected centrally.
	 *
	 * `min-h-0` is the load-bearing part and the easiest to forget — without it
	 * a scrolling child grows the flex item instead of scrolling inside it, and
	 * the pane quietly stops clipping.
	 */
	import type { Snippet } from 'svelte';

	let {
		tabbed = false,
		class: klass = '',
		children
	}: {
		/**
		 * A tab strip sits directly above. Squares off the top-left corner so
		 * the active tab blends into the card's edge — the strip's `-mb-px` and
		 * `border-b-card` do the rest.
		 */
		tabbed?: boolean;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<div
	class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border
	       bg-card {tabbed ? 'rounded-tl-none' : ''} {klass}"
>
	{@render children()}
</div>
