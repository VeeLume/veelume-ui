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
		 * ⚑ The same predicate the backend applies, evaluated locally.
		 *
		 * Without it, typing "Greta" over a list that visibly contains a Greta
		 * blanks to a spinner while the server round-trips — hiding the row you
		 * were looking at. With it, the rows we already hold that match appear
		 * instantly as a partial answer, and the server's fuller answer replaces
		 * them when it lands.
		 *
		 * It MUST agree with the server: `party` substring, id equality, exact
		 * kind. A predicate that disagrees shows rows the real answer will not
		 * contain, which is worse than showing nothing.
		 */
		preview: (e, q) => {
			if (q.where?.kind && e.kind !== q.where.kind) return false;
			const needle = (q.search ?? '').trim().toLowerCase();
			if (!needle) return true;
			return e.party.toLowerCase().includes(needle) || String(e.id) === needle;
		}
	}
);

/** Force generation so the one-off build cost is attributable to itself
 *  instead of being blamed on the first query. */
export function warmStress(): Promise<number> {
	return invoke<number>('stress_warm', {});
}
