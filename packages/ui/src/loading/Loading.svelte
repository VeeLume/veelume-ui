<script lang="ts">
	/**
	 * The labelled spinner for a surface that has nothing to show yet —
	 * Hearth's `Loading`, minus its domain (the load-path prediction stays
	 * an app concern; an app with something smarter to say passes `label`
	 * and `detail`).
	 *
	 * For a LIST that is loading, `Surface.List`'s own status states are the
	 * answer — this is for the boot screen and pane-sized placeholders that
	 * have no list to speak for them.
	 */
	import { getKitContext } from '../context/index.js';

	let {
		label = undefined,
		detail = undefined,
		class: klass = ''
	}: {
		/** Defaults to the label bag's Loading…. */
		label?: string;
		/** The "this can take longer" line — only when there is something to say. */
		detail?: string;
		class?: string;
	} = $props();

	const kit = getKitContext();
</script>

<div role="status" class="flex flex-col items-center gap-3 p-14 text-center {klass}">
	<span
		class="size-8 animate-spin rounded-full border-4 border-muted border-t-primary"
		aria-hidden="true"
	></span>
	<p class="text-sm">{label ?? kit.labels.loading()}</p>
	{#if detail}
		<p class="text-xs text-muted-foreground">{detail}</p>
	{/if}
</div>
