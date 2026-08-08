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
	 *   - `railFooter`, because the account block's contents are app-specific
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
		railFooter,
		banner,
		children
	}: {
		groups: NavGroup[];
		/** Shown in the bottom bar. Defaults to every item, which is right only
		 *  for small navs — pick explicitly past four or five. */
		bottomItems?: NavItem[];
		strategy?: NavStrategy;
		activePath?: string;
		railFooter?: Snippet<[{ showLabels: boolean }]>;
		banner?: Snippet;
		children: Snippet;
	} = $props();
</script>

<Root {groups} {activePath}>
	<Rail footer={railFooter} />
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
