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
			{ value: 'name', label: 'Name', compare: (a: ProbeRow, b: ProbeRow) => a.title.localeCompare(b.title) },
			{ value: 'name-desc', label: 'Name ↓', compare: (a: ProbeRow, b: ProbeRow) => b.title.localeCompare(a.title) }
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
</div>
