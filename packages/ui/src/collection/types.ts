/**
 * Types for the L1 collection primitive.
 *
 * Shaped by three existing implementations (connect-neo's `createRecordStore`,
 * stibu's eight hand-written stores, Starlume's `catalog.svelte.ts`) plus a
 * spike that ran connect-neo's store against stibu's TrailBase backend. The
 * findings that moved the design are in the vault note's casebook; the rules
 * are in ../../CLAUDE.md.
 */

/**
 * Data is ALWAYS present (possibly empty); status describes what is happening
 * to it.
 *
 * `refreshing` is the one both donor apps lack and both need: "I have data and
 * I am revalidating". Collapsing it into `ready` makes stale-while-revalidate
 * invisible to the UI, and collapsing it into `loading` makes a background
 * refresh flash a spinner over good data.
 */
export type Status = 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';

/**
 * A string is not an error type. The spike produced a silent data loss that no
 * `string` could have expressed, and Starlume's online-policy gate means
 * "refused by policy" is a different UI message from "network failed".
 */
export type KitError =
	| { kind: 'offline'; message?: string }
	/** An app policy gate refused the call — NOT a network failure. */
	| { kind: 'blocked-by-policy'; reason?: string; message?: string }
	| { kind: 'auth-expired'; message?: string }
	/** Field-level detail, because a form needs to know *which* field. */
	| { kind: 'validation'; fields?: Record<string, string>; message?: string }
	/**
	 * The write succeeded and returned something other than what was asked for —
	 * another writer won. Carries both sides so the UI can say what was lost.
	 */
	| {
			kind: 'write-diverged';
			requested: Record<string, unknown>;
			returned: Record<string, unknown>;
			diverged: string[];
			message?: string;
	  }
	| { kind: 'unknown'; cause: unknown; message?: string };

export type Unsubscribe = () => void;

/** What a backend tells us changed. Everything is optional: stibu's events
 *  carry neither scope nor keys, and the collection degrades to "reload all". */
export type ChangeInfo<K, S> = {
	scope?: S;
	keys?: K[];
	/**
	 * What happened, when the backend can say.
	 *
	 * `delete` + keys is the tier-2 deletion path: the records are removed from
	 * the cache and every live set locally, with NO refetch. Other kinds with
	 * keys refresh just those records via `fetchOne`. Absent — or keys absent —
	 * the collection degrades to reloading the affected sets, exactly as before.
	 */
	kind?: 'create' | 'update' | 'delete';
};

/**
 * Write semantics are DECLARED, not assumed.
 *
 * connect-neo's contract assumed PATCH (server merges). stibu's update requires
 * every field — a full replace. The spike had to merge the partial body against
 * the store's own cache *inside the IO adapter*, which meant the adapter needed
 * read access to the store it was being passed into: a circular reference
 * resolved with a lazy getter, i.e. exactly the workaround the kit exists to
 * prevent. Declaring the semantics lets the STORE own the merge, because the
 * store is what owns the cache.
 */
export type WriteSemantics = 'patch' | 'replace';

export type WriteIO<T, K extends string | number, S, B> = {
	semantics: WriteSemantics;
	/** For `replace`, `body` arrives already merged over the cached record. */
	save: (key: K, body: B, scope: S) => Promise<T>;
	create?: (body: B, scope: S) => Promise<T>;
	/**
	 * Whether a requested/returned pair counts as divergence.
	 *
	 * Defaults to `!==`. Override when the server normalises writes — connect-neo
	 * trims text on write, so `" x "` legitimately comes back `"x"` and a naive
	 * comparison would cry wolf. `() => false` disables detection entirely.
	 */
	isDiverged?: (field: string, requested: unknown, returned: unknown) => boolean;
};

