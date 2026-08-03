<script lang="ts" generics="R extends Row">
	/**
	 * The rows, plus the four states a list can be in.
	 *
	 * `status` is passed in rather than read from a collection: a surface may
	 * draw on several sources (reference + overlay), so only the caller knows
	 * which one's status the list should reflect.
	 *
	 * Note `refreshing` keeps the rows on screen. That is the whole point of the
	 * status union — a background revalidation must not blank out good data.
	 */
	import type { Snippet } from 'svelte';
	import { getKitContext } from '../context/index.js';
	import { getSurfaceContext } from './context.js';
	import type { Row } from './types.js';
	import type { Status } from '../collection/index.svelte.js';

	let {
		status = 'ready',
		selected = null,
		onselect,
		row,
		empty,
		class: klass = ''
	}: {
		status?: Status;
		/** Key of the open row, usually from the URL. */
		selected?: string | null;
		onselect?: (row: R) => void;
		/** Replace the default row rendering entirely. */
		row?: Snippet<[R, boolean]>;
		empty?: Snippet;
		class?: string;
	} = $props();

	const s = getSurfaceContext<R>();
	const kit = getKitContext();

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

<div class="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card {klass}">
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
		<ul>
			{#each s.visible as r (r.key)}
				{@const isSelected = selected === r.key}
				<li>
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
