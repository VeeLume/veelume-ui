<script lang="ts" generics="R extends Row">
	/**
	 * The list pane: its own header, its rows, and the four states it can be in.
	 *
	 * The header is a CHILD, not a sibling, because search and filters belong to
	 * the list — see `ListHeader` for what that containment buys. A page-level bar
	 * is the escalation case (`Surface.Toolbar`), not the default.
	 *
	 * `status` is passed in rather than read from a collection: a surface may draw
	 * on several sources (reference + overlay), so only the caller knows which
	 * one's status the list should reflect.
	 *
	 * Note `refreshing` keeps the rows on screen. That is the whole point of the
	 * status union — a background revalidation must not blank out good data.
	 */
	import type { Snippet } from 'svelte';
	import ListHeader from './ListHeader.svelte';
	import { getKitContext } from '../context/index.js';
	import { getSurfaceContext } from './context.js';
	import { createWindow } from '../window/index.svelte.js';
	import type { Row } from './types.js';
	import type { Action } from '../actions/types.js';
	import type { Status } from '../collection/index.svelte.js';

	let {
		status = 'ready',
		selected = undefined,
		action = undefined,
		onselect,
		header,
		headerLeading,
		row,
		empty,
		class: klass = ''
	}: {
		status?: Status;
		/** Overrides Root's `selected` for the rare surface with two lists. */
		selected?: string | null;
		/** The list's one forward action — "New …". Rendered in the header. */
		action?: Action;
		onselect?: (row: R) => void;
		/** Replace the whole header band. The escape hatch, one level down. */
		header?: Snippet;
		/** Prepend to the default header, keeping search and filters. */
		headerLeading?: Snippet;
		/** Replace the default row rendering entirely. */
		row?: Snippet<[R, boolean]>;
		empty?: Snippet;
		class?: string;
	} = $props();

	const s = getSurfaceContext<R>();
	const kit = getKitContext();

	const openKey = $derived(selected !== undefined ? selected : s.selected);

	// Viewport windowing — neutral below its threshold, so a short list renders
	// exactly as before. Engages by size, not by prop: a rendering strategy is
	// the kit's business, not a flag the consumer has to remember.
	const win = createWindow(() => s.visible.length);
	const windowed = $derived(s.visible.slice(win.start, win.end));

	const rowClass = (isSelected: boolean) =>
		'flex w-full items-baseline gap-2 border-b border-border px-3 py-2 text-left text-sm ' +
		'transition-colors last:border-b-0 ' +
		(isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted');
</script>

{#snippet body(r: R)}
	<span class="min-w-0 flex-1">
		<span class="block truncate font-medium">{r.title}</span>
		{#if r.subtitle}
			<span class="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
		{/if}
	</span>
	{#if r.trailing}
		<span class="shrink-0 text-xs tabular-nums text-muted-foreground">{r.trailing}</span>
	{/if}
	{#if r.badge}
		<span class="shrink-0 rounded-sm bg-muted px-1 py-px text-[0.65rem] text-muted-foreground"
			>{r.badge}</span
		>
	{/if}
{/snippet}

<div
	class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card {klass}"
>
	{#if header}
		{@render header()}
	{:else}
		<ListHeader {action} leading={headerLeading} />
	{/if}

	{#if s.narrowing}
		<!-- Only while narrowing. Unnarrowed this row would restate the list and
		     cost 28px on every surface forever; narrowed it answers the question the
		     user just asked, and carries the way out. -->
		<div
			class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1
			       text-xs text-muted-foreground"
		>
			<span class="tabular-nums">{kit.labels.narrowedCount({ shown: s.shown, total: s.total })}</span>
			<button
				type="button"
				class="ml-auto rounded px-1 underline-offset-2 hover:underline"
				onclick={() => s.browse.reset()}>{kit.labels.resetFilters()}</button
			>
		</div>
	{/if}

	<div class="min-h-0 flex-1 overflow-auto" {@attach win.container}>
		{#if status === 'loading'}
			<p class="p-4 text-sm text-muted-foreground">{kit.labels.loading()}</p>
		{:else if status === 'error'}
			<p class="p-4 text-sm text-destructive">{kit.labels.errorTitle()}</p>
		{:else if s.visible.length === 0}
			{#if empty}
				{@render empty()}
			{:else}
				<p class="p-6 text-center text-sm text-muted-foreground">{kit.labels.empty()}</p>
			{/if}
		{:else}
			<ul style:padding-top="{win.padTop}px" style:padding-bottom="{win.padBottom}px">
				{#each windowed as r, i (r.key)}
					{@const isSelected = openKey === r.key}
					<li data-index={win.start + i} {@attach win.item}>
						{#if row}
							{@render row(r, isSelected)}
						{:else if r.href}
							<!-- Split rather than <svelte:element>: an anchor and a button carry
							     different implicit roles, and a dynamic element leaves the
							     compiler unable to check the a11y contract. -->
							<a href={r.href} class={rowClass(isSelected)} onclick={() => onselect?.(r)}>
								{@render body(r)}
							</a>
						{:else}
							<button type="button" class={rowClass(isSelected)} onclick={() => onselect?.(r)}>
								{@render body(r)}
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
