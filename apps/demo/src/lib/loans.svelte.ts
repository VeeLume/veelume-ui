/**
 * The loans collection — scoped by year, plus the four closing operations.
 *
 * Scope is the partitioning strategy: rather than paging an unbounded set, it
 * is split into units the user already thinks in. stibu's orders and receipts
 * grow monotonically and will need exactly this.
 *
 * Only `save` goes through the collection's write layer, because only `save` is
 * a record-shaped update. The four closers are separate commands followed by
 * `refresh()` — stibu's "write through the API, reload after".
 */

import { invoke } from '@tauri-apps/api/core';
import { createCollection } from '@veelume/ui';
import type { Loan } from './fixtures/loans.js';

/** The year the surface is looking at. Set from the URL by the page; the
 *  collection reads it through a getter, so switching is just another entry. */
let currentYear = $state(String(new Date().getFullYear()));

export function setLoanYear(year: string): void {
	currentYear = year;
}
export function loanYear(): string {
	return currentYear;
}

export const loans = createCollection<Loan, string, string>(
	{
		keyOf: (l) => l.id,
		fetchAll: (year) => invoke('loans_list', { year }),
		write: {
			semantics: 'replace',
			save: (_id, body, year) => invoke('loans_save', { body, year })
		}
	},
	{ scope: () => currentYear }
);

/** 1 — soft delete: status change, returns the record. */
export async function returnLoan(id: string): Promise<void> {
	await invoke('loans_return', { id, year: currentYear });
	await loans.refresh();
}

/** 2 — hard delete: drafts only, returns nothing. */
export async function cancelLoan(id: string): Promise<void> {
	await invoke('loans_cancel', { id, year: currentYear });
	await loans.refresh();
}

/** 3 — counter-document: closes the original, issues a replacement, returns
 *  the NEW record. The one shape that cannot be modelled as a deletion at all. */
export async function markLost(id: string): Promise<string> {
	const replacement = await invoke<Loan>('loans_mark_lost', { id, year: currentYear });
	await loans.refresh();
	return replacement.id;
}

/** 4 — soft, terminal: returns nothing. */
export async function archiveLoan(id: string): Promise<void> {
	await invoke('loans_archive', { id, year: currentYear });
	await loans.refresh();
}
