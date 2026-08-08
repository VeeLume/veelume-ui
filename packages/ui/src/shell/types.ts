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
	/**
	 * Paths this item claims for its active state beyond its own — the HUB
	 * mechanism. stibu's `Finanzen` slot stands for three destinations and
	 * must light up on all of them; the computed More slot owns everything it
	 * collected. Matching is exact-or-child per path.
	 */
	owns?: string[];
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
 * The bottom bar's default arrangement, lifted from stibu: the hero (start)
 * item dead centre, the outer-right slot a More collector for everything
 * that did not fit.
 *
 * Pure data-in data-out so the bar and a `/more` page can share one
 * computation and never disagree about what overflowed.
 *
 * - `hero` — path of the item to centre. Defaults to the FIRST item (the
 *   start destination). `false` keeps plain declaration order.
 * - `slots` — total bar width in items, default 5 (stibu's rule: at most
 *   five, thumb-reachable).
 * - `more` — the collector item (label/icon/path are the caller's; the
 *   label comes from the label bag in `Shell.BottomBar`). Appended outer
 *   right whenever items overflow, carrying `owns` for every collected path
 *   so the slot lights up while the user is inside one of them. OMIT it to
 *   run the same split without minting a collector row — what a `/more`
 *   page does when it asks "what overflowed?" with the same hero/slots.
 */
export function splitBottomNav(
	items: NavItem[],
	opts: { hero?: string | false; slots?: number; more?: NavItem } = {}
): { bar: NavItem[]; overflow: NavItem[] } {
	const slots = opts.slots ?? 5;
	const heroPath = opts.hero === undefined ? items[0]?.path : opts.hero;

	const overflows = items.length > slots;
	// One slot is spent on the collector whenever there IS overflow — even
	// when `more` is omitted and no row is minted, or the bar and a /more
	// page would compute different overflows from the same inputs.
	const budget = overflows ? slots - 1 : items.length;

	const hero = heroPath === false ? undefined : items.find((i) => i.path === heroPath);
	const others = items.filter((i) => i !== hero);
	const chosen = hero ? others.slice(0, budget - 1) : others.slice(0, budget);
	const overflow = hero ? others.slice(budget - 1) : others.slice(budget);

	const bar = [...chosen];
	if (hero) {
		// Centre among the FINAL slot count, More included — floor puts the
		// hero left-of-centre when the count is even.
		const finalLen = bar.length + 1 + (overflows ? 1 : 0);
		bar.splice(Math.min(Math.floor((finalLen - 1) / 2), bar.length), 0, hero);
	}
	if (overflows && opts.more) {
		bar.push({
			...opts.more,
			owns: [...(opts.more.owns ?? []), ...overflow.map((i) => i.path)]
		});
	}
	return { bar, overflow };
}

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
