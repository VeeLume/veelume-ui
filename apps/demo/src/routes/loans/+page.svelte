<script lang="ts">
	/**
	 * Archetype B — list + detail + form over one entity.
	 *
	 * The scoped counterpart to /catalog: loans are partitioned by year, so both
	 * halves of the scope design are exercised by real surfaces rather than by
	 * argument.
	 *
	 * Also where the formatting locale becomes visible: due dates and fines
	 * render through the kit context, which the demo pins to de-DE against an
	 * English UI. `1.234,56 €` and `25.06.2025` in an English interface is a
	 * state that can only exist because the two locales are independent.
	 */
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Surface, createBrowseState, getKitContext, type Row } from '@veelume/ui';
	import {
		loans,
		setLoanYear,
		loanYear,
		returnLoan,
		cancelLoan,
		markLost,
		archiveLoan
	} from '$lib/loans.svelte';
	import type { Loan, LoanStatus } from '$lib/fixtures/loans';

	const kit = getKitContext();

	type LoanRow = Row & { loan: Loan; overdue: boolean };

	const YEARS = ['2024', '2025', '2026'];

	// URL drives scope, so a shared link opens the same year.
	$effect(() => {
		setLoanYear(page.url.searchParams.get('year') ?? '2026');
	});

	const browse = createBrowseState({
		q: { kind: 'text' },
		status: { kind: 'many' },
		flag: { kind: 'many' },
		sort: { kind: 'one', default: 'due', narrows: false }
	});

	const today = new Date().toISOString().slice(0, 10);

	const descriptor = {
		sources: () => loans.all,
		// 1:1 — a CRUD surface's degenerate derive. Same signature the catalog
		// uses to collapse N records into one row.
		derive: (records: Loan[]): LoanRow[] =>
			records.map((l) => ({
				key: l.id,
				title: l.title,
				subtitle: `${l.borrower} · ${kit.format.date(l.due_on, { dateStyle: 'medium' })}`,
				trailing: l.fine_cents
					? kit.format.number(l.fine_cents / 100, { style: 'currency', currency: 'EUR' })
					: undefined,
				badge: l.status,
				href: `/loans?${new URLSearchParams({ ...Object.fromEntries(page.url.searchParams), id: l.id })}`,
				loan: l,
				// Derived, not stored — so filtering on it requires derive-then-filter
				// exactly as the catalog's `owned` does.
				overdue: l.status === 'out' && l.due_on < today
			})),
		searchIn: (r: LoanRow) => [r.title, r.loan.borrower, r.loan.note],
		facets: [
			{
				id: 'status',
				label: 'Status',
				mode: 'many' as const,
				options: (['draft', 'out', 'returned', 'lost', 'archived'] as LoanStatus[]).map((s) => ({
					value: s,
					label: s,
					test: (r: LoanRow) => r.loan.status === s
				}))
			},
			{
				id: 'flag',
				label: 'Flags',
				mode: 'many' as const,
				options: [
					{ value: 'overdue', label: 'Overdue', test: (r: LoanRow) => r.overdue },
					{ value: 'fined', label: 'Has fine', test: (r: LoanRow) => r.loan.fine_cents > 0 },
					{
						value: 'replaced',
						label: 'Replaced',
						test: (r: LoanRow) => r.loan.replaced_by !== null
					}
				]
			}
		],
		sorts: [
			{ value: 'due', label: 'Due date', compare: (a: LoanRow, b: LoanRow) => a.loan.due_on.localeCompare(b.loan.due_on) },
			{ value: 'borrower', label: 'Borrower', compare: (a: LoanRow, b: LoanRow) => a.loan.borrower.localeCompare(b.loan.borrower) },
			{ value: 'fine', label: 'Fine', compare: (a: LoanRow, b: LoanRow) => b.loan.fine_cents - a.loan.fine_cents }
		]
	};

	const selectedId = $derived(page.url.searchParams.get('id'));
	const selected = $derived(selectedId ? loans.byKey(selectedId) : undefined);

	let noteDraft = $state<string | null>(null);
	let message = $state<string | null>(null);

	const note = $derived(noteDraft ?? selected?.note ?? '');

	function withParams(patch: Record<string, string | null>) {
		const p = new URLSearchParams(page.url.searchParams);
		for (const [k, v] of Object.entries(patch)) v === null ? p.delete(k) : p.set(k, v);
		return `/loans?${p}`;
	}

	async function act(label: string, fn: () => Promise<unknown>) {
		message = null;
		try {
			const result = await fn();
			message = typeof result === 'string' ? `${label} → replacement ${result}` : `${label} ✓`;
		} catch (e) {
			const err = e as { kind?: string; message?: string };
			message = `${label} failed: ${err.message ?? err.kind ?? 'error'}`;
		}
	}

	async function saveNote() {
		if (!selectedId) return;
		await act('Saved', () => loans.save(selectedId, { note }));
		noteDraft = null;
	}
