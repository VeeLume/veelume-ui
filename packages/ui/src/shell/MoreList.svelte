<script lang="ts">
	/**
	 * The More page's destination list — stibu's `/more` rows: icon, label,
	 * chevron, in one bordered card. The kit ships the LIST; the page around
	 * it (title, an account card above, anything else) is the app's, which is
	 * why this is not a `MorePage`.
	 *
	 * Feed it the `overflow` from `splitBottomNav` plus whatever is reachable
	 * only from here (settings) — the same computation the bar ran, so the
	 * two cannot disagree.
	 */
	import type { IconOf, NavItem } from './types.js';

	let { items, class: klass = '' }: { items: NavItem[]; class?: string } = $props();
</script>

<div class="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card {klass}">
	{#each items as item (item.path)}
		{@const Icon = item.icon as IconOf | undefined}
		<a href={item.path} class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent">
			{#if Icon}<Icon size={20} class="shrink-0 text-muted-foreground" />{/if}
			<span class="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
			<svg
				viewBox="0 0 16 16"
				class="size-4 shrink-0 text-muted-foreground"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="m6 3 5 5-5 5" />
			</svg>
		</a>
	{/each}
</div>
