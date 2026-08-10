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
	import { untrack, type Snippet } from 'svelte';
	import ListHeader from './ListHeader.svelte';
	import { getKitContext } from '../context/index.js';
	import { getSurfaceContext } from './context.js';
	import { createWindow } from '../window/index.svelte.js';
	import { statusBadgeClass, statusToneClass } from '../badge/types.js';
	import { isGroupHeader } from './types.js';
	import type { GroupHeader, ListEntry, Row } from './types.js';
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
		headerPanel,
		row,
		group,
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
		/** Extra controls inside the filter panel — view options like a grouping
		 *  toggle, which would otherwise eat the header width search needs. */
		headerPanel?: Snippet;
		/** Replace the default row rendering entirely. */
		row?: Snippet<[R, boolean]>;
		/** Replace the default section header — for aggregates the default
		 *  can't know about (Hearth's owned x/y reads the entry's `rows`). */
		group?: Snippet<[GroupHeader<R>]>;
		empty?: Snippet;
		class?: string;
	} = $props();

	const s = getSurfaceContext<R>();
	const kit = getKitContext();

	const openKey = $derived(selected !== undefined ? selected : s.selected);

	// Viewport windowing — neutral below its threshold, so a short list renders
	// exactly as before. Engages by size, not by prop: a rendering strategy is
	// the kit's business, not a flag the consumer has to remember.
	//
	// Windowed over ENTRIES, not rows: section headers are entries like any
	// other, measured by the same ResizeObserver — which is also why sticky
	// headers are deliberately not offered. `position: sticky` dies inside a
	// `translateY`-positioned entry (the transform establishes the containing
	// block), so sticky and windowing conflict structurally, not by oversight.
	const win = createWindow(() => s.entries.length);
	const windowed = $derived(s.entries.slice(win.start, win.end));

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

	/**
	 * Selection is followed into view — automatically, and with no prop.
	 *
	 * Every donor hand-rolls this, and the consumer cannot do it correctly
	 * above the windowing threshold anyway (the row may not be in the DOM, so
	 * `scrollIntoView` has nothing to call). `nearest` means a click on an
	 * already-visible row scrolls nothing, so the only times it moves are the
	 * ones that need it: back/forward, a deep link, a tab activated from the
	 * strip, or a neighbour promoted when a tab closed.
	 *
	 * Three things here are load-bearing, and each was a bug first:
	 *
	 * ⚑ `lastFollowed` is committed only on SUCCESS. A deep link arrives before
	 *   the data does, so the first run finds nothing; marking the key followed
	 *   there means the row never gets scrolled to when the set fills.
	 *
	 * ⚑ `status` is the retry trigger, NOT the entry list. Reading `s.entries`
	 *   tracked would reach the collection's lazy `ensure()`, which writes the
	 *   set it just read — the documented `effect_update_depth_exceeded` trap.
	 *   `status` is a plain prop, it already changes exactly when data arrives,
	 *   and it costs nothing.
	 *
	 * ⚑ Guarded on the KEY, not the index: `entries` changes on every filter
	 *   keystroke, and re-running then would fight a user who scrolled away
	 *   while typing.
	 */
	let lastFollowed: string | null = null; // deliberately not $state
	$effect(() => {
		const key = openKey;
		// Tracked purely as the "data may have arrived" signal.
		void status;
		if (!key) {
			lastFollowed = null;
			return;
		}
		if (key === lastFollowed) return;
		const index = untrack(() => s.entries.findIndex((e) => !isGroupHeader(e) && e.key === key));
		// Absent (still loading, or filtered out) — leave the key unfollowed so
		// the next status change tries again.
		if (index < 0) return;
		lastFollowed = key;
		win.scrollTo(index);
	});

	/**
	 * One-directional indentation: a header sits at its level's edge, every row
	 * one step past the DEEPEST level — content always right of its label, so
	 * the nesting can never read backwards. Legal without per-row depth because
	 * sections are UNIFORM: `groupDepth` is a surface constant, which a tree
	 * could never claim — per-row indent is Expand's business, not this list's.
	 * Ungrouped surfaces get 0 and render byte-identical to before.
	 */
	const INDENT = 12;
	const indentOf = (e: ListEntry<R>) => (isGroupHeader(e) ? e.level : s.groupDepth) * INDENT;

	const rowClass = (isSelected: boolean) =>
		'flex w-full items-baseline gap-2 border-b border-border px-3 py-2 text-left text-sm ' +
		'transition-colors last:border-b-0 ' +
		(isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted');
</script>

{#snippet section(h: GroupHeader<R>)}
	<!-- A header is NOT a row: never selectable, never expandable, skipped by
	     `onselect`. The default shows label · visible count; the `group`
	     snippet replaces it when a consumer wants aggregates.

	     ⚑ Hierarchy is typography PLUS one-directional indentation: the header
	     sits at its level's edge and content indents PAST it (see indentOf).
	     Header species still differ — level 0 a small heading in the primary
	     colour (Hearth's accent-heading move), deeper levels tracked kickers —
	     because indent alone cannot separate a label from a row title. -->
	{#if group}
		{@render group(h)}
	{:else if h.level === 0}
		<div class="flex items-baseline gap-2 px-3 pt-4 pb-1 text-sm font-semibold text-primary">
			<span class="truncate">{h.label}</span>
			<span class="shrink-0 text-xs font-normal tabular-nums text-muted-foreground"
				>{h.rows.length}</span
			>
		</div>
	{:else}
		<div
			class="flex items-baseline gap-2 px-3 pt-2.5 pb-1 text-xs font-medium
			       tracking-wider text-muted-foreground uppercase"
		>
			<span class="truncate">{h.label}</span>
			<span class="shrink-0 tabular-nums opacity-70">{h.rows.length}</span>
		</div>
	{/if}
{/snippet}

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
		{@const b =
			typeof r.badge === 'string' ? { label: r.badge, tone: 'neutral' as const } : r.badge}
		<span class="{statusBadgeClass} {statusToneClass[b.tone]}">{b.label}</span>
	{/if}
{/snippet}

<div
	class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card {klass}"
>
	{#if header}
		{@render header()}
	{:else}
		<ListHeader {action} leading={headerLeading} panel={headerPanel} />
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
			<span class="tabular-nums"
				>{kit.labels.narrowedCount({ shown: s.shown, total: s.total })}</span
			>
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
				{#each windowed as e, i (e.key)}
					<li
						data-index={win.start + i}
						{@attach win.item}
						style:position="absolute"
						style:left="0"
						style:right="0"
						style:top="0"
						style:transform="translateY({win.tops[i]}px)"
						style:padding-left="{indentOf(e)}px"
					>
						{#if isGroupHeader(e)}
							{@render section(e)}
						{:else}
							{@render entry(e)}
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<!-- Measured here too, though nothing is windowed: `scrollTo` computes
			     from these heights at EITHER size, so a consumer gets one call
			     instead of a branch it has to remember. One shared observer over
			     at most `threshold` rows is not a cost worth a second code path. -->
			<ul>
				{#each windowed as e, i (e.key)}
					<li data-index={i} {@attach win.item} style:padding-left="{indentOf(e)}px">
						{#if isGroupHeader(e)}
							{@render section(e)}
						{:else}
							{@render entry(e)}
						{/if}
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
