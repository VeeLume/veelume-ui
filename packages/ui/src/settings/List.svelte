<script lang="ts">
	/**
	 * The category list: title bar + one row per category (icon square, label,
	 * description, chevron). Selection is the ROUTE — a row is a link, active
	 * is a path-prefix match — which is what makes back/forward and deep links
	 * work with no state of its own.
	 *
	 * The title bar is a `<Bar>`, so it cannot drift from the 56px chrome
	 * geometry every other bar shares.
	 */
	import { page } from '$app/state';
	import Bar from '../actions/Bar.svelte';
	import { getKitContext } from '../context/index.js';
	import type { IconOf } from '../theme/types.js';
	import { getSettingsContext } from './context.js';

	const kit = getKitContext();
	const ctx = getSettingsContext();

	const pathname = $derived(page.url.pathname);
</script>

<div class="flex h-full w-full flex-col bg-background">
	<Bar class="shrink-0 border-b border-border">
		<h1 class="text-base font-semibold">{kit.labels.settings()}</h1>
	</Bar>

	<div class="min-h-0 flex-1 overflow-auto">
		{#each ctx.categories as category (category.id)}
			{@const Icon = category.icon as IconOf | undefined}
			{@const active = pathname === category.path || pathname.startsWith(category.path + '/')}
			<a
				href={category.path}
				class="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-accent"
				class:bg-accent={active}
				aria-current={active ? 'page' : undefined}
			>
				{#if Icon}
					<span
						class="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
					>
						<Icon size={20} />
					</span>
				{/if}
				<span class="min-w-0 flex-1">
					<span class="block truncate text-sm font-medium">{category.label}</span>
					{#if category.description}
						<span class="block truncate text-xs text-muted-foreground">
							{category.description}
						</span>
					{/if}
				</span>
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
</div>
