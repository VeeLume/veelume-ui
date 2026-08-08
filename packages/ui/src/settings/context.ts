/**
 * Settings context — how `Settings.List` and `Settings.Page` get the
 * categories and the section root without threading props through routes.
 */

import { getContext, setContext } from 'svelte';
import type { SettingsCategory } from './types.js';

export type SettingsContext = {
	readonly categories: SettingsCategory[];
	/** The section's root route — where back leads and where "at root" is. */
	readonly root: string;
};

const SETTINGS = Symbol('veelume-ui:settings');

export function setSettingsContext(ctx: SettingsContext): void {
	setContext(SETTINGS, ctx);
}

export function getSettingsContext(): SettingsContext {
	const ctx = getContext<SettingsContext | undefined>(SETTINGS);
	if (!ctx) {
		throw new Error(
			'veelume-ui: a Settings part was used outside <Settings.Root>. Parts read the categories and root from context.'
		);
	}
	return ctx;
}
