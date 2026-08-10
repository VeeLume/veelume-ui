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

<div class="relative flex min-h-0 flex-1 gap-3 {klass}">
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
			⚑ Only the SHOW affordance lives here, only while collapsed, and
			DOCKED rather than laid out. Four placements were tried:

			  1. a 12px seam with a bare chevron — unfindable;
			  2. the same seam, weightier and bar-aligned — findable, but a
			     permanent column reserved for one button;
			  3. a 36px rail while collapsed — no permanent cost, but still a
			     column, and a square handle spending width it does not need;
			  4. this: absolutely positioned in the surface's own left gutter, so
			     the detail pane runs edge to edge and the handle reserves nothing
			     at all.

			The rule underneath is the containment rule with its edge case named.
			HIDE belongs to the list's own header — it acts on the list, so it
			rides in the list's chrome and costs no layout. SHOW cannot, because
			the box it would live in is exactly the box that is gone.

			Shape follows the same logic: a splitter is read ALONG the seam it
			opens, so height is what makes it a target and width is pure cost —
			tall and narrow, flat against the left edge, rounded only on the side
			facing the content it will push.
		-->
		<button
			type="button"
			class="absolute top-4 left-0 z-10 hidden h-16 w-3 place-items-center rounded-r-md
			       border border-l-0 border-border bg-background text-xs text-muted-foreground
			       shadow-xs transition-colors hover:w-4 hover:bg-muted hover:text-foreground
			       md:grid"
			aria-label={kit.labels.showList()}
			title={kit.labels.showList()}
			aria-expanded={false}
			onclick={() => oncollapse(false)}
		>
			›
		</button>
	{/if}

	{#if detail}
		<!-- The collapsed pane keeps a handle-wide gutter of its own. Without it
		     the docked handle would sit ON the card for any surface that has no
		     padding of its own — the demo's `p-3` happens to match the handle
		     exactly, which is luck, not a contract. 12px while collapsed is the
		     whole cost, against 36 for a rail and 20 for a permanent divider. -->
		<div
			class="min-h-0 min-w-0 flex-1 {selected || !list ? '' : 'hidden md:block'}
			       {oncollapse && list && collapsed ? 'md:pl-3' : ''}"
		>
			{@render detail()}
		</div>
	{/if}
</div>
