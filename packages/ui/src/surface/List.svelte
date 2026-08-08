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
	import { statusBadgeClass, statusToneClass } from '../badge/types.js';
	import type { Row } from './types.js';
	import type { Action } from '../actions/types.js';
	import type { Status } from '../collection/index.svelte.js';

	let {
		status = 'ready',
		fetching = undefined,
		hasMore = false,
		onloadmore = undefined,
		updatedAt = undefined,
		staleAfter = 60_000,
		onrefresh = undefined,
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
		/**
		 * A background fetch is running — drives the throbber above the rows.
		 * Passed like `status`, and for the same reason: only the caller knows
		 * which source's activity the list should reflect. `undefined` means the
		 * caller has no fetch activity to report and no throbber track renders;
		 * a boolean reserves the track so its appearance never shifts layout.
		 */
		fetching?: boolean;
		/** The source stopped at its cap — more exists. Enables "Load more". */
		hasMore?: boolean;
		/** Extend the truncated set. Without it, `hasMore` renders nothing. */
		onloadmore?: () => void;
		/**
		 * When the data was last confirmed fresh (`view.updatedAt`). Rendered as
		 * "as of", NOT as a warning — old is not stale, and a set nobody has
		 * changed in an hour is an hour old and perfectly correct.
		 */
		updatedAt?: number;
		/**
		 * How old the data must be before the age is worth saying, in ms.
		 *
		 * ⚑ The threshold is the whole design. "Updated 2 seconds ago" on every
		 * surface is chrome that says nothing, and an indicator that fires
		 * constantly is one people learn to ignore — the casebook's
		 * "conservative guards fire constantly" lesson. Below this the band does
		 * not exist.
		 */
		staleAfter?: number;
		/** Re-read on demand. Without it the band states the age and offers no
		 *  remedy, which is just anxiety — so the button only renders with it. */
		onrefresh?: () => void;
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

	/**
	 * A ticking "now", so "5 minutes ago" keeps being true without the consumer
	 * re-rendering for other reasons.
	 *
	 * ⚑ The interval only exists once there is something to age. A permanent
	 * timer on every list in the app would be a real cost for a band that, by
	 * design, is usually absent — and `updatedAt` is undefined for every
	 * consumer that never passes it.
	 */
	let now = $state(Date.now());
	$effect(() => {
		if (updatedAt === undefined) return;
		const id = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(id);
	});

	const aged = $derived(updatedAt !== undefined && now - updatedAt >= staleAfter);

	const rowClass = (isSelected: boolean) =>
		'flex w-full items-baseline gap-2 border-b border-border px-3 py-2 text-left text-sm ' +
		'transition-colors last:border-b-0 ' +
		(isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted');
</script>

{#snippet entry(r: R)}
	{@const isSelected = openKey === r.key}
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
{/snippet}

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
		<!-- One class source with StatusBadge — a string is just the neutral tone. -->
		{@const b = typeof r.badge === 'string' ? { label: r.badge, tone: 'neutral' as const } : r.badge}
		<span class="{statusBadgeClass} {statusToneClass[b.tone]}">{b.label}</span>
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
		     cost 28px on every surface forever; narrowed it answers the question
		     the user just asked. The trailing slot carries LOAD MORE, not reset:
		     reset lives in the filter panel already, while a narrowed count over
		     a truncated set is exactly where "there may be more matches than
		     these" needs its remedy next to it. -->
		<div
			class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1
			       text-xs text-muted-foreground"
		>
			<span class="tabular-nums">{kit.labels.narrowedCount({ shown: s.shown, total: s.total })}</span>
			{#if hasMore && onloadmore}
				<button
					type="button"
					class="ml-auto rounded px-1 underline-offset-2 hover:underline"
					onclick={onloadmore}>{kit.labels.loadMore()}</button
				>
			{/if}
		</div>
	{/if}

	{#if fetching !== undefined}
		<!-- The throbber. The track is reserved whenever the caller reports fetch
		     activity at all, so the bar appearing never shifts the rows below. -->
		<div class="relative h-0.5 shrink-0 overflow-hidden" aria-hidden="true">
			{#if fetching}
				<div class="throb absolute inset-y-0 w-1/3 rounded-full bg-primary"></div>
			{/if}
		</div>
	{/if}

	<div class="min-h-0 flex-1 overflow-auto" {@attach win.container}>
		{#if status === 'loading' && s.visible.length === 0}
			<!-- Only when there is genuinely nothing to show yet — a filling set
			     streams rows while `loading`, and hiding them behind this label
			     would be the spinner the whole model exists to avoid. -->
			<p class="p-4 text-sm text-muted-foreground">{kit.labels.loading()}</p>
		{:else if status === 'error'}
			<p class="p-4 text-sm text-destructive">{kit.labels.errorTitle()}</p>
		{:else if s.visible.length === 0}
			{#if empty}
				{@render empty()}
			{:else}
				<p class="p-6 text-center text-sm text-muted-foreground">{kit.labels.empty()}</p>
			{/if}
		{:else if win.active}
			<!-- Windowed: a spacer whose height only changes with MEASUREMENTS,
			     rows placed by translateY. Scrolling moves and resizes nothing,
			     which is what keeps a scrollbar thumb drag mapped 1:1 to the
			     mouse — pad-based windowing relaid the list out on every window
			     move and the drag mapping drifted. -->
			<ul style:position="relative" style:height="{win.height}px">
				{#each windowed as r, i (r.key)}
					<li
						data-index={win.start + i}
						{@attach win.item}
						style:position="absolute"
						style:left="0"
						style:right="0"
						style:top="0"
						style:transform="translateY({win.tops[i]}px)"
					>
						{@render entry(r)}
					</li>
				{/each}
			</ul>
		{:else}
			<ul>
				{#each windowed as r (r.key)}
					<li>
						{@render entry(r)}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if aged && updatedAt !== undefined}
		<!-- "As of", at the BOTTOM. Ambient status, not a control you reach for —
		     the top belongs to the things you act with. Absent until the data is
		     old enough to be worth saying, so it costs nothing on a surface that
		     is keeping up. -->
		<div
			class="flex shrink-0 items-center gap-2 border-t border-border px-3 py-1
			       text-xs text-muted-foreground"
		>
			<span>{kit.labels.updatedAt({ when: kit.format.relativeTime(updatedAt) })}</span>
			{#if onrefresh}
				<button
					type="button"
					class="ml-auto rounded px-1 underline-offset-2 hover:underline"
					onclick={onrefresh}>{kit.labels.refresh()}</button
				>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Indeterminate sweep. A scoped keyframe rather than a Tailwind utility:
	   the consumer's Tailwind build cannot be relied on for custom keyframes
	   (the kit arrives via symlink — see the `@source` gotcha), while component
	   CSS compiles wherever the component does. */
	.throb {
		animation: throb 1.2s ease-in-out infinite;
	}
	@keyframes throb {
		from {
			left: -35%;
		}
		to {
			left: 100%;
		}
	}
</style>
