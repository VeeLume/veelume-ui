<script lang="ts">
	/**
	 * The extreme case — 1.5M entries, nothing hidden.
	 *
	 * This is not a showcase, it is an instrument. Every number on screen is one
	 * the working-set model claims to know, and the page's job is to make a wrong
	 * one visible: fetched vs total vs rendered, the cost of a query, the cost of
	 * building the DOM, and whether `complete` ever lies.
	 *
	 * ⚑ Every predicate here is SERVER-stage. Search, kind and order all travel in
	 * the `SetQuery` and reach the backend, because a client-side filter needs the
	 * whole set and the whole set is 1.5M rows. So this surface exercises the one
	 * thing the old "load everything and filter in a `$derived`" design could not
	 * do at all.
	 *
	 * Deliberately NOT using `Surface.Root`: the pipeline filters client-side by
	 * construction, which is exactly the wrong thing here. Wiring the surface
	 * parts to a server-stage set is the next piece of work, and pretending it
	 * already worked would hide that.
	 */
	import { untrack } from 'svelte';
	import { getKitContext, Button, createReveal } from '@veelume/ui';
	import { entries, warmStress, KINDS, ORDERS, type Entry } from '$lib/stress.svelte';

	const kit = getKitContext();

	let search = $state('');
	let kind = $state('');
	let order = $state('date');
	let desc = $state(false);
	const CAPS = [200, 1000, 2000, 5000, 10000, 20000, 100000];
	let cap = $state(10000);

	/**
	 * ⚑ Only the TEXT FIELD debounces.
	 *
	 * Debouncing everything was lazy: a checkbox or a select is a single
	 * deliberate act, and making the user wait 250ms for it to register feels
	 * broken. Typing is the only input that fires per keystroke, so it is the only
	 * one that needs holding back.
	 */
	let applied = $state({ search: '', kind: '', order: 'date', desc: false });

	let debouncedSearch = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const next = search;
		clearTimeout(timer);
		timer = setTimeout(() => (debouncedSearch = next), 250);
		return () => clearTimeout(timer);
	});

	// Discrete controls land immediately; only `search` arrives via the debounce.
	$effect(() => {
		applied = { search: debouncedSearch, kind, order, desc };
	});

	const query = $derived({
		search: applied.search || undefined,
		where: applied.kind ? { kind: applied.kind } : undefined,
		order: { by: applied.order, dir: applied.desc ? ('desc' as const) : ('asc' as const) },
		cap
	});

	const view = $derived(entries.query(query));
	const rows = $derived(view.all);

	/**
	 * Render to a paint budget rather than a row count — the point Valerie made:
	 * past a target, the answer is a better rendering strategy, not a freeze.
	 * Below the budget this does nothing at all; above it, the list fills in
	 * across frames and the page stays interactive the whole time.
	 */
	/** How long a frame may take before the reveal counts it as dropped and
	 *  halves the chunk. Lower = smoother but slower to fill. */
	let overrunMs = $state(20);
	// A getter, not the value — the same rule `scope` follows on collections. As
	// a plain value the control would be captured once and do nothing.
	const reveal = createReveal(() => rows.length, { overrunMs: () => overrunMs });
	const shown = $derived(reveal.count < rows.length ? rows.slice(0, reveal.count) : rows);

	// ── instrumentation ────────────────────────────────────────────────────────
	let warmMs = $state<number | null>(null);
	let queryMs = $state<number | null>(null);
	let paintMs = $state<number | null>(null);
	/** Plain, not `$state`. An effect that reads and writes the same state is the
	 *  textbook `effect_update_depth_exceeded`, and this one did exactly that. */
	let lastKey = '';

	const key = $derived(JSON.stringify(applied) + `|${cap}`);

	/**
	 * ⚑ `prefetch`, NOT `refresh`.
	 *
	 * This measured a forced refetch on every change, so it never once exercised
	 * the cache — switching asc↔desc and back refetched, which looked exactly
	 * like a broken cache and was actually a broken instrument. An instrument
	 * that cannot show the fast path is not measuring the thing it claims to.
	 */
	let cached = $state(false);

	$effect(() => {
		if (key === lastKey) return;
		lastKey = key;
		const t0 = performance.now();
		queryMs = null;
		paintMs = null;

		// ⚑ `untrack`, and it is not optional.
		//
		// Reading a collection view LAZILY FETCHES — `.all` and `.status` both call
		// `ensure()`, which writes the set. Reading them tracked inside an effect
		// means the write re-triggers the effect that caused it, forever. Nothing
		// in the type system hints at this: it looks like reading a property.
		untrack(() => {
			const before = entries.query(query);
			cached = before.status === 'ready' && (before.complete || before.all.length >= cap);
			entries.prefetch(undefined, query);
		});
		queueMicrotask(() => {
			const settle = () => {
				const v = entries.query(query);
				if (v.status === 'loading' || v.status === 'refreshing') {
					setTimeout(settle, 16);
					return;
				}
				queryMs = Math.round(performance.now() - t0);
				requestAnimationFrame(() =>
					requestAnimationFrame(() => (paintMs = Math.round(performance.now() - t0)))
				);
			};
			settle();
		});
	});

	async function warm() {
		warmMs = null;
		const t0 = performance.now();
		await warmStress();
		warmMs = Math.round(performance.now() - t0);
	}

	const money = (c: number) =>
		kit.format.number(c / 100, { style: 'currency', currency: 'EUR' });
