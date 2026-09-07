/**
 * The record form's actions as TIERS — so a host can put them where the
 * actions rule says the forward action goes: top-right, in the bar the
 * record owns (`DetailHeader`, `Settings.Page`), not at the foot of the form.
 *
 *   const fa = recordFormActions(form, kit);
 *   <DetailHeader title={…}>
 *     {#snippet actions()}<Actions primary={fa.primary} secondary={fa.secondary} />{/snippet}
 *   </DetailHeader>
 *   <RecordForm {form} {fields} placement="host" />
 *
 * Getters, not a snapshot: `dirty` and `saving` are read when the host renders
 * the cluster, so it re-renders with the form. Building an `Action` array
 * outside a `$derived` is exactly the freeze the `busy` docs warn about.
 */

import type { LabelBag } from '../context/labels.js';
import type { Action } from '../actions/types.js';
import type { RecordForm } from './recordForm.svelte.js';

export type RecordFormActions = {
	/** Save — the forward action. Disabled until dirty, busy while saving. */
	readonly primary: Action;
	/** Cancel, only while there is a draft to drop. */
	readonly secondary: Action[];
};

export function recordFormActions<T extends Record<string, unknown>>(
	form: RecordForm<T>,
	kit: { labels: Pick<LabelBag, 'save' | 'cancel'> }
): RecordFormActions {
	return {
		get primary() {
			return {
				label: kit.labels.save(),
				onclick: () => void form.submit(),
				disabled: !form.dirty,
				busy: form.saving
			};
		},
		get secondary() {
			return form.dirty ? [{ label: kit.labels.cancel(), onclick: () => form.reset() }] : [];
		}
	};
}
