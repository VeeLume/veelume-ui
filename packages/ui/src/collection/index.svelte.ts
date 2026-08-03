/**
 * The L1 collection primitive: a scoped cache with an optional write layer.
 *
 * Named "collection" rather than "record store" on purpose. Three donor apps
 * independently built cache + inflight-dedupe + invalidation, and only two of
 * them write — Hearth and Starlume browse reference data they never mutate. So
 * the cache is the primitive and writes are the option, not the reverse.
 *
 * Rules and their reasoning: ../../CLAUDE.md and the vault note's casebook.
 *
 * NOTE THE `.svelte.ts` EXTENSION — it is load-bearing. `$state` is a compiler
 * construct; in a plain `.ts` file it survives type-checking untouched and then
 * throws `rune_outside_svelte` at runtime. `svelte-check` does NOT catch it.
 */

import type {
	ChangeInfo,
	CollectionIO,
	CollectionOptions,
	Entry,
	KitError,
	ScopedView,
	Unsubscribe
} from './types.js';

export * from './types.js';

const DEFAULT_KEY = '__single__';

function toKitError(e: unknown, classify?: (e: unknown) => KitError | undefined): KitError {
	const classified = classify?.(e);
	if (classified) return classified;
	if (e && typeof e === 'object' && 'kind' in e) return e as KitError;
	return { kind: 'unknown', cause: e, message: e instanceof Error ? e.message : String(e) };
}

export function createCollection<
	T,
	K extends string | number,
	S = void,
	B extends Record<string, unknown> = Partial<T> & Record<string, unknown>
