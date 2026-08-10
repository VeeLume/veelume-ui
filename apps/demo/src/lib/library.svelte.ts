/**
 * The library's two collections and the derive step that joins them.
 *
 * Kept out of the page component so the derivation is testable and so the page
 * stays about rendering. This is the Catalog archetype in miniature:
 *
 *   editions (reference, read-only)  ─┐
 *                                     ├─ derive ─→ work rows (N:1 collapse)
 *   shelf   (overlay, writable)      ─┘
 */

import { invoke } from '@tauri-apps/api/core';
import { createCollection, type Row } from '@veelume/ui';
import type { Edition, ShelfEntry } from './fixtures/library.js';

/** Reference data. Unscoped — one dataset forever, the stibu/connect-neo case,
 *  which also exercises the collection's no-scope path. */
export const editions = createCollection<Edition, string>({
	keyOf: (e) => e.id,
	fetchAll: () => invoke('editions_list')
});

/** The overlay. A collection in its own right, joined only at derive time. */
export const shelf = createCollection<ShelfEntry, string>({
	keyOf: (s) => s.edition_id,
	fetchAll: () => invoke('shelf_list')
});

export type ShelfState = 'owned' | 'want' | 'none';

export type WorkRow = Row & {
	author: string;
	members: { edition: Edition; state: ShelfState }[];
	ownedCount: number;
	wantCount: number;
	total: number;
	firstYear: number;
	/** Comparable aggregates, invented HERE like `ownedCount` — no edition
	 *  carries "the cheapest edition of this work". `Compare` therefore reads
	 *  derived values, which is the case Starlume has too (cooked catalog
	 *  stats, not raw records). */
	pages: number;
	cheapestCents: number;
	rating: number;
};

/**
 * Records → rows. TWO collapses' worth of work in one step here, since a work
 * is the only grouping level this domain has.
 *
 * `ownedCount` is invented HERE — no `Edition` carries it. That is precisely
 * why filters must run after this and not before.
 */
export function deriveWorks(src: { editions: Edition[]; shelf: ShelfEntry[] }): WorkRow[] {
	const stateOf = new Map(src.shelf.map((s) => [s.edition_id, s.state as ShelfState]));
	const byWork = new Map<string, Edition[]>();
	for (const e of src.editions) {
		const list = byWork.get(e.work_id);
		if (list) list.push(e);
		else byWork.set(e.work_id, [e]);
	}

	const rows: WorkRow[] = [];
	for (const [workId, list] of byWork) {
		const members = list
			.slice()
			.sort((a, b) => a.year - b.year)
			.map((edition) => ({ edition, state: stateOf.get(edition.id) ?? ('none' as ShelfState) }));
		const ownedCount = members.filter((m) => m.state === 'owned').length;
		const wantCount = members.filter((m) => m.state === 'want').length;
		const first = members[0].edition;

		rows.push({
			// Stable across refetches: derived from the group's identity, not from
			// array position. A key that shifts detaches expansion state from its row.
			key: workId,
			title: first.work_title,
			subtitle: first.author,
			trailing: `${ownedCount}/${members.length}`,
			badge: wantCount ? '♡' : undefined,
			author: first.author,
			members,
			ownedCount,
			wantCount,
			total: members.length,
			firstYear: first.year,
			pages: first.pages,
			cheapestCents: Math.min(...members.map((m) => m.edition.price_cents)),
			rating: Math.max(...members.map((m) => m.edition.rating))
		});
	}
	return rows;
}

/** The overlay's write. Not a collection `save()` — a three-state toggle is not
 *  a record-shaped update; see the fixture's note. */
export async function toggleShelf(editionId: string): Promise<void> {
	await invoke('shelf_toggle', { id: editionId });
	await shelf.refresh();
}
