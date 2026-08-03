<script lang="ts">
	/**
	 * The Catalog archetype.
	 *
	 * Three things a CRUD surface does not do, all visible here:
	 *   - rows are DERIVED (several editions collapse into one work row)
	 *   - an OVERLAY is joined during derivation (the shelf)
	 *   - facets test overlay-derived properties, which forces derive→filter
	 *
	 * Expansion is page-local, in a SvelteSet — deliberately NOT the URL.
	 * Selection is a state you were *in*; expanding a row is transient
	 * exploration. Hearth draws the same line.
	 *
	 * The expandable row is built here via `Surface.List`'s `row` snippet rather
	 * than in the kit: it is the escape hatch working as designed. If the shape
	 * settles across a second surface it earns promotion to L2 — not before.
	 */
	import { SvelteSet } from 'svelte/reactivity';
	import { Surface } from '@veelume/ui';
	import { createBrowseState } from '@veelume/ui';
	import { getKitContext } from '@veelume/ui';
	import {
		editions,
		shelf,
		deriveWorks,
		toggleShelf,
		type WorkRow
	} from '$lib/library.svelte';

	const kit = getKitContext();

	const browse = createBrowseState({
		q: { kind: 'text' },
		shelf: { kind: 'many' },
		sort: { kind: 'one', default: 'title', narrows: false }
	});

	const expanded = new SvelteSet<string>();

	const descriptor = {
		// TWO sources. This is the structural difference.
		sources: () => ({ editions: editions.all, shelf: shelf.all }),
		derive: deriveWorks,
		searchIn: (r: WorkRow) => [r.title, r.author],
		facets: [
			{
				id: 'shelf',
				label: 'Shelf',
				mode: 'many' as const,
				options: [
					{ value: 'owned', label: 'Owned', test: (r: WorkRow) => r.ownedCount > 0 },
					{ value: 'want', label: 'Wanted', test: (r: WorkRow) => r.wantCount > 0 },
					{
						value: 'none',
						label: 'Unshelved',
						test: (r: WorkRow) => r.ownedCount === 0 && r.wantCount === 0
					}
				]
			}
		],
		sorts: [
			{
				value: 'title',
				label: 'Title',
				compare: (a: WorkRow, b: WorkRow) => a.title.localeCompare(b.title)
			},
			{
				value: 'year',
				label: 'Year',
				compare: (a: WorkRow, b: WorkRow) => a.firstYear - b.firstYear
			},
			{
				value: 'owned',
				label: 'Most owned',
				compare: (a: WorkRow, b: WorkRow) => b.ownedCount - a.ownedCount
			}
		]
	};

	// Reference data is browsable while the overlay is still arriving, so the
	// list must not wait on both.
	const status = $derived(editions.status);

	const symbol = { owned: '●', want: '♡', none: '○' } as const;
	const nextLabel = { owned: 'Mark as wanted', want: 'Remove from shelf', none: 'Mark as owned' };
</script>

<div class="flex h-full min-h-0 flex-col">
	<Surface.Root {descriptor} {browse} class="min-h-0 flex-1 gap-0">
		<Surface.Toolbar title="Catalog" />

		<Surface.List {status} class="m-3">
			{#snippet row(r: WorkRow)}
				{@const open = expanded.has(r.key)}
				<div class="border-b border-border last:border-b-0">
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
								{r.author} · {kit.format.number(r.total)} editions · from {r.firstYear}
							</span>
						</span>
						{#if r.badge}<span class="shrink-0 text-xs">{r.badge}</span>{/if}
						<span class="shrink-0 text-xs tabular-nums text-muted-foreground">{r.trailing}</span>
					</button>

					{#if open}
						<ul class="bg-muted/30 px-3 pb-2">
							{#each r.members as m (m.edition.id)}
								<li class="flex items-center gap-3 border-t border-border/50 py-1.5 text-xs">
									<button
										type="button"
										class="grid size-6 shrink-0 place-items-center rounded border border-input
										       bg-background hover:bg-muted"
										title={nextLabel[m.state]}
										onclick={() => toggleShelf(m.edition.id)}
									>
										{symbol[m.state]}
									</button>
									<span class="flex-1">{m.edition.format}</span>
									<span class="tabular-nums text-muted-foreground">{m.edition.year}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/snippet}
		</Surface.List>
	</Surface.Root>
</div>
