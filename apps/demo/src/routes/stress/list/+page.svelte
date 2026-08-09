<script lang="ts">
	/**
	 * The List archetype at stress scale — `Surface.List`'s DEFAULT rows fed by
	 * the 1.5M collection's unfiltered 10k set.
	 *
	 * Exists to verify the windowed KEYED path: /stress renders its own unkeyed
	 * hand-rolled list, so without this page the kit's own list would only ever
	 * window in its neutral small-list mode. Everything below the fill is the
	 * envelope's LOCAL regime: search, the kind facet with contextual counts,
	 * and sort all run in the pipeline over held rows.
	 */
	import { getKitContext, createBrowseState, Surface, type Row } from '@veelume/ui';
	import { entries, KINDS, type Entry } from '$lib/stress.svelte';

	const kit = getKitContext();

	type EntryRow = Row & { entry: Entry };

	const view = $derived(entries.query({ cap: 10_000 }));

	const browse = createBrowseState({
		q: { kind: 'text' },
		kind: { kind: 'many' },
		sort: { kind: 'one', default: 'date', narrows: false }
	});

	const money = (c: number) => kit.format.number(c / 100, { style: 'currency', currency: 'EUR' });

	const descriptor = {
		sources: () => view.all,
		// 1:1 — the CRUD surface's degenerate derive, same as loans.
		derive: (records: Entry[]): EntryRow[] =>
			records.map((e) => ({
				key: String(e.id),
				title: e.party,
				subtitle: `#${e.id} · ${e.date}`,
				trailing: money(e.cents),
				badge: e.kind,
				entry: e
			})),
		searchIn: (r: EntryRow) => [r.title, String(r.entry.id)],
		facets: [
			{
				id: 'kind',
				label: 'Kind',
				mode: 'many' as const,
				options: KINDS.map((k) => ({
					value: k,
					label: k,
					test: (r: EntryRow) => r.entry.kind === k
				}))
			}
		],
		sorts: [
			{
				value: 'date',
				label: 'Date',
				compare: (a: EntryRow, b: EntryRow) => a.entry.id - b.entry.id
			},
			{
				value: 'amount',
				label: 'Amount',
				compare: (a: EntryRow, b: EntryRow) => b.entry.cents - a.entry.cents
			},
			{
				value: 'party',
				label: 'Party',
				compare: (a: EntryRow, b: EntryRow) => a.title.localeCompare(b.title)
			}
		]
	};
</script>

<div class="flex h-full min-h-0 flex-col gap-3 p-4">
	<header class="flex items-center gap-3">
		<h1 class="text-lg font-semibold">Stress · List archetype</h1>
		<a class="text-sm underline underline-offset-2" href="/stress">instrument</a>
		<a class="text-sm underline underline-offset-2" href="/stress/catalog">catalog archetype</a>
		<span class="ml-auto text-xs text-muted-foreground">
			{kit.format.number(view.all.length)} rows · {view.status}
		</span>
	</header>

	<Surface.Root {descriptor} {browse} class="min-h-0 flex-1">
		<Surface.List
			status={view.status}
			fetching={view.fetching}
			hasMore={view.hasMore}
			onloadmore={() => entries.loadMore({ cap: 10_000 })}
		/>
	</Surface.Root>
</div>
