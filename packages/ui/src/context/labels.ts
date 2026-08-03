/**
 * The label bag — every user-facing string the kit can render.
 *
 * Paraglide is app-level and structurally unavailable to a library: its
 * `$lib/paraglide/messages` is generated *inside the consuming app*, so we
 * cannot import it, and shipping our own inlang project would mean two message
 * catalogues with two independent locale states that desync on every switch.
 * So the kit declares what it needs, ships English, and the app fills the bag
 * from whatever it uses.
 *
 * Every entry is a FUNCTION, not a string, so an app can wire Paraglide's
 * `m.foo()` directly and have it resolve at call time rather than being
 * snapshotted at setup.
 *
 * This set grows only when a component actually needs an entry — it is not a
 * speculative vocabulary. Everything here maps to a control that exists in one
 * of the donor apps.
 */

export type LabelBag = {
	// ── toolbar ──────────────────────────────────────────────────────────────
	/** Placeholder for the free-text search field. */
	search: () => string;
	/** Trigger that opens the filter popover. */
	filters: () => string;
	/** Clears every filter back to its neutral value. */
	resetFilters: () => string;
	/** Heading for the sort group inside the filter popover. */
	sort: () => string;
	/** How many rows the current search + filters leave. */
	resultCount: (a: { count: number }) => string;
	/** Explains what the surface is for — the on-demand `(i)` hint. */
	purpose: () => string;

	// ── view modes ───────────────────────────────────────────────────────────
	viewList: () => string;
	viewTable: () => string;
	/** Collapse the list pane so the record gets the full width. */
	hideList: () => string;
	showList: () => string;

	// ── list states ──────────────────────────────────────────────────────────
	loading: () => string;
	/** Nothing matched — distinct from "nothing exists". */
	empty: () => string;
	/** Heading above a read failure. */
	errorTitle: () => string;
	retry: () => string;

	// ── actions ──────────────────────────────────────────────────────────────
	create: () => string;
	save: () => string;
	cancel: () => string;

	// ── rows ─────────────────────────────────────────────────────────────────
	expandRow: () => string;
	collapseRow: () => string;
};

/**
 * English defaults, so a component renders correctly with no wiring at all —
 * which is what makes the gallery and any isolated usage work.
 */
export const defaultLabels: LabelBag = {
	search: () => 'Search…',
	filters: () => 'Filters',
	resetFilters: () => 'Reset',
	sort: () => 'Sort',
	resultCount: ({ count }) => `${count} ${count === 1 ? 'result' : 'results'}`,
	purpose: () => 'What is this view for?',

	viewList: () => 'List',
	viewTable: () => 'Table',
	hideList: () => 'Hide list',
	showList: () => 'Show list',

	loading: () => 'Loading…',
	empty: () => 'Nothing matches',
	errorTitle: () => 'Could not load',
	retry: () => 'Try again',

	create: () => 'New',
	save: () => 'Save',
	cancel: () => 'Cancel',

	expandRow: () => 'Expand',
	collapseRow: () => 'Collapse'
};
