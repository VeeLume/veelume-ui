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
		 * Receives the requested next state. **Omit and no control renders** —
		 * a surface whose list should always be visible never grows a divider
		 * it has to explain.
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

	{#if oncollapse && list && detail}
		<!-- The divider IS the control. A button in either pane's chrome would
		     belong to that pane and compete with its contents; the seam between
		     them belongs to neither, which is the same containment argument that
		     put search inside the list. Hidden below `md` with the split. -->
		<div class="hidden shrink-0 items-center md:flex">
			<button
				type="button"
				class="grid h-16 w-3 place-items-center rounded-full text-xs text-muted-foreground
				       hover:bg-muted hover:text-foreground"
				aria-label={collapsed ? kit.labels.showList() : kit.labels.hideList()}
				title={collapsed ? kit.labels.showList() : kit.labels.hideList()}
				aria-expanded={!collapsed}
				onclick={() => oncollapse(!collapsed)}
			>
				{collapsed ? '›' : '‹'}
			</button>
		</div>
	{/if}

	{#if detail}
		<div class="min-h-0 min-w-0 flex-1 {selected || !list ? '' : 'hidden md:block'}">
			{@render detail()}
		</div>
	{/if}
</div>
