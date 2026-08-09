<script lang="ts">
	/**
	 * One specimen: a title, why it exists, and the thing itself.
	 *
	 * The `note` is not decoration. A gallery whose captions only restate the
	 * title teaches nothing — the useful caption says what to LOOK at, or which
	 * decision the case is evidence for.
	 */
	import type { Snippet } from 'svelte';

	let {
		title,
		note,
		frame = true,
		children
	}: {
		title: string;
		note?: string;
		/** Off for specimens that supply their own container. */
		frame?: boolean;
		children: Snippet;
	} = $props();
</script>

<!-- min-w-0 twice, deliberately: a grid item's min-width defaults to AUTO, so
     a wide specimen (an overflowing tab strip) silently widens the whole page
     instead of scrolling inside its own overflow container. Both the section
     (a grid item of the page) and the content div (a grid item of the section)
     need it — the blowout re-forms at whichever level is left out. -->
<section class="grid min-w-0 gap-2">
	<div>
		<h3 class="text-sm font-medium">{title}</h3>
		{#if note}<p class="text-xs text-muted-foreground">{note}</p>{/if}
	</div>
	<div class="min-w-0 {frame ? 'rounded-lg border border-border bg-card p-3' : ''}">
		{@render children()}
	</div>
</section>
