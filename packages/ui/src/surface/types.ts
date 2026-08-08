/**
 * Surface types.
 *
 * A **Row** is an item as the list renders it — NOT necessarily a record. The
 * `derive` step is what allows N:1 (Hearth collapses several blueprints into
 * one craftable row); a 1:1 CRUD surface writes `rs => rs.map(toRow)`.
 */

import type { StatusTone } from '../badge/types.js';

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
