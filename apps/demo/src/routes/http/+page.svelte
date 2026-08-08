<script lang="ts">
	/**
	 * Loans over HTTP + SSE — the same surface `/loans` renders over Tauri IPC.
	 *
	 * This page exists to be COMPARED, not to be pretty. Everything below the
	 * `CollectionIO` is identical to the Tauri path: same primitive, same
	 * descriptor shape, same `Surface.List`. If the two ever diverge, the
	 * contract leaked.
	 *
	 * It also carries the one control the Tauri transport has no use for:
	 * "Drop streams", which severs every SSE connection server-side so the
	 * reconnect contract can be watched rather than assumed.
	 */
	import { page } from '$app/state';
	import { getKitContext, createBrowseState, Surface, type Row } from '@veelume/ui';
	import {
		API,
		httpLoans,
		setHttpLoanYear,
		returnLoanHttp,
		cancelLoanHttp,
		markLostHttp,
		archiveLoanHttp,
		createLoanHttp,
		resetLoansHttp,
		dropStreams
	} from '$lib/loans-http.svelte';
	import type { Loan } from '$lib/fixtures/loans';

	const kit = getKitContext();

	type LoanRow = Row & { loan: Loan };

	const YEARS = ['2024', '2025', '2026'];
	const year = $derived(page.url.searchParams.get('year') ?? '2025');
	$effect(() => setHttpLoanYear(year));

	const browse = createBrowseState({
		q: { kind: 'text' },
		status: { kind: 'many' },
		sort: { kind: 'one', default: 'due', narrows: false }
	});

	const descriptor = {
		sources: () => httpLoans.all,
		derive: (records: Loan[]): LoanRow[] =>
			records.map((l) => ({
				key: l.id,
				title: l.title,
				subtitle: `${l.borrower || '—'} · ${l.due_on}`,
				trailing: l.fine_cents
					? kit.format.number(l.fine_cents / 100, { style: 'currency', currency: 'EUR' })
					: undefined,
				badge: l.status,
				loan: l
			})),
		searchIn: (r: LoanRow) => [r.title, r.loan.borrower],
		facets: [
			{
				id: 'status',
				label: 'Status',
				mode: 'many' as const,
				options: ['draft', 'out', 'returned', 'lost', 'archived'].map((s) => ({
					value: s,
					label: s,
					test: (r: LoanRow) => r.loan.status === s
				}))
			}
		],
		sorts: [
			{
				value: 'due',
				label: 'Due date',
				compare: (a: LoanRow, b: LoanRow) => a.loan.due_on.localeCompare(b.loan.due_on)
			},
			{
				value: 'borrower',
				label: 'Borrower',
				compare: (a: LoanRow, b: LoanRow) => a.loan.borrower.localeCompare(b.loan.borrower)
			}
		]
	};

	let message = $state<string | null>(null);
	let selected = $state<string | null>(null);

	async function act(label: string, run: () => Promise<unknown>) {
		message = null;
		try {
			await run();
			message = `${label} ok`;
		} catch (e) {
			const err = e as { kind?: string; message?: string };
			message = `${label} failed: ${err.kind ?? ''} ${err.message ?? e}`;
		}
	}
</script>

<div class="flex h-full min-h-0 flex-col gap-3 p-4">
	<header class="flex flex-wrap items-center gap-2">
		<h1 class="text-lg font-semibold">Loans · HTTP + SSE</h1>
		<a class="text-sm underline underline-offset-2" href="/loans">same surface over Tauri IPC</a>
		<code class="rounded bg-muted px-1 text-xs">{API}</code>
	</header>

	<p class="text-xs text-muted-foreground">
		Needs the backend: <code class="rounded bg-muted px-1">just serve</code>. Same seeded loans,
		same domain methods — only the transport differs.
	</p>

	<div class="flex flex-wrap items-center gap-2">
		<div class="flex rounded-md border border-input p-0.5 text-sm">
			{#each YEARS as y (y)}
				<a
					class="rounded px-2 py-1 {year === y ? 'bg-accent text-accent-foreground' : ''}"
					href="/http?year={y}">{y}</a
				>
			{/each}
		</div>
		<button
			type="button"
			class="h-9 rounded-md border border-input px-3 text-sm hover:bg-muted"
			onclick={() => act('Reset', () => resetLoansHttp())}>Reset data</button
		>
		<!-- The reconnect probe. Severing the stream is the only way to watch the
		     contract that says a reconnect must re-invalidate. -->
		<button
			type="button"
			class="h-9 rounded-md border border-input px-3 text-sm hover:bg-muted"
			onclick={() => act('Drop streams', () => dropStreams())}>Drop streams</button
		>
		{#if message}
			<span class="text-xs text-muted-foreground">{message}</span>
		{/if}
	</div>

	<Surface.Root {descriptor} {browse} {selected} class="min-h-0 flex-1">
		<Surface.List
			status={httpLoans.status}
			fetching={httpLoans.status === 'loading' || httpLoans.status === 'refreshing'}
			hasMore={httpLoans.hasMore}
			onloadmore={() => httpLoans.loadMore()}
			updatedAt={httpLoans.updatedAt}
			onrefresh={() => httpLoans.refresh()}
			action={{ label: 'New loan', onclick: () => act('Create', createLoanHttp) }}
			onselect={(r) => (selected = r.key)}
		/>
	</Surface.Root>

	{#if selected}
		{@const loan = httpLoans.byKey(selected)}
		{#if loan}
			<div class="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
				<span class="text-sm font-medium">{loan.title}</span>
				<span class="text-xs text-muted-foreground">{loan.status}</span>
				<!-- The four closers, over HTTP. Each is one POST; the SSE event
				     does the cache work, exactly as the Tauri event does. -->
				<button
					type="button"
					class="ml-auto h-8 rounded-md border border-input px-2 text-xs hover:bg-muted"
					onclick={() => act('Return', () => returnLoanHttp(loan.id))}>Return</button
				>
				<button
					type="button"
					class="h-8 rounded-md border border-input px-2 text-xs hover:bg-muted"
					disabled={loan.status !== 'draft'}
					onclick={() => act('Cancel', () => cancelLoanHttp(loan.id))}>Cancel draft</button
				>
				<button
					type="button"
					class="h-8 rounded-md border border-input px-2 text-xs hover:bg-muted"
					onclick={() => act('Mark lost', () => markLostHttp(loan.id))}>Mark lost</button
				>
				<button
					type="button"
					class="h-8 rounded-md border border-input px-2 text-xs hover:bg-muted"
					onclick={() => act('Archive', () => archiveLoanHttp(loan.id))}>Archive</button
				>
			</div>
		{/if}
	{/if}
</div>
