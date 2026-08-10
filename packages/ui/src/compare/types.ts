/**
 * Compare types.
 *
 * One attribute per ROW, one entity per COLUMN — transposed on purpose. The
 * row-per-entity layout puts the reader back to eye-alignment as soon as there
 * are more than a handful of attributes, which is exactly what a side-by-side
 * detail pane already fails at; if the table were laid out that way it would
 * add nothing over two panes.
 */

export type CompareAttribute<E> = {
	/** Stable across renders — the keyed `{#each}` key. */
	key: string;
	label: string;
	/** `null` renders as an em dash: absent is not zero. */
	value: (entity: E) => number | string | null;
	/**
	 * Number formatting, through the kit's locale-aware formatter — so a
	 * currency attribute reads `12,99 €` under the app's FORMATTING locale
	 * rather than the browser's. Ignored for string values.
	 */
	format?: Intl.NumberFormatOptions;
	/**
	 * Scales the stored value for display, like `NumberInput`'s: cents in the
	 * record, euros on screen, and the record shape never lies about units.
	 */
	scale?: number;
	/**
	 * Which direction wins. **Omit for a neutral attribute** — the kit cannot
	 * know whether more pages is better, and a table that highlights a
	 * "winner" on a matter of taste is asserting something false. Only
	 * declared attributes get a marked best value; ties mark nothing, because
	 * "they are the same" is not a win.
	 */
	better?: 'higher' | 'lower';
};
