/**
 * The HTTP + SSE transport — one of the kit's two, beside Tauri IPC.
 *
 * The backend's *language* is not this module's business: Axum, Litestar and
 * anything else that honours the wire contract look identical from here. What
 * this module owns is precisely the part that must not be re-invented per app:
 *
 *  - **the reconnect discipline** (the one genuinely new problem HTTP brings),
 *  - **status → `KitError`** classification,
 *  - fetch/JSON plumbing.
 *
 * What it deliberately does NOT own is **URL and parameter building**, because
 * that is exactly what differs between backends — Axum's routes, Litestar's,
 * TrailBase's `filter[col][$op]=` syntax. The app supplies `routes`; a kit that
 * guessed here would be generalising instance #1.
 *
 * Plain `.ts` — no runes. Reactivity belongs to the collection, not the wire.
 */

import type { ChangeInfo, CollectionIO, FetchPage, FetchRequest, KitError } from './types.js';

/** A request the app describes and this module performs. */
export type HttpCall = {
	url: string;
	method?: string;
	/** Serialised as JSON when present. */
	body?: unknown;
};

export type HttpRoutes<T, K extends string | number, S, B> = {
	/** Where a page of the set lives. The response must BE a `FetchPage`. */
	page: (req: FetchRequest<S>) => string | HttpCall;
	/** One record by key — a deep link, or a server-search hit. */
	one?: (key: K, scope: S) => string | HttpCall;
	save?: (key: K, body: B, scope: S) => HttpCall;
	create?: (body: B, scope: S) => HttpCall;
};

export type SseOptions<K, S> = {
	/** The stream's URL. */
	url: string;
	/**
	 * The `event:` name to listen for. Omit for unnamed messages.
	 *
	 * ⚑ A named event on the server with no `eventName` here is silent
	 * failure: `EventSource` routes it to a listener nobody registered, so the
	 * stream connects, stays healthy, and delivers nothing.
	 */
	eventName?: string;
	/**
	 * Map one message onto a `ChangeInfo`. Defaults to the wire contract's own
	 * shape (`{ kind, keys, scope }`); supply this when the backend names its
	 * scope after the domain (`year`, `account`) as ours does.
	 */
	parse?: (data: unknown) => ChangeInfo<K, S> | undefined;
};

export type HttpIOOptions<T, K extends string | number, S, B> = {
	keyOf: (record: T) => K;
	routes: HttpRoutes<T, K, S, B>;
	/** `replace` sends the whole record; `patch` sends the changed fields. */
	semantics?: 'patch' | 'replace';
	/** Live invalidation. Omit for a fetch-once collection. */
	events?: SseOptions<K, S>;
	/** Injected so an app can add auth, tracing or a test double. */
	fetch?: typeof globalThis.fetch;
	/** Evaluated per request, so a rotating token is never captured stale. */
	headers?: () => HeadersInit;
};

/**
 * Map a failed response or a thrown fetch onto the kit's error union.
 *
 * Exported because an app that hand-rolls its `CollectionIO` still wants the
 * same mapping — a surface that renders "offline" for an expired session is a
 * lie regardless of who built the adapter.
 */
export async function classifyHttpError(e: unknown): Promise<KitError> {
	// `fetch` rejects only on a transport failure — DNS, refused, aborted mid
	// flight. A 500 is a resolved promise, so anything landing here is the
	// network rather than the server.
	if (!(e instanceof Response)) {
		return { kind: 'offline', message: e instanceof Error ? e.message : String(e) };
	}
	const body = await e
		.clone()
		.json()
		.catch(() => undefined);
	const message =
		(body && typeof body === 'object' && 'message' in body && String(body.message)) ||
		`${e.status} ${e.statusText}`;

	if (e.status === 401) return { kind: 'auth-expired', message };
	if (e.status === 403) return { kind: 'blocked-by-policy', message };
	if (e.status === 400 || e.status === 409 || e.status === 422) {
		const fields =
			body && typeof body === 'object' && 'fields' in body
				? (body.fields as Record<string, string>)
				: undefined;
		return { kind: 'validation', fields, message };
	}
	return { kind: 'unknown', cause: e, message };
}

