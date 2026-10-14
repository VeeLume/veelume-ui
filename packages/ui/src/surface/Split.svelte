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
	import PanelIcon from './PanelIcon.svelte';

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
	const kit = getKitContext();
	const selected = $derived(!!s.selected);
	// From Root, like `selected`: the HIDE half lives in the list's header and
	// the SHOW half here, and one fact must drive both.
	const collapse = $derived(s.collapse);
	const collapsed = $derived(!!collapse?.collapsed);

	/**
	 * ⚑ Collapse applies only where the split EXISTS. Below `md` the list and
	 * the record already take turns being the whole page, so a collapsed list
	 * there would either do nothing or hide the only thing on screen — which is
	 * why the hidden state is `md:` scoped rather than absolute.
	 */
	const listHidden = $derived(collapsed && !!detail);
</script>

<!-- `p-3` is the surface gutter, not a caller decision: both demo surfaces
     asked for exactly it. Override via `class` for a surface that is already
     inset. -->
<div class="relative flex min-h-0 flex-1 gap-3 p-3 {klass}">
	{#if list}
		<div
			class="flex min-h-0 w-full flex-col md:w-80 md:shrink-0 lg:w-96 {selected
				? 'hidden md:flex'
				: ''} {listHidden ? 'md:hidden' : ''}"
		>
			{@render list()}
		</div>
	{/if}

	{#if collapse && list && detail && collapsed}
		<!--
			⚑ The collapsed list is a 48px RAIL — `Surface.Supporting`'s model,
			mirrored, so the kit's two collapsible panes are one control. The
			toggle has one position in both states: the list header's leading
			toggle centres 24px in from the list's edge in the bar row, and the
			rail's glyph sits exactly there, so hiding and showing never move
			the target. The whole strip is the button.

			This replaced a DOCKED handle — a slim tab absolutely positioned in
			the gutter, reserving nothing. It won on cost and lost on the only
			thing that mattered: people could not find it, and its two halves
			(a half-button in the header, a tab on the edge) did not read as one
			control. Four placements were tried before it (a 12px seam; the same
			seam weightier; a 36px rail with a square handle; the dock); the rail
			came back once the supporting pane showed that a collapsed pane that
			names itself is worth its 48px.

			Card-shaped like the list it stands in for, inside the same gutter,
			so it reads as the list folded away rather than as new chrome.
		-->
		<button
			type="button"
			class="hidden w-12 shrink-0 flex-col items-center gap-3 overflow-hidden rounded-lg border
			       border-border bg-card text-muted-foreground transition-colors hover:bg-muted
			       hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40
			       focus-visible:outline-none md:flex"
			aria-label={kit.labels.showList()}
			title={kit.labels.showList()}
			aria-expanded={false}
			onclick={() => collapse.set(false)}
		>
			<span class="flex h-14 shrink-0 items-center"><PanelIcon side="left" open={false} /></span>
			<span class="text-sm font-medium [writing-mode:vertical-rl]">{kit.labels.showList()}</span>
		</button>
	{/if}

	{#if detail}
		<div class="min-h-0 min-w-0 flex-1 {selected || !list ? '' : 'hidden md:block'}">
			{@render detail()}
		</div>
	{/if}
</div>
