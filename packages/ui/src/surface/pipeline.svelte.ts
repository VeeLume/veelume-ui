/**
 * The surface pipeline — logic, no markup, so it is L1 even though only L2
 * components consume it.
 *
 *   scoped cache → derive rows → search → filter → sort   (→ window → render)
 *
 * ⚑ `derive` runs BEFORE `filter`, always. A catalog filters on properties that
 * only exist *after* derivation joins an overlay — Hearth filters on `owned`,
 * which no raw blueprint carries. A 1:1 CRUD surface cannot tell the two orders
 * apart, which is exactly why this has to be pinned deliberately rather than
 * discovered later by someone writing the first overlay filter.
 */

import type { FacetDef, Row, SortDef, SurfaceBrowse, SurfaceDescriptor } from './types.js';

/**
 * Both inputs arrive as ACCESSORS, not values.
 *
 * Taking them by value captures whatever the first render had, and a caller
 * passing a `$derived` descriptor would silently keep the stale one — the same
 * reason `scope` is a getter on collections. Reactivity is the caller's, read
 * through the getter.
 */
export function createSurface<Src, R extends Row>(
	getDescriptor: () => SurfaceDescriptor<Src, R>,
	getBrowse: () => SurfaceBrowse
) {
	const descriptor = $derived(getDescriptor());
	const browse = $derived(getBrowse());

	const facets = $derived(descriptor.facets ?? []);
	const sorts = $derived(descriptor.sorts ?? []);

	/** Step 1 — records to rows. 1:1 for a CRUD surface, N:1 for a catalog. */
	const rows = $derived(descriptor.derive(descriptor.sources()));

	const query = $derived(String(browse.values.q ?? '').trim().toLowerCase());

	/** Step 2 — free-text search, kept separate from filters because the
	 *  contextual counts below must be computed against a searched population. */
	const searched = $derived.by(() => {
		if (!query) return rows;
		return rows.filter((r) =>
			descriptor
				.searchIn(r)
				.some((v) => v != null && String(v).toLowerCase().includes(query))
		);
	});

	function selectionOf(f: FacetDef<R>): string[] {
		const raw = browse.values[f.id];
		if (f.mode === 'many') return Array.isArray(raw) ? raw : [];
		const one = typeof raw === 'string' ? raw : '';
		return one ? [one] : [];
	}

	/**
	 * Absence is neutral: nothing selected means everything passes. That is what
	 * makes omitting `<Surface.Toolbar>` safe — with no UI to set a facet, the
	 * facet simply does not narrow, rather than silently excluding rows.
	 */
	function passes(f: FacetDef<R>, row: R): boolean {
		const picked = selectionOf(f);
		if (!picked.length) return true;
		return f.options.some((o) => picked.includes(o.value) && (!o.test || o.test(row)));
	}

	/** Step 3 — filter. */
	const filtered = $derived(searched.filter((r) => facets.every((f) => passes(f, r))));

	const sort = $derived<SortDef<R> | undefined>(
		sorts.find((s) => s.value === browse.values.sort) ?? sorts[0]
	);

	/** Step 4 — sort. Copied first; `Array.sort` mutates, and mutating a
	 *  `$derived` source is how you get an infinite loop. */
	const visible = $derived(sort ? [...filtered].sort(sort.compare) : filtered);

	/**
	 * How many rows each option would leave — counted against search plus every
	 * OTHER facet, never against its own.
	 *
	 * Counting against the raw list is easier and lies: with a search active it
	 * can promise 37 and deliver 0. Excluding only the owning facet is what makes
	 * the number answer the question actually being asked — "what happens if I
	 * click this".
	 */
	const counts = $derived.by(() => {
		const out: Record<string, Record<string, number>> = {};
		for (const f of facets) {
			const base = searched.filter((r) => facets.every((g) => g.id === f.id || passes(g, r)));
			out[f.id] = Object.fromEntries(
				f.options.map((o) => [o.value, o.test ? base.filter(o.test).length : base.length])
			);
		}
		return out;
	});

	return {
		get rows() {
			return rows;
		},
		/** After search + filter + sort — what a list renders. */
		get visible() {
			return visible;
		},
		get counts() {
			return counts;
		},
		get facets() {
			return facets;
		},
		get sorts() {
			return sorts;
		},
		get activeSort() {
			return sort;
		},
		get query() {
			return String(browse.values.q ?? '');
		},
		get total() {
			return rows.length;
		},
		get shown() {
			return visible.length;
		},
		selectionOf,
		get browse() {
			return browse;
		}
	};
}

export type Surface<Src, R extends Row> = ReturnType<typeof createSurface<Src, R>>;