/**
 * A working set's declaration. Together with the scope this IS the set's
 * identity — two sets with equal declarations are the same set, and any change
 * makes a different one.
 *
 * ⚑ `order` is in here deliberately, and it is the non-obvious member. Switching
 * sort on an INCOMPLETE set is not a re-ordering, it is a different query: you
 * want *the 2 000 largest fines*, not "the newest 2 000, re-sorted by fine". The
 * cheap alternative silently answers "biggest fines" with "biggest fines among
 * recent orders", which is the truncated-count lie wearing a different hat.
 */
export type SetQuery = {
	/** Pushed-down predicates. Canonicalised into the set key. */
	where?: Record<string, string | string[]>;
	/** Free text. Separate from `where` because it debounces differently. */
	search?: string;
	/** Part of the set's identity — see above. */
	order?: { by: string; dir?: 'asc' | 'desc' };
	/** Overrides the collection's default cap for this set. */
	cap?: number;
};

/**
 * One accumulation step.
 *
 * `cursor` is opaque and the kit only round-trips it. In practice it is the last
 * row's sort key — **keyset paging**, which is what you write against SQLite,
 * TrailBase or Postgres and what stibu's `TrailBaseRepo::fetch_all_keyset`
 * already does. Not offset paging, which drifts when rows are inserted mid-
 * accumulation.
 */
export type FetchRequest<S> = {
	scope: S;
	query: SetQuery;
	/** How many more records this call should return. */
	limit: number;
	/** Whatever the previous page returned; absent on the first call. */
	cursor?: string;
};

export type FetchPage<T> = {
	records: T[];
	/**
	 * The sort key this page STARTED from, when continuing from a cursor.
	 *
	 * ⚑ Needed for deletion reconciliation, which works over the key INTERVAL a
	 * fill covered. Without it the interval's start is implicit and a
	 * cursor-continued page silently under-covers: rows between the cursor and
	 * the first returned row would never be reconciled. Omit on the first page,
	 * where the interval starts at the beginning of the result.
	 */
	from?: string;
	/** Continuation token. Absent means the source is exhausted. */
	cursor?: string;
	/**
	 * Rows matching the query on the server.
	 *
	 * Normally present: `COUNT(*)` over an indexed predicate is cheap on SQLite,
	 * TrailBase and Postgres, and TrailBase/Appwrite-shaped APIs return it with
	 * the page anyway. Optional only for the rare source where counting is
	 * genuinely expensive (connect-neo's Snowflake), where completeness falls
	 * back to the source reporting exhaustion.
	 */
	total?: number;
	/** Explicit end-of-data, for sources that say so rather than implying it. */
	done?: boolean;
};

export type CollectionIO<T, K extends string | number, S = void, B = Partial<T>> = {
	keyOf: (record: T) => K;
	/**
	 * The simple path: everything, one call, always complete. Sufficient for
	 * every collection in the fleet today, and the only thing an adapter must
	 * supply if it cannot page.
	 */
	fetchAll?: (scope: S) => Promise<T[]>;
	/**
	 * The paged path. Called repeatedly until the source is exhausted or the cap
	 * is reached — **accumulation, not pagination**: the client still ends up
	 * holding the set, so client-side filtering and contextual counts survive.
	 *
	 * An adapter supplying this is expected to honour the whole request. There is
	 * no capability negotiation, because every backend here is one we write —
	 * reached over Tauri IPC or HTTP, backed by SQLite, TrailBase or Postgres.
	 * Whether a predicate can be pushed down is knowledge the *app* has, and it
	 * belongs in the surface descriptor that declares the predicate, not in a
	 * handshake.
	 */
	fetchPage?: (req: FetchRequest<S>) => Promise<FetchPage<T>>;
	/** One record by key — a deep link, or a hit from a server-side search that
	 *  belongs to no working set the client holds. */
	fetchOne?: (key: K, scope: S) => Promise<T>;

	/** Omit for a read-only collection — catalogs never write. */
	write?: WriteIO<T, K, S, B>;

	/**
	 * Backend invalidation. stibu emits a Tauri event per write; TrailBase
	 * pushes realtime; a plain request/response API has none, and the collection
	 * is then simply fetch-once.
	 *
	 * ⚑ AN ADAPTER OVER A LOSSY CHANNEL MUST CALL `onChange()` WITH NO ARGUMENT
	 * ON EVERY RECONNECT. This is the whole contract for SSE/WebSocket
	 * transports and it is not optional: a dropped connection means missed
	 * events, so a silent reconnect leaves the cache stale *with no way to know
	 * it is* — the silent staleness this primitive exists to prevent. No new
	 * API is needed because every field of `ChangeInfo` is optional: an
	 * argument-less call already means "something changed, I cannot say what",
	 * and the collection reloads every declaration it holds. What began as a
	 * concession to a backend with uninformative events is exactly the right
	 * recovery primitive for a connection that can drop.
	 *
	 * In-process transports (Tauri IPC) cannot lose an event and have nothing
	 * to do here.
	 */
	subscribe?: (onChange: (info?: ChangeInfo<K, S>) => void) => Unsubscribe | Promise<Unsubscribe>;

	/**
	 * Map a transport error onto a `KitError`. Apps already have their own error
	 * types (stibu throws `Error(string)`, connect-neo has `ApiError`) and should
	 * not have to rewrite them; anything unclassified becomes `unknown`.
	 */
	classifyError?: (e: unknown) => KitError | undefined;
};

