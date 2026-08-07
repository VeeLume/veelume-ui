<script lang="ts">
	/**
	 * The Catalog archetype at stress scale — N:1 derivation over the 1.5M
	 * collection's 10k set, bundled by party name (given + surname, suffix
	 * stripped): ~500 bundles of ~20 entries each.
	 *
	 * This is the windowed VARIABLE-HEIGHT case the loans-shaped pages cannot
	 * reach: well past the window's threshold, with rows that change height
	 * after render when a bundle expands in place. The `size` facet filters on
	 * a DERIVED property — derive-before-filter, same as Hearth's `owned`.
	 */
	import { SvelteSet } from 'svelte/reactivity';
	import { getKitContext, createBrowseState, Surface, type Row } from '@veelume/ui';
	import { entries, type Entry } from '$lib/stress.svelte';

	const kit = getKitContext();

	type PartyRow = Row & { members: Entry[]; total: number };

	const view = $derived(entries.query({ cap: 10_000 }));

	const browse = createBrowseState({
		q: { kind: 'text' },
		size: { kind: 'many' },
		sort: { kind: 'one', default: 'entries', narrows: false }
	});

	const money = (c: number) => kit.format.number(c / 100, { style: 'currency', currency: 'EUR' });

	// Expansion is page-local and transient — the same rule the real catalog
	// follows: not browse state, not selection.
	const expanded = new SvelteSet<string>();

	const descriptor = {
		sources: () => view.all,
		derive: (records: Entry[]): PartyRow[] => {
			const groups = new Map<string, Entry[]>();
			for (const e of records) {
				const name = e.party.replace(/ \d+$/, '');
				const list = groups.get(name);
				if (list) list.push(e);
				else groups.set(name, [e]);
			}
			return [...groups.entries()].map(([name, members]) => ({
				key: name,
				title: name,
				members,
				total: members.reduce((sum, e) => sum + e.cents, 0)
			}));
		},
		searchIn: (r: PartyRow) => [r.title],
		facets: [
			{
				id: 'size',
				label: 'Size',
				mode: 'many' as const,
				options: [
					{ value: 'large', label: '20+ entries', test: (r: PartyRow) => r.members.length >= 20 },
					{
						value: 'refunds',
						label: 'Has refunds',
						test: (r: PartyRow) => r.members.some((e) => e.kind === 'refund')
					},
					{ value: 'negative', label: 'Negative total', test: (r: PartyRow) => r.total < 0 }
				]
			}
		],
		sorts: [
			{
				value: 'entries',
				label: 'Entries',
				compare: (a: PartyRow, b: PartyRow) => b.members.length - a.members.length
			},
			{ value: 'total', label: 'Total', compare: (a: PartyRow, b: PartyRow) => b.total - a.total },
			{
				value: 'name',
				label: 'Name',
				compare: (a: PartyRow, b: PartyRow) => a.title.localeCompare(b.title)
			}
		]
	};
</script>

<div class="flex h-full min-h-0 flex-col gap-3 p-4">
	<header class="flex items-center gap-3">
		<h1 class="text-lg font-semibold">Stress · Catalog archetype</h1>
		<a class="text-sm underline underline-offset-2" href="/stress">instrument</a>
		<a class="text-sm underline underline-offset-2" href="/stress/list">list archetype</a>
		<span class="ml-auto text-xs text-muted-foreground">
			{kit.format.number(view.all.length)} entries · {view.status}
		</span>
	</header>

	<Surface.Root {descriptor} {browse} class="min-h-0 flex-1">
		<Surface.List
			status={view.status}
			fetching={view.fetching}
			hasMore={view.hasMore}
			onloadmore={() => entries.loadMore({ cap: 10_000 })}
		>
			{#snippet row(r: PartyRow)}
				{@const open = expanded.has(r.key)}
				<div class="border-b border-border">
					<button
						type="button"
						class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
						aria-expanded={open}
						onclick={() => (open ? expanded.delete(r.key) : expanded.add(r.key))}
					>
						<span class="w-3 shrink-0 text-xs text-muted-foreground">{open ? '▾' : '▸'}</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">{r.title}</span>
							<span class="block truncate text-xs text-muted-foreground">
								{kit.format.number(r.members.length)} entries
							</span>
						</span>
						<span class="shrink-0 text-right tabular-nums text-xs text-muted-foreground">
							{money(r.total)}
						</span>
					</button>

					{#if open}
						<ul class="bg-muted/30 px-3 pb-2">
							{#each r.members as m (m.id)}
								<li class="flex items-center gap-3 border-t border-border/50 py-1.5 text-xs">
									<span class="w-14 shrink-0 tabular-nums text-muted-foreground">#{m.id}</span>
									<span class="w-20 shrink-0 tabular-nums text-muted-foreground">{m.date}</span>
									<span class="flex-1">{m.kind}</span>
									<span class="tabular-nums">{money(m.cents)}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/snippet}
		</Surface.List>
	</Surface.Root>
</div>
