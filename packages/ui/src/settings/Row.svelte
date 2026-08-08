<script lang="ts">
	/**
	 * One setting: label and hint on the left, the control trailing right —
	 * the row idiom every donor's settings pages share (Starlume's Switch
	 * rows, stibu's konto rows, the old demo toggles). This is what keeps a
	 * page of mixed controls looking composed instead of dropped in: the
	 * controls all hang from the same right edge, the text all starts at the
	 * same left edge.
	 *
	 * For a control too wide to trail on a phone (a Segmented with long
	 * labels), skip the Row and put it under a `Settings.Section` heading
	 * instead — stibu's Darstellung page does exactly that.
	 */
	import type { Snippet } from 'svelte';

	let {
		label,
		hint = undefined,
		children
	}: {
		label: string;
		hint?: string;
		children: Snippet;
	} = $props();
</script>

<div
	class="flex w-full items-center justify-between gap-4"
	style="min-height: var(--density-target)"
>
	<span class="min-w-0">
		<span class="block text-sm font-medium">{label}</span>
		{#if hint}
			<span class="block text-xs text-muted-foreground">{hint}</span>
		{/if}
	</span>
	<span class="flex shrink-0 items-center">
		{@render children()}
	</span>
</div>
