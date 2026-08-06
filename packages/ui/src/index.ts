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
 * Next: the Catalog archetype (derive + overlay) in apps/demo.
 */

// ── L2: actions ────────────────────────────────────────────────────────────
// The three-tier system. The invariant is POSITION: the one forward action sits
// top-right on every surface, so a user never hunts for it.
export { Actions, ActionMenu, Bar, Button, DetailHeader } from './actions/index.js';
export type { Action, ActionIcon, ButtonSize, ButtonVariant } from './actions/index.js';

// ── L3: app shell ──────────────────────────────────────────────────────────
// Rail + bottom bar + the responsive rules between them. The rail's collapse
// behaviour and its bottom account block are settled (stibu and Starlume
// derived both independently); the mobile strategy is the deliberate variation
// point.
export { AppShell, NavRail, BottomNav, breakpoints, activeNavPath } from './shell/index.js';
export type { NavGroup, NavIcon, NavItem, NavStrategy } from './shell/index.js';

// ── L2: record form ────────────────────────────────────────────────────────
// What archetype E actually reuses — connect-neo's wording is "the same
// EDITOR", not the same surface. A solo record is this with nothing around it.
export { RecordForm, NumberInput, createRecordForm, sectionsOf } from './form/index.js';
export {
	formatLocaleNumber,
	localeSeparators,
	parseLocaleNumber
} from './form/index.js';
export type {
	FieldKind,
	FieldSpec,
	FormSection,
	RecordFormIO,
	RecordFormState,
	SelectOption
} from './form/index.js';

// ── L2: surface parts ──────────────────────────────────────────────────────
export { Surface, createSurface } from './surface/index.js';
export type {
	FacetDef,
	FacetOption,
	Row,
	SortDef,
	SurfaceBrowse,
	SurfaceDescriptor,
	SurfaceState
} from './surface/index.js';

// ── L1: window ─────────────────────────────────────────────────────────────
// Render O(viewport), whatever the list holds. Supersedes the reveal: the
// reveal throttled how fast rows ENTERED the DOM, but once entered they all
// paid the update tax on every publish — measured at ~1 ms per rendered row
// per fill during an order switch. Neutral below its threshold.
export { createWindow } from './window/index.svelte.js';
export type { ListWindow, WindowOptions } from './window/index.svelte.js';

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
