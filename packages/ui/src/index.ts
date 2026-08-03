/**
 * @veelume/ui — public surface.
 *
 * Ships SOURCE, not a build: the consuming app's Vite/SvelteKit compiles it.
 * Deliberate for a workspace-linked package — no build step to keep in sync
 * while the kit and its harness are developed together.
 *
 * Layering (rules in ./CLAUDE.md, reasoning in the vault note
 * `Programmieren/Projects/veelume-ui.md`):
 *   L1  logic, no markup      — collections, browse state, context
 *   L2  compound components   — parts with snippet escape hatches
 *   L3  arrangements          — opinionated shells
 *
 * Next: L2 — the compound surface parts.
 */

// ── L1: browse state ───────────────────────────────────────────────────────
export { createBrowseState } from './browse/index.js';
export type {
	BrowseField,
	BrowseSpec,
	BrowseState,
	BrowseValues,
	HistoryMode
} from './browse/index.js';

// ── L1: collections ────────────────────────────────────────────────────────
export { createCollection } from './collection/index.svelte.js';
export type {
	Collection,
	CollectionIO,
	CollectionOptions,
	ChangeInfo,
	Entry,
	KitError,
	ScopedView,
	Status,
	Unsubscribe,
	WriteIO,
	WriteSemantics
} from './collection/index.svelte.js';

// ── L1: context ────────────────────────────────────────────────────────────
export {
	createKitContext,
	setKitContext,
	getKitContext,
	defaultLabels,
	type KitContext,
	type KitContextInput,
	type LabelBag
} from './context/index.js';
