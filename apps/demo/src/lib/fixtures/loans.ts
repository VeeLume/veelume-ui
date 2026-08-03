/**
 * Loans — the Collection (archetype B) fixture.
 *
 * Two jobs the catalog cannot do:
 *
 *  1. **Scoped by year.** The catalog is unscoped (one dataset forever, the
 *     stibu/connect-neo case); loans are partitioned the way stibu's orders and
 *     receipts will have to be. Both paths of the scope design get exercised.
 *  2. **All four delete shapes**, lifted from stibu's `api/client.ts`:
 *       return       soft — status change, returns the record
 *       cancel       hard — only a draft, returns nothing
 *       mark lost    counter-document — the original is closed and a REPLACEMENT
 *                    record is created; returns the new one
 *       archive      soft, terminal — returns nothing
 *     They are four operations, not one with a flag, which is why the
 *     collection's write layer deliberately does not try to own them.
 */

import type { FixtureModule } from './types.js';

export type LoanStatus = 'draft' | 'out' | 'returned' | 'lost' | 'archived';

export type Loan = {
	id: string;
	title: string;
	borrower: string;
	lent_on: string;
	due_on: string;
	status: LoanStatus;
	/** Set on the original when a replacement is issued — the counter-document link. */
	replaced_by: string | null;
	/** Cents. German formatting turns this into `1.234,56`, which is the point. */
	fine_cents: number;
	note: string;
};

const BORROWERS = ['Petra', 'Norbert', 'Dr. Nagel', 'Markus', 'Anja'];
const TITLES = [
	'The Dispossessed',
	'Use of Weapons',
	'Kindred',
	'Solaris',
	'Ancillary Justice',
	'A Closed and Common Orbit'
];
const STATUSES: LoanStatus[] = ['draft', 'out', 'out', 'returned', 'lost', 'archived'];

function build(): Record<string, Loan[]> {
	const out: Record<string, Loan[]> = {};
	['2024', '2025', '2026'].forEach((year, y) => {
		out[year] = Array.from({ length: 6 + y }, (_, i) => {
			const month = String(((i * 2 + y) % 12) + 1).padStart(2, '0');
			return {
				id: `loan-${year}-${i + 1}`,
				title: TITLES[(i + y) % TITLES.length],
				borrower: BORROWERS[(i + y * 2) % BORROWERS.length],
				lent_on: `${year}-${month}-05`,
				// A spread of due dates, so "overdue" is a real derived property
				// rather than everything landing on one side.
				due_on: `${year}-${month}-25`,
				status: STATUSES[(i + y) % STATUSES.length],
				replaced_by: null,
				fine_cents: i % 3 === 0 ? 0 : (i + 1) * 12345,
				note: ''
			};
		});
	});
	return out;
}

let byYear = build();

function find(year: string, id: string): Loan {
	const list = byYear[year] ?? [];
	const loan = list.find((l) => l.id === id);
	if (!loan) throw new Error(`loan ${id} not found in ${year}`);
	return loan;
}

export const loanFixtures: FixtureModule = {
	loans_list: (payload) => (byYear[String(payload.year)] ?? []).map((l) => ({ ...l })),

	/** Record-shaped edit — this one DOES belong to the collection's write layer. */
	loans_save: (payload) => {
		const year = String(payload.year);
		const body = payload.body as Loan;
		const list = byYear[year] ?? [];
		const i = list.findIndex((l) => l.id === body.id);
		if (i < 0) throw new Error(`loan ${body.id} not found`);
		list[i] = { ...body };
		return { ...list[i] };
	},

	/** 1 — soft delete. Returns the record. */
	loans_return: (payload) => {
		const loan = find(String(payload.year), String(payload.id));
		loan.status = 'returned';
		return { ...loan };
	},

	/** 2 — hard delete. Drafts only, and returns nothing. */
	loans_cancel: (payload) => {
		const year = String(payload.year);
		const id = String(payload.id);
		const loan = find(year, id);
		if (loan.status !== 'draft') throw new Error('only a draft can be cancelled');
		byYear[year] = byYear[year].filter((l) => l.id !== id);
		return null;
	},

	/** 3 — counter-document. Closes the original and issues a REPLACEMENT. */
	loans_mark_lost: (payload) => {
		const year = String(payload.year);
		const original = find(year, String(payload.id));
		const replacement: Loan = {
			...original,
			id: `${original.id}-R`,
			status: 'draft',
			replaced_by: null,
			fine_cents: 0,
			note: `Replacement for ${original.id}`
		};
		original.status = 'lost';
		original.replaced_by = replacement.id;
		byYear[year] = [...byYear[year], replacement];
		return { ...replacement };
	},

	/** 4 — soft, terminal. Returns nothing. */
	loans_archive: (payload) => {
		const loan = find(String(payload.year), String(payload.id));
		loan.status = 'archived';
		return null;
	},

	loans_reset: () => {
		byYear = build();
		return null;
	}
};
