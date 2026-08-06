/**
 * The browser twin of `src-tauri/src/stress.rs` — the same 1.5M entries, the
 * same LCG, the same order, the same answers.
 *
 * ⚑ It holds **1.5M real objects with their own strings**, and that is the
 * point rather than an oversight. An earlier version packed the rows into typed
 * arrays with 2 048 interned names and cost ~15MB; that cheated twice:
 *
 *  - it hid the footprint, which is one of the things this surface exists to
 *    expose;
 *  - it capped search selectivity, so no query could ever return a single row
 *    out of 1.5M — exactly the case worth testing.
 *
 * Expect a few hundred MB and a visible build pause. Both are findings. The
 * build is lazy, triggered by the first stress command, so no other surface
 * pays for a dataset it never opens.
 */

import type { FixtureModule } from './types.js';

export type { Entry, EntryPage } from '$lib/bindings';
import type { Entry } from '$lib/bindings';

export const STRESS_COUNT = 1_500_000;

export const KINDS = ['invoice', 'receipt', 'refund', 'credit', 'transfer', 'adjustment'];

const SURNAMES = [
	'Grunwald', 'Petersen', 'Kowalski', 'Ferreira', 'Nakamura', 'Oyelaran', 'Bergström',
	'Dvorak', 'Halvorsen', 'Ivanova', 'Jankowski', 'Kaufmann', 'Lindqvist', 'Moreau',
	'Nielsen', 'Okonkwo', 'Pavlenko', 'Quintero', 'Rasmussen', 'Sørensen', 'Takahashi',
	'Ueberroth', 'Vasquez', 'Weisskopf', 'Xiong', 'Yamamoto', 'Zieliński', 'Abadi',
	'Broekhuis', 'Castellano', 'Duarte', 'Eriksdottir'
];

const GIVEN = [
	'Anja', 'Boris', 'Clara', 'Dmitri', 'Elif', 'Farid', 'Greta', 'Hugo', 'Ines', 'Jonas',
	'Kira', 'Lucas', 'Mira', 'Nils', 'Olga', 'Piotr'
];

/**
 * 16 × 32 × 10 000 ≈ 5.1M possible names over 1.5M rows: most unique, surnames
 * still repeating heavily. `Grunwald` matches ~47 000 rows, `Anja Grunwald
 * 4213` matches one.
 */
const NAME_SUFFIX = 10_000;

let rows: Entry[] | null = null;
/** Lowercased party per row. Without it, every keystroke allocates 1.5M
 *  temporaries — a fixture artefact that would drown the signal. */
let partyLc: string[] = [];

const EPOCH = Date.UTC(2006, 0, 1);
const dateOf = (day: number) => new Date(EPOCH + day * 86_400_000).toISOString().slice(0, 10);

function build(): Entry[] {
	const out: Entry[] = new Array(STRESS_COUNT);
	partyLc = new Array(STRESS_COUNT);

	// Matched to the Rust LCG bit for bit, so both transports serve one dataset.
	let s = 0x5eed1234abcd0001n;
	const MUL = 6364136223846793005n;
	const INC = 1442695040888963407n;
	const MASK = (1n << 64n) - 1n;
	const next = (): number => {
		s = (s * MUL + INC) & MASK;
		return Number(s >> 33n) >>> 0;
	};

	for (let id = 0; id < STRESS_COUNT; id++) {
		const r1 = next();
		const r2 = next();
		const party = `${GIVEN[r2 % GIVEN.length]} ${
			SURNAMES[Math.floor(r2 / 16) % SURNAMES.length]
		} ${r1 % NAME_SUFFIX}`;
		partyLc[id] = party.toLowerCase();
		out[id] = {
			id,
			date: dateOf(Math.floor(id / 205)),
			party,
			kind: KINDS[r1 % KINDS.length],
			cents: (r1 % 500_000) - 50_000
		};
	}
	return out;
}

function data(): Entry[] {
	rows ??= build();
	return rows;
}

/**
 * Recent match lists, keyed by their query — most recent last, bounded.
 *
 * ⚑ Accumulating 20 000 rows at 500 per page is 40 calls, and each one was
 * re-scanning 1.5M rows and re-sorting the matches — 19.5s for a single search.
 * A real database does the work once and holds a cursor; this memo is the cheap
 * stand-in, and without it the backend's cost drowns every client-side effect
 * this surface exists to observe.
 *
 * ⚑ A MAP, not a single entry — mirroring the Rust twin exactly. Two fills
 * interleaving page-wise made a one-entry memo ping-pong: every page missed,
 * every miss re-scanned 1.5M rows.
 */
const MEMO_KEEP = 8;
const memo: { key: string; hits: number[] }[] = [];

function hitsFor(search: string, kind: string, order: string, desc: boolean): number[] {
	const key = `${search}|${kind}|${order}|${desc}`;
	const at = memo.findIndex((m) => m.key === key);
	if (at >= 0) {
		const [hit] = memo.splice(at, 1);
		memo.push(hit); // recency is the eviction order
		return hit.hits;
	}
	const hits = matching(search, kind, order, desc);
	memo.push({ key, hits });
	if (memo.length > MEMO_KEEP) memo.shift();
	return hits;
}

/** Matching ids in the requested order — a full scan plus a sort of the hits.
 *  Honest work; if it is slow, that is the finding. */
function matching(search: string, kind: string, order: string, desc: boolean): number[] {
	const all = data();
	const needle = search.trim().toLowerCase();
	const asId = /^\d+$/.test(needle) ? Number(needle) : -1;

	const hits: number[] = [];
	for (let id = 0; id < all.length; id++) {
		const r = all[id];
		if (kind && r.kind !== kind) continue;
		if (needle && !partyLc[id].includes(needle) && id !== asId) continue;
		hits.push(id);
	}

	if (order === 'amount') hits.sort((a, b) => all[a].cents - all[b].cents);
	else if (order === 'party') hits.sort((a, b) => (partyLc[a] < partyLc[b] ? -1 : partyLc[a] > partyLc[b] ? 1 : 0));
	// Default: ids are already in date order by construction, as an indexed
	// column would be — no sort needed.

	if (desc) hits.reverse();
	return hits;
}

export const stressFixtures: FixtureModule = {
	stress_warm: () => data().length,

	/** Keyset paging over the ordered match list — the cursor is the last id and
	 *  the next page starts after it. */
	stress_page: (payload) => {
		const all = data();
		const hits = hitsFor(
			String(payload.search ?? ''),
			String(payload.kind ?? ''),
			String(payload.order ?? ''),
			payload.desc === true
		);
		const limit = Math.max(0, Number(payload.limit) || 0);
		const cursor = payload.cursor == null ? null : Number(payload.cursor);

		let start = 0;
		if (cursor !== null && Number.isFinite(cursor)) {
			const at = hits.indexOf(cursor);
			start = at < 0 ? 0 : at + 1;
		}
		const end = Math.min(start + limit, hits.length);
		const records = hits.slice(start, end).map((id) => all[id]);
		const more = end < hits.length;

		return {
			records,
			cursor: more && records.length ? String(records[records.length - 1].id) : null,
			total: hits.length,
			done: !more
		};
	},

	stress_get: (payload) => {
		const id = Number(payload.id);
		const r = data()[id];
		if (!r) throw new Error(`entry ${id} not found`);
		return r;
	}
};
