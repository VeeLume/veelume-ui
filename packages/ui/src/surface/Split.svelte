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
	 *
	 * The column is `w-80 lg:w-96`, matching stibu. The narrower 18rem it started
	 * at was chosen before the list owned its own header, and a filter button plus
	 * a search field plus a "New …" button do not fit in 18rem — the width is what
	 * makes "fit as much as possible without being unclean" actually fit.
	 */
	import type { Snippet } from 'svelte';
	import { getSurfaceContext } from './context.js';

	let {
		list,
		detail,
		class: klass = ''
	}: {
		list?: Snippet;
		detail?: Snippet;
		class?: string;
	} = $props();

	// From Root, not a prop: which pane a narrow screen shows and which row the
	// list highlights are the same fact, and passing it twice invites them to
	// disagree.
	const s = getSurfaceContext();
	const selected = $derived(!!s.selected);
</script>

<div class="flex min-h-0 flex-1 gap-3 {klass}">
	{#if list}
		<div
			class="flex min-h-0 w-full flex-col md:w-80 md:shrink-0 lg:w-96 {selected
				? 'hidden md:flex'
				: ''}"
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
