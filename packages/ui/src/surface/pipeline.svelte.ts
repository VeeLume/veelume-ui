/**
 * The surface pipeline — logic, no markup, so it is L1 even though only L2
 * components consume it.
 *
 *   scoped cache → derive rows → search → filter → sort → group  (→ window → render)
 *
 * ⚑ `derive` runs BEFORE `filter`, always. A catalog filters on properties that
 * only exist *after* derivation joins an overlay — Hearth filters on `owned`,
 * which no raw blueprint carries. A 1:1 CRUD surface cannot tell the two orders
 * apart, which is exactly why this has to be pinned deliberately rather than
 * discovered later by someone writing the first overlay filter.
 *
 * ⚑ `group` runs AFTER sort, for two reasons that are the same lesson again:
 * after filter so header counts describe the narrowed population (a header
 * claiming 8 rows above 3 visible ones lies the same way pre-derive facet
 * counts did), and after sort so within-group order IS the sort order and the
 * default group order (first appearance) inherits it — alphabetical rows give
 * alphabetical groups with no second comparator.
 */

import { makeGroupHeader } from './types.js';
import type {
	FacetDef,
	GroupDef,
	ListEntry,
	Row,
	SortDef,
	SurfaceBrowse,
	SurfaceDescriptor
} from './types.js';

/**
 * Step 5 — partition sorted rows into sections, flattened for windowing.
 *
 * Recursive over levels (outermost first). Bucket insertion order is first
 * appearance; `compare` reorders keys when the domain has its own order.
 * Header keys are path-qualified with NUL separators so a "Misc" subgroup
 * under two different parents cannot collide — NUL because no app-supplied
 * partition key contains it, the same reasoning as canonical facet encoding.
 *
 * Empty groups DO NOT EXIST by construction: sections are emitted from actual
 * rows, so a filter that empties a group removes its header, and filtering to
 * nothing yields no header skeleton — absence stays neutral.
 */
function groupRows<R extends Row>(rows: R[], defs: GroupDef<R>[]): ListEntry<R>[] {
	const build = (subset: R[], level: number, path: string): ListEntry<R>[] => {
		const def = defs[level];
		const buckets = new Map<string, R[]>();
		for (const r of subset) {
			const k = def.key(r);
			const list = buckets.get(k);
			if (list) list.push(r);
			else buckets.set(k, [r]);
		}
		const keys = [...buckets.keys()];
		if (def.compare) keys.sort(def.compare);

		const out: ListEntry<R>[] = [];
		for (const k of keys) {
			const groupRows = buckets.get(k)!;
			const entryKey = `\0group\0${path}${k}`;
			out.push(makeGroupHeader(entryKey, level, def.label?.(k, groupRows) ?? k, groupRows));
			if (level + 1 < defs.length) out.push(...build(groupRows, level + 1, `${path}${k}\0`));
			else out.push(...groupRows);
		}
		return out;
	};
	return build(rows, 0, '');
}

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
	getBrowse: () => SurfaceBrowse,
	/**
	 * Which row is open, or null. Carried rather than computed — no pipeline step
	 * reads it — because it is the one piece of state THREE parts each need and
	 * were each being handed separately: the list highlights it, the split decides
	 * which pane a narrow screen shows, and the toolbar steps aside with the list.
	 * Three props for one fact is three chances to disagree.
	 */
	getSelected: () => string | null = () => null,
	/**
	 * List collapse, carried for the same reason `selected` is: TWO parts need
	 * one fact. `Split` decides whether the list pane renders, and `List`
	 * renders the control that flips it — and they are not in a parent/child
	 * relationship a prop could bridge, because the list arrives through a
	 * snippet declared in the APP. `undefined` means the surface has no
	 * collapse concept at all, and neither part draws anything.
	 */
	getCollapse: () => { collapsed: boolean; set: (next: boolean) => void } | undefined = () =>
		undefined
) {
	const descriptor = $derived(getDescriptor());
	const browse = $derived(getBrowse());
	const selected = $derived(getSelected());
	const collapse = $derived(getCollapse());

	const facets = $derived(descriptor.facets ?? []);
	const sorts = $derived(descriptor.sorts ?? []);

	/** Step 1 — records to rows. 1:1 for a CRUD surface, N:1 for a catalog. */
	const rows = $derived(descriptor.derive(descriptor.sources()));

	/**
	 * Rows by key, over ALL rows — deliberately pre-filter. The workbench's
	 * panes are projections by key that must survive a search emptying the
	 * list, and a tab's label must resolve while its row is filtered out.
	 * (The prototype re-derived rows for this; one derivation is the point.)
	 */
	const byKeyMap = $derived(new Map(rows.map((r) => [r.key, r])));

	const query = $derived(
		String(browse.values.q ?? '')
			.trim()
			.toLowerCase()
	);

	/** Step 2 — free-text search, kept separate from filters because the
	 *  contextual counts below must be computed against a searched population.
	 *
	 *  `searchIn` is optional: a surface with nothing worth searching declares no
	 *  search function and gets no search field. That is the same neutral-absence
	 *  rule the facets follow — capability is declared by the descriptor, so the
	 *  header never has to be told what to hide. */
	const searched = $derived.by(() => {
		const searchIn = descriptor.searchIn;
		if (!query || !searchIn) return rows;
		return rows.filter((r) =>
			searchIn(r).some((v) => v != null && String(v).toLowerCase().includes(query))
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
	 * Step 5 — group. Ungrouped surfaces get `visible` BACK — the same array,
	 * not a wrapped copy. `ListEntry<R>` is a union rather than a wrapper for
	 * exactly this: /stress republishes 1.5M rows per fill page, and a
	 * per-row allocation here would tax every flat list to pay for sections
	 * it doesn't have.
	 */
	const entries = $derived.by((): ListEntry<R>[] => {
		const defs = descriptor.groupBy;
		if (!defs?.length) return visible;
		return groupRows(visible, defs);
	});

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
		/** After search + filter + sort — the ROWS. Counts read this. */
		get visible() {
			return visible;
		},
		/** What a list renders: `visible` with section headers interleaved when
		 *  the descriptor groups, `visible` itself when it doesn't. */
		get entries() {
			return entries;
		},
		/**
		 * How many header levels sit above every row — the row indent, as a
		 * per-surface CONSTANT. Sections are uniform depth (unlike a tree), which
		 * is what lets rows indent past their headers without carrying any
		 * per-row depth and without wrapping the row objects.
		 */
		get groupDepth() {
			return descriptor.groupBy?.length ?? 0;
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
		/** Whether the descriptor gave us anything to search. Drives the field. */
		get searchable() {
			return !!descriptor.searchIn;
		},
		/**
		 * Whether the user has narrowed the list at all — the condition under which
		 * a result count is worth its vertical space. Unnarrowed, "34 results" only
		 * restates the list; narrowed, it answers the question just asked.
		 */
		get narrowing() {
			return !!query || browse.activeCount > 0;
		},
		get selected() {
			return selected;
		},
		/** `undefined` when the surface does not collapse — the parts test this
		 *  rather than a flag, so absence stays neutral. */
		get collapse() {
			return collapse;
		},
		/** A row by its key, from ALL rows (pre-filter) — see `byKeyMap`. */
		byKey(key: string): R | undefined {
			return byKeyMap.get(key);
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
