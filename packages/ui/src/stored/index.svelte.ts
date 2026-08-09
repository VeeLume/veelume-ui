/**
 * A reactive value backed by localStorage, with a validating loader — the
 * tiny pattern Hearth's `prefs` distilled and the demo's appearance store
 * re-derived: per-device VIEW preferences that would be wrong in a synced
 * backend (which theme, which density, which default quality) but must
 * survive a restart.
 *
 * The validator is the design: localStorage returns whatever was there —
 * an old enum value, another app's key, a truncated write — and a loader
 * that trusts it turns schema drift into runtime weirdness. Anything the
 * validator rejects falls back to `initial`, silently, because a reset
 * preference is an inconvenience and a poisoned one is a bug report.
 *
 * Values persist as JSON. Reads that are not JSON are offered to the
 * validator as the raw string — the donors stored bare strings, so their
 * existing keys load once and are re-written as JSON from then on.
 */

export type StoredValue<T> = { value: T };

export function storedValue<T>(
	key: string,
	initial: T,
	validate?: (candidate: unknown) => candidate is T
): StoredValue<T> {
	function load(): T {
		if (typeof window === 'undefined') return initial;
		const raw = localStorage.getItem(key);
		if (raw === null) return initial;
		let candidate: unknown;
		try {
			candidate = JSON.parse(raw);
		} catch {
			candidate = raw;
		}
		if (validate) return validate(candidate) ? candidate : initial;
		return candidate as T;
	}

	let current = $state<T>(load());

	return {
		get value() {
			return current;
		},
		set value(next: T) {
			current = next;
			if (typeof window === 'undefined') return;
			try {
				localStorage.setItem(key, JSON.stringify(next));
			} catch {
				// Quota or private mode: the value still works for this session,
				// it just will not survive a restart — same as having no storage.
			}
		}
	};
}
