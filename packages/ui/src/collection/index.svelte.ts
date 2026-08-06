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
	FetchPage,
	KitError,
	ScopedView,
	SetQuery,
	Unsubscribe,
	WorkingSet
} from './types.js';

export * from './types.js';

const DEFAULT_KEY = '__single__';
const DEFAULT_CAP = 2000;
const DEFAULT_PAGE = 500;
/** Pages between progress publishes. Every page is quadratic downstream; only
 *  at the end is invisible until it finishes. */
const PUBLISH_EVERY = 8;

/**
 * Canonical encoding of a set's declaration.
 *
 * Canonical is mandatory, for the same reason it is in the URL: without sorted
 * keys and sorted multi-values, the same query yields different strings, and
 * the cache fills with entries that are duplicates of each other under a
 * different name.
 */
function queryKey(q: SetQuery): string {
	const parts: string[] = [];
	if (q.search) parts.push(`q=${q.search}`);
	if (q.order) parts.push(`o=${q.order.by}:${q.order.dir ?? 'asc'}`);
	// ⚑ `cap` is deliberately NOT in the key. Identity is what the set MATCHES —
	// scope, predicates, order. The cap is how far we have read into it, which is
	// state, not identity: "newest 2 000" and "newest 5 000" are one query at two
	// depths and the shallower is a prefix of the deeper. Keying on it made
	// `loadMore` silently build a second set while the view kept reading the
	// first, which is how this was found.
	for (const k of Object.keys(q.where ?? {}).sort()) {
		const v = q.where![k];
		parts.push(`${k}=${(Array.isArray(v) ? [...v].sort() : [v]).join(',')}`);
	}
	return parts.join('&');
}

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
	/**
	 * ⚑ TWO tracked objects, and separating them is the whole design.
	 *
	 * `records` is the CACHE — every record we got, however we got it:
	 * accumulation, a server-side search, `fetchOne` from a deep link. It is
	 * path-dependent and that is fine, because nothing user-visible is computed
	 * from it.
	 *
	 * `sets` are WORKING SETS — declared queries (scope + predicates + order +
	 * cap) holding key lists. They are deterministic given their declaration,
	 * and everything user-visible (the rendered list, the counts, completeness)
	 * comes from them.
	 *
	 * Fusing the two is what made a server search "contaminate" the cache and a
	 * scroll silently change a facet count: both were mutating the thing the
	 * counts were computed from. Split, records may arrive however they arrive.
	 */
	let records = $state<Record<string, T>>({});
	let sets = $state<Record<string, WorkingSet<K>>>({});

	const cap = options.cap ?? DEFAULT_CAP;
	const pageSize = options.pageSize ?? DEFAULT_PAGE;

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

	const EMPTY_SET: WorkingSet<K> = {
		keys: [],
		fetchedCount: 0,
		complete: false,
		status: 'idle'
	};

	function patchSet(k: string, patch: Partial<WorkingSet<K>>): void {
		sets[k] = { ...(sets[k] ?? EMPTY_SET), ...patch };
	}

	/**
	 * How many records the cache holds.
	 *
	 * ⚑ A counter, not `Object.keys(records).length`. The demo panel rendered
	 * that figure and it built a 100 000-element array on EVERY render while
	 * touching the whole proxy's key set — which is why the UI stayed laggy after
	 * dropping the cap back to 2 000: the list had shrunk, the cache had not.
	 */
	let cachedCount = $state(0);

	/**
	 * Bumped only when an EXISTING record is replaced. Accumulation adds new keys
	 * and leaves old rows untouched, which is what makes the hydration memo below
	 * safe to extend rather than rebuild.
	 */
	let recordsEpoch = 0;

	/** Put records in the cache. The one way anything enters it. */
	function cache(list: T[]): void {
		for (const r of list) {
			const key = String(io.keyOf(r));
			if (records[key] === undefined) cachedCount += 1;
			else recordsEpoch += 1;
			records[key] = r;
		}
	}

	/**
	 * ⚑ Hydration is INCREMENTAL, and it has to be.
	 *
	 * Rebuilding the whole array on every read is O(n) per read, and a
	 * progressive reveal reads it once per chunk — so filling a list is
	 * quadratic. Observed as ms/row rising with the cap: ~0.05 at 20 000 rows and
	 * 0.2–0.5 at 100 000, i.e. a per-row cost that grew with the number of rows,
	 * which a per-row cost should not do.
	 *
	 * Since a growing set only ever appends keys, the previous answer is a prefix
	 * of the next one and the tail is all that needs mapping.
	 *
	 * Still O(n) in the array copy — a fresh reference is required or downstream
	 * `$derived`s will not re-run — but the copy is a flat memcpy rather than n
	 * proxy reads, which is where the cost actually was. Mutating in place and
	 * returning the same reference would remove even that, at the price of
	 * reactivity that works by accident.
	 */
	const memo = new Map<string, { keys: K[]; rows: T[]; epoch: number }>();

	function hydrate(setKey: string, keys: K[]): T[] {
		const prev = memo.get(setKey);
		const reusable =
			prev !== undefined &&
			prev.epoch === recordsEpoch &&
			prev.keys.length <= keys.length &&
			// Cheap prefix check: same length and same last element is enough here,
			// because keys are only ever appended to a set.
			(prev.keys.length === 0 || prev.keys[prev.keys.length - 1] === keys[prev.keys.length - 1]);

		const rows = reusable ? prev.rows.slice() : [];
		for (let i = reusable ? prev.keys.length : 0; i < keys.length; i++) {
			const r = records[String(keys[i])];
			if (r !== undefined) rows.push(r);
		}
		memo.set(setKey, { keys, rows, epoch: recordsEpoch });
		return rows;
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

	/**
	 * Accumulate a working set: page until the source is exhausted or the cap is
	 * reached. The two are different outcomes and the difference is the point —
	 * exhausted means `complete`, capped does not.
	 *
	 * `append: true` continues an existing set (an explicit "load more"); the
	 * default rebuilds it from scratch.
	 */
	async function run(
		k: string,
		scope: S,
		query: SetQuery,
		mode: 'loading' | 'refreshing',
		append = false,
		targetCap?: number
	): Promise<void> {
		const prev = sets[k];
		patchSet(k, { status: mode, error: undefined });
		const epoch = writeEpoch;

		// Dedupe by key while preserving arrival order. Keyset paging against our
		// own backends does not re-emit rows, so this is not the load-bearing
		// defence it would be against a third-party cursor — it is here because a
		// row inserted mid-accumulation can otherwise appear twice, and a Set
		// lookup is cheaper than reasoning about when that happens.
		const keys: K[] = append ? [...(prev?.keys ?? [])] : [];
		const seen = new Set<string>(keys.map(String));
		let fetched = append ? (prev?.fetchedCount ?? 0) : 0;
		let total = append ? prev?.total : undefined;
		let cursor = append ? prev?.cursor : undefined;

		// How deep to read. `targetCap` is what "load more" raises; it stays out of
		// the set key on purpose (see queryKey).
		const limit = targetCap ?? query.cap ?? cap;

		try {
			// No paging offered: one call, everything, always complete. An adapter
			// that cannot page must still be usable — a 400-row table should not
			// have to implement cursors to work here.
			if (!io.fetchPage) {
				if (!io.fetchAll) throw new Error('collection: io needs fetchAll or fetchPage');
				const data = await io.fetchAll(scope);
				if (epoch !== writeEpoch) return run(k, scope, query, 'refreshing');
				cache(data);
				patchSet(k, {
					keys: data.map(io.keyOf),
					fetchedCount: data.length,
					total: data.length,
					complete: true,
					cursor: undefined,
					status: 'ready',
					error: undefined
				});
				return;
			}

			let pages = 0;
			let exhausted = false;
			// Distinct from `exhausted`: we stopped, but NOT because the source said
			// so. Conflating them would report `complete` on a set we merely gave up
			// on — the silent truncation this whole model exists to prevent.
			let stalled = false;
			while (keys.length < limit && !exhausted && !stalled) {
				const page: FetchPage<T> = await io.fetchPage({
					scope,
					query,
					limit: Math.min(pageSize, limit - keys.length),
					cursor
				});
				if (epoch !== writeEpoch) return run(k, scope, query, 'refreshing');
				pages += 1;

				cache(page.records);
				const before = keys.length;
				for (const r of page.records) {
					const key = io.keyOf(r);
					if (seen.has(String(key))) continue;
					seen.add(String(key));
					keys.push(key);
				}
				const gained = keys.length - before;
				fetched += page.records.length;
				if (page.total !== undefined) total = page.total;
				cursor = page.cursor;

				// Three independent ways to learn the source is spent. `done` when the
				// adapter says so; no cursor when it implies it; a short page for the
				// APIs that offer neither — which is what both SC donors rely on.
				exhausted = page.done === true || !page.cursor || page.records.length === 0;

				// A page that adds nothing means the adapter is not advancing. Against
				// our own backends that is a bug in our own code, so the useful
				// behaviour is to stop rather than hang — but NOT to call it complete,
				// which would turn our bug into a silent truncation.
				stalled = !exhausted && gained === 0;

				// ⚑ Publish periodically AND yield, and the yield is the load-bearing
				// half.
				//
				// Publishing every page is quadratic — each one rebuilds the whole
				// key→record array downstream, so 40 pages of 500 cost ~800k record
				// lookups (measured: 5.6s for an accumulation whose IPC cost was
				// 13ms). But publishing rarely is not enough on its own, because
				// every `await` here resolves into a MICROTASK: the browser paints
				// between tasks, never between microtasks, so a loop of immediately-
				// resolving fetches completes without a single frame. Rows were being
				// published early and staying invisible until the end.
				//
				// So: publish on a cadence, and hand the browser a real task each
				// time so it can actually draw what was published.
				if (pages === 1 || pages % PUBLISH_EVERY === 0) {
					patchSet(k, {
						keys: [...keys],
						fetchedCount: fetched,
						total,
						cursor,
						complete: exhausted,
						status: 'refreshing'
					});
					// setTimeout, not requestAnimationFrame: rAF never fires in a hidden
					// document and would stall the whole accumulation there.
					await new Promise((r) => setTimeout(r, 0));
				}
			}

			patchSet(k, {
				keys,
				fetchedCount: fetched,
				total,
				cursor,
				// Exhausted, or the total says we hold it all. Hitting the cap is NOT
				// completeness — that is the case the whole model exists to surface.
				complete: exhausted || (total !== undefined && fetched >= total),
				status: 'ready',
				error: undefined
			});
		} catch (e) {
			patchSet(k, { status: 'error', error: toKitError(e, io.classifyError) });
		}
	}

	/**
	 * Start a fetch if one is warranted. Safe to call from a getter during
	 * render: every `$state` write happens in a microtask, never synchronously.
	 */
	/** A set's cache key: scope and declaration together, since both are identity. */
	const setKeyFor = (scope: S, query: SetQuery): string => {
		const q = queryKey(query);
		return q ? `${keyFor(scope)} ${q}` : keyFor(scope);
	};

	function ensure(
		scope: S,
		query: SetQuery,
		force = false,
		append = false,
		targetCap?: number
	): Promise<void> {
		const k = setKeyFor(scope, query);
		const existing = inflight.get(k);
		if (existing) return existing;

		const held = sets[k];
		if (!force && !append && held && held.status !== 'idle') {
			// The set exists — but "exists" is not "deep enough". The cap is depth,
			// not identity, so raising it must extend THIS set rather than being
			// ignored. Without this the cap control silently does nothing and the
			// only way to see more is a forced refetch, which throws away the rows
			// already held.
			const wanted = targetCap ?? query.cap ?? cap;
			if (held.complete || held.keys.length >= wanted) return Promise.resolve();
			append = true;
			targetCap = wanted;
		}

		ensureSubscribed();
		declarations.set(k, { scope, query });
		const mode = sets[k]?.status === 'ready' ? 'refreshing' : 'loading';
		const p = Promise.resolve()
			.then(() => run(k, scope, query, mode, append, targetCap))
			.finally(() => {
				inflight.delete(k);
			});
		inflight.set(k, p);
		return p;
	}

	function view(scope: S, query: SetQuery = {}): ScopedView<T, K> {
		const k = setKeyFor(scope, query);
		const set = () => sets[k];
		/**
		 * ⚑ The cap is ONE number: how many rows the caller wants. The fetch tops
		 * up when the set is short of it, and the view slices when the set is
		 * deeper than it.
		 *
		 * It was only the former, so dropping 20 000 back to 2 000 kept rendering
		 * 20 000 — the set had them and nothing trimmed. Slicing here also makes
		 * lowering free and perfectly reversible: the extra keys stay held, so
		 * going back up is instant rather than a refetch.
		 */
		const limit = query.cap ?? cap;
		return {
			get all() {
				void ensure(scope, query);
				const ks = set()?.keys ?? [];
				return hydrate(k, ks.length > limit ? ks.slice(0, limit) : ks);
			},
			get status() {
				void ensure(scope, query);
				return set()?.status ?? 'idle';
			},
			get error() {
				return set()?.error;
			},
			get hasData() {
				const s = set()?.status;
				return s === 'ready' || s === 'refreshing';
			},
			get complete() {
				void ensure(scope, query);
				return set()?.complete ?? false;
			},
			get fetchedCount() {
				return set()?.fetchedCount ?? 0;
			},
			get total() {
				return set()?.total;
			},
			/**
			 * More to show, from either direction: the server has rows we have not
			 * fetched, OR we hold rows the cap is currently hiding. Both are "raise
			 * the cap", and only one of them costs a request.
			 */
			get hasMore() {
				const s = set();
				if (!s || s.status === 'loading') return false;
				return !s.complete || s.keys.length > limit;
			},
			/**
			 * Reads the CACHE, not the set. A record reached from a deep link or a
			 * server search belongs to no set, and refusing to render it because it
			 * is not in the current one would be the split failing at its whole job.
			 */
			byKey(key: K) {
				void ensure(scope, query);
				return records[String(key)];
			}
		};
	}

	/**
	 * Fold a record into the cache and into any set that already lists it.
	 *
	 * Note what it does NOT do: add the key to sets that do not have it. Whether
	 * a new record belongs to a set carrying pushed-down predicates is a question
	 * only the server can answer — see the note's open item.
	 */
	function upsert(record: T): void {
		const key = String(io.keyOf(record));
		if (records[key] === undefined) cachedCount += 1;
		else recordsEpoch += 1;
		records[key] = record;
	}

	/** Append a record to a set it is known to belong to (a local create). */
	function joinSet(k: string, key: K): void {
		const set = sets[k];
		if (!set || set.keys.some((x) => x === key)) return;
		patchSet(k, {
			keys: [...set.keys, key],
			fetchedCount: set.fetchedCount + 1,
			// Both counters move together, as the archived Flutter PaginatedList
			// does, or the completeness invariant drifts under live mutation.
			total: set.total === undefined ? undefined : set.total + 1
		});
	}

	// ── invalidation ───────────────────────────────────────────────────────────

	/**
	 * Every set is remembered with the declaration that built it, so an
	 * invalidation can re-run it exactly. Untracked — it is bookkeeping, and
	 * writing it during a getter must stay legal.
	 */
	const declarations = new Map<string, { scope: S; query: SetQuery }>();

	function reload(info?: ChangeInfo<K, S> | null): void {
		const prefix = info?.scope !== undefined ? keyFor(info.scope) : null;
		for (const k of Object.keys(sets)) {
			const d = declarations.get(k);
			if (!d) continue;
			// A scope-tagged event only touches that scope's sets; an untagged one
			// (stibu's events carry neither id nor scope) touches all of them.
			if (prefix !== null && k !== prefix && !k.startsWith(`${prefix} `)) continue;
			void ensure(d.scope, d.query, true);
		}
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
			upsert(saved);

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
			upsert(made);
			// Safe only for the unfiltered set: whether a new record satisfies a
			// pushed-down predicate is the server's answer, not ours.
			joinSet(setKeyFor(scope, {}), io.keyOf(made));
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

		get complete() {
			return view(scopeOf()).complete;
		},
		get total() {
			return view(scopeOf()).total;
		},
		get fetchedCount() {
			return view(scopeOf()).fetchedCount;
		},
		get hasMore() {
			return view(scopeOf()).hasMore;
		},

		/**
		 * A working set other than the ambient one — a different scope, a
		 * pushed-down filter, a different order. `at(scope)` with no query is the
		 * plain cross-scope read it always was.
		 */
		at: (scope: S, query: SetQuery = {}) => view(scope, query),
		/** The ambient scope, narrowed by a pushed-down declaration. */
		query: (query: SetQuery) => view(scopeOf(), query),

		/** Whether this collection can page at all — a surface needs to know
		 *  whether an incomplete set is even reachable. */
		get paged() {
			return !!io.fetchPage;
		},

		/** Eager fetch. Same `ensure()` a read triggers, so a prefetch and a mount
		 *  share one request rather than racing. */
		/** Returns the in-flight promise, so a caller that wants to await the
		 *  warm-up can — and so a measurement of it is not accidentally timing
		 *  the call instead of the fetch. */
		prefetch(scope?: S, query: SetQuery = {}): Promise<void> {
			return ensure(arguments.length ? (scope as S) : scopeOf(), query);
		},

		/** Force a refetch of a set, keeping its data visible meanwhile. */
		refresh(scope?: S, query: SetQuery = {}): Promise<void> {
			return ensure(arguments.length ? (scope as S) : scopeOf(), query, true);
		},

		/**
		 * Raise the ceiling: accumulate one more run of pages onto an existing set.
		 * Explicit rather than automatic, because an automatic infinite fetch means
		 * the counts keep shifting under the user and there is no bottom.
		 */
		loadMore(query: SetQuery = {}, by?: number): Promise<void> {
			const scope = scopeOf();
			const set = sets[setKeyFor(scope, query)];
			if (!set || set.complete) return Promise.resolve();
			// Raise the depth on the SAME set — the cap is not part of its key, so
			// this extends rather than forking a parallel one.
			return ensure(scope, query, true, true, set.keys.length + (by ?? query.cap ?? cap));
		},

		/** Fetch one record into the cache — a deep link, or a hit from a
		 *  server-side search that belongs to no set we hold. */
		async refreshOne(key: K): Promise<T> {
			if (!io.fetchOne) throw new Error('collection: fetchOne not supplied');
			const fresh = await io.fetchOne(key, scopeOf());
			upsert(fresh);
			return fresh;
		},

		save,
		create,

		/**
		 * Drop working sets. Records stay cached — they are shared, and a set is
		 * only a list of keys, so dropping one costs nothing to rebuild from the
		 * cache if its records are still there.
		 */
		evict(scope?: S): void {
			const prefix = keyFor(arguments.length ? (scope as S) : scopeOf());
			for (const k of Object.keys(sets)) {
				if (k === prefix || k.startsWith(`${prefix} `)) {
					delete sets[k];
					declarations.delete(k);
				}
			}
		},
		evictAll(): void {
			sets = {};
			declarations.clear();
		},
		/** Drop cached records too. Separate because the two are separate. */
		clearCache(): void {
			records = {};
			cachedCount = 0;
			memo.clear();
			recordsEpoch += 1;
		},

		/** Drop the invalidation subscription. */
		dispose(): void {
			unsubscribe?.();
			unsubscribe = null;
		},

		/** Introspection for tests and the gallery. */
		get debug() {
			return {
				writesInFlight,
				writeEpoch,
				sets: Object.keys(sets),
				cached: cachedCount
			};
		}
	};
}

export type Collection<
	T,
	K extends string | number,
	S = void,
	B extends Record<string, unknown> = Partial<T> & Record<string, unknown>
> = ReturnType<typeof createCollection<T, K, S, B>>;
