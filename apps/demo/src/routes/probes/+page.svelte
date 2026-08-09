<script lang="ts">
	/**
	 * First real consumer of the L2 surface parts.
	 *
	 * Probes are a test rig, not the demo's domain (that is works/editions/loans)
	 * — but they exercise the whole spine end to end: a scoped collection feeding
	 * a derive step, facets with contextual counts, URL-backed browse state, and
	 * the responsive list/detail split.
	 */
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { invoke } from '@tauri-apps/api/core';
	import { createCollection, createBrowseState, Surface, type Row } from '@veelume/ui';

	type Probe = { id: string; name: string; note: string };
	type ProbeRow = Row & { note: string };

	// Scope comes from the URL, which the reactive-getter design makes free —
	// the collection reads it, and switching scopes is just a different entry.
	const scope = $derived(page.url.searchParams.get('scope') ?? 'alpha');

	const probes = createCollection<Probe, string, string>(
		{
			keyOf: (p) => p.id,
			fetchAll: (s) => invoke('probes_list', { scope: s }),
			write: {
				semantics: 'replace',
				save: (_id, body, s) => invoke('probes_save', { body, scope: s })
			}
		},
		{ scope: () => scope }
	);

	const browse = createBrowseState({
		q: { kind: 'text' },
		state: { kind: 'many' },
		sort: { kind: 'one', default: 'name', narrows: false }
	});

	const descriptor = {
		sources: () => probes.all,
		// 1:1 here. A catalog would collapse N records into one row instead —
		// same signature, which is the point.
		derive: (records: Probe[]): ProbeRow[] =>
			records.map((p) => ({
				key: p.id,
				title: p.name,
				subtitle: p.note,
				note: p.note,
				href: `/probes?${new URLSearchParams({ ...Object.fromEntries(page.url.searchParams), id: p.id })}`
			})),
		searchIn: (r: ProbeRow) => [r.title, r.note],
		facets: [
			{
				id: 'state',
				label: 'Note',
				mode: 'many' as const,
				options: [
					{ value: 'initial', label: 'Untouched', test: (r: ProbeRow) => r.note === 'initial' },
					{ value: 'edited', label: 'Edited', test: (r: ProbeRow) => r.note !== 'initial' }
				]
			}
		],
		sorts: [
			{
				value: 'name',
				label: 'Name',
				compare: (a: ProbeRow, b: ProbeRow) => a.title.localeCompare(b.title)
			},
			{
				value: 'name-desc',
				label: 'Name ↓',
				compare: (a: ProbeRow, b: ProbeRow) => b.title.localeCompare(a.title)
			}
		]
	};

	const selectedId = $derived(page.url.searchParams.get('id'));
	const selected = $derived(selectedId ? probes.byKey(selectedId) : undefined);

	let draft = $state('');
	let lastError = $state<string | null>(null);

	function switchScope(next: string) {
		const p = new URLSearchParams(page.url.searchParams);
		p.set('scope', next);
		p.delete('id');
		void goto(`/probes?${p}`, { keepFocus: true, noScroll: true });
	}

	async function save() {
		if (!selectedId) return;
		lastError = null;
		try {
			await probes.save(selectedId, { note: draft });
		} catch (e) {
			const err = e as { kind?: string; diverged?: string[]; returned?: Record<string, unknown> };
			lastError =
				err.kind === 'write-diverged'
					? `Overwritten by another writer on: ${err.diverged?.join(', ')} → "${err.returned?.note}"`
					: `${err.kind ?? 'error'}`;
		}
	}

	async function hijackNext() {
		await invoke('probes_hijack', { patch: { note: 'OTHER WRITER' } });
	}

	// ── the paged rig: search escalation, observable ───────────────────────────
	//
	// Same primitive as /stress, scaled down to 40 records so BOTH regimes of
	// the search escalation are reachable deterministically:
	//
	//   cap 20  → the base set stops `capped`, so every search term is a
	//             pushed-down set — watch `sets` climb per keystroke.
	//   cap 100 → raising the cap EXTENDS the same base set (cap is depth, not
	//             identity) until it exhausts; from then on typing narrows
	//             locally and mints nothing.
	//
	// "Forget all" drops sets and cache so the sequence can be replayed.
	const paged = createCollection<Probe, string>(
		{
			keyOf: (p) => p.id,
			fetchPage: ({ query, limit, cursor }) =>
				invoke('probes_page', { search: query.search ?? '', limit, cursor: cursor ?? null })
		},
		{
			pageSize: 10,
			matches: (p, q) => {
				const needle = (q.search ?? '').trim().toLowerCase();
				return (
					!needle || p.name.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle)
				);
			},
			compare: () => (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
		}
	);

	let rigCap = $state(20);
	let rigSearch = $state('');
	const rig = $derived(paged.query({ search: rigSearch.trim() || undefined, cap: rigCap }));
