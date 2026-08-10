/**
 * Record form state — draft, dirty, save. Logic only, so L1.
 *
 * Editing is record-at-a-time and explicit: a draft accumulates locally and is
 * written on demand. That is not a style choice — big-list inline editing is
 * what produced the row-shift errors connect-neo's rule set was written to
 * prevent ("real table, read-only; edits go through the record form").
 *
 * The draft holds ONLY changed fields, which is what makes a `patch` backend
 * send a genuine patch and lets `write-diverged` compare exactly the fields the
 * user meant to change.
 */

import type { KitError } from '../collection/types.js';

export type RecordFormIO<T> = {
	/** The record being edited, or undefined while it loads. */
	record: () => T | undefined;
	/** Persist the changed fields. Usually `collection.save(key, patch)`. */
	save: (patch: Partial<T>) => Promise<T>;
};

export function createRecordForm<T extends Record<string, unknown>>(io: RecordFormIO<T>) {
	let draft = $state<Partial<T>>({});
	let saving = $state(false);
	let error = $state<KitError | null>(null);
	let saved = $state(false);

	const record = $derived(io.record());
	/** What the form shows: the record with the draft laid over it. */
	const value = $derived({ ...(record ?? ({} as T)), ...draft });
	const dirty = $derived(Object.keys(draft).length > 0);

	return {
		get value() {
			return value;
		},
		get record() {
			return record;
		},
		get dirty() {
			return dirty;
		},
		get saving() {
			return saving;
		},
		get error() {
			return error;
		},
		/** True briefly after a successful save — for a transient confirmation. */
		get saved() {
			return saved;
		},
		get patch() {
			return draft;
		},

		set<K extends keyof T>(name: K, next: T[K]): void {
			// Setting a field back to its stored value un-dirties it, so "save"
			// cannot be armed by a round trip that changed nothing.
			if (record && Object.is(record[name], next)) {
				const { [name]: _dropped, ...rest } = draft;
				draft = rest as Partial<T>;
			} else {
				draft = { ...draft, [name]: next };
			}
			saved = false;
			error = null;
		},

		reset(): void {
			draft = {};
			error = null;
			saved = false;
		},

		async submit(): Promise<boolean> {
			if (!dirty || saving) return false;
			saving = true;
			error = null;
			try {
				await io.save(draft);
				draft = {};
				saved = true;
				return true;
			} catch (e) {
				// `write-diverged` arrives here like any other failure, but the cache
				// already holds the server's value — so clearing the draft would erase
				// the user's intent before they have seen what happened to it. Keep it.
				error = (e as KitError)?.kind
					? (e as KitError)
					: { kind: 'unknown', cause: e, message: String(e) };
				return false;
			} finally {
				saving = false;
			}
		}
	};
}

export type RecordForm<T extends Record<string, unknown>> = ReturnType<typeof createRecordForm<T>>;
