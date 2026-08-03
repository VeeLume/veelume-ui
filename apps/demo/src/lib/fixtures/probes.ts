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

export type Probe = {
	id: string;
	name: string;
	note: string;
};

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

	/** Test control: reset seeds and counters. */
	probes_reset: () => {
		byScope.alpha = seed('alpha');
		byScope.beta = seed('beta');
		hijack = null;
		for (const k of Object.keys(callCounts)) delete callCounts[k];
		return null;
	}
};