</script>

<div class="flex h-full min-h-0 flex-col gap-3 p-4">
	<header class="flex flex-wrap items-center gap-2">
		<h1 class="text-lg font-semibold">Stress · 1.5M</h1>
		<Button variant="outline" onclick={warm}>Build dataset</Button>
		{#if warmMs !== null}
			<span class="text-xs text-muted-foreground">generated in {warmMs} ms</span>
		{/if}
	</header>

	<!-- Controls. Plain, because the point is the numbers below them. -->
	<div class="flex flex-wrap items-center gap-2">
		<input
			class="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm"
			placeholder="Search party or id…"
			bind:value={search}
		/>
		<select class="h-9 rounded-md border border-input bg-background px-2 text-sm" bind:value={kind}>
			<option value="">any kind</option>
			{#each KINDS as k (k)}<option value={k}>{k}</option>{/each}
		</select>
		<select class="h-9 rounded-md border border-input bg-background px-2 text-sm" bind:value={order}>
			{#each ORDERS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
		</select>
		<label class="flex items-center gap-1 text-sm">
			<input type="checkbox" bind:checked={desc} /> desc
		</label>
		<label class="flex items-center gap-1 text-sm">
			frame
			<select
				class="h-9 rounded-md border border-input bg-background px-2 text-sm"
				bind:value={overrunMs}
			>
				{#each [12, 20, 33, 100] as n (n)}<option value={n}>{n} ms</option>{/each}
			</select>
		</label>
		<label class="flex items-center gap-1 text-sm">
			cap
			<select
				class="h-9 rounded-md border border-input bg-background px-2 text-sm"
				bind:value={cap}
			>
				{#each CAPS as n (n)}<option value={n}>{n}</option>{/each}
			</select>
		</label>
	</div>

	<!--
		The honesty panel. `rendered` is separate from `fetched` on purpose: with no
		progressive reveal built yet, they are equal, and watching them stay equal
		as the cap grows is the argument for building it.
	-->
	<dl
		class="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-border bg-card p-3
		       text-sm sm:grid-cols-4"
	>
		<div><dt class="text-xs text-muted-foreground">total (server)</dt>
			<dd class="tabular-nums">{kit.format.number(view.total ?? 0)}</dd></div>
		<div><dt class="text-xs text-muted-foreground">fetched</dt>
			<dd class="tabular-nums">{kit.format.number(view.fetchedCount)}</dd></div>
		<div><dt class="text-xs text-muted-foreground">rendered</dt>
			<dd class="tabular-nums">
				{kit.format.number(reveal.count)}{#if reveal.slicing}<span
						class="text-xs text-muted-foreground"> · filling</span
					>{/if}
			</dd></div>
		<div><dt class="text-xs text-muted-foreground">complete</dt>
			<dd class={view.complete ? '' : 'text-destructive'}>{view.complete}</dd></div>
		<div><dt class="text-xs text-muted-foreground">status</dt><dd>{view.status}</dd></div>
		<div><dt class="text-xs text-muted-foreground">query</dt>
			<dd class="tabular-nums">
				{queryMs ?? '…'} ms{#if cached}<span class="text-xs text-muted-foreground"> · cached</span
					>{/if}
			</dd></div>
		<div><dt class="text-xs text-muted-foreground">to paint</dt>
			<dd class="tabular-nums">{paintMs ?? '…'} ms</dd></div>
		<div><dt class="text-xs text-muted-foreground">ms / row (info)</dt>
			<dd class="tabular-nums">{reveal.msPerRow ? reveal.msPerRow.toFixed(3) : '…'}</dd></div>
		<div><dt class="text-xs text-muted-foreground">cached records</dt>
			<dd class="tabular-nums">{kit.format.number(entries.debug.cached)}</dd></div>
	</dl>

	{#if view.preview}
		<!--
			⚑ A different axis from `complete`. These rows are held records filtered
			LOCALLY to the current query — a correct partial answer produced without
			waiting, not the previous query's list. Typing "Greta" over a list that
			visibly contains a Greta should not blank the row you were looking at.
		-->
		<div
			class="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm
			       text-muted-foreground"
		>
			<span class="size-2 animate-pulse rounded-full bg-primary"></span>
			Showing matches from what is already loaded, while the full result arrives…
		</div>
	{/if}

	{#if !view.complete && view.status === 'ready' && !view.preview}
		<!-- The truncation band, hand-rolled here until it exists in the kit. -->
		<div
			class="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
		>
			<span>
				Showing {kit.format.number(rows.length)} of {kit.format.number(view.total ?? 0)} ·
				{ORDERS.find((o) => o.value === applied.order)?.label.toLowerCase()}
				{applied.desc ? 'descending' : 'ascending'} first
			</span>
			<!--
				Raises the CAP rather than calling loadMore. The cap is now the single
				number — how many rows are wanted — so "load more" and the dropdown are
				the same control, and stepping back down is free because the extra rows
				stay held.
			-->
			<Button
				class="ml-auto"
				variant="outline"
				onclick={() => (cap = CAPS.find((n) => n > cap) ?? cap)}
				disabled={!view.hasMore || cap >= CAPS[CAPS.length - 1]}>Show more</Button
			>
		</div>
	{/if}

	<div class="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card">
		{#if view.status === 'loading' && rows.length === 0}
			<!-- Only when there is genuinely nothing to show. With `stale` in play
			     that is now rare: a filter change keeps the previous rows up as a
			     bridge until page one of the new set lands. -->
			<p class="p-4 text-sm text-muted-foreground">{kit.labels.loading()}</p>
		{:else if view.status === 'error'}
			<p class="p-4 text-sm text-destructive">{view.error?.message ?? kit.labels.errorTitle()}</p>
		{:else if rows.length === 0}
			<p class="p-6 text-center text-sm text-muted-foreground">{kit.labels.empty()}</p>
		{:else}
			<!-- Rows still all land in the DOM eventually; what changed is that they
			     arrive across frames when they exceed the budget, so the page never
			     stalls waiting for one enormous commit. -->
			<!--
				⚑ UNKEYED, deliberately.

				Keyed by id, changing the sort order destroys and recreates every row
				— thousands of nodes in one commit, which is the chug. Unkeyed, the
				each-block reuses the DOM and updates text in place, so a reorder
				costs property writes rather than allocation.

				Safe here because these rows carry no per-row component state and no
				transitions: position IS the identity. A row with an input in it
				would need the key back.
			-->
			<ul>
				{#each shown as r}
					<li
						class="flex items-baseline gap-3 border-b border-border px-3 py-1.5 text-sm
						       last:border-b-0"
					>
						<span class="w-16 shrink-0 tabular-nums text-xs text-muted-foreground">{r.id}</span>
						<span class="w-24 shrink-0 tabular-nums text-xs text-muted-foreground">{r.date}</span>
						<span class="min-w-0 flex-1 truncate">{r.party}</span>
						<span class="w-24 shrink-0 text-xs text-muted-foreground">{r.kind}</span>
						<span class="w-28 shrink-0 text-right tabular-nums">{money(r.cents)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
