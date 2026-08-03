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
export type ChangeInfo<K, S> = { scope?: S; keys?: K[] };

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

export type CollectionIO<T, K extends string | number, S = void, B = Partial<T>> = {
	keyOf: (record: T) => K;
	fetchAll: (scope: S) => Promise<T[]>;
	fetchOne?: (key: K, scope: S) => Promise<T>;

	/** Omit for a read-only collection — catalogs never write. */
	write?: WriteIO<T, K, S, B>;

	/**
	 * Backend invalidation. stibu emits a Tauri event per write; TrailBase
	 * pushes realtime; a plain request/response API has none, and the collection
	 * is then simply fetch-once.
	 */
	subscribe?: (onChange: (info?: ChangeInfo<K, S>) => void) => Unsubscribe | Promise<Unsubscribe>;

	/**
	 * Map a transport error onto a `KitError`. Apps already have their own error
	 * types (stibu throws `Error(string)`, connect-neo has `ApiError`) and should
	 * not have to rewrite them; anything unclassified becomes `unknown`.
	 */
	classifyError?: (e: unknown) => KitError | undefined;
};

export type CollectionOptions<S> = {
	/**
	 * Reactive scope. Read INSIDE the accessors, so Svelte tracks it and a scope
	 * change re-renders into a different cache entry. Omit for a single-scope
	 * collection.
	 */
	scope?: () => S;
	/** Required when scope is not already a usable key (compound scopes). */
	scopeKey?: (scope: S) => string;
};

/** One scope's slot in the cache. */
export type Entry<T> = {
	readonly data: T[];
	readonly status: Status;
	readonly error?: KitError;
};

/** The read surface for one scope — what `at()` returns, and what the ambient
 *  accessors delegate to. */
export type ScopedView<T, K extends string | number> = {
	readonly all: T[];
	readonly status: Status;
	readonly error: KitError | undefined;
	/** `ready` or `refreshing` — i.e. "there is data worth rendering". */
	readonly hasData: boolean;
	byKey(key: K): T | undefined;
};