export type CollectionOptions<T, S> = {
	/**
	 * Reactive scope. Read INSIDE the accessors, so Svelte tracks it and a scope
	 * change re-renders into a different cache entry. Omit for a single-scope
	 * collection.
	 */
	scope?: () => S;
	/** Required when scope is not already a usable key (compound scopes). */
	scopeKey?: (scope: S) => string;
	/**
	 * Evaluate a pushed-down query against a record we already hold, locally.
	 *
	 * ⚑ This is what stops a search blanking a list that visibly already contains
	 * matches. Type "Greta" over a list with a Greta in it and the server round
	 * trip should not hide the row you were looking at — the rows we hold that
	 * match ARE a correct partial answer to the new query, arriving instantly.
	 *
	 * The kit cannot do this itself: `search` and `where` are opaque strings it
	 * only forwards, and which fields they mean is the app's knowledge.
	 *
	 * ⚑ This is the DEFINITION of a set, not an optimisation. Rows are derived by
	 * running this over the cache; the server fetch exists to make sure the cache
	 * holds enough records for that derivation to be complete, and must agree
	 * with this predicate. A backend that cannot express the query is not a
	 * blocker — over-fetch and let this filter locally.
	 *
	 * Omit it only for a collection with no pushed-down predicates, where every
	 * cached record in scope belongs to the one set.
	 */
	matches?: (record: T, query: SetQuery) => boolean;
	/**
	 * Comparator for a set's order. Mandatory alongside `matches`, because the
	 * derivation sorts locally — the server's ordering is an accelerator, not the
	 * source of the row order.
	 */
	compare?: (order: SetQuery['order']) => (a: T, b: T) => number;
	/**
	 * How many records to accumulate before stopping and reporting the set
	 * incomplete. A **row count, not a time budget** — a time budget makes the
	 * set non-deterministic (same query, different contents depending on the
	 * connection), which breaks the property the whole model rests on.
	 *
	 * It bounds fetch time and memory, NOT the DOM — progressive reveal handles
	 * rendering, and the two budgets are independent.
	 */
	cap?: number;
	/** Records per accumulation call. */
	pageSize?: number;
};

/**
 * A working set: a declared query plus what we know about answering it.
 *
 * ⚑ It holds KEYS, not records. Records live once in the collection's cache, so
 * visiting many predicate combinations costs a few arrays of strings rather
 * than N copies of the data — which is what makes a combination space
 * affordable, and what retracts the earlier worry about explicit-only eviction.
 */
