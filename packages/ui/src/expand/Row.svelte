<script lang="ts">
	/**
	 * The expandable row — one anatomy, filled by omission:
	 *
	 *   [ gutter ] [ caret ] [ title (+ meta) ] ……… [ right ] [ actions ]
	 *
	 * Complexity scales by WHICH SLOTS YOU FILL, not by bespoke markup or a
	 * `variant`. Starlume renders four catalogs through one such row; the
	 * tiers it names fall out of this without being modelled: gutter + title +
	 * right is a line, adding `children` makes it expandable, adding `meta`
	 * gives it a chip line.
	 *
	 * ⚑ There is no `expandable` prop. Supplying `children` IS what makes a row
	 * expandable — the donor carried both a boolean and the content, and the
	 * two could disagree.
	 *
	 * Two gestures, split by omission as well:
	 *   - `onselect` supplied → the body SELECTS, the caret TOGGLES (the
	 *     workbench case: peeking at structure must not disturb the working set)
	 *   - `onselect` omitted → the whole row toggles (Starlume's catalogs,
	 *     where there is nothing to select)
	 */
	import { tick, type Snippet } from 'svelte';
	import { getKitContext } from '../context/index.js';

	let {
		title,
		subtitle = undefined,
		open = false,
		ontoggle = undefined,
		selected = false,
		onselect = undefined,
		ondblclick = undefined,
		indent = 0,
		gutter,
		meta,
		right,
		actions,
		children,
		class: klass = ''
	}: {
		title: string;
		subtitle?: string;
		open?: boolean;
		/** Controlled, like `Switch`: the row reports the gesture and renders
		 *  what it is told. Omit with `children` present and the caret is
		 *  inert — so a read-only tree cannot half-work. */
		ontoggle?: () => void;
		selected?: boolean;
		/** Present = the body is a selection target and the caret is separate. */
		onselect?: () => void;
		/**
		 * A second activation gesture on the body. Named for the EVENT, not for
		 * a meaning: the workbench reads it as "pin", another surface might read
		 * it as "open in place", and the row has no business knowing which.
		 *
		 * ⚑ It lives here rather than on a wrapper the consumer supplies
		 * because the handler belongs on the interactive element — a `dblclick`
		 * on a static `<div>` is an a11y defect the compiler correctly flags.
		 * Known gap, shared with `Surface.TabStrip`: there is no keyboard
		 * equivalent for this gesture anywhere yet.
		 */
		ondblclick?: () => void;
		/**
		 * Nesting depth. ⚑ Per-ROW indent, unlike a grouped list's, where depth
		 * is uniform and lives on the surface — here a variant leaf sits under
		 * its parent and its sibling may not, so only the row knows.
		 */
		indent?: number;
		/** Fixed-width leading slot, so badges align down the whole list. */
		gutter?: Snippet;
		/** The chip line under the title. */
		meta?: Snippet;
		/** Right-aligned readout — a count, a duration, a price. */
		right?: Snippet;
		/** Trailing controls. Not part of the toggle target. */
		actions?: Snippet;
		/** Presence makes the row expandable. */
		children?: Snippet;
		class?: string;
	} = $props();

	const kit = getKitContext();

	const expandable = $derived(!!children);
	const INDENT = 16;

	let node: HTMLElement | undefined;

	/**
	 * ⚑ The toggled row keeps its viewport position.
	 *
	 * Only single-open mode can move it: opening pushes content DOWN, which is
	 * fine, but closing a row ABOVE this one pulls everything up and the row
	 * you just clicked slides out from under the cursor. That jank is what
	 * made the accordion feel worse than a detail pane, and it is a defect of
	 * the implementation rather than of the pattern.
	 *
	 * Measured against the row's own top and corrected twice: after `tick()`
	 * for plain flow, then after a frame, because a WINDOWED list re-lays out
	 * on `requestAnimationFrame` and the first correction would miss it. Both
	 * land before paint in the common case, so there is no flash.
	 *
	 * (Above the windowing threshold a row may not be in the DOM at all —
	 * that is `win.scrollTo(index)`'s job, not this one's.)
	 */
	function anchoredToggle() {
		if (!ontoggle) return;
		const scroller = scrollParent(node);
		const before = node?.getBoundingClientRect().top;
		ontoggle();
		if (!scroller || before === undefined || !node) return;

		const correct = () => {
			const after = node!.getBoundingClientRect().top;
			const delta = after - before;
			if (delta !== 0) scroller.scrollTop += delta;
		};
		void tick().then(() => {
			correct();
			// rAF AND a timeout, once: a hidden document never runs rAF at all
			// (the suspended-tray case), so a correction that only used it
			// would silently not happen off screen. Same pairing the window
			// module's `schedule()` uses.
			let done = false;
			const late = () => {
				if (done) return;
				done = true;
				correct();
			};
			requestAnimationFrame(late);
			setTimeout(late, 40);
		});
	}

	function scrollParent(from: HTMLElement | undefined): HTMLElement | null {
		let el = from?.parentElement;
		while (el) {
			const oy = getComputedStyle(el).overflowY;
			if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el;
			el = el.parentElement;
		}
		return null;
	}

	const caretLabel = $derived(open ? kit.labels.collapseRow() : kit.labels.expandRow());
