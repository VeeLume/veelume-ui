/**
 * The working set — the workbench's L1: which records are held open as tabs.
 *
 * Promoted from the demo catalog's prototype after the semantics settled in
 * use. The responsibility split it assumes (and does not own):
 *
 *   - ACTIVE selection is the CONSUMER's, in the URL — back must mean "the
 *     item I was on", the browse table's selection row. The workset never
 *     stores active; `Surface.TabStrip` reads it from the surface context.
 *   - the TAB SET is here — workspace state like expansion: transient,
 *     surviving navigation in a module-scope instance, never history.
 *
 * Preview-vs-pinned is the insight that stops tab garbage: a click PREVIEWS
 * (one preview slot, replaced by the next click), an explicit gesture PINS.
 * Without the distinction, browsing twenty rows leaves twenty tabs and the
 * pattern dies of clutter.
 *
 * Keys are `Row.key` — stable across refetches, like everything selection
 * touches.
 */

export type WorksetTab = { key: string; pinned: boolean };

export type Workset = ReturnType<typeof createWorkset>;

export function createWorkset() {
	let pinned = $state<string[]>([]);
	let preview = $state<string | null>(null);

	/** For `activate`'s rapid-second-activation test. */
	let lastKey: string | null = null;
	let lastAt = 0;

	const tabsOf = (): WorksetTab[] => [
		...pinned.map((key) => ({ key, pinned: true })),
		...(preview !== null && !pinned.includes(preview) ? [{ key: preview, pinned: false }] : [])
	];

	return {
		/** Pinned tabs in pin order, then the preview tab (if any) trailing. */
		get tabs(): WorksetTab[] {
			return tabsOf();
		},

		/** A row was chosen: make it visible. Pinned keys are already tabs;
		 *  anything else takes the single preview slot. Idempotent. */
		select(key: string): void {
			if (!pinned.includes(key)) preview = key;
		},

		/**
		 * The row/tab gesture: preview on first activation, PIN on a rapid
		 * second activation of the same key.
		 *
		 * ⚑ This replaces a `dblclick` handler, which cannot be relied on here.
		 * The first click navigates (selection lives in the URL), the re-render
		 * recreates the element the browser is counting clicks on, and the pair
		 * never completes — so double-click-to-pin worked when scripted and
		 * failed under a real double-click, which is exactly the shape of bug
		 * synthetic events hide. Timing state survives the re-render because it
		 * is state, not DOM.
		 *
		 * It also closes the a11y gap dblclick had: Enter twice on a focused
		 * row now pins, because a keyboard activation is a click.
		 */
		activate(key: string, options: { doubleMs?: number } = {}): void {
			const now = Date.now();
			const rapid = lastKey === key && now - lastAt < (options.doubleMs ?? 400);
			lastKey = key;
			lastAt = now;
			if (rapid) this.pin(key);
			else this.select(key);
		},

		/** Promote the preview (or any key) to a pinned tab. Idempotent. */
		pin(key: string): void {
			if (!pinned.includes(key)) pinned = [...pinned, key];
			if (preview === key) preview = null;
		},

		/** Close a tab. Returns the NEIGHBOUR to activate next — the closed
		 *  tab's successor, else its predecessor, else null (empty set). The
		 *  CONSUMER owns the URL, so the consumer applies the result. */
		close(key: string): string | null {
			const before = tabsOf().map((t) => t.key);
			const idx = before.indexOf(key);
			if (preview === key) preview = null;
			pinned = pinned.filter((k) => k !== key);
			const after = before.filter((k) => k !== key);
			if (after.length === 0) return null;
			return after[Math.min(idx, after.length - 1)];
		},

		isPinned(key: string): boolean {
			return pinned.includes(key);
		},

		has(key: string): boolean {
			return pinned.includes(key) || preview === key;
		}
	};
}
