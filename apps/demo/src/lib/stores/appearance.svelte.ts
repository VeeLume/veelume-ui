// Appearance preferences (colour scheme + density), persisted per device and
// applied to <html>: `data-density` drives the density CSS variables and the
// `dark` class drives the dark-theme tokens (see app.css / theme.css).
// init() runs once from the root layout, before content first paints.
//
// Deliberately NOT part of the Rust settings snapshot: this is per-device
// display preference, it must apply before any IPC round-trip completes, and
// the web build (if one ever happens) has no backend to ask.
//
// Persistence rides the kit's storedValue — the validating loader is what
// this store used to hand-roll, and what Hearth's prefs hand-rolled before
// it. This store keeps what IS app logic: applying the values to <html> and
// following the OS scheme while theme is 'system'.

import { storedValue } from '@veelume/ui';

export type Density = 'comfortable' | 'compact';
export type Theme = 'light' | 'dark' | 'system';

const density = storedValue<Density>(
	'veelume-ui-demo:density',
	'comfortable',
	(v): v is Density => v === 'comfortable' || v === 'compact'
);

const theme = storedValue<Theme>(
	'veelume-ui-demo:theme',
	'system',
	(v): v is Theme => v === 'light' || v === 'dark' || v === 'system'
);

class Appearance {
	private mql: MediaQueryList | null = null;
	private started = false;

	get density() {
		return density.value;
	}
	get theme() {
		return theme.value;
	}

	init() {
		if (this.started || typeof window === 'undefined') return;
		this.started = true;

		this.mql = window.matchMedia('(prefers-color-scheme: dark)');
		this.mql.addEventListener('change', () => this.applyTheme());
		this.applyDensity();
		this.applyTheme();
	}

	setDensity(d: Density) {
		density.value = d;
		this.applyDensity();
	}

	setTheme(t: Theme) {
		theme.value = t;
		this.applyTheme();
	}

	/** Whether the *effective* scheme is dark (resolves 'system'). */
	get isDark() {
		return theme.value === 'dark' || (theme.value === 'system' && !!this.mql?.matches);
	}

	private applyDensity() {
		const root = document.documentElement;
		if (density.value === 'compact') root.dataset.density = 'compact';
		else delete root.dataset.density;
	}

	private applyTheme() {
		document.documentElement.classList.toggle('dark', this.isDark);
	}
}

export const appearance = new Appearance();
