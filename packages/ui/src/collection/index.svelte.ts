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

import { createSubscriber } from 'svelte/reactivity';

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
/**
 * Separator between a set key's scope part and query part. NUL cannot occur in
 * an app-supplied scope key, so prefix matching by scope cannot collide with a
 * scope whose key contains the separator. Written as an ESCAPE deliberately:
 * this used to be a raw NUL byte in the source, which made grep and ripgrep
 * classify the file as binary — and it silently disagreed with the plain
 * space that `reload` and `evict` matched on, so scope-filtered invalidation
 * and eviction never touched a set that had a query part.
 */
const SEP = '\u0000';
/**
 * ⚑ The ENVELOPE, not a tunable — see DESIGN.md "The envelope". Below it, a
 * set is held whole and filtering/search/counts are local; above it, the set
 * reports `capped` and refinement pushes down into the query.
 */
const DEFAULT_CAP = 10_000;
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
	// ⚑ Every value is ESCAPED. The separators here (`&`, `=`, `,`, `:`) are all
	// legal inside a user's search text and inside a facet value, so an
	// unescaped `search: "a&kind=b"` produces exactly the key that `search: "a"`
	// plus `where: { kind: "b" }` produces — two different questions collapsing
	// onto one set, which serves one query's rows as the other's answer. The
	// same reason the URL encoding is canonical.
	const enc = encodeURIComponent;
	const parts: string[] = [];
	// `search` in a key means a PUSHED-DOWN search — one the server must answer.
	// A search served locally (base set exhausted) never reaches this function:
	// the escalation answers it from the base's rows without minting a set.
	if (q.search) parts.push(`q=${enc(q.search)}`);
	if (q.order) parts.push(`o=${enc(q.order.by)}:${q.order.dir ?? 'asc'}`);
	// ⚑ `cap` is deliberately NOT in the key. Identity is what the set MATCHES —
	// scope, predicates, order. The cap is how far we have read into it, which is
	// state, not identity: "newest 2 000" and "newest 5 000" are one query at two
	// depths and the shallower is a prefix of the deeper. Keying on it made
	// `loadMore` silently build a second set while the view kept reading the
	// first, which is how this was found.
	for (const k of Object.keys(q.where ?? {}).sort()) {
		const v = q.where![k];
		const values = (Array.isArray(v) ? [...v].sort() : [v]).map(enc);
		parts.push(`${enc(k)}=${values.join(',')}`);
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
	 * ⚑ Which records arrived under which scope. The fill or write that produced
	 * a record knows its scope; the record itself cannot say — so without this,
	 * a 2025 fill leaks into a live 2026 set the moment both exist, which is
	 * exactly the cross-scope leak design C removed and E silently reintroduced.
	 * Live sets are FED and DERIVED per scope; the record cache stays shared, so
	 * `byKey` still answers across scopes.
	 */
	const scopeIndex = new Map<string, Set<string>>();
	/**
	 * ⚑ ONE version signal for all live rows, at COLLECTION level — deliberately
	 * not per live set. A per-instance signal dies with its instance: the
	 * lifecycle forgets an unobserved set and recreates it on the next read, and
	 * any derived that captured the dead instance's signal is permanently
	 * disconnected — bumps land on the new instance, the old dependents never
	 * wake, so nobody re-reads, so the new instance is never observed either.
	 * Measured as a whole surface freezing mid-fill with zero errors: the header
	 * stopped at a page boundary and the pipeline never woke at all. A signal
	 * that outlives instances is what makes forget-and-recreate SAFE.
	 */
	let liveVersion = $state(0);
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

	/**
	 * When each set was last READ, by set key. Plain and untracked — getters
	 * write it during render, which must stay legal (the `inflight` rule).
	 *
	 * This is the fill-halting signal. `createSubscriber`'s teardown also knows
	 * when a set loses its readers, but measured up to 15s late — fine for the
	 * memory lifecycle, useless for cancelling a fill. A read timestamp is
	 * prompt by construction: every page the fill publishes re-renders the
	 * observing surface, which re-reads the view, which refreshes this — so an
	 * abandoned set goes stale within one page.
	 */
	const lastRead = new Map<string, number>();

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
	/**
	 * A QUEUE, not a single collapsed entry. When events were only ever "reload
	 * everything", keeping the last one was enough; a keyed delete arriving
	 * beside a keyed update must not overwrite it. Redundant reloads in the
	 * drained queue still collapse — `ensure` dedupes through `inflight`.
	 */
	let pendingInvalidations: (ChangeInfo<K, S> | undefined)[] = [];
	let unsubscribe: Unsubscribe | null = null;
	let subscribing = false;

	const scopeOf = (): S => (options.scope ? options.scope() : (undefined as S));
	const keyFor = (scope: S): string =>
		options.scopeKey ? options.scopeKey(scope) : scope === undefined ? DEFAULT_KEY : String(scope);

	const EMPTY_SET: WorkingSet<K> = {
		keys: [],
		fetchedCount: 0,
		status: 'idle'
	};

	function patchSet(k: string, patch: Partial<WorkingSet<K>>): void {
		// A new container each time: `.raw` only notifies on reassignment.
		sets = { ...sets, [k]: { ...(sets[k] ?? EMPTY_SET), ...patch } };
	}

	/**
	 * ⚑ A LIVE SET: rows derived once, then maintained by BATCH.
	 *
	 * Design E maintained rows per record — every arrival paid a binary search,
	 * a splice and an O(n) reindex, so inserting 10 000 records into a 10 000-row
	 * set was ~10⁸ operations. Design D had the right algorithm all along:
	 * filter the batch, sort the batch, one merge pass — O(n + k log k) for a
	 * whole page instead of O(n · k). D's only sin was its reactivity, fixed
	 * below. See DESIGN.md.
	 *
	 * Reactivity is a plain array plus a VERSION counter — the exact pattern
	 * `records` uses, for the exact reason it uses it: `$state<T[]>` deep-proxies
	 * every record pushed in (a proxy plus per-property signals each — measured
	 * at ~1 GB for 20 000 records), and every splice invalidates every index
	 * signal after it. One version signal gives readers the only dependency they
	 * need: "the rows changed".
	 *
	 * Membership is a `Set` of keys. The key→position map is gone — it is the
	 * thing that cannot survive insertions cheaply, and with batch merges nothing
	 * needs positions.
	 */
	type Live = {
		/** The scope key this set belongs to — feeding is routed by it. */
		readonly sk: string;
		readonly rows: T[];
		readonly deriving: boolean;
		applyBatch(batch: T[]): void;
		drop(key: string): void;
		derive(): void;
	};

	function createLive(setKey: string, sk: string, query: SetQuery): Live {
		let rows: T[] = [];
		// No per-instance signals — see `liveVersion`. `deriving` is plain for
		// the same reason: readers learn of its flips through the outer bump.
		let deriving = false;
		const have = new Set<string>();
		const match = options.matches;
		const base = options.compare?.(query.order);
		/**
		 * ⚑ Maintenance is tied to OBSERVATION. Every live set is offered every
		 * arriving record forever, so under E each search term left an immortal
		 * set behind and maintenance cost scaled with history, not with the
		 * screen. `createSubscriber` tells us when the last reactive reader
		 * leaves; the set then forgets itself. It is a cache of a cache — the
		 * records stay, the declaration stays, and rebuilding is one derive.
		 */
		/**
		 * ⚑ Forgetting is DEFERRED, and the grace period is load-bearing.
		 *
		 * The subscriber count transiently crosses zero during re-renders (a
		 * scope switch destroys the old effects before the new ones attach), and
		 * deleting synchronously on that crossing split the brain: the template
		 * kept rendering instance A while a recreated B took its place in the
		 * map — every later event then mutated a set nobody rendered. Found via
		 * a keyed delete that logged `rows 7 → 6` while the DOM showed 7.
		 * Re-observation within the grace period cancels the drop.
		 */
		let forget: ReturnType<typeof setTimeout> | undefined;
		const subscribe = createSubscriber(() => {
			if (forget !== undefined) {
				clearTimeout(forget);
				forget = undefined;
			}
			return () => {
				forget = setTimeout(() => {
					// Identity check: an evict may have replaced us already.
					if (live.get(setKey) === self) live.delete(setKey);
				}, 1_000);
			};
		});
		/**
		 * ⚑ PK tiebreak, so the order is TOTAL — the same guarantee the wire
		 * contract demands of the backend. Without it, equal sort keys make row
		 * positions merge-order-dependent and the client's order can disagree
		 * with the server's between two fills of the same set.
		 */
		const cmp = base
			? (a: T, b: T): number => {
					const c = base(a, b);
					if (c !== 0) return c;
					const ka = io.keyOf(a);
					const kb = io.keyOf(b);
					return ka < kb ? -1 : ka > kb ? 1 : 0;
				}
			: undefined;

		/** Merge a sorted run of new rows into `rows` — one pass, one allocation.
		 *  Always a NEW array, never a push: version bump ⇔ identity change is
		 *  what the local-search memo keys on. */
		function merge(adds: T[]): void {
			if (adds.length === 0) return;
			if (!cmp) {
				rows = rows.concat(adds);
				return;
			}
			adds.sort(cmp);
			const merged = new Array<T>(rows.length + adds.length);
			let i = 0;
			let j = 0;
			let o = 0;
			while (i < rows.length && j < adds.length)
				merged[o++] = cmp(rows[i], adds[j]) <= 0 ? rows[i++] : adds[j++];
			while (i < rows.length) merged[o++] = rows[i++];
			while (j < adds.length) merged[o++] = adds[j++];
			rows = merged;
		}

		/**
		 * One batch, one rule — covers arrival, replacement and disappearance.
		 *
		 * A record already present is stripped in a single filter pass and, if it
		 * still matches, re-added through the merge — which is how a moved sort
		 * position is handled without ever asking where it was. Re-fetching
		 * records we already hold is the NORMAL case (every refresh page is one),
		 * so the replace path must be batch-cheap, not per-record-clever.
		 */
		function applyBatch(batch: T[]): void {
			const adds: T[] = [];
			// A cursor source can re-emit a row at a page boundary; within one
			// batch the first occurrence wins, or a key could be merged in twice.
			const seen = new Set<string>();
			let strip: Set<string> | null = null;
			for (const r of batch) {
				const key = String(io.keyOf(r));
				if (seen.has(key)) continue;
				seen.add(key);
				const ok = !match || match(r, query);
				if (have.has(key)) {
					(strip ??= new Set()).add(key);
					if (ok) adds.push(r);
					else have.delete(key);
				} else if (ok) {
					have.add(key);
					adds.push(r);
				}
			}
			if (strip) {
				const s = strip;
				rows = rows.filter((r) => !s.has(String(io.keyOf(r))));
			}
			merge(adds);
			if (strip || adds.length) liveVersion += 1;
		}

		const self: Live = {
			sk,
			get rows() {
				subscribe();
				void liveVersion;
				return rows;
			},
			get deriving() {
				subscribe();
				void liveVersion;
				return deriving;
			},
			applyBatch,
			drop(key: string) {
				if (!have.delete(key)) return;
				rows = rows.filter((r) => String(io.keyOf(r)) !== key);
				liveVersion += 1;
			},
			/**
			 * The one irreducible O(cache) cost, and the only place a set is built
			 * rather than maintained. Chunked across tasks so a large cache does not
			 * stall the frame, publishing each chunk as it lands — partial data
			 * beats a spinner. Each chunk goes through `applyBatch`, so building IS
			 * maintaining: sort the chunk, merge once.
			 */
			/**
			 * ⚑ NOTHING SYNCHRONOUS in here may write a signal. `derive()` runs
			 * from `liveFor`, which runs from view getters, which run inside the
			 * consumer's `$derived` — and `liveVersion` pre-exists that
			 * evaluation, so a synchronous bump is `state_unsafe_mutation`. (The
			 * old per-instance `version` dodged this by accident: Svelte permits
			 * writing state CREATED during the current evaluation, which is the
			 * only reason derive-on-first-read was ever legal.) The reset below
			 * is plain-variable work; every bump happens in the async chunks.
			 */
			derive() {
				rows = [];
				have.clear();
				// Only THIS scope's records — scope membership is structural (which
				// fill produced the record), not something `match` can decide.
				const all = [...(scopeIndex.get(sk) ?? [])];
				const CHUNK = 5_000;
				deriving = true;
				let i = 0;
				const step = () => {
					// Dropped (or replaced) while deriving: stop filling a corpse.
					if (live.get(setKey) !== self) return;
					const end = Math.min(i + CHUNK, all.length);
					const batch: T[] = [];
					for (; i < end; i++) {
						const r = records.get(all[i]);
						if (r !== undefined && (!match || match(r, query))) batch.push(r);
					}
					applyBatch(batch);
					if (i < all.length) setTimeout(step, 0);
					else {
						deriving = false;
						liveVersion += 1;
					}
				};
				setTimeout(step, 0);
			}
		};
		return self;
	}

	const live = new Map<string, Live>();

	function liveFor(setKey: string, sk: string, query: SetQuery): Live {
		let l = live.get(setKey);
		if (!l) {
			l = createLive(setKey, sk, query);
			live.set(setKey, l);
			l.derive();
		}
		return l;
	}

	/**
	 * Put records in the cache and maintain every live set with them.
	 *
	 * ⚑ The whole page goes to each live set as ONE batch — one sort of the
	 * page, one merge pass, one version bump. Per-record application was E's
	 * regression; per-batch is D's algorithm with working reactivity. There is
	 * no publish cadence left to tune: a fill of k pages costs each set k
	 * merges, not k rebuilds.
	 */
	function cache(list: T[], sk: string): void {
		let idx = scopeIndex.get(sk);
		if (!idx) scopeIndex.set(sk, (idx = new Set()));
		for (const r of list) {
			const key = String(io.keyOf(r));
			records.set(key, r);
			idx.add(key);
		}
		// Only live sets of the scope this fill ran under — see `scopeIndex`.
		for (const l of live.values()) if (l.sk === sk) l.applyBatch(list);
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
			// Loud, deliberately: a silently-failed subscription looks exactly like
			// "invalidation is broken" and costs a debugging session to find.
			.catch((e) => console.error('collection: subscribe failed', e))
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
		const sk = keyFor(scope);
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
				cache(data, sk);
				patchSet(k, {
					keys: data.map(io.keyOf),
					fetchedCount: data.length,
					total: data.length,
					stopped: 'exhausted',
					cursor: undefined,
					status: 'ready',
					updatedAt: Date.now(),
					error: undefined
				});
				return;
			}

			let exhausted = false;
			// Distinct from `exhausted`: we stopped, but NOT because the source said
			// so. Conflating them would report `complete` on a set we merely gave up
			// on — the silent truncation this whole model exists to prevent.
			let stalled = false;
			/**
			 * ⚑ Halt a SUPERSEDED fill. Typing commits intermediate queries whose
			 * fills otherwise all run to completion behind the current one — and
			 * with page-wise interleaving they thrash any per-query state the
			 * backend keeps (measured over Tauri: a search that costs ~1.5 s clean
			 * cost 25 s behind two abandoned fills). "Abandoned" means: this set
			 * WAS being read and has not been read for a second — see `lastRead`.
			 * A pure prefetch — never read — still completes; warming a set nobody
			 * reads yet is its whole job.
			 */
			const readRecently = () => {
				const t = lastRead.get(k);
				return t !== undefined && performance.now() - t < 1_000;
			};
			let everRead = false;
			let halted = false;
			while (keys.length < limit && !exhausted && !stalled) {
				const wanted = readRecently();
				everRead ||= wanted;
				// The final patch reports this as `capped`, which is exactly what it
				// is: we stopped ourselves, more exists, and a later read extends.
				if (everRead && !wanted) {
					halted = true;
					break;
				}
				const page: FetchPage<T> = await io.fetchPage({
					scope,
					query,
					limit: Math.min(pageSize, limit - keys.length),
					cursor
				});
				if (epoch !== writeEpoch) return run(k, scope, query, 'refreshing');

				cache(page.records, sk);
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

				// ⚑ A YIELD, not a publish — and it is still load-bearing.
				//
				// There is no publish cadence left to tune: live sets pick each page
				// up as it lands, at O(page). But every `await` here resolves into a
				// MICROTASK, and the browser paints between TASKS, never between
				// microtasks — so a loop of immediately-resolving fetches (fixtures,
				// a warm backend) completes without a single frame, and rows that
				// were maintained early stay invisible until the end. A real task
				// between pages is what lets the browser draw them.
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
				// Stamped only on SUCCESS. A failed fill must leave the previous
				// timestamp standing: the rows on screen really are as of then,
				// and moving it would claim a freshness we did not get.
				updatedAt: Date.now(),
				error: undefined
			});

			/**
			 * ⚑ A halt must not silently truncate an OBSERVED set. Fine-grained
			 * reactivity means a page that settles stops re-reading — so a fill
			 * halted during a main-thread stall (a route compiling, a long task)
			 * would stay at 6 000 of 10 000 forever with nothing left to extend
			 * it. The patch above re-renders any surface still showing this set,
			 * and that render stamps a fresh read — so a short recheck can tell
			 * "still watched" (resume) from "abandoned" (stay halted). An
			 * abandoned set gets no post-halt read and terminates for good.
			 */
			if (halted) {
				const haltedAt = performance.now();
				setTimeout(() => {
					if ((lastRead.get(k) ?? 0) > haltedAt) {
						void ensure(scope, query, false, true, limit);
					}
				}, 300);
			}
		} catch (e) {
			patchSet(k, { status: 'error', error: toKitError(e, io.classifyError) });
		}
	}

	/** A set's cache key: scope and declaration together, since both are identity. */
	const setKeyFor = (scope: S, query: SetQuery): string => {
		const q = queryKey(query);
		return q ? `${keyFor(scope)}${SEP}${q}` : keyFor(scope);
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
		const sk = keyFor(scope);
		const set = () => sets[k];
		/** Every read stamps `lastRead` — the fill-halting signal. */
		const touch = () => {
			lastRead.set(k, performance.now());
		};
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
				touch();
				void ensure(scope, query);
				return liveFor(k, sk, query).rows;
			},
			get status() {
				touch();
				void ensure(scope, query);
				return set()?.status ?? 'idle';
			},
			get error() {
				return set()?.error;
			},
			get hasData() {
				touch();
				return liveFor(k, sk, query).rows.length > 0;
			},
			get stopped() {
				touch();
				void ensure(scope, query);
				return set()?.stopped;
			},
			get fetching() {
				touch();
				void ensure(scope, query);
				const st = set()?.status;
				return st === 'loading' || st === 'refreshing' || liveFor(k, sk, query).deriving;
			},
			/** Derived, never stored — see the note on `stopped`. */
			get complete() {
				touch();
				void ensure(scope, query);
				return set()?.stopped === 'exhausted';
			},
			get fetchedCount() {
				return set()?.fetchedCount ?? 0;
			},
			get total() {
				return set()?.total;
			},
			get updatedAt() {
				return set()?.updatedAt;
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

	// ── search escalation ──────────────────────────────────────────────────────

	/** The declaration minus transient search — the corpus a search narrows. */
	function baseOf(query: SetQuery): SetQuery {
		const { search: _search, ...base } = query;
		return base;
	}

	/**
	 * ⚑ THE ESCALATION RULE — the envelope's two regimes, decided per read.
	 *
	 * A search can be answered without minting a set exactly when the base set
	 * (same declaration, search stripped) holds everything its query matches AND
	 * the app supplied `matches` to narrow it locally. Then typing never
	 * creates sets, never fetches, and the answer is exact. Otherwise the search
	 * is a different question than the rows we hold can answer, and it pushes
	 * down into the set key as before — a deliberate server round-trip.
	 *
	 * Reads tracked state, so a consumer's getters re-route the moment the base
	 * fill reports `exhausted`.
	 */
	function servesLocally(scope: S, query: SetQuery): boolean {
		if (!query.search || !options.matches) return false;
		return sets[setKeyFor(scope, baseOf(query))]?.stopped === 'exhausted';
	}

	/**
	 * The view consumers actually get: `view()` plus the escalation. A query
	 * without search IS its own base and passes straight through.
	 *
	 * In the push-down branch the base is ensured too — otherwise a deep link
	 * that lands with a search active would fill search sets forever and never
	 * learn that the base exhausts. One extra fill, once, buys convergence to
	 * the local regime wherever the data permits it.
	 */
	function scopedView(scope: S, query: SetQuery = {}): ScopedView<T, K> {
		if (!query.search || !options.matches) return view(scope, query);

		const base = baseOf(query);
		const match = options.matches;

		/** Local narrowing, memoised on the rows array identity — which changes
		 *  exactly when the base live set's version bumps. */
		let memoIn: T[] | null = null;
		let memoOut: T[] = [];
		const narrowed = (rows: T[]): T[] => {
			if (rows !== memoIn) {
				memoOut = rows.filter((r) => match(r, query));
				memoIn = rows;
			}
			return memoOut;
		};

		const local = () => servesLocally(scope, query);
		const baseView = () => view(scope, base);
		const pushView = () => {
			void ensure(scope, base);
			return view(scope, query);
		};

		return {
			get all() {
				return local() ? narrowed(baseView().all) : pushView().all;
			},
			get status() {
				return local() ? baseView().status : pushView().status;
			},
			get error() {
				return local() ? baseView().error : pushView().error;
			},
			get hasData() {
				return local() ? narrowed(baseView().all).length > 0 : pushView().hasData;
			},
			/** Locally served means exactly answered: we hold the whole corpus. */
			get stopped() {
				return local() ? ('exhausted' as const) : pushView().stopped;
			},
			get fetching() {
				return local() ? baseView().fetching : pushView().fetching;
			},
			get complete() {
				return local() ? true : pushView().complete;
			},
			get fetchedCount() {
				return local() ? baseView().fetchedCount : pushView().fetchedCount;
			},
			/** Local total is the narrowed count — the true answer, not the
			 *  base's server total, which counts the wider corpus. */
			get total() {
				return local() ? narrowed(baseView().all).length : pushView().total;
			},
			/** A locally-served search is as fresh as the base it narrows. */
			get updatedAt() {
				return local() ? baseView().updatedAt : pushView().updatedAt;
			},
			get hasMore() {
				return local() ? false : pushView().hasMore;
			},
			byKey(key: K) {
				return (local() ? baseView() : pushView()).byKey(key);
			}
		};
	}

	/**
	 * Fold one record into the cache and its scope's live sets — a write result,
	 * a deep link, a search hit. A batch of one through the same path fills use.
	 */
	function upsert(record: T, scope: S): void {
		cache([record], keyFor(scope));
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
			if (prefix !== null && k !== prefix && !k.startsWith(prefix + SEP)) continue;
			void ensure(d.scope, d.query, true);
		}
	}

	/**
	 * Remove records locally — the cache, the scope index, every live set, and
	 * the working-set bookkeeping (mirroring `joinSet`'s increments). No fetch:
	 * this is the path where absence is KNOWN, either because this client
	 * deleted (tier 1, `discard`) or the backend event named the keys (tier 2).
	 */
	function removeLocal(keys: K[]): void {
		if (!keys.length) return;
		const strip = new Set(keys.map(String));
		for (const k of strip) records.delete(k);
		for (const idx of scopeIndex.values()) for (const k of strip) idx.delete(k);
		for (const l of live.values()) for (const k of strip) l.drop(k);
		let next: Record<string, WorkingSet<K>> | null = null;
		for (const [k, set] of Object.entries(sets)) {
			const kept = set.keys.filter((x) => !strip.has(String(x)));
			const removed = set.keys.length - kept.length;
			if (!removed) continue;
			(next ??= { ...sets })[k] = {
				...set,
				keys: kept,
				fetchedCount: Math.max(0, set.fetchedCount - removed),
				total: set.total === undefined ? undefined : Math.max(0, set.total - removed)
			};
		}
		if (next) sets = next;
		recordsVersion += 1;
	}

	/**
	 * One change event, routed by how much it says:
	 *
	 *  - `delete` + keys  → remove locally, fetch nothing.
	 *  - keys + `fetchOne` → refresh exactly those records; a key the server no
	 *    longer answers for falls back to a reload, which self-heals.
	 *  - anything less    → reload the affected sets, as always.
	 */
	function handleChange(info?: ChangeInfo<K, S> | null): void {
		if (info?.keys?.length) {
			if (info.kind === 'delete') {
				removeLocal(info.keys);
				return;
			}
			if (io.fetchOne) {
				const scope = info.scope !== undefined ? info.scope : scopeOf();
				for (const key of info.keys) {
					io.fetchOne(key, scope).then(
						(fresh) => upsert(fresh, scope),
						() => reload(info)
					);
				}
				return;
			}
		}
		reload(info);
	}

	function onInvalidated(info?: ChangeInfo<K, S>): void {
		if (writesInFlight > 0) {
			// Defer, per the spike: a naive reload starts a fetch before the write
			// commits and can serve pre-write state.
			pendingInvalidations.push(info);
			return;
		}
		handleChange(info);
	}

	function settleWrite(): void {
		writesInFlight -= 1;
		writeEpoch += 1;
		if (writesInFlight === 0 && pendingInvalidations.length) {
			const drained = pendingInvalidations;
			pendingInvalidations = [];
			for (const info of drained) handleChange(info);
		}
	}

	// ── writes ─────────────────────────────────────────────────────────────────

	function divergence(requested: B, returned: T): string[] {
		const isDiverged = io.write?.isDiverged ?? ((_f: string, a: unknown, b: unknown) => a !== b);
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
			upsert(saved, scope);

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
			upsert(made, scope);
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
		get updatedAt() {
			return view(scopeOf()).updatedAt;
		},
		get hasMore() {
			return view(scopeOf()).hasMore;
		},

		/**
		 * A working set other than the ambient one — a different scope, a
		 * pushed-down filter, a different order. `at(scope)` with no query is the
		 * plain cross-scope read it always was.
		 */
		at: (scope: S, query: SetQuery = {}) => scopedView(scope, query),
		/** The ambient scope, narrowed by a declaration. Search escalates: local
		 *  over an exhausted base, pushed down over a capped one. */
		query: (query: SetQuery) => scopedView(scopeOf(), query),

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
			const s = arguments.length ? (scope as S) : scopeOf();
			// Same routing as a read: a locally-served search warms its base; a
			// pushed-down one warms both, so the base can report whether it
			// exhausts and flip the regime.
			if (servesLocally(s, query)) return ensure(s, baseOf(query));
			if (query.search && options.matches) void ensure(s, baseOf(query));
			return ensure(s, query);
		},

		/** Force a refetch of a set, keeping its data visible meanwhile. */
		refresh(scope?: S, query: SetQuery = {}): Promise<void> {
			const s = arguments.length ? (scope as S) : scopeOf();
			return ensure(s, servesLocally(s, query) ? baseOf(query) : query, true);
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
			const scope = scopeOf();
			const fresh = await io.fetchOne(key, scope);
			upsert(fresh, scope);
			return fresh;
		},

		save,
		create,

		/**
		 * Tier-1 deletion: WE did it. The app just performed a delete the server
		 * confirmed, so the records leave the cache and every live set locally —
		 * no refetch, no event required. The server stays authoritative: this is
		 * only ever called AFTER it answered.
		 */
		discard(...keys: K[]): void {
			removeLocal(keys);
		},

		/**
		 * Drop working sets. Records stay cached — they are shared, and a set is
		 * only a list of keys, so dropping one costs nothing to rebuild from the
		 * cache if its records are still there.
		 */
		evict(scope?: S): void {
			const prefix = keyFor(arguments.length ? (scope as S) : scopeOf());
			const next = { ...sets };
			for (const k of Object.keys(next)) {
				if (k === prefix || k.startsWith(prefix + SEP)) {
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
			scopeIndex.clear();
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
				/** Sets actually being MAINTAINED — observed ones. The difference
				 *  against `sets` is the lifecycle working. */
				liveSets: [...live.keys()],
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
