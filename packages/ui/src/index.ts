/**
 * @veelume/ui — public surface.
 *
 * Ships SOURCE, not a build: the consuming app's Vite/SvelteKit compiles it.
 * That is deliberate for a workspace-linked package — no build step to keep in
 * sync while the kit and its harness are developed together.
 *
 * Layering (see the vault note `Programmieren/Projects/veelume-ui.md`):
 *   L1  logic, no markup      — collections, browse state, context
 *   L2  compound components   — parts with snippet escape hatches
 *   L3  arrangements          — opinionated shells
 *
 * Nothing is exported yet. First up, in order:
 *   - context.ts        label bag + message locale + formatting locale
 *   - collection.ts     scoped cache: ensure/prefetch/evict/at, status union
 *   - browse.ts         URL-backed browse state
 */

export {};
