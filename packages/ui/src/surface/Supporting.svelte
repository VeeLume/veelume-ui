<script lang="ts">
	/**
	 * Material's SUPPORTING PANE canonical layout: a main pane that holds the
	 * work, and a pane on the right that only means something beside it — a
	 * live preview of the settings being edited, a reference panel. Standalone,
	 * not a `Surface.Root` part: the first consumer (a settings page with a
	 * preview of its effect) has no collection, no browse state and no list.
	 *
	 *   docked — the container fits both: side by side, the pane at Material's
	 *            30% (360px floor, 640px ceiling), each pane scrolling alone
	 *   sheet  — it does not: the pane opens OVER the main pane, behind a scrim
	 *            scoped to this box, closed until asked for
	 *
	 * ⚑ Docked-vs-sheet is decided by the CONTAINER's width, never the
	 * viewport's — the `Expand.Cols` lesson again: the nav rail spends width,
	 * so a 1024px window can hold an 800px box. The cut-off is Material's
	 * expanded threshold (840) applied to the box.
	 *
	 * ⚑ The two modes have two different open states, and that is deliberate.
	 * Docked, `open` is the app's (controlled — a stored preference, usually):
	 * a pane you hid stays hidden. As a sheet the pane covers the work, so its
	 * open state is page-local and starts closed — narrowing the window must
	 * never bury the main pane under a pane someone opened on a wide screen.
	 *
	 * ⚑ The toggle has ONE position, in every state and both modes: the
	 * top-right corner, centred 24px in from the right edge and in the 56px bar
	 * row. Open, it ends the pane's header; collapsed, the pane shrinks to a
	 * 48px rail with the toggle in the same spot and the pane's title running
	 * down it — so the control never moves under the pointer, and a hidden pane
	 * still says what it is. This REPLACES the docked-handle idea `Split`'s list
	 * collapse uses for this pane: a slim tab on the far edge was the version
	 * people could not find, and its open/close halves lived in two places.
	 *
	 * Docked, the seam RESIZES when the app supplies `onresize` (Material's pane
	 * expansion): drag, arrow keys, double-click to reset, and a drag released
	 * below half the pane's floor collapses it to the rail. Width is the app's
	 * like `open` — Starlume's case is the reason it exists: its main column
	 * hugs capped content and the preview wants the rest, the inverse of a
	 * fixed 30%.
	 */
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import Bar from '../actions/Bar.svelte';
	import { getKitContext } from '../context/index.js';
	import PanelIcon from './PanelIcon.svelte';

	let {
		title,
		open,
		onopen,
		width = null,
		onresize = undefined,
		actions = undefined,
		main,
		pane,
		class: klass = ''
	}: {
		/** Names the pane: its header, the collapsed rail, the toggle's label. */
		title: string;
		/** Docked open state — controlled, like `Switch`. */
		open: boolean;
		/** Reports the requested docked state. Not called for the sheet, whose
		 *  open state is the component's own (see above). */
		onopen: (next: boolean) => void;
		/**
		 * The docked pane's width in px; `null` is Material's default (30% of the
		 * box, 360–640px). Controlled like `open` — a stored preference, usually.
		 * Clamped at render so a narrower window never pushes the main pane
		 * under its floor; the stored value is never rewritten by a resize of
		 * the WINDOW, only by the user's drag.
		 */
		width?: number | null;
		/** Reports a drag or keyboard resize (`null` = back to the default, on a
		 *  double-click). Omit it and there is no handle — omission removes the
		 *  control, as everywhere in the kit. */
		onresize?: (next: number | null) => void;
		/** Pane-header chrome, left of the toggle — a refresh, a status note. */
		actions?: Snippet;
		/** The main pane. Owns its own padding; this box only scrolls it. */
		main: Snippet;
		/** The supporting pane's body, under its header; padded and scrolling. */
		pane: Snippet;
		class?: string;
	} = $props();

	const kit = getKitContext();

	/** Material's expanded threshold, measured on the box. */
	const DOCK_MIN = 840;

	/** Neither pane may be dragged narrower than a compact window (Material's
	 *  600 cut-off is for a WINDOW; 360 is the narrowest phone it designs for). */
	const PANE_MIN = 360;
	const MAIN_MIN = 360;
	/** The default's ceiling only — a dragged width may exceed it. */
	const DEFAULT_MAX = 640;
	/** Released below half the floor, a drag means "close it" (VS Code's gesture). */
	const COLLAPSE_AT = PANE_MIN / 2;
	const STEP = 16;
	const BIG_STEP = 64;

	let box = $state(0);
	// 0 before the first measure: assume the common desktop case rather than
	// flashing a sheet layout and jumping (the breakpoints store's reasoning).
	const docked = $derived(box === 0 || box >= DOCK_MIN);

	const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
	const maxPane = $derived(Math.max(PANE_MIN, box - MAIN_MIN));
	const defaultWidth = $derived(clamp(box * 0.3, PANE_MIN, DEFAULT_MAX));

	// Live width while dragging: local, committed once on release, so a stored
	// preference is written once per gesture rather than once per pixel.
	let dragWidth = $state<number | null>(null);
	let collapsing = $state(false);
	const paneWidth = $derived(clamp(dragWidth ?? width ?? defaultWidth, PANE_MIN, maxPane));

	let drag: { x: number; w: number; id: number } | null = null;

	function startDrag(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { x: e.clientX, w: paneWidth, id: e.pointerId };
		dragWidth = paneWidth;
	}

	function moveDrag(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.id) return;
		// The pane is on the RIGHT: moving the seam left widens it.
		const raw = drag.w + (drag.x - e.clientX);
		collapsing = raw < COLLAPSE_AT;
		dragWidth = clamp(Math.round(raw), PANE_MIN, maxPane);
	}

	function endDrag(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.id) return;
		drag = null;
		const next = dragWidth;
		const close = collapsing;
		dragWidth = null;
		collapsing = false;
		// A collapse keeps the stored width: reopening restores the size you had.
		// Compared against the width without a drag in flight, so a click on the
		// handle (no movement) writes nothing.
		if (close) onopen(false);
		else if (next !== null && next !== clamp(width ?? defaultWidth, PANE_MIN, maxPane))
			onresize?.(next);
	}

	/** The APG window-splitter keys. Arrows step, Home/End jump to the floors,
	 *  Enter collapses (the pattern's "toggle" — the rail's button restores). */
	function keyResize(e: KeyboardEvent) {
		const step = e.shiftKey ? BIG_STEP : STEP;
		let next: number | null = null;
		if (e.key === 'ArrowLeft') next = paneWidth + step;
		else if (e.key === 'ArrowRight') next = paneWidth - step;
		else if (e.key === 'Home') next = maxPane;
		else if (e.key === 'End') next = PANE_MIN;
		else if (e.key === 'Enter') {
			e.preventDefault();
			// The handle leaves with the pane; focus must not fall to <body>.
			onopen(false);
			void tick().then(() => railButton?.focus());
			return;
		} else return;
		e.preventDefault();
		onresize?.(clamp(next, PANE_MIN, maxPane));
	}

	let sheetOpen = $state(false);
	const shown = $derived(docked ? open : sheetOpen);

	// Widening while the sheet is up hands over to the docked state; the sheet
	// state must not survive to reappear on the next narrowing.
	$effect(() => {
		if (docked) sheetOpen = false;
	});

	let railButton = $state<HTMLButtonElement>();
	// One ref for both modes: the docked pane and the sheet never coexist.
	let paneToggle = $state<HTMLButtonElement>();

	async function set(next: boolean) {
		if (docked) {
			onopen(next);
			return;
		}
		sheetOpen = next;
		// The sheet is modal over the main pane, so focus goes into it and comes
		// back to the control that opened it.
		await tick();
		(next ? paneToggle : railButton)?.focus();
	}
