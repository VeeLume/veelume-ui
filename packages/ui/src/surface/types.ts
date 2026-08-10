/**
 * Surface types.
 *
 * A **Row** is an item as the list renders it — NOT necessarily a record. The
 * `derive` step is what allows N:1 (Hearth collapses several blueprints into
 * one craftable row); a 1:1 CRUD surface writes `rs => rs.map(toRow)`.
 */

import type { StatusTone } from '../theme/types.js';

export type Row = {
	/** Stable across refetches — expansion state and keyed `{#each}` depend on
	 *  it. A derived row needs a canonical composite, e.g. sorted member ids. */
	key: string;
	title: string;
	subtitle?: string;
	/** Right-aligned secondary text (a count, a date). */
	trailing?: string;
	/**
	 * A status chip. A plain string renders neutral; pass the result of
	 * `resolveStatus(map, status)` from derive for a toned one. Resolved
	 * data, not a component — a windowed list renders thousands of these.
	 */
	badge?: string | { label: string; tone: StatusTone };
	/** Where selecting the row leads. Omit for surfaces that select in place. */
	href?: string;
};

export type FacetOption<R> = {
	value: string;
	label: string;
	/** Omit for an option that matches everything (the neutral "all"). */
	test?: (row: R) => boolean;
};

export type FacetDef<R> = {
	id: string;
	label: string;
	/** `one` = radio (first option is the neutral default); `many` = checkboxes. */
	mode: 'one' | 'many';
	options: FacetOption<R>[];
};

export type SortDef<R> = {
	value: string;
	label: string;
	compare: (a: R, b: R) => number;
};

/**
 * One grouping level — SECTIONS, a presentation partitioning of the flat row
 * list under headers. Not to be confused with *bundles* (N records collapsing
 * into one row with members), which are `derive`'s business: Hearth's mission
 * chains are bundles, its catalog taxonomy is sections.
 */
export type GroupDef<R> = {
	/** Partition key. Must be stable across refetches, like `Row.key`. */
	key: (row: R) => string;
	/** Header text. Default: the partition key itself. Receives the group's
	 *  VISIBLE rows, so a label can carry an aggregate (Hearth's owned x/y). */
	label?: (key: string, rows: R[]) => string;
	/** Group order. Default: first appearance, which inherits the active sort —
	 *  alphabetical rows give alphabetical groups for free. Supply this when the
	 *  domain has its own order (a taxonomy). */
	compare?: (a: string, b: string) => number;
};

/**
 * A section header the pipeline interleaves into the entry list.
 *
 * Branded with a module-private symbol rather than a `kind` string so no app
 * row shape can collide with it — rows are app-extended and the kit cannot
 * reserve a property name on them.
 */
const HEADER = Symbol('veelume-ui:group-header');

export type GroupHeader<R> = {
	[HEADER]: true;
	/** Unique among entries (headers and rows share one keyed {#each}). */
	key: string;
	/** 0 = outermost. Drives the default header's indent/emphasis. */
	level: number;
	label: string;
	/** The group's visible rows — post-filter, so counts never lie. */
	rows: R[];
};

/**
 * What a grouped list renders: rows with headers interleaved, FLAT — windowing
 * needs one indexable list, and headers are measured like any other entry.
 * Ungrouped surfaces get `visible` back unchanged (same array, no per-row
 * allocation — /stress republishes 1.5M rows per fill page).
 */
export type ListEntry<R> = R | GroupHeader<R>;

export function isGroupHeader<R>(entry: ListEntry<R>): entry is GroupHeader<R> {
	return HEADER in (entry as object);
}

/** Pipeline-internal factory — the symbol stays module-private. */
export function makeGroupHeader<R>(
	key: string,
	level: number,
	label: string,
	rows: R[]
): GroupHeader<R> {
	return { [HEADER]: true, key, level, label, rows };
}

export type SurfaceDescriptor<Src, R extends Row> = {
	/** Where the data comes from — one collection, or several when an overlay is
	 *  joined during derivation. */
	sources: () => Src;
	/** Records to rows. The ONLY structural difference between archetypes. */
	derive: (src: Src) => R[];
	/**
	 * Everything free-text search looks at. **Omit it and the list gets no search
	 * field** — capability is declared here, so no part has to be told to hide a
	 * control it should never have drawn.
	 */
	searchIn?: (row: R) => (string | number | null | undefined)[];
	facets?: FacetDef<R>[];
	sorts?: SortDef<R>[];
	/**
	 * Section levels, outermost first — Hearth's taxonomy is two. Omit and the
	 * list is flat; absence is neutral. Toggleable grouping is this being
	 * derived from app state (rebuild the descriptor), not a mode on any part.
	 */
	groupBy?: GroupDef<R>[];
};

/**
 * The slice of browse state a surface needs. Structural rather than the
 * concrete `BrowseState<Spec>`, so a surface does not have to be generic over
 * the whole spec — and so a test can pass a plain object.
 */
export type SurfaceBrowse = {
	readonly values: Record<string, string | string[]>;
	set(key: string, value: never): void;
	toggle(key: string, option: string): void;
	reset(): void;
	readonly activeCount: number;
};
