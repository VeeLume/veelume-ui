/**
 * The loans collection over the SECOND transport — HTTP + SSE.
 *
 * ⚑ Compare with `loans.svelte.ts` line for line. The `createCollection` call
 * is the same primitive with the same options; only the `CollectionIO` differs,
 * and it is assembled rather than hand-written. That is the whole claim: the
 * frontend is coupled to the *contract*, not to Tauri.
 *
 * The server is `src-tauri/src/demo_http.rs`, run with `just serve`, over the
 * same seeded data and the same domain methods the Tauri commands call.
 */

import { createCollection, createHttpIO } from '@veelume/ui';
import type { Loan } from './fixtures/loans.js';

/** Where `just serve` listens. Overridable so the page can point at a deployed
 *  backend without a rebuild. */
export const API =
	(typeof location !== 'undefined' && new URLSearchParams(location.search).get('api')) ||
	'http://127.0.0.1:3001';

let currentYear = $state(String(new Date().getFullYear()));

export function setHttpLoanYear(year: string): void {
	currentYear = year;
}
export function httpLoanYear(): string {
	return currentYear;
}

/** Scope travels as a query param — the app's business, not the kit's. */
const scoped = (path: string, year: string, extra: Record<string, string> = {}) => {
	const q = new URLSearchParams({ year, ...extra });
	return `${API}${path}?${q}`;
};

export const httpLoans = createCollection<Loan, string, string>(
	createHttpIO<Loan, string, string>({
		keyOf: (l) => l.id,
		routes: {
			page: ({ scope, limit, cursor }) =>
				scoped('/api/loans', scope, {
					limit: String(limit),
					...(cursor ? { cursor } : {})
				}),
			one: (id, year) => scoped(`/api/loans/${encodeURIComponent(id)}`, year),
			save: (id, body, year) => ({
				url: scoped(`/api/loans/${encodeURIComponent(id)}`, year),
				method: 'PUT',
				body
			}),
			create: (_body, year) => ({ url: scoped('/api/loans', year), method: 'POST' })
		},
		events: {
			url: `${API}/api/events`,
			// The server names its event, so this MUST be named too — an
			// unnamed listener would connect, stay healthy and hear nothing.
			eventName: 'loans-changed',
			// The domain calls its scope `year`; `ChangeInfo` calls it `scope`.
			// Mapping that is the app's job, which is why `parse` exists.
			parse: (data) => {
				const c = data as { kind?: string; keys?: string[]; year?: string };
				return {
					kind: c.kind as 'create' | 'update' | 'delete' | undefined,
					keys: c.keys,
					// A reset broadcasts an empty year: everything may have
					// changed, so leave the scope off and let every set reload.
					scope: c.year || undefined
				};
			}
		}
	}),
	{ scope: () => currentYear, cap: 100, pageSize: 3 }
);

/** The four closers, over HTTP. Each is one POST; the SSE event does the rest. */
const closer = (id: string, verb: string) =>
	fetch(scoped(`/api/loans/${encodeURIComponent(id)}/${verb}`, currentYear), { method: 'POST' });

export const returnLoanHttp = (id: string) => closer(id, 'return');
export const markLostHttp = (id: string) => closer(id, 'mark-lost');
export const archiveLoanHttp = (id: string) => closer(id, 'archive');

/** Tier-1 deletion: we did it, so the record leaves locally the moment the
 *  server confirms. The keyed `delete` event lands right after and finds
 *  nothing to remove — which is what makes the two tiers compose. */
export async function cancelLoanHttp(id: string): Promise<void> {
	const res = await closer(id, 'cancel');
	if (!res.ok) throw new Error(await res.text());
	httpLoans.discard(id);
}

export async function createLoanHttp(): Promise<string> {
	const made = await httpLoans.create({} as never);
	return made.id;
}

export const resetLoansHttp = () => fetch(`${API}/api/loans/reset`, { method: 'POST' });

/**
 * Drop every SSE connection server-side.
 *
 * The reconnect path is the one genuinely new thing this transport brings, and
 * an untestable recovery path is an unimplemented one — so the server makes it
 * a button, the way `probes_hijack` does for write divergence.
 */
export const dropStreams = () => fetch(`${API}/api/debug/drop-streams`, { method: 'POST' });
