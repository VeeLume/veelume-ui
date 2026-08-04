/**
 * The 1.5M-entry collection — the extreme case, with nothing hidden.
 *
 * Every predicate here is **server-stage**: search, kind and order all go into
 * the `SetQuery` and reach the backend. That is not a preference, it is forced
 * by the numbers — a client-side filter needs the whole set, and the whole set
 * is 1.5M rows. This is therefore the surface that proves the working-set model
 * does something the old "load everything and filter in a `$derived`" design
 * could not do at all.
 */

import { invoke } from '@tauri-apps/api/core';
import { createCollection } from '@veelume/ui';
import type { Entry } from './fixtures/stress.js';

export type { Entry };

export const KINDS = ['invoice', 'receipt', 'refund', 'credit', 'transfer', 'adjustment'];

export const ORDERS = [
	{ value: 'date', label: 'Date' },
	{ value: 'amount', label: 'Amount' },
	{ value: 'party', label: 'Party' }
];

export const entries = createCollection<Entry, number, void>(
	{
		keyOf: (e) => e.id,
		// No `fetchAll`. A collection this size has no "just load it" path, and
		// leaving the option out means nothing can accidentally take it.
		fetchPage: ({ query, limit, cursor }) =>
			invoke('stress_page', {
				search: query.search ?? '',
				kind: (query.where?.kind as string) ?? '',
				order: query.order?.by ?? 'date',
				desc: query.order?.dir === 'desc',
				limit,
				cursor: cursor ?? null
			}),
		fetchOne: (id) => invoke('stress_get', { id })
	},
	// Cap and page size are the two knobs the page exposes; these are the
	// starting guesses the note says should be measured rather than picked.
	{ cap: 2000, pageSize: 500 }
);

/** Force generation so the one-off build cost is attributable to itself
 *  instead of being blamed on the first query. */
export function warmStress(): Promise<number> {
	return invoke<number>('stress_warm', {});
}
