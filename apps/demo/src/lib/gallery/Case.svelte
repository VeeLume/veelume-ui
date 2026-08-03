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

<section class="grid gap-2">
	<div>
		<h3 class="text-sm font-medium">{title}</h3>
		{#if note}<p class="text-xs text-muted-foreground">{note}</p>{/if}
	</div>
	<div class={frame ? 'rounded-lg border border-border bg-card p-3' : ''}>
		{@render children()}
	</div>
</section>
