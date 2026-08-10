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
	import { tick, untrack, type Snippet } from 'svelte';
	import { getKitContext } from '../context/index.js';
	import { getSurfaceContext } from './context.js';
	import Tab from './Tab.svelte';
	import type { Workset } from './workset.svelte.js';

	let {
		workset,
		titleOf = undefined,
		onactivate,
		onback = undefined,
		onbelow = undefined,
		trailing,
		selected = undefined,
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
		/**
		 * Pinned to the RIGHT of the strip, after a flexible gap — for things
		 * that are part of the working set's chrome rather than of the set: a
		 * compare tab, a layout toggle. Rendering them as a trailing tab rather
		 * than a button elsewhere keeps every way of looking at the set in one
		 * row, which is the whole point of a strip.
		 */
		trailing?: Snippet;
		/**
		 * Overrides which tab reads as active. Defaults to `Root.selected`.
		 *
		 * ⚑ `null` means NO record tab is active — which is what a surface needs
		 * when the detail region is showing something that is not a record at
		 * all. A compare view is a tab too, so leaving the record tab lit while
		 * comparing shows two active tabs and lies about which one you are in.
		 * The record's own selection stays in the URL, untouched, so returning
		 * to it is one click.
		 */
		selected?: string | null;
		class?: string;
	} = $props();

	const s = getSurfaceContext();
	const kit = getKitContext();

	const activeKey = $derived(selected !== undefined ? selected : s.selected);

	const label = (key: string) => (titleOf ? titleOf(key) : (s.byKey(key)?.title ?? key));

	// `$state` because the keydown handler reads it — a plain `let` assigned by
	// `bind:this` never notifies, which svelte-check flags precisely because
	// the read would silently see `undefined`.
	let strip = $state<HTMLElement | undefined>(undefined);

	/** The tabs' own focusable elements, in visual order. Queried rather than
	 *  tracked in an array because the trailing slot's content is the app's and
	 *  may legitimately be a tab too (the demo's Compare). */
	const tabButtons = () => (strip ? [...strip.querySelectorAll<HTMLElement>('[role="tab"]')] : []);

	function close(key: string, refocus = false) {
		const next = workset.close(key);
		if (s.selected === key) onactivate(next);
		// Keyboard closes must land focus somewhere deliberate; a mouse close
		// leaves focus where the pointer put it, which is already correct.
		if (refocus) void tick().then(() => tabButtons()[0]?.focus());
	}

	/**
	 * ⚑ Browser-tab keyboard semantics, and they are not decoration: this strip
	 * already declares `role="tablist"`/`role="tab"`, which PROMISES arrow-key
	 * navigation and a roving tabindex. Declaring the roles without the
	 * interaction is worse than not declaring them — a screen reader announces
	 * a tab list the keyboard then refuses to drive.
	 *
	 * Activation is MANUAL (arrows move focus, Enter/Space activate) rather
	 * than automatic-on-focus. Automatic is the commoner tab pattern, but here
	 * activation navigates and writes history, so arrowing across five tabs
	 * would push five entries the back button then has to walk.
	 */
	function onkeydown(event: KeyboardEvent) {
		const buttons = tabButtons();
		const from = buttons.indexOf(document.activeElement as HTMLElement);
		if (from < 0) return;

		let to = -1;
		if (event.key === 'ArrowRight') to = (from + 1) % buttons.length;
		else if (event.key === 'ArrowLeft') to = (from - 1 + buttons.length) % buttons.length;
		else if (event.key === 'Home') to = 0;
		else if (event.key === 'End') to = buttons.length - 1;
		else if (event.key === 'Delete') {
			// The APG's gesture for a deletable tab. Ctrl+W is the browser's own
			// and cannot be intercepted on the web at all — a desktop shell can
			// bind it, which makes it the app's business rather than the kit's.
			const key = buttons[from].dataset.tabKey;
			if (key) {
				event.preventDefault();
				close(key, true);
			}
			return;
		} else return;

		event.preventDefault();
		buttons[to]?.focus();
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
	<!-- `tabindex={-1}` on the list itself: the ROVING tabindex lives on the
	     tabs, so the container must be focusable-by-script yet skipped by Tab —
	     which is also what satisfies `tablist`'s focus contract. -->
	<div
		bind:this={strip}
		class="-mb-px flex items-end gap-1 overflow-x-auto {klass}"
		role="tablist"
		tabindex={-1}
		{onkeydown}
	>
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
			{@const isActive = t.key === activeKey}
			<!-- `activate`, not a dblclick: activating the previewed tab again pins
			     it, and that gesture survives the re-render the first activation
			     causes. See `createWorkset.activate`. -->
			<Tab
				active={isActive}
				muted={!t.pinned}
				tabKey={t.key}
				focusable={isActive}
				title={t.pinned ? label(t.key) : `${label(t.key)} — ${kit.labels.tabPreviewHint()}`}
				onclick={() => {
					workset.activate(t.key);
					onactivate(t.key);
				}}
				onauxclick={(e) => {
					// Middle click closes, as in every browser since tabs existed.
					if (e.button === 1) {
						e.preventDefault();
						close(t.key);
					}
				}}
				onmousedown={(e) => {
					// Without this the middle button starts autoscroll, which leaves
					// the page in scroll mode after the tab is gone.
					if (e.button === 1) e.preventDefault();
				}}
			>
				{label(t.key)}
				{#snippet actions()}
					<!-- The controls inside a tab are OUT of the tab order (`-1`):
					     browser tabs behave the same way, and Delete on the focused
					     tab is the keyboard path to closing. Otherwise every tab would
					     cost three Tab presses to walk past. -->
					{#if onbelow}
						<!-- ⚑ Revealed on hover, or kept on the ACTIVE tab. A control
						     repeated on every tab reads as noise the moment there are
						     more than three, and splitting is a deliberate act rather
						     than a per-tab affordance. Browser tabs treat their close
						     button the same way. Opacity at a fixed size, never width,
						     so revealing it cannot reflow the strip under the pointer. -->
						<button
							type="button"
							tabindex="-1"
							class="grid size-5 place-items-center rounded-sm text-xs text-muted-foreground
							       transition-opacity hover:bg-muted hover:text-foreground
							       group-hover:pointer-events-auto group-hover:opacity-100
							       {isActive ? 'opacity-100' : 'pointer-events-none opacity-0'}"
							aria-label={kit.labels.tabOpenBelow()}
							title={kit.labels.tabOpenBelow()}
							onclick={() => onbelow(t.key)}
						>
							⊟
						</button>
					{/if}
					<button
						type="button"
						tabindex="-1"
						class="mr-1 grid size-5 place-items-center rounded-sm text-xs
						       text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label={kit.labels.tabClose()}
						onclick={() => close(t.key)}
					>
						✕
					</button>
				{/snippet}
			</Tab>
		{/each}
		{#if trailing}
			<!-- `ml-auto` rather than a spacer element: the trailing group sits
			     right when there is room and simply follows the tabs when the
			     strip is already overflowing, instead of being pushed off. -->
			<div class="ml-auto flex shrink-0 items-end pl-2">
				{@render trailing()}
			</div>
		{/if}
	</div>
{/if}
