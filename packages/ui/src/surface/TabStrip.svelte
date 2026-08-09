<script lang="ts">
	/**
	 * The working set's tab strip — the workbench's L2 half.
	 *
	 * Reads ACTIVE from the surface context (`Root.selected`, i.e. the URL);
	 * holds the TAB SET via the `workset` prop. It deliberately does not own
	 * either: the split of authorities is the design (see workset.svelte.ts).
	 *
	 * Composable by omission, per gesture:
	 *   - no `onbelow`  → no split button; the strip is single-pane
	 *   - no `onback`   → no narrow-width back button
	 *
	 * The strip also owns the URL→workset sync — a deep link or back/forward
	 * must land as a visible tab. ⚑ It is `untrack`ed with a plain-variable
	 * guard, and that is load-bearing: `select()` reads the workset's own
	 * state, so a naked call would make this effect re-run on workset
	 * mutations — BEFORE a pending `goto` updates the URL, which still holds
	 * a just-closed key — and resurrect closed tabs. The prototype hit
	 * exactly this; owning the sync here means no consumer can re-hit it.
	 *
	 * Rendering expects the pane card DIRECTLY below: the active tab carries
	 * `border-b-card` and the strip a `-mb-px`, so the tab blends into the
	 * card's top edge. Pair with `rounded-tl-none` on the card while tabs
	 * exist (see apps/demo's catalog).
	 */
	import { untrack } from 'svelte';
	import { getKitContext } from '../context/index.js';
	import { getSurfaceContext } from './context.js';
	import type { Workset } from './workset.svelte.js';

	let {
		workset,
		titleOf = undefined,
		onactivate,
		onback = undefined,
		onbelow = undefined,
		class: klass = ''
	}: {
		workset: Workset;
		/** Tab label for a key. Default: the row's title via the surface
		 *  context's `byKey` — which reads ALL rows, so a label resolves even
		 *  while its row is filtered out of the list. */
		titleOf?: (key: string) => string;
		/** Make a key the active selection — the consumer writes its URL.
		 *  `null` means the set emptied: clear the selection. */
		onactivate: (key: string | null) => void;
		/** Narrow-width back button (clears the selection so the list
		 *  returns). Omit and no button renders. */
		onback?: () => void;
		/** Open a key in the second pane. Omit and no split button renders. */
		onbelow?: (key: string) => void;
		class?: string;
	} = $props();

	const s = getSurfaceContext();
	const kit = getKitContext();

	const label = (key: string) => (titleOf ? titleOf(key) : (s.byKey(key)?.title ?? key));

	function close(key: string) {
		const next = workset.close(key);
		if (s.selected === key) onactivate(next);
	}

	// The URL is the authority on ACTIVE; the workset follows. Guarded and
	// untracked — see the header comment for why both are load-bearing.
	let lastSynced: string | null = null; // deliberately not $state
	$effect(() => {
		const k = s.selected;
		if (k === lastSynced) return;
		lastSynced = k;
		if (k) untrack(() => workset.select(k));
	});
</script>

{#if workset.tabs.length > 0}
	<div class="-mb-px flex items-end gap-1 overflow-x-auto {klass}" role="tablist">
		{#if onback}
			<button
				type="button"
				class="mr-1 mb-1 grid size-9 shrink-0 place-items-center rounded-md border
				       border-input md:hidden"
				aria-label={kit.labels.back()}
				onclick={onback}
			>
				←
			</button>
		{/if}
		{#each workset.tabs as t (t.key)}
			{@const isActive = t.key === s.selected}
			<!-- The attachment reads isActive, so activating a tab by ANY route —
			     click, close-promotes-neighbour, back/forward — scrolls it into
			     view when the strip overflows. -->
			<div
				role="tab"
				aria-selected={isActive}
				class="flex shrink-0 items-center rounded-t-md border
				       {isActive
					? 'border-border border-b-card bg-card'
					: 'border-transparent text-muted-foreground hover:text-foreground'}"
				{@attach (node) => {
					if (isActive) node.scrollIntoView({ inline: 'nearest', block: 'nearest' });
				}}
			>
				<button
					type="button"
					class="h-9 max-w-48 truncate pl-3 pr-1 text-sm {t.pinned ? '' : 'italic'}"
					title={t.pinned ? label(t.key) : `${label(t.key)} — ${kit.labels.tabPreviewHint()}`}
					onclick={() => onactivate(t.key)}
					ondblclick={() => workset.pin(t.key)}
				>
					{label(t.key)}
				</button>
				{#if onbelow}
					<button
						type="button"
						class="grid size-5 place-items-center rounded-sm text-xs
						       text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label={kit.labels.tabOpenBelow()}
						title={kit.labels.tabOpenBelow()}
						onclick={() => onbelow(t.key)}
					>
						⊟
					</button>
				{/if}
				<button
					type="button"
					class="mr-1 grid size-5 place-items-center rounded-sm text-xs
					       text-muted-foreground hover:bg-muted hover:text-foreground"
					aria-label={kit.labels.tabClose()}
					onclick={() => close(t.key)}
				>
					✕
				</button>
			</div>
		{/each}
	</div>
{/if}
