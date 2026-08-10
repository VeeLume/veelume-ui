/**
 * The demo's real domain: works, their editions, and a personal shelf.
 *
 * Shaped to force the Catalog archetype's three structural differences from a
 * CRUD surface:
 *
 *  1. **Rows are not records.** Several editions collapse into one work row —
 *     structurally identical to Hearth folding blueprints into a craftable, so
 *     the derive step is real rather than contrived.
 *  2. **There is an overlay.** The shelf is a SEPARATE dataset joined during
 *     derivation. Reference data is never written; writes go to the shelf.
 *  3. **Filters test overlay-derived properties.** "Owned" is not a property of
 *     an edition — it only exists after the join, which is what forces
 *     derive-before-filter.
 */

import type { FixtureModule } from './types.js';

// Re-exported from the generated bindings rather than redeclared.
export type { Edition, ShelfEntry } from '$lib/bindings';
import type { Edition, ShelfEntry } from '$lib/bindings';

const AUTHORS = [
	'Ursula K. Le Guin',
	'Iain M. Banks',
	'Octavia Butler',
	'Stanisław Lem',
	'Ann Leckie',
	'Becky Chambers'
];
const TITLES = [
	'The Dispossessed',
	'Use of Weapons',
	'Kindred',
	'Solaris',
	'Ancillary Justice',
	'A Closed and Common Orbit',
	'The Left Hand of Darkness',
	'Player of Games',
	'Parable of the Sower',
	'The Cyberiad',
	'Provenance',
	'Record of a Spaceborn Few'
];
const FORMATS = ['hardcover', 'paperback', 'ebook'] as const;

function buildEditions(): Edition[] {
	const out: Edition[] = [];
	TITLES.forEach((title, w) => {
		const author = AUTHORS[w % AUTHORS.length];
		// 1–3 editions per work, so leaf rows and bundle rows both occur.
		const n = (w % 3) + 1;
		for (let e = 0; e < n; e++) {
			// Same arithmetic as the Rust twin — the two transports must seed
			// identically or a comparison would differ by backend.
			out.push({
				id: `ed-${w}-${e}`,
				work_id: `work-${w}`,
				work_title: title,
				author,
				year: 1969 + w * 3 + e,
				format: FORMATS[e % FORMATS.length],
				pages: 180 + ((w * 37) % 320) + e * 12,
				price_cents: 799 + ((w * 143) % 1900) + e * 250,
				rating: 3.0 + ((w * 7 + e * 3) % 21) / 10.0
			});
		}
	});
	return out;
}

let editions = buildEditions();
let shelf: ShelfEntry[] = [
	{ edition_id: 'ed-0-0', state: 'owned' },
	{ edition_id: 'ed-2-1', state: 'owned' },
	{ edition_id: 'ed-4-0', state: 'want' }
];

export const libraryFixtures: FixtureModule = {
	/** Reference data. Read-only — the app never writes this. */
	editions_list: () => editions.map((e) => ({ ...e })),

	/** The overlay. A separate collection, joined only at derive time. */
	shelf_list: () => shelf.map((s) => ({ ...s })),

	/**
	 * The overlay's write. Deliberately NOT modelled as a collection `save()`:
	 * a three-state toggle (none → owned → want → none) is not a record-shaped
	 * update, and contorting the write layer to fit it would be the wrong kind
	 * of generality. The page invokes this and calls `refresh()` — which is
	 * exactly stibu's "write through the API, reload after" pattern.
	 */
	shelf_toggle: (payload) => {
		const id = String(payload.id);
		const existing = shelf.find((s) => s.edition_id === id);
		if (!existing) shelf = [...shelf, { edition_id: id, state: 'owned' }];
		else if (existing.state === 'owned')
			shelf = shelf.map((s) => (s.edition_id === id ? { ...s, state: 'want' } : s));
		else shelf = shelf.filter((s) => s.edition_id !== id);
		return null;
	},

	library_reset: () => {
		editions = buildEditions();
		shelf = [
			{ edition_id: 'ed-0-0', state: 'owned' },
			{ edition_id: 'ed-2-1', state: 'owned' },
			{ edition_id: 'ed-4-0', state: 'want' }
		];
		return null;
	}
};
