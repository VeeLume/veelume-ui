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
 * Next, in order: collection.ts (scoped cache) → browse.ts (URL-backed state).
 */

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
