/**
 * The kit's shared design vocabulary — types needed by ≥2 modules where
 * importing from the natural owner would cross layers (the admission test;
 * see CLAUDE.md). No markup, no barrel: import these by their real path.
 */

import type { Component, ComponentType } from 'svelte';

/**
 * Deliberately admits both component eras: lucide-svelte still ships
 * Svelte-4-style class components (`ComponentType`) while other icon sets ship
 * runes-era ones. A kit that accepted only one would be choosing the app's icon
 * library for it.
 *
 * Rendering casts to the runes form — see `IconOf` — because a union is not
 * constructable in a template.
 */
export type Icon = Component<Record<string, unknown>> | ComponentType;

/** The narrowing the templates use. Contained here rather than repeated. */
export type IconOf = Component<Record<string, unknown>>;

/**
 * Exactly four tones appear across the fleet; a fifth is a design decision,
 * not a prop. Lives here rather than in `badge/` because the L1 `Row` type
 * carries a resolved tone — the type spine must not import an L2 module.
 */
export type StatusTone = 'primary' | 'neutral' | 'warning' | 'destructive';
