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
	import { getKitContext } from '../context/index.js';
	import { getSurfaceContext } from './context.js';

	let {
		list,
		detail,
		collapsed = false,
		oncollapse = undefined,
		class: klass = ''
	}: {
		list?: Snippet;
		detail?: Snippet;
		/**
		 * Give the detail region the full width. Controlled, like `Switch`:
		 * whether this is a per-session preference, a URL param or a stored
		 * setting is the app's call, and the split just renders what it is told.
		 */
		collapsed?: boolean;
		/**
		 * Receives the requested next state.
		 *
		 * ⚑ The kit renders only the SHOW affordance, and only while collapsed.
		 * **The HIDE control is the app's, and belongs in the list's own header**
		 * (`Surface.List`'s `headerLeading`) — it acts on the list, so by the
		 * containment rule it rides in the list's chrome, where it costs no
		 * layout at all. Show cannot follow that rule, because the box it would
		 * live in is the one that just disappeared; that asymmetry is the whole
		 * design, not an oversight.
		 *
		 * Omit and neither exists — a surface whose list is always visible never
		 * grows a control it has to explain.
		 */
		oncollapse?: (next: boolean) => void;
		class?: string;
	} = $props();

	// From Root, not a prop: which pane a narrow screen shows and which row the
	// list highlights are the same fact, and passing it twice invites them to
	// disagree.
	const s = getSurfaceContext();
	const kit = getKitContext();
	const selected = $derived(!!s.selected);

	/**
	 * ⚑ Collapse applies only where the split EXISTS. Below `md` the list and
	 * the record already take turns being the whole page, so a collapsed list
	 * there would either do nothing or hide the only thing on screen — which is
	 * why the hidden state is `md:` scoped rather than absolute.
	 */
	const listHidden = $derived(collapsed && !!detail);
</script>

<div class="flex min-h-0 flex-1 gap-3 {klass}">
	{#if list}
		<div
			class="flex min-h-0 w-full flex-col md:w-80 md:shrink-0 lg:w-96 {selected
				? 'hidden md:flex'
				: ''} {listHidden ? 'md:hidden' : ''}"
		>
			{@render list()}
		</div>
	{/if}

	{#if oncollapse && list && detail && collapsed}
		<!--
			⚑ Only the SHOW affordance lives here, and only while collapsed.
			Three placements were tried before this one:

			  1. a 12px seam with a bare chevron — unfindable;
			  2. the same seam, weightier and bar-aligned — findable, but it is a
			     permanent column reserved for one button ("the divider just eats
			     space for a single button");
			  3. this: nothing at all while expanded.

			The rule that falls out is the containment rule with its edge case
			named. HIDE belongs to the list's own header — it acts on the list, so
			it rides in the list's chrome and costs no layout. SHOW cannot,
			because the box it would live in is exactly the box that is gone; so
			the kit supplies it, and only then. A rail that exists only while
			collapsed spends 36px at the moment the list just gave back 384.
		-->
		<div class="hidden w-9 shrink-0 flex-col items-center pt-4 md:flex">
			<button
				type="button"
				class="grid size-7 place-items-center rounded-md border border-border bg-background
				       text-muted-foreground shadow-xs transition-colors hover:bg-muted
				       hover:text-foreground"
				aria-label={kit.labels.showList()}
				title={kit.labels.showList()}
				aria-expanded={false}
				onclick={() => oncollapse(false)}
			>
				›
			</button>
		</div>
	{/if}

	{#if detail}
		<div class="min-h-0 min-w-0 flex-1 {selected || !list ? '' : 'hidden md:block'}">
			{@render detail()}
		</div>
	{/if}
</div>
