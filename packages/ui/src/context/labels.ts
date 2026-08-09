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
	/** The same, but against the unnarrowed total — shown only while narrowing,
	 *  where the comparison is the information. */
	narrowedCount: (a: { shown: number; total: number }) => string;
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
	/** Extend a truncated set — shown only when the source has more. */
	loadMore: () => string;
	/**
	 * How old the data is — "as of", never a warning. `when` arrives already
	 * formatted in the formatting locale ("5 minutes ago"), so the bag only
	 * chooses the wording around it.
	 */
	updatedAt: (a: { when: string }) => string;
	/** Re-read the current set on demand. */
	refresh: () => string;

	// ── actions ──────────────────────────────────────────────────────────────
	create: () => string;
	save: () => string;
	cancel: () => string;
	/** ConfirmDialog's default forward label — per-call overrides ("Delete")
	 *  are app content and arrive as props. */
	confirm: () => string;

	/** Accessible name for the `⋮` overflow trigger. */
	moreActions: () => string;
	back: () => string;

	// ── rows ─────────────────────────────────────────────────────────────────
	expandRow: () => string;
	collapseRow: () => string;

	// ── shell ────────────────────────────────────────────────────────────────
	/** The settings entry in the rail footer, and the settings pane title. */
	settings: () => string;
	/** Desktop placeholder when no settings category is selected. */
	selectCategory: () => string;
	/** The bottom bar's overflow collector slot. */
	more: () => string;

	// ── notifications ────────────────────────────────────────────────────────
	/** The bell's accessible name and the center's heading. */
	notifications: () => string;
	/** Empties the notification center. */
	clearAll: () => string;
	/** Accessible name for a toast's / a center row's close button. */
	dismiss: () => string;
	/** The center with no notifications this session. */
	nothingYet: () => string;
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
	narrowedCount: ({ shown, total }) => `${shown} of ${total}`,
	purpose: () => 'What is this view for?',

	viewList: () => 'List',
	viewTable: () => 'Table',
	hideList: () => 'Hide list',
	showList: () => 'Show list',

	loading: () => 'Loading…',
	empty: () => 'Nothing matches',
	errorTitle: () => 'Could not load',
	retry: () => 'Try again',
	loadMore: () => 'Load more',
	updatedAt: ({ when }) => `Updated ${when}`,
	refresh: () => 'Refresh',

	create: () => 'New',
	save: () => 'Save',
	cancel: () => 'Cancel',
	confirm: () => 'Confirm',

	moreActions: () => 'More actions',
	back: () => 'Back',

	expandRow: () => 'Expand',
	collapseRow: () => 'Collapse',

	settings: () => 'Settings',
	selectCategory: () => 'Select a category',
	more: () => 'More',

	notifications: () => 'Notifications',
	clearAll: () => 'Clear all',
	dismiss: () => 'Dismiss',
	nothingYet: () => 'Nothing yet'
};
