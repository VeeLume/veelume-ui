/**
 * L1 browse state — query, facets, sort and view mode, stored in the URL.
 *
 * Not "URL vs in-memory". The question is *what deserves a history entry*, and
 * the URL is the only storage `history.back()` can restore from — in-memory
 * state can never be back-able, which is structural rather than a quality
 * issue. Back must mean "the state I was just in", never "one level up".
 *
 * WHAT LIVES HERE: search text, facets, sort, view mode.
 * WHAT DOES NOT:
 *   - **selection** (which record is open) — that is a route, or a param the
 *     app owns; it is navigation, not browse state.
 *   - **expansion** (which rows are open) — page-local and transient. Hearth
 *     keeps it in a `SvelteSet` deliberately: expanding a row is exploration,
 *     not a state you were *in*.
 *   - **preferences** (sidebar collapsed, theme, density) — those belong to the
 *     appearance store; they are not navigation either.
 *
 * ON SCOPE CHANGES — a deliberate deviation from the earlier design sketch,
 * which said browse state should reset when scope changes. It should not.
 * Starlume needed `syncItemsChannel()` because its *results* were cached inside
 * the browse object, and its own `invalidateCatalogs()` already keeps browse
 * INPUTS while dropping results. Here results live in the collection, keyed by
 * scope and therefore already correct, so a reset would only throw away user
 * intent: filtering to "unread" and switching year should keep the filter.
 */

import { page } from '$app/state';
import { goto } from '$app/navigation';

/** Which history behaviour a change produces. */
export type HistoryMode = 'push' | 'replace';

export type BrowseField =
	| { kind: 'text'; default?: string; history?: HistoryMode; narrows?: boolean }
	| { kind: 'one'; default: string; history?: HistoryMode; narrows?: boolean }
	| { kind: 'many'; default?: string[]; history?: HistoryMode; narrows?: boolean };

export type BrowseSpec = Record<string, BrowseField>;

type ValueOf<F> = F extends { kind: 'many' } ? string[] : string;
export type BrowseValues<Spec extends BrowseSpec> = { [K in keyof Spec]: ValueOf<Spec[K]> };

/**
 * Defaults encode the history rule so a consumer cannot get it wrong by
 * omission: typing in a search box must NOT create a history entry (one entry
 * per keystroke makes back unusable — worse than in-memory), while choosing a
 * filter, a sort or a view mode must.
 */
function historyOf(field: BrowseField): HistoryMode {
	return field.history ?? (field.kind === 'text' ? 'replace' : 'push');
}

/** Sort never counts toward "am I looking at everything?" — it is always set.
 *  Search does not either; the badge answers what the FILTERS are doing. */
function narrowsBy(field: BrowseField): boolean {
	return field.narrows ?? field.kind !== 'text';
}

function defaultOf(field: BrowseField): string | string[] {
	if (field.kind === 'many') return field.default ?? [];
	return field.default ?? '';
}

function sameValue(a: string | string[], b: string | string[]): boolean {
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((v, i) => v === b[i]);
	}
	return a === b;
}

/** Read one field out of a URL, falling back to its default. */
function readField(params: URLSearchParams, key: string, field: BrowseField): string | string[] {
	if (field.kind === 'many') {
		const all = params.getAll(key);
		// Sorted on read as well as write, so a hand-edited URL still compares
		// equal to a generated one.
		return all.length ? [...all].sort() : ((field.default ?? []) as string[]);
	}
	return params.get(key) ?? field.default ?? '';
}

