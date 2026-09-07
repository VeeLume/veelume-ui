/**
 * Field descriptors for the record form.
 *
 * Supplied by the CALLER, not by a backend. connect-neo's editor is driven by a
 * server-published field registry, and that is genuinely good — but it requires
 * a backend built to publish one, which TrailBase will not and a local-SQLite
 * app would have to invent. So the registry variant is a companion that simply
 * produces this list from the server; the list itself is the contract.
 */

export type FieldKind =
	'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'date' | 'time' | 'display' | 'reference';

import type { StatusTone } from '../theme/types.js';

export type SelectOption = {
	value: string;
	label: string;
	/**
	 * `Segmented` only: the selected option renders in this tone instead of
	 * the filled primary — for options that MEAN something (a participant's
	 * pending / accepted / declined), where the colour is the message and a
	 * uniform highlight would drop it. A `select` ignores it.
	 */
	tone?: StatusTone;
};

/**
 * What a `reference` field points into: another collection's records, picked
 * from a `PickerDialog`. The record stores the picked item's KEY; the form
 * shows its label. `items` is a getter so a lazily loading collection stays
 * live — a descriptor is usually built once, and `() => customers.all` is
 * what keeps the picker current when the set arrives later.
 *
 * Two forms in stibu (a gift card's customer, a voucher's assigned customer)
 * composed exactly this beside the form before it became a kind.
 */
export type ReferenceSpec<I> = {
	items: () => readonly I[];
	key: (item: I) => string;
	label: (item: I) => string;
	/** Second line under the label in the picker. */
	detail?: (item: I) => string | null | undefined;
	/** What the picker's search matches. Defaults to the label. */
	searchIn?: (item: I) => (string | null | undefined)[];
	/** The picker dialog's title. Defaults to the field label. */
	title?: string;
	/** Shown while nothing is picked. */
	placeholder?: string;
};

export type FieldSpec<T> = {
	/** Key on the record. Also the form control's id. */
	name: keyof T & string;
	label: string;
	kind: FieldKind;
	/** Groups fields under a heading. Order of first appearance wins, which is
	 *  the same rule connect-neo's registry uses. */
	section?: string;
	hint?: string;
	readonly?: boolean;
	/** `text` only — the `<input type>`, which is what picks the phone's
	 *  keyboard (`email`, `tel`, `url`). Defaults to `text`. */
	inputType?: 'text' | 'email' | 'url' | 'tel' | 'password';
	/** `select` only. */
	options?: SelectOption[];
	/** `number` only — passed to `Intl.NumberFormat`, so currency works. */
	format?: Intl.NumberFormatOptions;
	/** `number` only — the stored value is `displayed * scale`. Lets a cents
	 *  column present as euros without the record shape lying about units. */
	scale?: number;
	/** `display` only — render a stored value as text. */
	render?: (record: T) => string;
	/**
	 * `reference` only — the collection the field points into. The item type
	 * is the reference's own business (the record only stores its key), so it
	 * is existential here; `key`/`label` are typed against it at the call site.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	reference?: ReferenceSpec<any>;
};

export type FormSection<T> = { name: string; fields: FieldSpec<T>[] };

/** Sections in descriptor order — the descriptor IS the layout, so the form
 *  never carries its own idea of how a record is arranged. */
export function sectionsOf<T>(fields: FieldSpec<T>[]): FormSection<T>[] {
	const out: FormSection<T>[] = [];
	for (const f of fields) {
		const name = f.section ?? '';
		const last = out.at(-1);
		if (last && last.name === name) last.fields.push(f);
		else {
			// Non-adjacent fields of the same section still merge, so section order
			// is fixed by where each section FIRST appears.
			const existing = out.find((s) => s.name === name);
			if (existing) existing.fields.push(f);
			else out.push({ name, fields: [f] });
		}
	}
	return out;
}
