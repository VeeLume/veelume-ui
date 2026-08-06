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
>(io: CollectionIO<T, K, S, B>, options: CollectionOptions<T, S> = {}) {
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
	/**
	 * ⚑ A plain Map plus a VERSION counter, not a `$state` object.
	 *
	 * A deep `$state` proxy over a hundred thousand records is itself the
	 * bottleneck, and both halves scale with cache size: every record written
	 * during accumulation is a reactive write, and every hydrate creates one
	 * fine-grained dependency per key read. Observed as the whole UI freezing
	 * while "cached records" ticked upward — the counter moving WAS the render
	 * loop, one flush per record.
	 *
	 * A version bumped once per batch gives readers exactly the dependency they
	 * need ("the cache changed") and nothing they do not.
	 */
	const records = new Map<string, T>();
	let recordsVersion = $state(0);
	/**
	 * ⚑ `$state.raw`, because a set holds a key array up to the cap.
	 *
	 * Plain `$state` deep-proxies it, so slicing 100 000 keys becomes 100 000
	 * proxy reads — the same per-element tax the record cache above was paying.
	 * Sets are always REPLACED wholesale, never mutated in place, which is
	 * exactly the shape `.raw` is for.
	 */
	let sets = $state.raw<Record<string, WorkingSet<K>>>({});

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
		// A new container each time: `.raw` only notifies on reassignment.
		sets = { ...sets, [k]: { ...(sets[k] ?? EMPTY_SET), ...patch } };
	}


	/** Put records in the cache. The one way anything enters it. */
	/**
	 * ⚑ A LIVE SET: rows derived once, then maintained in place.
	 *
	 * The rows array is `$state` and is *mutated*, never replaced. That is the
	 * whole point. Handing Svelte a fresh array on every fill page made every
	 * downstream stage — merge, slice, each-block walk, reveal restart — cost
	 * O(rows already on screen), so a fill of k pages cost O(k · n) and the UI
	 * stuttered k times. Mutating in place costs O(what changed).
	 *
	 * The key→index map is what makes that exact: with it, an arrival, a
	 * replacement and a deletion are all maintainable, so a full re-derive is
	 * needed ONLY when the set's identity changes (a different predicate or
	 * order). There is no rebuild-vs-maintain judgement call left to tune.
	 */
	type Live = {
		readonly rows: T[];
		readonly deriving: boolean;
		apply(record: T): void;
		drop(key: string): void;
		derive(): void;
	};

	function createLive(query: SetQuery): Live {
		const rows = $state<T[]>([]);
		let deriving = $state(false);
		const index = new Map<string, number>();
		const match = options.matches;
		const cmp = options.compare?.(query.order);

		/** First position whose row sorts after `r`. */
		function seek(r: T): number {
			if (!cmp) return rows.length;
			let lo = 0;
			let hi = rows.length;
			while (lo < hi) {
				const mid = (lo + hi) >> 1;
				if (cmp(rows[mid], r) <= 0) lo = mid + 1;
				else hi = mid;
			}
			return lo;
		}

		function reindexFrom(i: number): void {
			for (let j = i; j < rows.length; j++) index.set(String(io.keyOf(rows[j])), j);
		}

		function removeAt(i: number): void {
			index.delete(String(io.keyOf(rows[i])));
			rows.splice(i, 1);
			reindexFrom(i);
		}

		function insert(r: T): void {
			const at = seek(r);
			rows.splice(at, 0, r);
			reindexFrom(at);
		}

		return {
			get rows() {
				return rows;
			},
			get deriving() {
				return deriving;
			},
			/**
			 * One record, one rule. Covers arrival, replacement and disappearance —
			 * a replaced record whose sort position moved is removed and reinserted,
			 * which is why nothing here can drift out of order.
			 */
			apply(record: T) {
				const key = String(io.keyOf(record));
				const at = index.get(key);
				const ok = !match || match(record, query);
				if (at === undefined) {
					if (ok) insert(record);
					return;
				}
				if (!ok) {
					removeAt(at);
					return;
				}
				const moved =
					cmp !== undefined &&
					((at > 0 && cmp(rows[at - 1], record) > 0) ||
						(at + 1 < rows.length && cmp(record, rows[at + 1]) > 0));
				if (moved) {
					removeAt(at);
					insert(record);
				} else {
					rows[at] = record;
				}
			},
			drop(key: string) {
				const at = index.get(key);
				if (at !== undefined) removeAt(at);
			},
			/**
			 * The one irreducible O(cache) cost, and the only place a set is built
			 * rather than maintained. Chunked across tasks so a large cache does not
			 * stall the frame, publishing as it goes — partial data beats a spinner.
			 */
			derive() {
				const all = [...records.values()];
				const CHUNK = 5_000;
				deriving = true;
				let i = 0;
				const step = () => {
					const end = Math.min(i + CHUNK, all.length);
					for (; i < end; i++) {
						const r = all[i];
						if (!match || match(r, query)) insert(r);
					}
					if (i < all.length) setTimeout(step, 0);
					else deriving = false;
				};
				step();
			}
		};
	}

	const live = new Map<string, Live>();

	function liveFor(setKey: string, query: SetQuery): Live {
		let l = live.get(setKey);
		if (!l) {
			l = createLive(query);
			live.set(setKey, l);
			l.derive();
		}
		return l;
	}

	/**
	 * Put records in the cache and maintain every live set with them.
	 *
	 * ⚑ No publish step, no cadence. Rows are `$state` arrays mutated in place,
	 * so Svelte sees the appends directly and there is nothing left to schedule.
	 * `PUBLISH_EVERY` and its interval successor both existed only to limit how
	 * often an O(n) rebuild ran.
	 */
	function cache(list: T[]): void {
		for (const r of list) {
			records.set(String(io.keyOf(r)), r);
			for (const l of live.values()) l.apply(r);
		}
		recordsVersion += 1;
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
		// Rebuilding from scratch: the memo's rows describe the previous answer and
		// would be reused as a prefix of the new one. Precise invalidation here is
		// what lets `cache()` leave the epoch alone.
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
					stopped: 'exhausted',
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
				// Hand the browser a task between pages so it can paint what the live
				// sets already picked up. The maintenance itself is O(page), so this
				// is a yield, not a publish.
				await new Promise((r) => setTimeout(r, 0));
			}

			patchSet(k, {
				keys,
				fetchedCount: fetched,
				total,
				cursor,
				// ⚑ WHY we stopped, not whether we are "complete". Two reasons, and
				// nothing compares counts — which is what removed the hole where
				// over-fetch-and-filter made `total` count the wider query.
				stopped: exhausted ? 'exhausted' : 'capped',
				status: 'ready',
				error: undefined
			});
		} catch (e) {
			patchSet(k, { status: 'error', error: toKitError(e, io.classifyError) });
		}
	}

	/** A set's cache key: scope and declaration together, since both are identity. */
	const setKeyFor = (scope: S, query: SetQuery): string => {
		const q = queryKey(query);
		return q ? `${keyFor(scope)} ${q}` : keyFor(scope);
	};

	/**
	 * Start a fetch if one is warranted. Safe to call from a getter during
	 * render: every `$state` write happens in a microtask, never synchronously.
	 */
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
			if (held.stopped === 'exhausted' || held.keys.length >= wanted) return Promise.resolve();
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
		return {
			/**
			 * Derived, always. There is no loading state that hides rows: whatever
			 * the cache can answer is shown immediately and the fill corrects it in
			 * the background. Partial data beats a spinner.
			 */
			/**
			 * The maintained array itself, not a copy. Capping is the consumer's
			 * business now — `cap` governs how deep the FILL goes, and slicing here
			 * would reintroduce an O(cap) copy on every read.
			 */
			get all() {
				void ensure(scope, query);
				return liveFor(k, query).rows;
			},
			get status() {
				void ensure(scope, query);
				return set()?.status ?? 'idle';
			},
			get error() {
				return set()?.error;
			},
			get hasData() {
				return liveFor(k, query).rows.length > 0;
			},
			get stopped() {
				void ensure(scope, query);
				return set()?.stopped;
			},
			get fetching() {
				void ensure(scope, query);
				const st = set()?.status;
				return st === 'loading' || st === 'refreshing' || liveFor(k, query).deriving;
			},
			/** Derived, never stored — see the note on `stopped`. */
			get complete() {
				void ensure(scope, query);
				return set()?.stopped === 'exhausted';
			},
			get fetchedCount() {
				return set()?.fetchedCount ?? 0;
			},
			get total() {
				return set()?.total;
			},
			/** More to be had: the fill stopped at our own cap. */
			get hasMore() {
				const s = set();
				return !!s && s.stopped === 'capped';
			},
			/**
			 * Reads the CACHE, not the set. A record from a deep link or a server
			 * search belongs to no set, and refusing to render it because of that
			 * would be the split failing at its whole job.
			 */
			byKey(key: K) {
				void ensure(scope, query);
				void recordsVersion;
				return records.get(String(key));
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
		records.set(key, record);
		// No special case: a replacement is a record change like any other, and
		// `apply` moves it if its sort position changed. The rescan this used to
		// force is exactly what the key→index map made unnecessary.
		for (const l of live.values()) l.apply(record);
		recordsVersion += 1;
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
			if (!set || set.stopped === 'exhausted') return Promise.resolve();
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
			const next = { ...sets };
			for (const k of Object.keys(next)) {
				if (k === prefix || k.startsWith(`${prefix} `)) {
					delete next[k];
					declarations.delete(k);
					live.delete(k);
				}
			}
			sets = next;
		},
		evictAll(): void {
			sets = {};
			declarations.clear();
		},
		/** Drop cached records too. Separate because the two are separate. */
		clearCache(): void {
			records.clear();
			recordsVersion += 1;
		},

		/** Drop the invalidation subscription. */
		dispose(): void {
			unsubscribe?.();
			unsubscribe = null;
		},

		/** Introspection for tests and the gallery. */
		get debug() {
			void recordsVersion;
			return {
				writesInFlight,
				writeEpoch,
				sets: Object.keys(sets),
				cached: records.size
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
