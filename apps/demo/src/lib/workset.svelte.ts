/**
 * The working set — the WORKBENCH PROTOTYPE's state, deliberately app-level.
 *
 * Prototyped in the demo before any of it freezes into the kit (the archetype
 * revision's note: tab ergonomics are easy to get subtly wrong, so they must
 * be felt first). The split of responsibilities under test:
 *
 *   - ACTIVE selection → the URL (`?work=`), because back must mean "the item
 *     I was on" — the browse table's selection row, unchanged
 *   - the TAB SET → this module store, because pins are workspace state like
 *     expansion: transient, surviving navigation, never history
 *
 * Preview-vs-pinned is the VS Code insight that stops tab garbage: a click
 * PREVIEWS (one preview slot, replaced by the next click), an explicit gesture
 * PINS (double-click here). Without the distinction, browsing twenty rows
 * leaves twenty tabs and the pattern dies of clutter.
 *
 * Module scope, not page state — a tab set that died on navigation would make
 * the "curated selection with quick access" promise a lie.
 */

export type WorkTab = { key: string; pinned: boolean };

function createWorkset() {
	let pinned = $state<string[]>([]);
	let preview = $state<string | null>(null);

	const tabsOf = (): WorkTab[] => [
		...pinned.map((key) => ({ key, pinned: true })),
		...(preview !== null && !pinned.includes(preview) ? [{ key: preview, pinned: false }] : [])
	];

	return {
		/** Pinned tabs in pin order, then the preview tab (if any) trailing. */
		get tabs(): WorkTab[] {
			return tabsOf();
		},

		/** A row was chosen: make it visible. Pinned keys are already tabs;
		 *  anything else takes the single preview slot. */
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
		 *  caller owns the URL, so the caller applies it. */
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

/** The catalog's working set. One per workbench surface, module-scoped. */
export const catalogWorkset = createWorkset();
