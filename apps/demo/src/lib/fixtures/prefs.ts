/**
 * Reading preferences — one record, no list. Archetype E's data.
 *
 * Modelled as a collection of exactly one rather than a bare get/save pair, to
 * test whether the collection primitive degenerates gracefully. If it turns out
 * to be ceremony, that is the finding.
 */

import type { FixtureModule } from './types.js';

// Re-exported from the generated bindings rather than redeclared: a fixture
// that drifts from the Rust contract is worse than no fixture, because it
// passes while the real backend fails.
export type { Preferences } from '$lib/bindings';
import type { Preferences } from '$lib/bindings';

const initial: Preferences = {
	id: 'me',
	display_name: 'Valerie',
	default_loan_days: 28,
	fine_per_day_cents: 150,
	preferred_format: 'paperback',
	notes: ''
};

let current: Preferences = { ...initial };

export const prefsFixtures: FixtureModule = {
	prefs_list: () => [{ ...current }],

	prefs_save: (payload) => {
		current = { ...(payload.body as Preferences) };
		return { ...current };
	},

	prefs_reset: () => {
		current = { ...initial };
		return null;
	}
};
