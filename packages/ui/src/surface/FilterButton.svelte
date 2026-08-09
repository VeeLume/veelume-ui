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
	import Popup from '../popup/Popup.svelte';
	import { getKitContext } from '../context/index.js';
	import { getSurfaceContext } from './context.js';

	let { class: klass = '' }: { class?: string } = $props();

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

	<!-- The dismissal semantics (outside click, Escape, focus return) are the
	     Popup base's — the upgrade the old inline-panel comment promised, and
	     it changed nothing about this component's public API. -->
	<Popup
		{open}
		onclose={() => (open = false)}
		position="top-full left-0 mt-1"
		label={kit.labels.filters()}
		class="w-72 p-3"
	>
		{#if s.sorts.length}
			<div class="mb-3">
				<div class="mb-1 text-xs font-medium text-muted-foreground">{kit.labels.sort()}</div>
				{#each s.sorts as opt (opt.value)}
					<label class="flex items-center gap-2 py-1 text-sm">
						<input
							type="radio"
							checked={s.activeSort?.value === opt.value}
							onchange={() => s.browse.set('sort', opt.value as never)}
						/>
						{opt.label}
					</label>
				{/each}
			</div>
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
