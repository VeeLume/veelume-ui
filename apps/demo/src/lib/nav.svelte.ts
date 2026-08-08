// Navigation model. Components read `nav.groups` / `nav.bottomItems` and never
// build routes themselves, so adding a destination is one edit here.
//
// The types are the kit's: redeclaring them locally worked by structural
// accident and was drift waiting to happen (`activeNavPath` had already been
// copied in whole).
import type { NavGroup, NavItem } from '@veelume/ui';
import {
	House,
	Library,
	BookUp,
	SlidersHorizontal,
	Palette,
	FlaskConical,
	Gauge,
	Settings
} from 'lucide-svelte';

/** Destinations that exist regardless of configuration. */
const coreItems: NavItem[] = [
	{ label: 'Home', icon: House, path: '/home' },
	// The Catalog archetype — derive + overlay, the demo's real domain.
	{ label: 'Catalog', icon: Library, path: '/catalog' },
	// Archetype B — scoped by year, the counterpart to the unscoped catalog.
	{ label: 'Loans', icon: BookUp, path: '/loans' },
	// Archetype E — one record, no list. Root minus two children.
	{ label: 'Preferences', icon: SlidersHorizontal, path: '/preferences' },
	// Every component, every state — the kit's own showcase.
	{ label: 'Gallery', icon: Palette, path: '/gallery' },
	// A test rig, not domain. Delete once the real surfaces cover the same ground.
	{ label: 'Probes', icon: FlaskConical, path: '/probes' },
	// The extreme case: 1.5M entries, every predicate server-stage. An
	// instrument, not a showcase.
	{ label: 'Stress', icon: Gauge, path: '/stress' }
];

/** Not in `groups` — settings lives in the rail footer and on the More page. */
export const settingsItem: NavItem = {
	label: 'Settings',
	icon: Settings,
	path: '/settings'
};

class Nav {
	get groups(): NavGroup[] {
		const groups: NavGroup[] = [{ items: coreItems }];
		return groups;
	}

	get items(): NavItem[] {
		return this.groups.flatMap((g) => g.items);
	}
}

export const nav = new Nav();