</script>

{#snippet body()}
	<Bar>
		<h2 class="min-w-0 flex-1 truncate text-base font-semibold">{title}</h2>
		{#if actions}{@render actions()}{/if}
		<!-- `-mr-1.5` against the bar's `px-3` centres the toggle 24px in from
		     the edge: exactly where the 48px rail centres its own glyph. -->
		<button
			bind:this={paneToggle}
			type="button"
			class="-mr-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md
			       text-muted-foreground transition-colors hover:bg-accent hover:text-foreground
			       focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
			aria-label={kit.labels.hidePane({ title })}
			title={kit.labels.hidePane({ title })}
			aria-expanded={true}
			onclick={() => set(false)}
		>
			<PanelIcon side="right" open={true} />
		</button>
	</Bar>
	<div class="min-h-0 flex-1 overflow-auto p-4">
		{@render pane()}
	</div>
{/snippet}

<!-- While dragging, the whole box holds the resize cursor and refuses text
     selection: the pointer leaves the 12px seam immediately, and a drag that
     paints a selection across both panes reads as broken. -->
<div
	class="relative flex h-full min-h-0 min-w-0 {dragWidth !== null
		? 'cursor-col-resize select-none'
		: ''} {klass}"
	bind:clientWidth={box}
>
	<div class="min-h-0 min-w-0 flex-1 overflow-auto" inert={!docked && sheetOpen}>
		{@render main()}
	</div>

	{#if docked && shown}
		<!-- Before the first measure there is no box to take 30% of, so the
		     CSS default stands in for one frame rather than flashing at 360. -->
		<aside
			class="relative flex min-h-0 shrink-0 flex-col border-l border-border bg-background
			       transition-opacity {box ? '' : 'w-[30%] max-w-160 min-w-90'}
			       {collapsing ? 'opacity-40' : ''}"
			style:width={box ? `${paneWidth}px` : undefined}
			aria-label={title}
		>
			{#if onresize}
				<!--
					Material's pane-expansion handle on the APG window-splitter
					contract. The SEAM is a 10px hit zone starting ON the border and
					running into the pane (height makes a splitter findable, width
					is pure cost); the PILL is Material's 4×48 drag handle laid over
					the border line, always drawn so the seam announces itself
					without a hover hunt. Double-click restores the default, the
					convention every editor with a splitter has taught.

					⚑ The seam must not reach LEFT of the border: the main pane's
					scrollbar sits flush against it, and a zone straddling the
					border (the first version) stole the scrollbar's last 6px — a
					grab at the scrollbar started a resize instead.
				-->
				<!-- A FOCUSABLE separator is a widget in WAI-ARIA (the window
				     splitter pattern); Svelte's lint only knows the static one. -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
				<div
					class="group absolute inset-y-0 -left-px z-10 flex w-2.5 cursor-col-resize touch-none
					       items-center justify-start focus-visible:outline-none"
					role="separator"
					aria-orientation="vertical"
					aria-label={kit.labels.resizePane({ title })}
					title={kit.labels.resizePane({ title })}
					aria-valuemin={box ? Math.round((MAIN_MIN / box) * 100) : undefined}
					aria-valuemax={box ? Math.round(((box - PANE_MIN) / box) * 100) : undefined}
					aria-valuenow={box ? Math.round(((box - paneWidth) / box) * 100) : undefined}
					tabindex="0"
					onpointerdown={startDrag}
					onpointermove={moveDrag}
					onpointerup={endDrag}
					onpointercancel={endDrag}
					ondblclick={() => onresize?.(null)}
					onkeydown={keyResize}
				>
					<span
						class="h-12 w-1 rounded-full bg-border transition-colors
						       group-hover:bg-muted-foreground group-focus-visible:bg-ring
						       {dragWidth !== null ? 'bg-foreground' : ''}"
					></span>
				</div>
			{/if}
			{@render body()}
		</aside>
	{:else}
		<!-- The collapsed rail: ONE button, so the whole strip is the target.
		     Glyph in the bar row (same spot as the open header's toggle), title
		     running down beneath it so a hidden pane still names itself. -->
		<button
			bind:this={railButton}
			type="button"
			class="flex w-12 shrink-0 flex-col items-center gap-3 border-l border-border bg-background
			       text-muted-foreground transition-colors hover:bg-muted hover:text-foreground
			       focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none
			       focus-visible:ring-inset"
			aria-label={kit.labels.showPane({ title })}
			title={kit.labels.showPane({ title })}
			aria-expanded={false}
			inert={!docked && sheetOpen}
			onclick={() => set(true)}
		>
			<span class="flex h-14 shrink-0 items-center"><PanelIcon side="right" open={false} /></span>
			<span class="text-sm font-medium [writing-mode:vertical-rl]">{title}</span>
		</button>
	{/if}

	{#if !docked && sheetOpen}
		<!-- Scoped to this box, not the window: the sheet covers the main pane
		     it supports, never the nav rail beside it. -->
		<button
			type="button"
			class="absolute inset-0 z-10 cursor-default bg-black/40"
			aria-label={kit.labels.hidePane({ title })}
			tabindex="-1"
			onclick={() => set(false)}
		></button>
		<!-- A dialog, not an aside: the main pane under it is inert, so it is
		     modal within this box — and the role is what licenses the Escape. -->
		<div
			class="absolute inset-y-0 right-0 z-20 flex w-[min(36rem,100%)] flex-col border-l
			       border-border bg-background shadow-xl"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			aria-label={title}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					e.stopPropagation();
					set(false);
				}
			}}
		>
			{@render body()}
		</div>
	{/if}
</div>