</script>

<div class="flex h-full flex-col gap-3 p-4">
	<header class="flex flex-wrap items-center gap-3">
		<h1 class="text-lg font-semibold">Loans</h1>
		<div class="flex rounded-md border border-input p-0.5 text-sm">
			{#each YEARS as y (y)}
				<a
					href={withParams({ year: y, id: null })}
					class="rounded px-2 py-1 {loanYear() === y ? 'bg-accent text-accent-foreground' : ''}"
					>{y}</a
				>
			{/each}
		</div>
		<span class="text-xs text-muted-foreground">
			scope {loanYear()} · status {loans.status} · {kit.formattingLocale} formatting
		</span>
	</header>

	<Surface.Root {descriptor} {browse} class="flex-1">
		<Surface.Toolbar />

		<Surface.Split selected={!!selectedId}>
			{#snippet list()}
				<Surface.List status={loans.status} selected={selectedId} />
			{/snippet}

			{#snippet detail()}
				<div class="h-full overflow-auto rounded-lg border border-border bg-card p-4">
					{#if selected}
						<h2 class="font-medium">{selected.title}</h2>
						<dl class="mt-3 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
							<dt class="text-muted-foreground">Borrower</dt>
							<dd>{selected.borrower}</dd>
							<dt class="text-muted-foreground">Lent</dt>
							<dd>{kit.format.date(selected.lent_on, { dateStyle: 'long' })}</dd>
							<dt class="text-muted-foreground">Due</dt>
							<dd>{kit.format.date(selected.due_on, { dateStyle: 'long' })}</dd>
							<dt class="text-muted-foreground">Fine</dt>
							<dd class="tabular-nums">
								{kit.format.number(selected.fine_cents / 100, {
									style: 'currency',
									currency: 'EUR'
								})}
							</dd>
							<dt class="text-muted-foreground">Status</dt>
							<dd>{selected.status}</dd>
							{#if selected.replaced_by}
								<dt class="text-muted-foreground">Replaced by</dt>
								<dd>
									<a class="underline" href={withParams({ id: selected.replaced_by })}
										>{selected.replaced_by}</a
									>
								</dd>
							{/if}
						</dl>

						<label class="mt-4 block text-xs text-muted-foreground" for="note">Note</label>
						<input
							id="note"
							class="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
							value={note}
							oninput={(e) => (noteDraft = e.currentTarget.value)}
						/>
						<button
							type="button"
							class="mt-2 h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground"
							onclick={saveNote}>{kit.labels.save()}</button
						>

						<!-- The four closing operations. Four commands, not one with a
						     flag: they differ in what they return and what they leave
						     behind, which is why the write layer does not own them. -->
						<div class="mt-4 border-t border-border pt-3">
							<p class="mb-2 text-xs text-muted-foreground">Closing operations</p>
							<div class="flex flex-wrap gap-2">
								<button
									type="button"
									class="h-8 rounded-md border border-input px-2 text-xs hover:bg-muted"
									onclick={() => act('Returned', () => returnLoan(selected.id))}>Return (soft)</button
								>
								<button
									type="button"
									class="h-8 rounded-md border border-input px-2 text-xs hover:bg-muted
									       disabled:opacity-40"
									disabled={selected.status !== 'draft'}
									onclick={() =>
										act('Cancelled', async () => {
											await cancelLoan(selected.id);
											await goto(withParams({ id: null }));
										})}>Cancel (hard)</button
								>
								<button
									type="button"
									class="h-8 rounded-md border border-input px-2 text-xs hover:bg-muted"
									onclick={() => act('Marked lost', () => markLost(selected.id))}
									>Mark lost (counter-doc)</button
								>
								<button
									type="button"
									class="h-8 rounded-md border border-input px-2 text-xs hover:bg-muted"
									onclick={() => act('Archived', () => archiveLoan(selected.id))}>Archive</button
								>
							</div>
							{#if message}
								<p class="mt-2 rounded bg-muted p-2 text-xs">{message}</p>
							{/if}
						</div>
					{:else}
						<p class="text-sm text-muted-foreground">Pick a loan.</p>
					{/if}
				</div>
			{/snippet}
		</Surface.Split>
	</Surface.Root>
</div>
