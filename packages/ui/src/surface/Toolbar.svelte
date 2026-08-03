<script lang="ts">
	/**
	 * The ESCALATION bar — and the default is not to have one.
	 *
	 * A surface has three owners of chrome, and the test for where a control goes
	 * is simply which one it belongs to:
	 *
	 *   list chrome    search, filters, "New …"      → `Surface.ListHeader`
	 *   record chrome  back, title, save, overflow   → `DetailHeader`
	 *   surface chrome belongs to NEITHER pane       → here
	 *
	 * Surface chrome is scope switchers (a year, an account), list↔table mode, and
	 * actions that operate on the whole surface rather than on the list or the
	 * open record. Most surfaces have none — so most surfaces omit this part and
	 * spend the 56px on content instead. **Render it only when the third bucket is
	 * non-empty**; that is the whole rule, and it is checkable per control.
	 *
	 * It deliberately has no `title`. The nav rail already names the surface, and a
	 * bar that repeats it is duplicating a label to justify its own existence.
	 *
	 * ⚑ It hides on a narrow screen when a record is open. On narrow the record IS
	 * the page, so the entire list side — this bar, the list header, the list —
	 * steps aside as one unit. It reads `selected` from Root, so a caller cannot
	 * get this half-right.
	 */
	import type { Snippet } from 'svelte';
	import Bar from '../actions/Bar.svelte';
	import { breakpoints } from '../shell/breakpoints.svelte.js';
	import { getSurfaceContext } from './context.js';

	let {
		leading,
		actions,
		class: klass = ''
	}: {
		/** Scope switchers, mode toggles — the left-hand region. */
		leading?: Snippet;
		/** Surface-wide actions. Put an `<Actions>` here; the tiers do the rest. */
		actions?: Snippet;
		class?: string;
	} = $props();

	const s = getSurfaceContext();
	const asideForRecord = $derived(!!s.selected && !breakpoints.isDesktop);
</script>

{#if !asideForRecord}
	<Bar class={klass}>
		{#if leading}{@render leading()}{/if}

		<!-- ml-auto on the wrapper, not the cluster, so the forward action is pinned
		     to the right edge whether or not anything sits on the left. -->
		<div class="ml-auto flex shrink-0 items-center gap-2">
			{#if actions}{@render actions()}{/if}
		</div>
	</Bar>
{/if}
