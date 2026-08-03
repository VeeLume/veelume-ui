/**
 * The kit context — the ONLY channel through which app state reaches a kit
 * component. Everything else arrives as props or snippets; a direct app-store
 * import is forbidden (see CLAUDE.md, "Coupling contract").
 *
 * Carries two independent locales. This is not pedantry:
 *
 *   messageLocale     which language the text is in
 *   formattingLocale  how numbers, dates, times and week-start render
 *
 * Windows models these separately and so must we — Starlume's UI is English
 * while its user is German, so 24h and `1.234,56` are correct there. Fusing
 * them forces a choice between an English UI with am/pm and a German UI nobody
 * asked for.
 *
 * Nothing here uses runes. Reactivity comes from the app: the getters call the
 * functions it supplied, so `formattingLocale: () => settings.locale` is read
 * inside a component and tracked normally.
 */

import { getContext, setContext } from 'svelte';
import { defaultLabels, type LabelBag } from './labels.js';

export type { LabelBag };
export { defaultLabels };

export type KitContextInput = {
	/** Language of the UI text. Defaults to `'en'`. */
	messageLocale?: () => string;
	/**
	 * Regional formatting. Defaults to `messageLocale` — correct for the common
	 * case, and overridable exactly because it is often wrong (an English UI for
	 * a German user wants German formatting).
	 */
	formattingLocale?: () => string;
	/** Partial override; anything omitted keeps its English default. */
	labels?: Partial<LabelBag>;
};

export type KitContext = {
	readonly messageLocale: string;
	readonly formattingLocale: string;
	readonly labels: LabelBag;
	/**
	 * Derived from `formattingLocale`. Pass straight to bits-ui's date
	 * components — **their default is `en-US`**, so an omitted prop silently
	 * renders am/pm in a German UI. That exact bug is live in connect-neo.
	 */
	readonly hourCycle: 12 | 24;
	format: {
		number: (value: number, options?: Intl.NumberFormatOptions) => string;
		date: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
	};
};

const KIT_CONTEXT = Symbol('veelume-ui');

// Intl constructors are expensive and get called per row; option sets are few,
// so an unbounded cache keyed on locale + options is fine in practice.
const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function numberFormat(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
	const key = `${locale}|${options ? JSON.stringify(options) : ''}`;
	let f = numberFormats.get(key);
	if (!f) {
		f = new Intl.NumberFormat(locale, options);
		numberFormats.set(key, f);
	}
	return f;
}

function dateFormat(locale: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
	const key = `${locale}|${options ? JSON.stringify(options) : ''}`;
	let f = dateFormats.get(key);
	if (!f) {
		f = new Intl.DateTimeFormat(locale, options);
		dateFormats.set(key, f);
	}
	return f;
}

/**
 * Ask the runtime what the locale actually prefers rather than hardcoding a
 * region list. `resolvedOptions().hourCycle` is the well-supported route;
 * `Intl.Locale#hourCycles` is not universally available.
 */
function resolveHourCycle(locale: string): 12 | 24 {
	try {
		const hc = dateFormat(locale, { hour: 'numeric' }).resolvedOptions().hourCycle;
		return hc === 'h11' || hc === 'h12' ? 12 : 24;
	} catch {
		return 24;
	}
}

/**
 * Build a context without touching Svelte's component tree — for tests, for
 * L1 code that needs a locale, and as the implementation behind
 * {@link setKitContext}.
 */
export function createKitContext(input: KitContextInput = {}): KitContext {
	const labels: LabelBag = { ...defaultLabels, ...input.labels };

	const messageLocale = () => input.messageLocale?.() ?? 'en';
	const formattingLocale = () => input.formattingLocale?.() ?? messageLocale();

	return {
		get messageLocale() {
			return messageLocale();
		},
		get formattingLocale() {
			return formattingLocale();
		},
		get labels() {
			return labels;
		},
		get hourCycle() {
			return resolveHourCycle(formattingLocale());
		},
		format: {
			number: (value, options) => numberFormat(formattingLocale(), options).format(value),
			date: (value, options) =>
				dateFormat(formattingLocale(), options).format(
					typeof value === 'string' ? new Date(value) : value
				)
		}
	};
}

/**
 * Install the context. Call once, during initialisation of the app's root
 * layout.
 */
export function setKitContext(input: KitContextInput = {}): KitContext {
	const ctx = createKitContext(input);
	setContext(KIT_CONTEXT, ctx);
	return ctx;
}

let fallback: KitContext | undefined;

/**
 * Read the context. Must be called during component initialisation, like any
 * `getContext`.
 *
 * An app that never called {@link setKitContext} gets an English, `en`-formatted
 * default rather than an error — deliberate, so a component works in isolation
 * (the gallery, a test, a first spike) with zero wiring.
 */
export function getKitContext(): KitContext {
	const ctx = getContext<KitContext | undefined>(KIT_CONTEXT);
	if (ctx) return ctx;
	fallback ??= createKitContext();
	return fallback;
}
