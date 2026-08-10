<script lang="ts">
	/**
	 * The filter trigger and its panel — sort options, every facet with its
	 * contextual count, and a reset.
	 *
	 * Its own component rather than part of a bar, because the thing it belongs to
	 * is the LIST, and the list is not always in the same bar. stibu reached the
	 * same factoring (`FilterPopover` + `FilterGroup`), and so did connect-neo
	 * (`ui/FilterPopover`, `ui/FilterGroup`, `ui/FilterFacet`) — two independent
	 * derivations of "the filter UI is a unit that travels".
	 *
	 * The badge is the active-filter count, which is also the reason the panel can
	 * be hidden by default: a narrowed list must never look like an unnarrowed one.
	 */
	import type { Snippet } from 'svelte';
	import Popup from '../popup/Popup.svelte';
	import RadioGroup from '../form/RadioGroup.svelte';
	import { getKitContext } from '../context/index.js';
	import { getSurfaceContext } from './context.js';

	let {
		panel,
		class: klass = ''
	}: {
		/**
		 * App-supplied controls for the panel — VIEW options the descriptor
		 * cannot model, like a grouping toggle.
		 *
		 * Rendered with sort and before the facets, because the panel reads in
		 * two halves: how the list is ARRANGED (sort, grouping), then what it is
		 * NARROWED to (facets). A view control in the header would compete with
		 * search for the width the list actually needs.
		 */
		panel?: Snippet;
		class?: string;
	} = $props();

	const s = getSurfaceContext();
	const kit = getKitContext();

	let open = $state(false);

	const activeCount = $derived(s.browse.activeCount);
</script>

<div class="relative shrink-0 {klass}">
	<button
		type="button"
		class="relative grid size-9 place-items-center rounded-md border border-input
		       bg-background shadow-xs transition-colors hover:bg-muted"
		aria-expanded={open}
		title={kit.labels.filters()}
		onclick={() => (open = !open)}
	>
		<svg viewBox="0 0 16 16" class="size-4" fill="none" stroke="currentColor" stroke-width="1.5">
			<path d="M2 4h12M4.5 8h7M7 12h2" stroke-linecap="round" />
		</svg>
		{#if activeCount}
			<span
				class="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full
				       bg-primary text-[0.6rem] text-primary-foreground">{activeCount}</span
			>
		{/if}
	</button>

	<!-- The dismissal semantics (outside click, Escape, focus return) and the
	     placement (flip/shift against the clipping ancestors) are the Popup
	     base's — this component states intent, below-start, and nothing else. -->
	<Popup
		{open}
		onclose={() => (open = false)}
		side="bottom"
		align="start"
		offset={4}
		label={kit.labels.filters()}
		class="w-72 p-3"
	>
		{#if s.sorts.length}
			<RadioGroup
				class="mb-3"
				label={kit.labels.sort()}
				options={s.sorts}
				value={s.activeSort?.value ?? ''}
				onchange={(v) => s.browse.set('sort', v as never)}
			/>
		{/if}

		{#if panel}
			<div class="mb-3">{@render panel()}</div>
		{/if}

		{#each s.facets as f (f.id)}
			<div class="mb-3">
				<div class="mb-1 text-xs font-medium text-muted-foreground">{f.label}</div>
				{#each f.options as opt (opt.value)}
					{@const picked = s.selectionOf(f).includes(opt.value)}
					<label class="flex items-center gap-2 py-1 text-sm">
						<input
							type={f.mode === 'many' ? 'checkbox' : 'radio'}
							checked={picked}
							onchange={() =>
								f.mode === 'many'
									? s.browse.toggle(f.id, opt.value)
									: s.browse.set(f.id, opt.value as never)}
						/>
						<span class="flex-1">{opt.label}</span>
						<span class="tabular-nums text-xs text-muted-foreground"
							>{s.counts[f.id]?.[opt.value] ?? 0}</span
						>
					</label>
				{/each}
			</div>
		{/each}

		<button
			type="button"
			class="w-full rounded-md border border-input px-2 py-1 text-sm hover:bg-muted"
			onclick={() => s.browse.reset()}>{kit.labels.resetFilters()}</button
		>
	</Popup>
</div>
