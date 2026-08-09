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
