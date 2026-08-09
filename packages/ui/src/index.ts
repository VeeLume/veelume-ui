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
// Compound parts on the Surface contract: Root owns the frame decisions
// (rail vs bottom bar, labels, safe-area) in context, parts read them, and an
// app's divergence slots in as its own part reading `getShellContext()` —
// versioned like everything else, never copy-in. `AppShell` is the default
// arrangement; composing `Shell.BottomBar` (or not) IS the mobile strategy.
export {
	Shell,
	AppShell,
	NavRail,
	BottomNav,
	breakpoints,
	getShellContext,
	activeNavPath,
	splitBottomNav
} from './shell/index.js';
export type { NavGroup, NavIcon, NavItem, NavStrategy, ShellContext } from './shell/index.js';

// ── L2/L3: settings scaffold ───────────────────────────────────────────────
// The stibu-shaped settings section: categories as data, each category a
// small routed page, and the kit owning the three-state responsive layout
// (list+page · list full-screen · page full-screen with back).
export { Settings, getSettingsContext } from './settings/index.js';
export type { SettingsCategory, SettingsContext } from './settings/index.js';

// ── L2: record form ────────────────────────────────────────────────────────
// What archetype E actually reuses — connect-neo's wording is "the same
// EDITOR", not the same surface. A solo record is this with nothing around it.
export {
	RecordForm,
	NumberInput,
	Switch,
	Segmented,
	createRecordForm,
	sectionsOf
} from './form/index.js';
export { formatLocaleNumber, localeSeparators, parseLocaleNumber } from './form/index.js';
export type {
	FieldKind,
	FieldSpec,
	FormSection,
	RecordFormIO,
	RecordFormState,
	SelectOption
} from './form/index.js';

// ── L1+L2: notifications ───────────────────────────────────────────────────
// One funnel, two surfaces: notify()/ingest() feed a single bounded session
// log; Toasts (transient, sticky-by-level) and Center (persistent, marks
// read on open) read it, Bell carries the unread count. Parts compose
// independently — the store is the contract, not the arrangement.
export {
	Notify,
	notifications,
	notify,
	ingest,
	dismiss,
	markAllRead,
	clearAll,
	isSticky
} from './notify/index.js';
export type { NotifAction, NotifInput, NotifLevel, Notification } from './notify/index.js';

// ── L2: popup ──────────────────────────────────────────────────────────────
// The anchored-panel base: outside click, Escape, focus return, position
// classes that REPLACE the default. FilterButton and Notify.Center ride it;
// collision-aware placement is the planned upgrade inside it.
export { Popup } from './popup/index.js';

// ── L2: status badge ───────────────────────────────────────────────────────
// One pill + a per-domain status→(label, tone) map — four stibu components
// were this exact split with the map inlined. `Row.badge` accepts the
// resolved form so windowed lists render it without a component per row.
export { StatusBadge, resolveStatus } from './badge/index.js';
export type { StatusMap, StatusStyle, StatusTone } from './badge/index.js';

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
// The HTTP + SSE transport, beside Tauri IPC. The kit owns the reconnect
// discipline and status→KitError mapping; the app owns URL building, because
// that is what differs between Axum, Litestar and TrailBase.
export { createHttpIO, sseInvalidation, classifyHttpError } from './collection/http.js';
export type { HttpCall, HttpIOOptions, HttpRoutes, SseOptions } from './collection/http.js';
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