</script>

<div bind:this={node} class="border-b border-border last:border-b-0 {klass}">
	<div class="flex items-stretch" style:padding-left="{indent * INDENT}px">
		{#if gutter}
			<!-- Fixed width, not intrinsic: the whole point is that the badges
			     line up across rows whose gutters hold different things. -->
			<div class="flex w-10 shrink-0 items-center justify-center py-2">
				{@render gutter()}
			</div>
		{/if}

		{#if expandable && onselect}
			<!-- Split gestures: the caret is its own control so peeking never
			     touches the selection. -->
			<button
				type="button"
				class="grid w-7 shrink-0 place-items-center text-xs text-muted-foreground
				       hover:bg-muted hover:text-foreground"
				aria-expanded={open}
				aria-label={caretLabel}
				onclick={anchoredToggle}
			>
				{open ? '▾' : '▸'}
			</button>
		{/if}

		{#if onselect}
			<button
				type="button"
				class="flex min-w-0 flex-1 items-center gap-3 py-2 pr-2 text-left text-sm
				       {selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}"
				onclick={onselect}
				{ondblclick}
			>
				{@render body()}
			</button>
		{:else if expandable}
			<button
				type="button"
				class="flex min-w-0 flex-1 items-center gap-3 py-2 pr-2 text-left text-sm
				       {selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}"
				aria-expanded={open}
				onclick={anchoredToggle}
				{ondblclick}
			>
				<span class="w-4 shrink-0 text-xs text-muted-foreground">{open ? '▾' : '▸'}</span>
				{@render body()}
			</button>
		{:else}
			<!-- Neither selectable nor expandable: a plain line, and NOT a button,
			     because an interactive element that does nothing is a lie to a
			     screen reader. -->
			<div class="flex min-w-0 flex-1 items-center gap-3 py-2 pr-2 text-sm">
				{@render body()}
			</div>
		{/if}

		{#if actions}
			<div class="flex shrink-0 items-center gap-1 pr-2">
				{@render actions()}
			</div>
		{/if}
	</div>

	{#if expandable && open}
		<!-- Indented to the content edge, so the expansion reads as belonging to
		     its row rather than to the list. -->
		<div class="pb-3 pr-3" style:padding-left="{indent * INDENT + (gutter ? 40 : 0) + 28}px">
			{@render children!()}
		</div>
	{/if}
</div>

{#snippet body()}
	<span class="min-w-0 flex-1">
		<span class="block truncate font-medium">{title}</span>
		{#if subtitle}
			<span class="block truncate text-xs text-muted-foreground">{subtitle}</span>
		{/if}
		{#if meta}
			<span class="mt-0.5 flex flex-wrap items-center gap-1">{@render meta()}</span>
		{/if}
	</span>
	{#if right}
		<span class="shrink-0 text-xs tabular-nums text-muted-foreground">{@render right()}</span>
	{/if}
{/snippet}
