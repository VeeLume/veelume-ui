<script lang="ts" generics="E">
	/**
	 * The comparison matrix — attributes down, entities across.
	 *
	 * The third view of a working set, beside the list and the detail pane(s):
	 * a Split shows two entities interactively and independently scrollable,
	 * this shows N of them aligned and read-only. The tab strip is the natural
	 * feed, but `entities` is a plain array — which is what lets the
	 * across-versions case work at all, where the entities are two snapshots
	 * of ONE record and no tabs exist.
	 *
	 * ⚑ It does not own its placement. Same rule as `Wizard` not owning an
	 * overlay: a mode over the detail region, a synthetic tab, or a shareable
	 * `?compare=a,b,c` route are all arrangements the app picks, and because
	 * there is only one matrix they cannot drift.
	 */
	import type { Snippet } from 'svelte';
	import { getKitContext } from '../context/index.js';
	import type { CompareAttribute } from './types.js';

	let {
		entities,
		attributes,
		keyOf,
		labelOf,
		head,
		empty,
		class: klass = ''
	}: {
		entities: E[];
		attributes: CompareAttribute<E>[];
		keyOf: (entity: E) => string;
		labelOf: (entity: E) => string;
		/** Replace a column heading — a close button, a badge, a link. */
		head?: Snippet<[E]>;
		empty?: Snippet;
		class?: string;
	} = $props();

	const kit = getKitContext();

	type Cell = { text: string; best: boolean };

	/**
	 * Sorting the ENTITIES by one attribute — i.e. reordering columns from a
	 * row. Internal state rather than a prop: the given order is the app's
	 * (usually the tab order), and this is a transient way of looking at it,
	 * the same argument that keeps expansion out of the URL.
	 *
	 * Three states, and the third is the point: a sort you cannot undo would
	 * destroy the app's ordering for the rest of the session.
	 */
	let sortKey = $state<string | null>(null);
	let reversed = $state(false);

	function cycleSort(key: string) {
		if (sortKey !== key) {
			sortKey = key;
			reversed = false;
		} else if (!reversed) {
			reversed = true;
		} else {
			sortKey = null;
			reversed = false;
		}
	}

	const ordered = $derived.by(() => {
		const attr = attributes.find((a) => a.key === sortKey);
		if (!attr) return entities;

		// `better` decides which end leads: best-first is the useful default
		// when a direction exists, ascending when it does not.
		const descending = attr.better === 'higher';
		const dir = (reversed ? -1 : 1) * (descending ? -1 : 1);

		return [...entities].sort((a, b) => {
			const va = attr.value(a);
			const vb = attr.value(b);
			// Missing values sink, in BOTH directions — a blank is not a winner
			// and reversing should not promote it to one.
			if (va === null && vb === null) return 0;
			if (va === null) return 1;
			if (vb === null) return -1;
			if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
			return String(va).localeCompare(String(vb)) * dir;
		});
	});

	/**
	 * Rows are computed once per render rather than per cell, because finding
	 * the best value needs the whole row anyway — and doing it in the template
	 * would mean re-scanning every entity for every cell.
	 */
	const rows = $derived(
		attributes.map((attr) => {
			const raw = ordered.map((e) => attr.value(e));
			const numeric = raw.map((v) => (typeof v === 'number' ? v : null));

			// A winner needs a declared direction, at least two entities, and
			// genuine disagreement. Otherwise nothing is marked.
			let bestValue: number | null = null;
			if (attr.better && ordered.length > 1) {
				const present = numeric.filter((v): v is number => v !== null);
				if (present.length > 1) {
					const min = Math.min(...present);
					const max = Math.max(...present);
					if (min !== max) bestValue = attr.better === 'higher' ? max : min;
				}
			}

			const cells: Cell[] = raw.map((v, i) => {
				if (v === null) return { text: '—', best: false };
				if (typeof v === 'string') return { text: v, best: false };
				const shown = attr.scale ? v / attr.scale : v;
				return {
					text: kit.format.number(shown, attr.format),
					best: bestValue !== null && numeric[i] === bestValue
				};
			});

			return { key: attr.key, label: attr.label, cells, sortable: true };
		})
	);

	const marker = (key: string) => (sortKey !== key ? '' : reversed ? ' ↑' : ' ↓');
</script>

{#if entities.length === 0}
	{#if empty}
		{@render empty()}
	{:else}
		<p class="p-6 text-center text-sm text-muted-foreground">{kit.labels.compareEmpty()}</p>
	{/if}
{:else}
	<!-- The scroll container is the table's own, so many entities scroll
	     sideways inside it rather than widening the page — the `min-w-0`
	     lesson, applied where it belongs. -->
	<div class="overflow-auto {klass}">
		<table class="w-full border-collapse text-sm">
			<thead>
				<tr>
					<!-- Sticky in BOTH axes: the attribute column must survive a
					     sideways scroll, and the heading row a vertical one. -->
					<th
						class="sticky top-0 left-0 z-20 min-w-36 border-b border-border bg-card px-3 py-2
						       text-left text-xs font-medium tracking-wider text-muted-foreground uppercase"
					>
						{kit.labels.attribute()}
					</th>
					{#each ordered as entity (keyOf(entity))}
						<th
							class="sticky top-0 z-10 min-w-32 border-b border-l border-border bg-card px-3 py-2
							       text-left font-medium"
						>
							{#if head}{@render head(entity)}{:else}{labelOf(entity)}{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.key)}
					<tr class="hover:bg-muted/40">
						<!-- The attribute label IS the sort control: clicking a row
						     reorders the COLUMNS by it. Cycles best-first → reversed →
						     back to the app's order, because a sort you cannot undo
						     would destroy the given ordering for the session. -->
						<th
							class="sticky left-0 z-10 border-b border-border bg-card p-0 text-left"
							aria-sort={sortKey !== row.key ? 'none' : reversed ? 'ascending' : 'descending'}
						>
							<button
								type="button"
								class="w-full px-3 py-2 text-left text-xs font-medium tracking-wider uppercase
								       hover:text-foreground {sortKey === row.key ? 'text-foreground' : 'text-muted-foreground'}"
								onclick={() => cycleSort(row.key)}
							>
								{row.label}{marker(row.key)}
							</button>
						</th>
						{#each row.cells as cell, i (keyOf(ordered[i]))}
							<td
								class="border-b border-l border-border px-3 py-2 tabular-nums
								       {cell.best ? 'font-semibold text-primary' : ''}"
							>
								{cell.text}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