>(io: CollectionIO<T, K, S, B>, options: CollectionOptions<S> = {}) {
	/** Tracked: the cache itself. */
	let entries = $state<Record<string, Entry<T>>>({});

	/**
	 * Untracked bookkeeping. Deliberately a plain Map, not `$state`: `ensure()`
	 * is called from a getter during render, and touching tracked state there is
	 * illegal. Starlume splits it the same way, which is what makes the
	 * pull-based read model legal at all.
	 */
	const inflight = new Map<string, Promise<void>>();

	// ── invalidation bookkeeping ───────────────────────────────────────────────
	let writesInFlight = 0;
	/**
	 * Bumped on every completed write. A reload that started before a write
	 * finished is stale by the time it resolves — the spike caught exactly this:
	 * `load()` began at .685, `save:ok` upserted at .688, the load landed at .710
	 * and replaced the whole array, discarding the upsert. Comparing the epoch
	 * lets us discard such a result instead of letting it clobber.
	 */
	let writeEpoch = 0;
	let pendingInvalidation: ChangeInfo<K, S> | null | undefined;
	let unsubscribe: Unsubscribe | null = null;
	let subscribing = false;

	const scopeOf = (): S => (options.scope ? options.scope() : (undefined as S));
	const keyFor = (scope: S): string =>
		options.scopeKey ? options.scopeKey(scope) : scope === undefined ? DEFAULT_KEY : String(scope);

	function patchEntry(k: string, patch: Partial<Entry<T>>): void {
		const base: Entry<T> = entries[k] ?? { data: [], status: 'idle' };
		entries[k] = { ...base, ...patch };
	}

	/**
	 * Attach the invalidation listener once, on first use. There is no explicit
	 * `start()` because reads are lazy — the collection begins listening when it
	 * first has something worth keeping fresh.
	 */
	function ensureSubscribed(): void {
		if (!io.subscribe || unsubscribe || subscribing) return;
		subscribing = true;
		void Promise.resolve(io.subscribe(onInvalidated))
			.then((un) => {
				unsubscribe = un;
			})
			.finally(() => {
				subscribing = false;
			});
	}

	async function run(k: string, scope: S, mode: 'loading' | 'refreshing'): Promise<void> {
		patchEntry(k, { status: mode, error: undefined });
		const epoch = writeEpoch;
		try {
			const data = await io.fetchAll(scope);
			if (epoch !== writeEpoch) {
				// A write landed while this was in flight, so its result predates
				// state we already hold. Discard and re-run rather than clobber.
				return run(k, scope, 'refreshing');
			}
			patchEntry(k, { data, status: 'ready', error: undefined });
		} catch (e) {
			patchEntry(k, { status: 'error', error: toKitError(e, io.classifyError) });
		}
	}

	/**
	 * Start a fetch if one is warranted. Safe to call from a getter during
	 * render: every `$state` write happens in a microtask, never synchronously.
	 */
	function ensure(scope: S, force = false): Promise<void> {
		const k = keyFor(scope);
		const existing = inflight.get(k);
		if (existing) return existing;
		if (!force && entries[k] && entries[k].status !== 'idle') return Promise.resolve();

		ensureSubscribed();
		const mode = entries[k]?.status === 'ready' ? 'refreshing' : 'loading';
		const p = Promise.resolve()
			.then(() => run(k, scope, mode))
			.finally(() => {
				inflight.delete(k);
			});
		inflight.set(k, p);
		return p;
	}

	function view(scope: S): ScopedView<T, K> {
		const k = keyFor(scope);
		return {
			get all() {
				void ensure(scope);
				return entries[k]?.data ?? [];
			},
			get status() {
				void ensure(scope);
				return entries[k]?.status ?? 'idle';
			},
			get error() {
				return entries[k]?.error;
			},
			get hasData() {
				const s = entries[k]?.status;
				return s === 'ready' || s === 'refreshing';
			},
			byKey(key: K) {
				void ensure(scope);
				return entries[k]?.data.find((r) => io.keyOf(r) === key);
			}
		};
	}

	function upsert(scope: S, record: T): void {
		const k = keyFor(scope);
		const current = entries[k]?.data ?? [];
		const key = io.keyOf(record);
		const i = current.findIndex((r) => io.keyOf(r) === key);
		const next = i >= 0 ? current.with(i, record) : [...current, record];
		patchEntry(k, { data: next, status: 'ready' });
	}

	// ── invalidation ───────────────────────────────────────────────────────────

	function reload(info?: ChangeInfo<K, S> | null): void {
		const targets =
			info?.scope !== undefined ? [keyFor(info.scope)] : Object.keys(entries).filter((k) => k);
		for (const k of targets) {
			// Only scopes we actually hold; a scope nobody looked at stays unfetched.
			if (!entries[k]) continue;
			const scope = info?.scope !== undefined ? info.scope : scopeFromKey(k);
			void ensure(scope, true);
		}
	}

	/**
	 * Recovering a scope VALUE from its key is only possible when the key is the
	 * value. With a custom `scopeKey` the mapping is one-way, so a keyless
	 * invalidation can only refresh the current scope — documented rather than
	 * silently wrong.
	 */
	function scopeFromKey(k: string): S {
		if (options.scopeKey) return scopeOf();
		return (k === DEFAULT_KEY ? undefined : k) as S;
	}

	function onInvalidated(info?: ChangeInfo<K, S>): void {
		if (writesInFlight > 0) {
			// Defer, per the spike: a naive reload starts a fetch before the write
			// commits and can serve pre-write state. Several events collapse into
			// one pending entry — one write emitted THREE events in the spike.
			pendingInvalidation = info ?? null;
			return;
		}
		reload(info);
	}

	function settleWrite(): void {
		writesInFlight -= 1;
		writeEpoch += 1;
		if (writesInFlight === 0 && pendingInvalidation !== undefined) {
			const info = pendingInvalidation;
			pendingInvalidation = undefined;
			reload(info);
		}
	}

	// ── writes ─────────────────────────────────────────────────────────────────

	function divergence(requested: B, returned: T): string[] {
		const isDiverged =
			io.write?.isDiverged ?? ((_f: string, a: unknown, b: unknown) => a !== b);
		const rec = returned as unknown as Record<string, unknown>;
		return Object.keys(requested).filter((f) => isDiverged(f, requested[f], rec[f]));
	}

	async function save(key: K, body: B): Promise<T> {
		const w = io.write;
		if (!w) throw new Error('collection: this collection is read-only');
		const scope = scopeOf();

		// `replace` backends need every field. The STORE merges, because the store
		// owns the cache — the alternative is handing the adapter a reference back
		// into the store it is being passed into.
		let payload = body;
		if (w.semantics === 'replace') {
			const current = view(scope).byKey(key);
			if (!current) {
				throw {
					kind: 'unknown',
					cause: null,
					message: `collection: cannot build a replace payload for "${String(key)}" — not in cache`
				} satisfies KitError;
			}
			payload = { ...(current as unknown as B), ...body };
		}

		writesInFlight += 1;
		try {
			const saved = await w.save(key, payload, scope);
			upsert(scope, saved);

			// The server is authoritative, so the cache now holds the truth — but the
			// caller's intent was not honoured, and staying silent about that is the
			// data loss the spike demonstrated.
			const diverged = divergence(body, saved);
			if (diverged.length) {
				throw {
					kind: 'write-diverged',
					requested: body as Record<string, unknown>,
					returned: saved as unknown as Record<string, unknown>,
					diverged,
					message: `write diverged on: ${diverged.join(', ')}`
				} satisfies KitError;
			}
			return saved;
		} catch (e) {
			throw toKitError(e, io.classifyError);
		} finally {
			settleWrite();
		}
	}

	async function create(body: B): Promise<T> {
		const w = io.write;
		if (!w?.create) throw new Error('collection: this collection does not support create');
		const scope = scopeOf();
		writesInFlight += 1;
		try {
			const made = await w.create(body, scope);
			upsert(scope, made);
			return made;
		} catch (e) {
			throw toKitError(e, io.classifyError);
		} finally {
			settleWrite();
		}
	}

	// ── public surface ─────────────────────────────────────────────────────────

	return {
		// Ambient accessors ARE `at(scope())` — one implementation, two entry
		// points. `scope()` is read inside the getter, so Svelte tracks it.
		get all() {
			return view(scopeOf()).all;
		},
		get status() {
			return view(scopeOf()).status;
		},
		get error() {
			return view(scopeOf()).error;
		},
		get hasData() {
			return view(scopeOf()).hasData;
		},
		byKey(key: K) {
			return view(scopeOf()).byKey(key);
		},

		/** Read a scope that is not the current one — cross-scope views (diff
		 *  pages) and non-reactive callers. */
		at: (scope: S) => view(scope),

		/** Eager fetch. Same `ensure()` a read triggers, so a prefetch and a mount
		 *  share one request rather than racing. */
		prefetch(scope?: S): void {
			void ensure(arguments.length ? (scope as S) : scopeOf());
		},

		/** Force a refetch of a scope, keeping its data visible meanwhile. */
		refresh(scope?: S): Promise<void> {
			return ensure(arguments.length ? (scope as S) : scopeOf(), true);
		},

		/** Fetch one record and fold it in. */
		async refreshOne(key: K): Promise<T> {
			if (!io.fetchOne) throw new Error('collection: fetchOne not supplied');
			const scope = scopeOf();
			const fresh = await io.fetchOne(key, scope);
			upsert(scope, fresh);
			return fresh;
		},

		save,
		create,

		/** Explicit only — no LRU, no TTL. Scope cardinality is low by design. */
		evict(scope?: S): void {
			const k = keyFor(arguments.length ? (scope as S) : scopeOf());
			delete entries[k];
		},
		evictAll(): void {
			entries = {};
		},

		/** Drop the invalidation subscription. */
		dispose(): void {
			unsubscribe?.();
			unsubscribe = null;
		},

		/** Introspection for tests and the gallery. */
		get debug() {
			return { writesInFlight, writeEpoch, scopes: Object.keys(entries) };
		}
	};
}

export type Collection<
	T,
	K extends string | number,
	S = void,
	B extends Record<string, unknown> = Partial<T> & Record<string, unknown>
> = ReturnType<typeof createCollection<T, K, S, B>>;