export function createBrowseState<Spec extends BrowseSpec>(spec: Spec) {
	const keys = Object.keys(spec) as (keyof Spec & string)[];

	function currentParams(): URLSearchParams {
		return page.url.searchParams;
	}

	function read(key: keyof Spec & string): string | string[] {
		return readField(currentParams(), key, spec[key]);
	}

	/**
	 * Rebuild the whole query string canonically.
	 *
	 * Canonical form is mandatory, not tidiness: without it the same filter set
	 * yields different strings depending on the order things were clicked, and
	 * back/forward fills with entries that look like distinct states but are not.
	 *
	 *   - params the kit does not own are preserved, in their original order
	 *   - owned params are emitted in sorted key order
	 *   - multi-values are sorted within a param
	 *   - anything equal to its default is OMITTED
	 */
	function buildSearch(next: Partial<Record<keyof Spec & string, string | string[]>>): string {
		const current = currentParams();
		const out = new URLSearchParams();

		for (const [k, v] of current) {
			if (!(k in spec)) out.append(k, v);
		}

		for (const key of [...keys].sort()) {
			const field = spec[key];
			const value = key in next ? next[key]! : read(key);
			if (sameValue(value, defaultOf(field))) continue;

			if (Array.isArray(value)) {
				for (const v of [...value].sort()) out.append(key, v);
			} else if (value !== '') {
				out.set(key, value);
			}
		}

		const qs = out.toString();
		return qs ? `?${qs}` : '';
	}

	function apply(
		next: Partial<Record<keyof Spec & string, string | string[]>>,
		history: HistoryMode
	): void {
		const search = buildSearch(next);
		const target = `${page.url.pathname}${search}`;
		if (target === `${page.url.pathname}${page.url.search}`) return;
		void goto(target, {
			replaceState: history === 'replace',
			// Both matter for a search box: without keepFocus every keystroke
			// blurs the input, and without noScroll the list jumps to the top.
			keepFocus: true,
			noScroll: true
		});
	}

	const values = {} as BrowseValues<Spec>;
	for (const key of keys) {
		Object.defineProperty(values, key, {
			enumerable: true,
			get: () => read(key)
		});
	}

	return {
		/** Live, URL-derived. Reading these during render tracks `page.url`. */
		values,

		set<K extends keyof Spec & string>(key: K, value: ValueOf<Spec[K]>): void {
			apply({ [key]: value } as never, historyOf(spec[key]));
		},

		/**
		 * Several fields in ONE navigation.
		 *
		 * ⚑ Not sugar: two `set` calls are two history entries and two renders,
		 * and the intermediate state is a real state the user can land on with
		 * the back button — "record selected, compare still open" is exactly the
		 * incoherence this exists to prevent. Any change that is one gesture
		 * must be one navigation.
		 *
		 * History is `push` when ANY touched field pushes, because the entry is
		 * worth keeping if any part of it was.
		 */
		setMany(values: Partial<{ [K in keyof Spec]: ValueOf<Spec[K]> }>): void {
			const modes = Object.keys(values).map((k) => historyOf(spec[k]));
			apply(values as never, modes.includes('push') ? 'push' : 'replace');
		},

		/** Add/remove one option of a `many` facet. */
		toggle<K extends keyof Spec & string>(key: K, option: string): void {
			const field = spec[key];
			if (field.kind !== 'many') throw new Error(`browse: "${key}" is not a multi-select facet`);
			const current = read(key) as string[];
			const next = current.includes(option)
				? current.filter((v) => v !== option)
				: [...current, option];
			apply({ [key]: next } as never, historyOf(field));
		},

		/** Back to defaults. One history entry — undoing a reset is a real intent. */
		reset(): void {
			const cleared = Object.fromEntries(keys.map((k) => [k, defaultOf(spec[k])]));
			apply(cleared as never, 'push');
		},

		/** Fields that are narrowing the list — the filter badge's number.
		 *  Excludes search and (by convention) sort: the badge answers "am I
		 *  looking at everything?", which only filters can change. */
		get activeCount(): number {
			return keys.filter((k) => narrowsBy(spec[k]) && !sameValue(read(k), defaultOf(spec[k])))
				.length;
		},

		get isNarrowed(): boolean {
			return this.activeCount > 0;
		},

		/** The canonical query string for the current state — for "copy link",
		 *  and for asserting canonicality in tests. */
		get canonicalSearch(): string {
			return buildSearch({});
		}
	};
}

export type BrowseState<Spec extends BrowseSpec> = ReturnType<typeof createBrowseState<Spec>>;
