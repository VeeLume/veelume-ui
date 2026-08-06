/**
 * The loans collection — scoped by year, plus the four closing operations.
 *
 * Scope is the partitioning strategy: rather than paging an unbounded set, it
 * is split into units the user already thinks in. stibu's orders and receipts
 * grow monotonically and will need exactly this.
 *
 * Only `save` goes through the collection's write layer, because only `save` is
 * a record-shaped update. The four closers are separate commands; what used to
 * be "write through the API, reload after" is now event-driven — the backend
 * emits `loans-changed` with kind + keys, and the collection refreshes exactly
 * the records named (or removes them locally, for a keyed delete).
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createCollection } from '@veelume/ui';
import type { Loan } from './fixtures/loans.js';

/** What both backends put on the `loans-changed` event. Mirrors `ChangeInfo`,
 *  with the scope under its domain name. */
type LoanChange = { kind?: 'create' | 'update' | 'delete'; keys?: string[]; year?: string };

/** The year the surface is looking at. Set from the URL by the page; the
 *  collection reads it through a getter, so switching is just another entry. */
let currentYear = $state(String(new Date().getFullYear()));

export function setLoanYear(year: string): void {
	currentYear = year;
}
export function loanYear(): string {
	return currentYear;
}

/**
 * A cap this small is deliberate. The seeded years hold 6–8 loans, so `cap: 5`
 * puts a real surface into the truncated state permanently — which is the state
 * that has to be *visible*, and the one a demo seeded with comfortable data
 * would never reach. `?cap=` overrides it for the complete case.
 */
const capFromUrl =
	typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('cap')) : 0;

export const loans = createCollection<Loan, string, string>(
	{
		keyOf: (l) => l.id,
		// Both paths are declared: `fetchPage` is used when present, and `fetchAll`
		// stays as the degradation target an adapter that cannot page would rely on.
		fetchAll: (year) => invoke('loans_list', { year }),
		fetchPage: ({ scope: year, limit, cursor }) =>
			invoke('loans_page', { year, limit, cursor: cursor ?? null }),
		fetchOne: (id, year) => invoke('loans_get', { id, year }),
		write: {
			semantics: 'replace',
			save: (_id, body, year) => invoke('loans_save', { body, year })
		},
		/**
		 * Backend invalidation, from both transports: Rust emits after each
		 * mutation, the fixtures emit through the mocked event bus. A keyed
		 * `delete` removes locally with no refetch; keyed updates refresh just
		 * those records; anything less reloads the year's sets.
		 */
		subscribe: async (onChange) =>
			listen<LoanChange>('loans-changed', (e) =>
				onChange({ kind: e.payload.kind, keys: e.payload.keys, scope: e.payload.year })
			)
	},
	{ scope: () => currentYear, cap: capFromUrl || 5, pageSize: 3 }
);

/**
 * Create. Not a `write.save` — the collection's write layer updates a record it
 * already holds, and this one does not exist yet. Same shape as the four
 * closers: a command, then `refresh()`.
 */
export async function createLoan(): Promise<string> {
	const loan = await invoke<Loan>('loans_create', { year: currentYear });
	await loans.refresh();
	return loan.id;
}

/** 1 — soft delete: status change, returns the record. The keyed `update`
 *  event refreshes exactly this record — no full reload anymore. */
export async function returnLoan(id: string): Promise<void> {
	await invoke('loans_return', { id, year: currentYear });
}

/** 2 — hard delete: drafts only, returns nothing.
 *
 *  Tier-1 deletion: WE did it, so `discard` drops the record locally the
 *  moment the server confirms. The backend's keyed `delete` event (tier 2)
 *  lands right after and finds nothing left to remove — idempotent by
 *  design, and the second tier is what covers OTHER writers' deletes. */
export async function cancelLoan(id: string): Promise<void> {
	await invoke('loans_cancel', { id, year: currentYear });
	loans.discard(id);
}

/** 3 — counter-document: closes the original, issues a replacement, returns
 *  the NEW record. The one shape that cannot be modelled as a deletion at all
 *  — the keyed event carries BOTH ids, and both records refresh. */
export async function markLost(id: string): Promise<string> {
	const replacement = await invoke<Loan>('loans_mark_lost', { id, year: currentYear });
	return replacement.id;
}

/** 4 — soft, terminal: returns nothing. */
export async function archiveLoan(id: string): Promise<void> {
	await invoke('loans_archive', { id, year: currentYear });
}
