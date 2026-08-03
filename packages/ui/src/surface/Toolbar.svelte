<script lang="ts">
	/**
	 * Search · filters · sort · count · actions.
	 *
	 * Fixed positions, per the layout decision: search on the left (aligned with
	 * the list it filters), count beside it, actions pushed right. Every region
	 * takes a snippet override, so an app changes contents without forking the
	 * component.
	 *
	 * ⚑ Same 56px bar, same 36px controls, same `px-3` as `DetailHeader` — that
	 * equality IS the feature. A cluster in a fixed place is only half the
	 * promise if the bar it sits in changes height or inset between a list and a
	 * record; the title and the search field must land on the same x so nothing
	 * jumps on navigation. Measured before this was true: 13px of drift.
	 *
	 * The search input is pinned to `h-9` rather than the density target. At
	 * comfortable density a full-height field grows to exactly the bar's own
	 * height and fills it edge to edge while its neighbours sit inset — density
	 * scales FORM fields, chrome stays fixed.
	 */
	import type { Snippet } from 'svelte';
	import { getKitContext } from '../context/index.js';
	import { getSurfaceContext } from './context.js';

	let {
		title = undefined,
		actions,
		leading,
		class: klass = ''
	}: {
		/** Shown before the controls, matching a DetailHeader's title. */
		title?: string;
		/** Right-hand region — the one forward action belongs here. */
		actions?: Snippet;
		/** Before the search field. */
		leading?: Snippet;
		class?: string;
	} = $props();

	const s = getSurfaceContext();
	const kit = getKitContext();

	let filtersOpen = $state(false);

	const activeCount = $derived(s.browse.activeCount);
</script>

<header
	class="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 {klass}"
>
	{#if title}<h2 class="mr-1 shrink-0 truncate text-base font-semibold">{title}</h2>{/if}
	{#if leading}{@render leading()}{/if}

	<div class="relative flex shrink-0 items-center gap-2 md:w-72">
		{#if s.facets.length || s.sorts.length}
			<button
				type="button"
				class="relative grid size-9 shrink-0 place-items-center rounded-md border border-input
				       bg-background shadow-xs transition-colors hover:bg-muted"
				aria-expanded={filtersOpen}
				title={kit.labels.filters()}
				onclick={() => (filtersOpen = !filtersOpen)}
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
		{/if}

		<input
			type="search"
			class="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
			placeholder={kit.labels.search()}
			value={s.query}
			oninput={(e) => s.browse.set('q', e.currentTarget.value as never)}
		/>

		{#if filtersOpen}
			<!-- Deliberately a plain panel for now, not a bits-ui Popover: the
			     dismissal semantics (outside-click, Escape, focus return) are worth
			     doing properly and are an upgrade that does not change this part's
			     public API. -->
			<div
				class="absolute top-10 left-0 z-20 w-72 rounded-md border border-input bg-background
				       p-3 shadow-lg"
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
			</div>
		{/if}
	</div>

	<span class="hidden shrink-0 text-xs text-muted-foreground sm:inline">
		{kit.labels.resultCount({ count: s.shown })}
	</span>

	<!-- ml-auto on the wrapper, not the cluster, so the forward action is pinned
	     to the right edge whether or not the count and search are present. -->
	<div class="ml-auto flex shrink-0 items-center gap-2">
		{#if actions}{@render actions()}{/if}
	</div>
</header>
