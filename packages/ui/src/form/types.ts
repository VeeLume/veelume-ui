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
	'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'date' | 'time' | 'display';

export type SelectOption = { value: string; label: string };

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
	/** `select` only. */
	options?: SelectOption[];
	/** `number` only — passed to `Intl.NumberFormat`, so currency works. */
	format?: Intl.NumberFormatOptions;
	/** `number` only — the stored value is `displayed * scale`. Lets a cents
	 *  column present as euros without the record shape lying about units. */
	scale?: number;
	/** `display` only — render a stored value as text. */
	render?: (record: T) => string;
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
