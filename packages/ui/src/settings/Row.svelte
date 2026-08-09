<script lang="ts">
	/**
	 * One setting: label and hint on the left, the control trailing right —
	 * the row idiom every donor's settings pages share (Starlume's Switch
	 * rows, stibu's konto rows). This is what keeps a page of mixed controls
	 * looking composed instead of dropped in: text from one left edge,
	 * controls hanging from one right edge.
	 *
	 * The layout adapts by CONTENT, not by breakpoint: flex-wrap plus a
	 * minimum label width means the control sits inline while it actually
	 * fits beside the label, and drops below it (left-aligned — stibu's
	 * "under the heading" arrangement) the moment it does not. A Switch
	 * therefore stays inline even on a phone, while a wide Segmented wraps
	 * exactly when the space runs out — no prop to set, no breakpoint to
	 * keep in sync with the control's real width.
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
	class="flex w-full flex-wrap items-center justify-between gap-x-8 gap-y-2"
	style="min-height: var(--density-target)"
>
	<!-- min-w is the wrap trigger: the label refuses to shrink below it, so a
	     control that would crowd it moves to its own line instead. -->
	<span class="min-w-48 flex-1">
		<span class="block text-sm font-medium">{label}</span>
		{#if hint}
			<span class="block text-xs text-muted-foreground">{hint}</span>
		{/if}
	</span>
	<span class="flex shrink-0 items-center">
		{@render children()}
	</span>
</div>
