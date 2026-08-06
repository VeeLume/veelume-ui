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
	{
		cap: 10_000,
		pageSize: 500,
		/**
		 * ⚑ The DEFINITION of a set, and the same predicate the backend applies.
		 *
		 * Rows are derived by running this over the cache, so a search shows its
		 * matches instantly from what is already held and the fetch only tops the
		 * cache up. It MUST agree with the server — a predicate that disagrees
		 * shows rows the real answer will not contain, which is worse than showing
		 * nothing.
		 */
		matches: (e: Entry, q) => {
			if (q.where?.kind && e.kind !== q.where.kind) return false;
			const needle = (q.search ?? '').trim().toLowerCase();
			if (!needle) return true;
			return e.party.toLowerCase().includes(needle) || String(e.id) === needle;
		},
		/**
		 * The derivation sorts locally, so the order needs a real comparator — the
		 * server's ordering is an accelerator, not the source of row order.
		 */
		compare: (order) => {
			const dir = order?.dir === 'desc' ? -1 : 1;
			if (order?.by === 'amount') return (a: Entry, b: Entry) => (a.cents - b.cents) * dir;
			if (order?.by === 'party') return (a: Entry, b: Entry) => a.party.localeCompare(b.party) * dir;
			return (a: Entry, b: Entry) => (a.id - b.id) * dir;
		}
	}
);

/** Force generation so the one-off build cost is attributable to itself
 *  instead of being blamed on the first query. */
export function warmStress(): Promise<number> {
	return invoke<number>('stress_warm', {});
}
