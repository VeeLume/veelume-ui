// Paraglide wrapper. Import `m` from here rather than reaching into
// `$lib/paraglide/messages` directly, so the locale-switch behaviour below is
// the only path that exists.
import * as m from '$lib/paraglide/messages';
import {
	getLocale,
	setLocale,
	locales,
	localStorageKey,
	type Locale
} from '$lib/paraglide/runtime';

export { m, getLocale, setLocale, locales };
export type { Locale };

/**
 * Set the active locale, or clear the override to follow the OS preference
 * (the `preferredLanguage` strategy). Reloads the page so every `m.*` call
 * re-renders — Paraglide messages resolve at call time, not reactively.
 */
export function selectLocale(locale: Locale | 'system'): void {
	if (locale === 'system') {
		localStorage.removeItem(localStorageKey);
		window.location.reload();
	} else {
		setLocale(locale);
	}
}

/** Whether the user has an explicit language override stored. */
export function hasExplicitLocale(): boolean {
	return localStorage.getItem(localStorageKey) !== null;
}
