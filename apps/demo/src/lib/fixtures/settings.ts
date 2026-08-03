/**
 * Fixtures for the app-settings commands.
 *
 * Mirrors `src-tauri/src/settings.rs`: one snapshot, whole-snapshot saves. The
 * command names are the Rust ones (snake_case), not the generated TS wrappers —
 * `mockIPC` intercepts at the `invoke` boundary.
 *
 * Persisted to sessionStorage rather than held in a module variable, so a reload
 * keeps whatever was toggled. sessionStorage and not localStorage on purpose: a
 * fixture backend that survives closing the tab would start to feel like a real
 * one, and drift from Rust without anyone noticing.
 */

import type { AppSettings, FixtureModule } from './types.js';

const KEY = 'fixtures:settings';

const initial: AppSettings = {
	// Onboarding is not built yet; starting "completed" keeps it out of the way.
	onboarding_completed: true
};

function load(): AppSettings {
	if (typeof sessionStorage === 'undefined') return { ...initial };
	const raw = sessionStorage.getItem(KEY);
	if (!raw) return { ...initial };
	try {
		return { ...initial, ...(JSON.parse(raw) as Partial<AppSettings>) };
	} catch {
		return { ...initial };
	}
}

function store(value: AppSettings): void {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.setItem(KEY, JSON.stringify(value));
}

let current = load();

export const settingsFixtures: FixtureModule = {
	settings_get: () => current,

	settings_save: (payload) => {
		current = payload.settings as AppSettings;
		store(current);
		// The Rust command returns `Result<(), String>`; tauri-specta unwraps a
		// bare resolve into `{ status: "ok" }`, so null is the success shape.
		return null;
	}
};
