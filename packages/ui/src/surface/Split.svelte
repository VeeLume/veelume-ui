<script lang="ts">
	/**
	 * The responsive list/detail arrangement, and the one place the layout
	 * opinion lives:
	 *
	 *   wide   — list beside the record, selection is instant
	 *   narrow — the list IS the page; picking a record navigates and the list
	 *            steps aside
	 *
	 * Omitting this and rendering `<Surface.List>` alone gives a plain list.
	 * Omitting the list instead gives archetype E — "a record as the whole
	 * surface" — which is why it is a missing child rather than a second shell.
	 */
	import type { Snippet } from 'svelte';

	let {
		/** Whether a record is open — drives which pane a narrow screen shows. */
		selected = false,
		list,
		detail,
		class: klass = ''
	}: {
		selected?: boolean;
		list?: Snippet;
		detail?: Snippet;
		class?: string;
	} = $props();
</script>

<div class="flex min-h-0 flex-1 gap-3 {klass}">
	{#if list}
		<div
			class="flex min-h-0 w-full flex-col md:w-72 md:shrink-0 {selected ? 'hidden md:flex' : ''}"
		>
			{@render list()}
		</div>
	{/if}

	{#if detail}
		<div class="min-h-0 min-w-0 flex-1 {selected || !list ? '' : 'hidden md:block'}">
			{@render detail()}
		</div>
	{/if}
</div>
