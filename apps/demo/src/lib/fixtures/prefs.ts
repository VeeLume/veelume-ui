/**
 * Reading preferences — one record, no list. Archetype E's data.
 *
 * Modelled as a collection of exactly one rather than a bare get/save pair, to
 * test whether the collection primitive degenerates gracefully. If it turns out
 * to be ceremony, that is the finding.
 */

import type { FixtureModule } from './types.js';

export type Preferences = {
	id: 'me';
	display_name: string;
	default_loan_days: number;
	/** Cents per day. German formatting makes this `1,50 €`. */
	fine_per_day_cents: number;
	preferred_format: 'hardcover' | 'paperback' | 'ebook';
	notes: string;
};

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
