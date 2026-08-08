/**
 * Navigation model for the app shell.
 *
 * Data, not components: the app declares where it can go, and the shell decides
 * how that renders at each width. Adding a destination is one entry, never a
 * layout edit — which is the property both stibu and Starlume arrived at
 * independently.
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
export type NavIcon = Component<Record<string, unknown>> | ComponentType;

/** The narrowing the templates use. Contained here rather than repeated. */
export type IconOf = Component<Record<string, unknown>>;

export type NavItem = {
	label: string;
	path: string;
	icon?: NavIcon;
};

export type NavGroup = {
	/** Section heading, shown only when the rail is wide enough for labels. */
	label?: string;
	items: NavItem[];
};

/**
 * How narrow screens navigate — **the one deliberate variation point** in the
 * shell.
 *
 * stibu's bottom bar works for stibu and fits Hearth and Starlume badly, both
 * of which are rail-only. So this is a choice the app makes, not a default the
 * kit imposes.
 */
export type NavStrategy = 'bottom' | 'rail-only';

/**
 * The rail row: one class string shared by `NavRail`'s items and the footer
 * components, so their geometry cannot disagree — the same lesson `<Bar>`
 * enforces for the three chrome bars (three copies once drifted by 13px).
 */
export const railRowClass =
	'flex items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors';

/**
 * Longest-prefix match, so `/items/42` still lights up `/items` and a nested
 * route wins over its parent.
 */
export function activeNavPath(pathname: string, paths: string[]): string | null {
	let best: string | null = null;
	for (const p of paths) {
		if (pathname === p || pathname.startsWith(p + '/')) {
			if (!best || p.length > best.length) best = p;
		}
	}
	return best;
}
