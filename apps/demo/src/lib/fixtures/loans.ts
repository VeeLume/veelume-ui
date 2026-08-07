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

import { emit } from '@tauri-apps/api/event';
import type { FixtureModule } from './types.js';

export type LoanStatus = 'draft' | 'out' | 'returned' | 'lost' | 'archived';

// `Loan` comes from the generated bindings rather than being redeclared, so it
// cannot drift from the Rust contract. `LoanStatus` stays local: Rust models
// status as a plain String and the UI wants the narrower union.
export type { Loan } from '$lib/bindings';
import type { Loan } from '$lib/bindings';

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

/**
 * The invalidation channel, exactly as the Rust twin emits it. `mockIPC`'s
 * `shouldMockEvents` makes `emit` reach the app's `listen` — which is what
 * lets a browser drive the collection's whole keyed-invalidation path.
 * Fire-and-forget: a fixture must not couple its response to event delivery.
 */
function changed(year: string, kind: 'create' | 'update' | 'delete', keys: string[]): void {
	void emit('loans-changed', { kind, keys, year });
}

export const loanFixtures: FixtureModule = {
	loans_list: (payload) => (byYear[String(payload.year)] ?? []).map((l) => ({ ...l })),

	/**
	 * The paged read — accumulation, not pagination. The client calls this until
	 * the source is exhausted or its cap is reached, and still ends up holding the
	 * set, so client-side filtering and contextual counts survive.
	 *
	 * **Keyset, exclusive**: the cursor is the last row's id and the next page
	 * starts *after* it. That is what you write over SQLite, TrailBase or
	 * Postgres — no offset drift when a row is inserted mid-accumulation, and no
	 * boundary row re-emitted. `total` comes back with every page, as it does
	 * from a `COUNT(*)` on an indexed predicate.
	 */
	loans_page: (payload) => {
		const year = String(payload.year);
		const list = byYear[year] ?? [];
		const limit = Number(payload.limit) || 10;
		const cursor = payload.cursor == null ? null : String(payload.cursor);

		const after = cursor ? list.findIndex((l) => l.id === cursor) + 1 : 0;
		const slice = list.slice(after, after + limit);
		const last = slice.at(-1);
		const more = after + slice.length < list.length;

		return {
			records: slice.map((l) => ({ ...l })),
			cursor: more && last ? last.id : null,
			total: list.length,
			done: !more
		};
	},

	/** Record-shaped edit — this one DOES belong to the collection's write layer. */
	loans_save: (payload) => {
		const year = String(payload.year);
		const body = payload.body as Loan;
		const list = byYear[year] ?? [];
		const i = list.findIndex((l) => l.id === body.id);
		if (i < 0) throw new Error(`loan ${body.id} not found`);
		list[i] = { ...body };
		changed(year, 'update', [body.id]);
		return { ...list[i] };
	},

	/** 1 — soft delete. Returns the record. */
	loans_return: (payload) => {
		const year = String(payload.year);
		const loan = find(year, String(payload.id));
		loan.status = 'returned';
		changed(year, 'update', [loan.id]);
		return { ...loan };
	},

	/** 2 — hard delete. Drafts only, and returns nothing. The keyed `delete`
	 *  event is tier-2 deletion: any OTHER client holding this record learns of
	 *  its absence without a refetch. */
	loans_cancel: (payload) => {
		const year = String(payload.year);
		const id = String(payload.id);
		const loan = find(year, id);
		if (loan.status !== 'draft') throw new Error('only a draft can be cancelled');
		byYear[year] = byYear[year].filter((l) => l.id !== id);
		changed(year, 'delete', [id]);
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
		// Both ids: the closed original AND the issued replacement — which is
		// what makes the counter-document work over keyed refresh.
		changed(year, 'update', [original.id, replacement.id]);
		return { ...replacement };
	},

	/** 4 — soft, terminal. Returns nothing. */
	loans_archive: (payload) => {
		const year = String(payload.year);
		const loan = find(year, String(payload.id));
		loan.status = 'archived';
		changed(year, 'update', [loan.id]);
		return null;
	},

	/** One record by id — what a deep link or a server-search hit needs, since
	 *  neither belongs to any working set the client holds. */
	loans_get: (payload) => ({ ...find(String(payload.year), String(payload.id)) }),

	/** The create path — what the list header's one forward action reaches. */
	loans_create: (payload) => {
		const year = String(payload.year);
		const list = (byYear[year] ??= []);
		const loan: Loan = {
			id: `loan-${year}-new-${list.length + 1}`,
			title: 'Untitled loan',
			borrower: '',
			lent_on: `${year}-01-01`,
			due_on: `${year}-01-31`,
			status: 'draft',
			replaced_by: null,
			fine_cents: 0,
			note: ''
		};
		list.push(loan);
		changed(year, 'create', [loan.id]);
		return { ...loan };
	},

	loans_reset: () => {
		byYear = build();
		return null;
	}
};