/**
 * Subscribe to an SSE invalidation stream, with the reconnect contract built in.
 *
 * ⚑ THE RECONNECT IS THE POINT. A dropped connection means missed events, so a
 * silently-reconnecting stream leaves the cache stale with no way to know it
 * is. `EventSource` reconnects on its own and fires `open` each time it
 * succeeds — so every open *after the first* is a gap, and the collection is
 * told with an argument-less `onChange()`: "something changed, I cannot say
 * what". Its existing degradation path reloads every declaration.
 *
 * Exported separately from `createHttpIO` because the discipline is what
 * matters, not the packaging: an app with a hand-built IO should still get it.
 */
export function sseInvalidation<K, S>(
	options: SseOptions<K, S>,
	onChange: (info?: ChangeInfo<K, S>) => void
): () => void {
	const parse =
		options.parse ??
		((data: unknown) => (data ?? undefined) as ChangeInfo<K, S> | undefined);

	const source = new EventSource(options.url);
	let everOpened = false;

	source.addEventListener('open', () => {
		if (everOpened) onChange();
		everOpened = true;
	});

	source.addEventListener(options.eventName ?? 'message', (ev) => {
		const raw = (ev as MessageEvent).data;
		let data: unknown = raw;
		try {
			data = JSON.parse(raw);
		} catch {
			// A non-JSON payload is still a change signal; the argument-less
			// call is the honest report of "something, unspecified".
			onChange();
			return;
		}
		onChange(parse(data));
	});

	// No `onerror` handling on purpose: `EventSource` retries by itself, and
	// the retry's `open` is what reports the gap. Closing here would turn a
	// blip into a permanently stale cache.

	return () => source.close();
}

/** Build a `CollectionIO` over HTTP. */
export function createHttpIO<
	T,
	K extends string | number,
	S = void,
	B extends Record<string, unknown> = Partial<T> & Record<string, unknown>
>(options: HttpIOOptions<T, K, S, B>): CollectionIO<T, K, S, B> {
	const doFetch = options.fetch ?? ((...a: Parameters<typeof fetch>) => globalThis.fetch(...a));
	const asCall = (c: string | HttpCall): HttpCall => (typeof c === 'string' ? { url: c } : c);

	/**
	 * ⚑ Errors are classified HERE rather than through `CollectionIO.
	 * classifyError`, and the reason is a signature: reading a validation
	 * body is async, `classifyError` is sync. So everything this adapter
	 * throws is already a `KitError` — which the store's `toKitError` passes
	 * straight through, because it recognises anything carrying a `kind`.
	 */
	async function send<R>(call: HttpCall): Promise<R> {
		const headers = new Headers(options.headers?.() ?? {});
		if (call.body !== undefined) headers.set('content-type', 'application/json');

		let res: Response;
		try {
			res = await doFetch(call.url, {
				method: call.method ?? (call.body !== undefined ? 'POST' : 'GET'),
				headers,
				body: call.body !== undefined ? JSON.stringify(call.body) : undefined
			});
		} catch (e) {
			// `fetch` rejects only on transport failure — a 500 resolves.
			throw await classifyHttpError(e);
		}
		if (!res.ok) throw await classifyHttpError(res);
		// 204 is the honest answer for the closers that return nothing.
		if (res.status === 204) return undefined as R;
		return (await res.json()) as R;
	}

	return {
		keyOf: options.keyOf,
		fetchPage: (req) => send<FetchPage<T>>(asCall(options.routes.page(req))),
		fetchOne: options.routes.one
			? (key, scope) => send<T>(asCall(options.routes.one!(key, scope)))
			: undefined,
		write: options.routes.save
			? {
					semantics: options.semantics ?? 'replace',
					save: (key, body, scope) => send<T>(options.routes.save!(key, body, scope)),
					create: options.routes.create
						? (body, scope) => send<T>(options.routes.create!(body, scope))
						: undefined
				}
			: undefined,
		subscribe: options.events
			? (onChange) => sseInvalidation(options.events!, onChange)
			: undefined
	};
}
