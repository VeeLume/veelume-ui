<script lang="ts">
	/**
	 * The Catalog archetype — and the WORKBENCH PROTOTYPE.
	 *
	 * Three things a CRUD surface does not do, all visible here:
	 *   - rows are DERIVED (several editions collapse into one work row)
	 *   - an OVERLAY is joined during derivation (the shelf)
	 *   - facets test overlay-derived properties, which forces derive→filter
	 *
	 * On top of that, this page prototypes the workbench (the archetype
	 * revision's answer to accordion-vs-detail) ENTIRELY at app level — zero
	 * kit changes — so the tab ergonomics can be felt before anything freezes:
	 *
	 *   - ACTIVE selection lives in the URL (`?work=`, push history — back
	 *     means "the item I was on")
	 *   - the TAB SET lives in a module store ($lib/workset.svelte) — pins are
	 *     workspace state like expansion: survive navigation, never history
	 *   - click previews (one preview slot, replaced by the next click),
	 *     double-click pins — the VS Code move that stops tab garbage
	 *
	 * Expansion (the caret) STAYS, deliberately, beside the workbench: it is
	 * the Expand niche — a shallow in-place peek at the variants without
	 * selecting anything. Having both on one surface is the point of the
	 * prototype: feel which one you reach for, and when.
	 */
	import {
		Surface,
		Expand,
		createExpansion,
		Compare,
		RadioGroup,
		Placeholder,
		DetailHeader,
		Button,
		createBrowseState,
		getKitContext
	} from '@veelume/ui';
	import type { GroupDef, CompareAttribute } from '@veelume/ui';
	import {
		editions,
		shelf,
		deriveWorks,
		toggleShelf,
		type WorkRow,
		type ShelfState
	} from '$lib/library.svelte';
	import type { Edition } from '$lib/fixtures/library';
	import { catalogWorkset } from '$lib/workset.svelte';

	const kit = getKitContext();

	const browse = createBrowseState({
		q: { kind: 'text' },
		shelf: { kind: 'many' },
		sort: { kind: 'one', default: 'title', narrows: false },
		// Grouping is view state like sort — history-worthy, non-narrowing. The
		// TOGGLE lives here; the MECHANISM is the descriptor being $derived from
		// it below. No part carries a grouping mode.
		group: { kind: 'one', default: 'author', narrows: false },
		// The ACTIVE record — the browse table's selection row: a param, push
		// history, so back/forward walk the works you were on.
		work: { kind: 'one', default: '', narrows: false },
		// The SECOND pane — the split, stacked: pane 2 sits BELOW pane 1, the
		// split line horizontal. A URL param on purpose: a compare is a state
		// worth sharing (the web tier's build-diff pages are this exact shape),
		// and back closes the split before it closes the selection, which is
		// the order you'd want.
		below: { kind: 'one', default: '', narrows: false },
		// COMPARE — a mode over the detail region rather than a third pane. In
		// the URL for the same reason as `below`: a comparison is a state worth
		// sharing, and it is the shape the web tier's public build-diff pages
		// want. `Compare` itself has no opinion on any of this — placement is
		// the app's, like the Wizard's host.
		compare: { kind: 'one', default: '', narrows: false },
		// List collapse — view state, so the URL, so a link can carry "give me
		// the wide read". `replace` history: hiding the list is not a place you
		// want the back button to walk through.
		list: { kind: 'one', default: 'open', narrows: false, history: 'replace' }
	});

	// `many`: peeking at one work's editions has no business closing another's.
	// A deep-read accordion (Starlume's missions) is where `one` belongs.
	const expanded = createExpansion('many');

	// One level. The label default is the key itself (the author); the count the
	// default header renders is the group's VISIBLE rows, so narrowing the list
	// renarrows every header for free.
	const byAuthor: GroupDef<WorkRow>[] = [{ key: (r) => r.author }];

	// ONE derivation, shared by the pipeline and the panes: the page derives
	// works and the descriptor takes them as its source with an identity
	// `derive`. (The prototype ran deriveWorks twice — once in the descriptor,
	// once for the pane lookup; the tab strip's labels now come from the
	// pipeline's own `byKey`, and the panes read this.)
	const works = $derived(deriveWorks({ editions: editions.all, shelf: shelf.all }));
	const workByKey = $derived(new Map(works.map((r) => [r.key, r])));

	const base = {
		sources: () => works,
		derive: (rs: WorkRow[]) => rs,
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

	// Toggleable grouping IS this line: the descriptor derives from browse
	// state, so switching rebuilds it and the pipeline follows. Sorting within
	// groups still works — sort runs before group, so "Year" orders each
	// author's works while the authors keep first-appearance order.
	const descriptor = $derived({
		...base,
		groupBy: browse.values.group === 'author' ? byAuthor : undefined
	});

	// Reference data is browsable while the overlay is still arriving, so the
	// list must not wait on both.
	const status = $derived(editions.status);

	const active = $derived(browse.values.work || null);
	const activeWork = $derived(active ? workByKey.get(active) : undefined);

	// The second pane is a PROJECTION by key, deliberately independent of the
	// tab set: closing B's tab does not tear down a compare you set up, and a
	// shared ?below= link renders without minting tabs. Whether that
	// independence survives promotion is a behaviour to judge in use.
	const below = $derived(browse.values.below || null);
	const belowWork = $derived(below ? workByKey.get(below) : undefined);

	// The working set IS the compare input — that is the whole reason the
	// workbench was built first. `entities` stays a plain array, so the same
	// component would serve "one work across two builds" with no tabs at all.
	const comparing = $derived(browse.values.compare === 'tabs');
	const compareEntities = $derived(
		catalogWorkset.tabs.map((t) => workByKey.get(t.key)).filter((w): w is WorkRow => !!w)
	);

	const compareAttributes: CompareAttribute<WorkRow>[] = [
		// Neutral: no `better`, because the kit cannot know that a longer book
		// is a worse one — and a table asserting a winner on taste is lying.
		// ⚑ `useGrouping: false` — a year is a number the formatter would
		// happily render as "1.984" under de-DE. Every locale-aware readout has
		// this trap; `format` is the escape hatch, so the fix is here and not a
		// special case in the component.
		{
			key: 'year',
			label: 'First published',
			value: (w) => w.firstYear,
			format: { useGrouping: false }
		},
		{ key: 'pages', label: 'Pages', value: (w) => w.pages },
		{ key: 'editions', label: 'Editions', value: (w) => w.total },
		// Declared directions — only these get a marked best value.
		{
			key: 'price',
			label: 'Cheapest',
			value: (w) => w.cheapestCents,
			scale: 100,
			format: { style: 'currency', currency: 'EUR' },
			better: 'lower'
		},
		{
			key: 'rating',
			label: 'Rating',
			value: (w) => w.rating,
			format: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
			better: 'higher'
		},
		// Comparing an OVERLAY-derived value: owned exists only after the join.
		{ key: 'owned', label: 'Owned', value: (w) => w.ownedCount, better: 'higher' }
	];

	function openWork(key: string) {
		// `activate`, not `select`: a rapid second activation of the same row
		// pins it. Replaces the dblclick that could not survive the navigation
		// this very call triggers — and it works from the keyboard too.
		catalogWorkset.activate(key);
		// ⚑ ONE navigation, both fields: compare is a TAB, so activating a record
		// leaves it — and via `setMany`, because two `set` calls would make
		// "record selected, compare still open" a real state the back button
		// could land on.
		browse.setMany({ work: key, compare: '' });
	}

	// Domain data, which is the only thing this page should be defining.
	const SHELF_SYMBOL = { owned: '●', want: '♡', none: '○' } as const;
	const NEXT_SHELF_LABEL = {
		owned: 'Mark as wanted',
		want: 'Remove from shelf',
		none: 'Mark as owned'
	} as const;
	const GROUPINGS = [
		{ value: 'author', label: 'By author' },
		{ value: 'none', label: 'Flat' }
	];

	/** Tabs sit above the first pane, so it squares its top-left corner. */
	const tabbed = () => catalogWorkset.tabs.length > 0;
</script>

<!--
	Configuration A — no toolbar. The catalog has no chrome that belongs to
	neither pane, so it has no page bar: search and filters ride in the list's own
	header, and the 56px a toolbar would have cost goes to rows instead.

	⚑ Everything below is COMPOSITION plus DATA. No element in this file styles
	anything — the demo exists to exercise the kit, so a class string here would
	be a bug report about a missing part.
-->
<Surface.Root
	{descriptor}
	{browse}
	selected={active}
	collapsed={browse.values.list === 'closed'}
	oncollapse={(next) => browse.set('list', next ? 'closed' : 'open')}
>
	<Surface.Split>
		{#snippet list()}
			<Surface.List {status}>
				{#snippet headerPanel()}
					<!-- A view option, so it rides in the filter panel beside sort
					     rather than eating the header width search needs — and through
					     the same RadioGroup the panel renders sort with, so two
					     identical one-of-many choices cannot start looking different. -->
					<RadioGroup
						label="Group"
						options={GROUPINGS}
						value={browse.values.group}
						onchange={(v) => browse.set('group', v)}
					/>
				{/snippet}
				{#snippet row(r: WorkRow, isSelected: boolean)}
					<!-- Both gestures, which is why the kit splits them: the caret peeks
					     at the editions in place, the body opens the workbench. Pinning
					     rides `onselect` via `workset.activate` — a second activation of
					     the same row promotes it. -->
					<Expand.Row
						title={r.title}
						subtitle="{r.author} · {kit.format.number(r.total)} editions · from {r.firstYear}"
						open={expanded.has(r.key)}
						ontoggle={() => expanded.toggle(r.key)}
						selected={isSelected}
						onselect={() => openWork(r.key)}
					>
						{#snippet right()}{r.badge ?? ''} {r.trailing}{/snippet}
						<!-- The expansion is NESTED ROWS, not a bespoke list: leaves are
						     the same component one level in. -->
						{#each r.members as m (m.edition.id)}
							{@render editionRow(m, 1)}
						{/each}
					</Expand.Row>
				{/snippet}
			</Surface.List>
		{/snippet}

		{#snippet detail()}
			<Surface.Panes>
				{#snippet strip()}
					<!-- Gestures are the kit's contract; the wiring is the app's — each
					     callback writes app browse state, and omitting `onbelow`/`onback`
					     would remove those controls. -->
					<Surface.TabStrip
						workset={catalogWorkset}
						selected={comparing ? null : active}
						onactivate={(k) => browse.setMany({ work: k ?? '', compare: '' })}
						onback={() => browse.set('work', '')}
						onbelow={(k) => browse.set('below', k)}
					>
						{#snippet trailing()}
							{#if catalogWorkset.tabs.length > 1}
								<!-- A virtual TAB, not a button: comparing is another way of
								     looking at the working set, so it reads as one of them —
								     active state included. It carries no key, which is why
								     the kit models it as a trailing slot. -->
								<Surface.Tab
									active={comparing}
									onclick={() => browse.set('compare', comparing ? '' : 'tabs')}
								>
									⊞ Compare {compareEntities.length}
								</Surface.Tab>
							{/if}
						{/snippet}
					</Surface.TabStrip>
				{/snippet}

				{#if comparing}
					<!-- Compare REPLACES the panes rather than joining them: a different
					     view of the same working set, not a third thing to read beside
					     two others. No PaneBody — Compare owns its scroll container,
					     because its sticky axes depend on it. -->
					<Surface.Pane tabbed={tabbed()}>
						<Compare
							entities={compareEntities}
							attributes={compareAttributes}
							keyOf={(w) => w.key}
							labelOf={(w) => w.title}
						/>
					</Surface.Pane>
				{:else}
					<Surface.Pane tabbed={tabbed()}>
						{#if activeWork}
							{@render workPane(activeWork)}
						{:else}
							<Placeholder>
								Select a work to preview it. Click previews, a second click pins, ⊟ opens a second
								pane below.
							</Placeholder>
						{/if}
					</Surface.Pane>

					{#if belowWork}
						<Surface.Pane>
							{@render workPane(belowWork, () => browse.set('below', ''))}
						</Surface.Pane>
					{/if}
				{/if}
			</Surface.Panes>
		{/snippet}
	</Surface.Split>
</Surface.Root>

<!-- The record view: a header, the facts, and the editions as rows. Every part
     of it is a kit part; what is app-specific is WHICH facts and which rows. -->
{#snippet workPane(w: WorkRow, onclose?: () => void)}
	<DetailHeader title={w.title} onback={onclose} backOnDesktop={!!onclose}>
		{#snippet actions()}
			{#if onclose}
				<Button variant="ghost" size="icon" onclick={onclose} title="Close pane">✕</Button>
			{/if}
		{/snippet}
	</DetailHeader>
	<Surface.PaneBody>
		<Expand.Facts
			facts={[
				{ label: 'Author', value: w.author },
				{ label: 'First published', value: String(w.firstYear) },
				{ label: 'Owned', value: `${w.ownedCount}/${w.total}` },
				{ label: 'Rating', value: kit.format.number(w.rating, { minimumFractionDigits: 1 }) }
			]}
		/>
		{#each w.members as m (m.edition.id)}
			{@render editionRow(m)}
		{/each}
	</Surface.PaneBody>
{/snippet}

<!-- One edition, used by BOTH the list's expansion and the record pane — the
     same component at two indents rather than two lists that drift. -->
{#snippet editionRow(m: { edition: Edition; state: ShelfState }, indent = 0)}
	<Expand.Row title={m.edition.format} {indent}>
		{#snippet gutter()}
			<Button
				variant="outline"
				size="icon"
				title={NEXT_SHELF_LABEL[m.state]}
				onclick={() => toggleShelf(m.edition.id)}
			>
				{SHELF_SYMBOL[m.state]}
			</Button>
		{/snippet}
		{#snippet right()}{m.edition.year}{/snippet}
	</Expand.Row>
{/snippet}
