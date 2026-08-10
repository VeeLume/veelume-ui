<script lang="ts">
	/**
	 * The list's own header: `[leading] [filters] [search] [action]`.
	 *
	 * ⚑ It lives INSIDE the list pane, and that containment is the design.
	 *
	 * Search and filters belong to the list, not to the page. Putting them in a
	 * page-level bar produced three defects at once, all of which this fixes by
	 * construction rather than by rule:
	 *
	 *   - they sat at the page's left edge while the list they filtered started
	 *     further in, so the control and its target visibly disagreed;
	 *   - they survived into the detail view on a narrow screen — filters for a
	 *     list that was not on screen;
	 *   - the bar needed a title to justify its width, which duplicated the label
	 *     the nav rail was already showing.
	 *
	 * None of those are reachable from here: a child of the list is aligned with
	 * the list, hidden with the list, and has no page to name.
	 *
	 * Lifted from stibu's `ListHeader`, which is the same three slots in the same
	 * order and is the part of that app's layout Valerie rates highest.
	 *
	 * **Absence is neutral, and it is declared by the descriptor.** No search
	 * function → no search field. No facets and no sorts → no filter button. No
	 * action → no button. Nothing to show → the header does not render at all, and
	 * the list keeps the 56px. That is what "avoid a bar unless it earns its
	 * space" means mechanically; there is no flag to set.
	 */
	import type { Snippet } from 'svelte';
	import Bar from '../actions/Bar.svelte';
	import Button from '../actions/Button.svelte';
	import FilterButton from './FilterButton.svelte';
	import { getKitContext } from '../context/index.js';
	import { getSurfaceContext } from './context.js';
	import type { Action, IconOf } from '../actions/types.js';

	let {
		action = undefined,
		leading,
		panel,
		class: klass = ''
	}: {
		/**
		 * The list's forward action — "New …". Tier ①, and the only one: a list has
		 * exactly one thing you came to it to start. Anything else is a record
		 * action and belongs in the `DetailHeader`.
		 */
		action?: Action;
		/** Before the filter button — a segmented control, a scope chip. */
		leading?: Snippet;
		/** Extra controls inside the FILTER PANEL — see `FilterButton.panel`.
		 *  Prefer this over `leading` for view options: the header's width
		 *  belongs to search, and a control there costs the list every time it
		 *  renders, whether or not anyone is adjusting the view. */
		panel?: Snippet;
		class?: string;
	} = $props();

	const s = getSurfaceContext();
	const kit = getKitContext();

	const filterable = $derived(s.facets.length > 0 || s.sorts.length > 0 || !!panel);
	const show = $derived(s.searchable || filterable || !!action || !!leading);
	const Icon = $derived(action?.icon as IconOf | undefined);
</script>

{#if show}
	<Bar class={klass}>
		{#if leading}{@render leading()}{/if}

		{#if filterable}<FilterButton {panel} />{/if}

		{#if s.searchable}
			<!-- Pinned to h-9 rather than the density target: at comfortable density a
			     full-height field grows to exactly the bar's own height and fills it
			     edge to edge while its neighbours sit inset. Density scales FORM
			     fields; chrome stays fixed. -->
			<input
				type="search"
				class="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
				placeholder={kit.labels.search()}
				value={s.query}
				oninput={(e) => s.browse.set('q', e.currentTarget.value as never)}
			/>
		{:else}
			<div class="flex-1"></div>
		{/if}

		{#if action}
			<Button
				variant="primary"
				href={action.href}
				onclick={action.onclick}
				disabled={action.disabled}
				title={action.title ?? action.label}
			>
				{#if Icon}<Icon class="size-4 shrink-0" />{/if}
				<!-- The label collapses in a narrow list column so the search field
				     keeps its width — but ONLY when an icon is there to carry the
				     button. Collapsing unconditionally renders an empty button, which
				     is how the same trick fails in an action cluster. -->
				<span class={Icon ? 'hidden lg:inline' : ''}>{action.label}</span>
			</Button>
		{/if}
	</Bar>
{/if}
