<script lang="ts">
	/**
	 * The default arrangement — `Shell.Root/Rail/Content/BottomBar` composed
	 * the way most apps want them. Nothing here an app could not write itself;
	 * that is the point. An app with a different frame composes the parts
	 * directly (see apps/demo's root layout) and keeps every part it did not
	 * replace updating with the kit.
	 *
	 * What stays the app's:
	 *   - `strategy`, because mobile nav is the one deliberate variation point
	 *     (stibu is rail+bottom; Hearth and Starlume are rail-only)
	 *   - `bottomItems`, because choosing what a phone user reaches for is a
	 *     content judgement
	 *   - `railHeader` / `railFooter`, because a brand row and an account block
	 *     are app content — a bell belongs in the header exactly when the app
	 *     has background work to announce
	 *
	 * `banner` exists for the things that must sit above the scroll container and
	 * below the status bar — an update prompt, an offline notice. Putting them in
	 * `children` would let them scroll away.
	 */
	import type { Snippet } from 'svelte';
	import Root from './Root.svelte';
	import Rail from './Rail.svelte';
	import Content from './Content.svelte';
	import BottomBar from './BottomBar.svelte';
	import type { NavGroup, NavItem, NavStrategy } from './types.js';

	let {
		groups,
		bottomItems = undefined,
		strategy = 'bottom',
		activePath = undefined,
		railHeader,
		railFooter,
		banner,
		children
	}: {
		groups: NavGroup[];
		/** Explicit bottom-bar slots. Omitted, the bar runs the default split:
		 *  hero centred, overflow collected behind a trailing More slot. */
		bottomItems?: NavItem[];
		strategy?: NavStrategy;
		activePath?: string;
		/** The brand row — app-specific for the same reason as the footer. */
		railHeader?: Snippet<[{ showLabels: boolean }]>;
		railFooter?: Snippet<[{ showLabels: boolean }]>;
		banner?: Snippet;
		children: Snippet;
	} = $props();
</script>

<Root {groups} {activePath}>
	<Rail header={railHeader} footer={railFooter} />
	<Content {banner}>
		{#snippet bottom()}
			<!-- Mounting BottomBar is what makes the rail yield narrow widths,
			     so the strategy check must gate the mount, not the visibility. -->
			{#if strategy === 'bottom'}
				<BottomBar items={bottomItems} />
			{/if}
		{/snippet}
		{@render children()}
	</Content>
</Root>
