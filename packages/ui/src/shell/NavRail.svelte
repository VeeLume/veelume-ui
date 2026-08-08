<script lang="ts">
	/**
	 * The navigation rail.
	 *
	 * Two things are settled rather than configurable, because stibu and Starlume
	 * arrived at both independently:
	 *   - the rail collapses to icons and re-earns its labels with width
	 *   - the account/settings block sits at the BOTTOM, below a divider
	 *
	 * What goes in that block is the app's — an avatar, a cog, both — so it
	 * arrives as a snippet. Hardcoding a `/settings` link here is exactly the
	 * coupling that made connect-neo's surface unportable.
	 */
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { activeNavPath, railRowClass, type NavGroup, type NavItem, type IconOf } from './types.js';

	let {
		groups,
		activePath = undefined,
		showLabels = false,
		footer,
		item,
		class: klass = ''
	}: {
		groups: NavGroup[];
		/** Defaults to the current route; override for tests or nested routers. */
		activePath?: string;
		showLabels?: boolean;
		/** The bottom block — avatar, settings, whatever the app puts there. */
		footer?: Snippet<[{ showLabels: boolean }]>;
		/** Replaces a nav row's rendering — a `soon` flag, a badge count. The
		 *  default `<a>` otherwise; grouping and geometry stay the rail's. */
		item?: Snippet<[{ item: NavItem; active: boolean; showLabels: boolean }]>;
		class?: string;
	} = $props();

	const pathname = $derived(activePath ?? page.url.pathname);
	const active = $derived(
		activeNavPath(
			pathname,
			groups.flatMap((g) => g.items.map((i) => i.path))
		)
	);

	const rowBase = railRowClass;
</script>

<nav
	class="flex flex-col border-r border-border bg-background py-3 {klass}"
	class:w-56={showLabels}
	class:px-3={showLabels}
	class:w-20={!showLabels}
	class:items-center={!showLabels}
	class:px-2={!showLabels}
>
	<div class="flex min-h-0 flex-1 flex-col gap-1 overflow-auto" class:w-full={showLabels}>
		{#each groups as group, i (group.label ?? i)}
			{#if group.label && showLabels}
				<div
					class="px-3 pt-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
				>
					{group.label}
				</div>
			{:else if i > 0}
				<!-- Without labels a group heading has nowhere to go, so the grouping
				     survives as a divider rather than vanishing. -->
				<div
					class="my-1 h-px self-center bg-border"
					class:w-full={showLabels}
					class:w-6={!showLabels}
				></div>
			{/if}

			{#each group.items as navItem (navItem.path)}
				{@const isActive = active === navItem.path}
				{@const Icon = navItem.icon as IconOf}
				{#if item}
					{@render item({ item: navItem, active: isActive, showLabels })}
				{:else}
					<a
						href={navItem.path}
						class={rowBase}
						class:w-full={showLabels}
						class:justify-center={!showLabels}
						class:bg-accent={isActive}
						class:text-accent-foreground={isActive}
						class:text-muted-foreground={!isActive}
						class:hover:bg-accent={!isActive}
						style="height: var(--density-target)"
						aria-current={isActive ? 'page' : undefined}
						title={!showLabels ? navItem.label : undefined}
					>
						{#if navItem.icon}<Icon size={20} class="shrink-0" />{/if}
						{#if showLabels}<span class="truncate">{navItem.label}</span>{/if}
					</a>
				{/if}
			{/each}
		{/each}
	</div>

	{#if footer}
		<div
			class="mt-2 flex flex-col gap-1 border-t border-border pt-2"
			class:w-full={showLabels}
			class:items-center={!showLabels}
		>
			{@render footer({ showLabels })}
		</div>
	{/if}
</nav>