export type WorkingSet<K> = {
	/**
	 * Keys the SERVER has confirmed for this set, in its order.
	 *
	 * ⚑ No longer what gets rendered. Rows are derived from the cache through
	 * `matches` + `compare`; this is kept because it records what the fill
	 * actually returned, which is what deletion reconciliation diffs against.
	 */
	readonly keys: K[];
	/** Key interval the fills have covered, for reconciliation. */
	readonly coveredFrom?: string;
	readonly coveredTo?: string;
	/** Why the last fill stopped. Replaces the tracked `complete`. */
	readonly stopped?: 'exhausted' | 'capped';
	/**
	 * Rows the server has handed us for this set.
	 *
	 * ⚑ NOT `keys.length`, and the difference is load-bearing twice over: a
	 * cursor source re-emits rows at page boundaries so dedupe makes keys fewer,
	 * and completeness must be measured against what was FETCHED rather than
	 * what is rendered — deriving it downstream would make every client-side
	 * filter read as "there is more on the server".
	 */
	readonly fetchedCount: number;
	/** Matching records on the server, when the adapter supplies one. A snapshot
	 *  from query time, deliberately not maintained as pages arrive. */
	readonly total?: number;
	/**
	 * When this set's fill last SUCCEEDED, as `Date.now()`.
	 *
	 * ⚑ A property of the set, not of the connection — which is what makes it
	 * meaningful on every transport. Over SSE an event-driven refresh keeps
	 * bumping it, so it stops advancing exactly when updates stop arriving;
	 * over Tauri IPC it simply says how long ago the data was confirmed.
	 *
	 * Note what it does NOT mean: old is not the same as stale. A set nobody
	 * has changed in an hour is an hour old and perfectly correct. Surfaces
	 * should present it as "as of", never as a warning.
	 */
	readonly updatedAt?: number;
	/**
	 * ⚑ There is no `complete` here, deliberately. It was a required boolean
	 * that nothing maintained once `stopped` replaced it — so it read `false`
	 * forever, including on sets that held everything. A required field that
	 * always lies is worse than an absent one: the next reader believes it.
	 * Completeness is `stopped === 'exhausted'`, derived at the view.
	 */
	readonly status: Status;
	readonly error?: KitError;
	/** Continuation for the next accumulation step, when there is one. */
	readonly cursor?: string;
};

/** @deprecated The pre-working-set shape. Kept so the name still resolves while
 *  consumers migrate; `WorkingSet` plus the record cache replaces it. */
export type Entry<T> = {
	readonly data: T[];
	readonly status: Status;
	readonly error?: KitError;
};

/** The read surface for one working set — what `at()` returns, and what the
 *  ambient accessors delegate to. */
export type ScopedView<T, K extends string | number> = {
	readonly all: T[];
	readonly status: Status;
	readonly error: KitError | undefined;
	/** `ready` or `refreshing` — i.e. "there is data worth rendering". */
	readonly hasData: boolean;
	/**
	 * Why the last fill stopped — the whole of what `complete` used to track.
	 *
	 * ⚑ `exhausted` means the server had nothing more, so we hold everything
	 * matching. `capped` means we stopped ourselves and there is more.
	 * `undefined` means no fill has finished yet. A readout, not an invariant.
	 *
	 * A boolean `complete` conflated the two reasons, needed three rules to
	 * compute, and still leaked under over-fetch-and-filter-locally because it
	 * compared `fetched >= total` and `total` then counted the wider query.
	 * Nothing compares counts any more.
	 */
	readonly stopped: 'exhausted' | 'capped' | undefined;
	/** A fill is running. Rows are still readable throughout. */
	readonly fetching: boolean;
	/** Convenience for the common check. Derived, never stored. */
	readonly complete: boolean;
	readonly fetchedCount: number;
	readonly total: number | undefined;
	/** When this set's fill last succeeded — see `WorkingSet.updatedAt`. "As
	 *  of", never a staleness warning. */
	readonly updatedAt: number | undefined;
	/** Whether another accumulation step would yield more. */
	readonly hasMore: boolean;
	byKey(key: K): T | undefined;
};
