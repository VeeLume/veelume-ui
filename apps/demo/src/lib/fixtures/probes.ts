/**
 * A deliberately hostile fixture entity, used to drive the collection primitive
 * through the paths that are hard to reach against a real backend.
 *
 * This is the payoff the fixture adapter was built for: the record-store spike
 * had to *race* two writers to provoke a write conflict and got
 * non-deterministic ordering, so the same click produced different traces. Here
 * `probes_hijack` makes the next save return something other than what was
 * asked for, every time.
 *
 * Two scopes exist so scope keying is exercised rather than assumed.
 *
 * Not the demo's domain — that is works/editions/loans. This is a test rig, and
 * it should be deleted once the real surfaces cover the same ground.
 */

import type { FixtureModule } from './types.js';

// Re-exported, never redeclared: a fixture that drifts from the Rust contract
// is worse than no fixture, because it passes while the real backend fails.
export type { Probe } from '$lib/bindings';
import type { Probe } from '$lib/bindings';

function seed(scope: string): Probe[] {
	return Array.from({ length: 3 }, (_, i) => ({
		id: `${scope}-${i + 1}`,
		name: `${scope} probe ${i + 1}`,
		note: 'initial'
	}));
}

const byScope: Record<string, Probe[]> = {
	alpha: seed('alpha'),
	beta: seed('beta')
};

/** 8 × 5 cycling with period 40 → every name distinct, every word shared by
 *  several rows — so a one-word search has a small, countable answer. */
const PAGED_GIVEN = ['amber', 'birch', 'cedar', 'fjord', 'garnet', 'heron', 'juniper', 'krill'];
const PAGED_KIND = ['array', 'beacon', 'circuit', 'dynamo', 'filament'];

/** The paged-rig corpus: 40 records — big enough to page, small enough to
 *  exhaust under a 100 cap. Read-only; reset with the probes. */
function seedPaged(): Probe[] {
	return Array.from({ length: 40 }, (_, i) => ({
		id: `paged-${String(i + 1).padStart(2, '0')}`,
		name: `${PAGED_GIVEN[i % 8]} ${PAGED_KIND[i % 5]} ${i + 1}`,
		note: 'initial'
	}));
}

let paged = seedPaged();

/** Applied INSTEAD of the requested body on the next save. Simulates another
 *  writer winning — the exact shape of the spike's silent data loss. */
let hijack: Partial<Probe> | null = null;

/** How many times each command has been called, so dedupe is measurable rather
 *  than inferred. */
export const callCounts: Record<string, number> = {};

function count(cmd: string): void {
	callCounts[cmd] = (callCounts[cmd] ?? 0) + 1;
}

export const probeFixtures: FixtureModule = {
	probes_list: (payload) => {
		count('probes_list');
		const scope = String(payload.scope ?? 'alpha');
		return (byScope[scope] ?? []).map((p) => ({ ...p }));
	},

	probes_get: (payload) => {
		count('probes_get');
		const scope = String(payload.scope ?? 'alpha');
		const id = String(payload.id);
		const found = (byScope[scope] ?? []).find((p) => p.id === id);
		if (!found) throw new Error(`probe ${id} not found`);
		return { ...found };
	},

	/** Full-replace semantics, matching stibu's `UpdateCustomerInput`. */
	probes_save: (payload) => {
		count('probes_save');
		const scope = String(payload.scope ?? 'alpha');
		const body = payload.body as Probe;
		const list = byScope[scope] ?? [];
		const i = list.findIndex((p) => p.id === body.id);
		if (i < 0) throw new Error(`probe ${body.id} not found`);

		const applied = hijack ? { ...body, ...hijack } : body;
		hijack = null;
		list[i] = { ...applied };
		return { ...list[i] };
	},

	/** Test control: make the next save return something else. */
	probes_hijack: (payload) => {
		hijack = (payload.patch as Partial<Probe>) ?? null;
		return null;
	},

	/** The paged rig — see the Rust twin's doc comment. Keyset paging plus a
	 *  pushed-down search, mirrored bit for bit. */
	probes_page: (payload) => {
		count('probes_page');
		const needle = String(payload.search ?? '')
			.trim()
			.toLowerCase();
		const hits = paged.filter(
			(p) =>
				!needle || p.name.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle)
		);

		const cursor = payload.cursor == null ? null : String(payload.cursor);
		const at = cursor === null ? -1 : hits.findIndex((p) => p.id === cursor);
		const start = at < 0 ? 0 : at + 1;
		const take = Math.max(0, Number(payload.limit) || 0);
		const slice = hits.slice(start, start + take).map((p) => ({ ...p }));
		const more = start + slice.length < hits.length;

		return {
			records: slice,
			cursor: more && slice.length ? slice[slice.length - 1].id : null,
			total: hits.length,
			done: !more
		};
	},

	/** Test control: reset seeds and counters. */
	probes_reset: () => {
		byScope.alpha = seed('alpha');
		byScope.beta = seed('beta');
		paged = seedPaged();
		hijack = null;
		for (const k of Object.keys(callCounts)) delete callCounts[k];
		return null;
	}
};
