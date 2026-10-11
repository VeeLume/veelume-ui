/**
 * Live background activity — the mutable sibling of the notification log.
 *
 * A notification is an immutable event (keyed, deduped, dismissable); an
 * activity is state that changes stage and then disappears ("Parsing
 * DataCore…", "Waiting for the game to exit"). Folding them into one list
 * would break `ingest`'s keyed dedupe and the log's write-once model, so
 * they are two stores sharing one surface: the Center renders activities as
 * a "Now" section above the log, the Bell shows a busy mark while any run.
 *
 * How an activity ENDS is the notification log's job, not this store's — a
 * failure is a warning/error notification, a success worth keeping is a
 * quiet `ingest(..., { toast: false })`, a routine one leaves no trace.
 *
 * Snapshot-shaped on purpose: the named variation is WHERE the work runs.
 * Starlume's runs in Rust and arrives as whole snapshots (a suspended
 * webview catches up by re-reading the list, not by replaying deltas), so
 * the one entry point replaces the list. An app whose work runs in the
 * frontend builds the same list from its own state and sets it the same
 * way. The store holds only what the surfaces render; anything an app
 * filters inline surfaces on (a channel, a kind) stays in its own records.
 */

export type ActivityPhase =
	| { type: 'running'; stage: string | null }
	/** Blocked on a condition outside the app — rendered without a timer. */
	| { type: 'waiting'; reason: string };

export type Activity = {
	/** Stable identity across snapshots (keyed `#each`). */
	key: string;
	title: string;
	phase: ActivityPhase;
	/** Epoch ms — running activities show elapsed time from it. */
	started: number;
	/** Who runs it — a module or service id, rendered as a tag (the
	 *  notification `source` convention). */
	source?: string | null;
};

let items = $state<Activity[]>([]);

/** Reactive read access — `activities.items` / `.busy`. */
export const activities = {
	get items() {
		return items;
	},
	/** Anything in flight — the Bell's busy mark. */
	get busy() {
		return items.length > 0;
	}
};

/** Replace the live list with a fresh snapshot (adapter or app state). */
export function setActivities(next: Activity[]) {
	items = next;
}

/**
 * Elapsed time as a clock — `0:07`, `12:34`, `1:02:03`. Digits and colons
 * only, so it needs no locale.
 */
export function formatElapsed(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const ss = String(s).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