</script>

<div class="flex h-full flex-col gap-3 p-4">
	<header class="flex items-center gap-3">
		<h1 class="text-lg font-semibold">Probes</h1>
		<div class="flex rounded-md border border-input p-0.5 text-sm">
			{#each ['alpha', 'beta'] as s (s)}
				<button
					type="button"
					class="rounded px-2 py-1 {scope === s ? 'bg-accent text-accent-foreground' : ''}"
					onclick={() => switchScope(s)}>{s}</button
				>
			{/each}
		</div>
		<span class="text-xs text-muted-foreground">status: {probes.status}</span>
	</header>

	<Surface.Root {descriptor} {browse} selected={selectedId} class="flex-1">
		<Surface.Toolbar>
			{#snippet actions()}
				<button
					type="button"
					class="h-9 rounded-md border border-input px-3 text-sm hover:bg-muted"
					onclick={hijackNext}>Hijack next save</button
				>
			{/snippet}
		</Surface.Toolbar>

		<Surface.Split>
			{#snippet list()}
				<Surface.List status={probes.status} />
			{/snippet}

			{#snippet detail()}
				<div class="h-full rounded-lg border border-border bg-card p-4">
					{#if selected}
						<h2 class="mb-3 font-medium">{selected.name}</h2>
						<label class="block text-xs text-muted-foreground" for="note">note</label>
						<input
							id="note"
							class="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
							value={draft || selected.note}
							oninput={(e) => (draft = e.currentTarget.value)}
						/>
						<div class="mt-3 flex gap-2">
							<button
								type="button"
								class="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground"
								onclick={save}>Save</button
							>
						</div>
						<p class="mt-2 text-xs text-muted-foreground">in store: {selected.note}</p>
						{#if lastError}
							<p class="mt-2 rounded bg-destructive/15 p-2 text-xs text-destructive">{lastError}</p>
						{/if}
					{:else}
						<p class="text-sm text-muted-foreground">Pick a probe.</p>
					{/if}
				</div>
			{/snippet}
		</Surface.Split>
	</Surface.Root>

	<!-- The paged rig. Not part of the surface above on purpose: it exercises
	     the collection's search escalation directly, without the pipeline. -->
	<section class="rounded-lg border border-border bg-card p-3">
		<div class="flex flex-wrap items-center gap-2">
			<h2 class="text-sm font-medium">Paged rig · search escalation</h2>
			<input
				class="h-9 w-56 rounded-md border border-input bg-background px-3 text-sm"
				placeholder="Search paged probes…"
				bind:value={rigSearch}
			/>
			<div class="flex rounded-md border border-input p-0.5 text-sm">
				{#each [20, 100] as c (c)}
					<button
						type="button"
						class="rounded px-2 py-1 {rigCap === c ? 'bg-accent text-accent-foreground' : ''}"
						onclick={() => (rigCap = c)}>cap {c}</button
					>
				{/each}
			</div>
			<button
				type="button"
				class="h-9 rounded-md border border-input px-3 text-sm hover:bg-muted"
				onclick={() => {
					paged.evictAll();
					paged.clearCache();
				}}>Forget all</button
			>
		</div>
		<dl class="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 text-sm sm:grid-cols-6">
			<div>
				<dt class="text-xs text-muted-foreground">rows</dt>
				<dd class="tabular-nums">{rig.all.length}</dd>
			</div>
			<div>
				<dt class="text-xs text-muted-foreground">total</dt>
				<dd class="tabular-nums">{rig.total ?? '—'}</dd>
			</div>
			<div>
				<dt class="text-xs text-muted-foreground">stopped</dt>
				<dd>{rig.stopped ?? '—'}</dd>
			</div>
			<div>
				<dt class="text-xs text-muted-foreground">status</dt>
				<dd>{rig.status}</dd>
			</div>
			<!-- The metric that IS the demonstration: pushed-down search mints a
			     set per term; locally-served search mints none. -->
			<div>
				<dt class="text-xs text-muted-foreground">sets</dt>
				<dd class="tabular-nums">{paged.debug.sets.length}</dd>
			</div>
			<div>
				<dt class="text-xs text-muted-foreground">live</dt>
				<dd class="tabular-nums">{paged.debug.liveSets.length}</dd>
			</div>
		</dl>
		<p class="mt-1 text-xs text-muted-foreground">
			At cap 20 the base stays capped and every term is a pushed-down set — “sets” climbs per
			keystroke. Switch to cap 100: the base extends until it exhausts, and typing then narrows
			locally, minting nothing. “Forget all” replays it.
		</p>
		<ul class="mt-2 flex flex-wrap gap-1">
			{#each rig.all as p (p.id)}
				<li class="rounded bg-muted px-2 py-0.5 text-xs">{p.name}</li>
			{/each}
		</ul>
	</section>
</div>
