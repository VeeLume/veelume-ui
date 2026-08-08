<script lang="ts">
	/**
	 * One explained group of controls: heading, one-line rationale, the
	 * control. Sections divide with a rule; the first one draws none, so a
	 * page with a single section has no stray line.
	 *
	 * The description is not decoration — stibu's settings pages explain what
	 * a choice MEANS ("'System' follows your device") rather than restating
	 * the heading, and that is the register this slot is for.
	 */
	import type { Snippet } from 'svelte';

	let {
		title,
		description = undefined,
		children
	}: {
		title: string;
		description?: string;
		children: Snippet;
	} = $props();
</script>

<!-- justify-items-start: grid items are blockified, so an inline-flex control
     (Segmented) would silently stretch full-width and look unanchored. Rows
     opt back into full width with their own w-full. -->
<section
	class="grid justify-items-start gap-3 border-t border-border pt-6 pb-6 first:border-t-0 first:pt-0 last:pb-0"
>
	<div>
		<h2 class="text-sm font-semibold">{title}</h2>
		{#if description}
			<p class="text-xs text-muted-foreground">{description}</p>
		{/if}
	</div>
	{@render children()}
</section>
