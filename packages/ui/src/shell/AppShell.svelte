<script lang="ts">
	/**
	 * The app frame: rail beside content, bottom bar underneath it on narrow
	 * screens, with the safe-area insets a Tauri mobile build needs.
	 *
	 * The responsive behaviour is the shell's, not each app's — that is the whole
	 * reason it moved into the kit. What stays the app's:
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
	import NavRail from './NavRail.svelte';
	import BottomNav from './BottomNav.svelte';
	import { breakpoints } from './breakpoints.svelte.js';
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

	const flatItems = $derived(groups.flatMap((g) => g.items));
	// rail-only keeps the rail at every width, so a narrow window gets icons
	// rather than a bar the app never designed for.
	const showRail = $derived(strategy === 'rail-only' || breakpoints.showRail);
	const showBottom = $derived(strategy === 'bottom' && breakpoints.showBottomNav);
</script>

<div class="flex h-svh overflow-hidden bg-background">
	{#if showRail}
		<NavRail
			{groups}
			{activePath}
			showLabels={breakpoints.showLabels}
			footer={railFooter}
		/>
	{/if}

	<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
		<!-- Status bar / notch inset (0 on desktop). Non-scrolling, so sticky
		     headers below it can never slide under the system bar. -->
		<div class="shrink-0 bg-background" style="height: env(safe-area-inset-top)"></div>

		{#if banner}{@render banner()}{/if}

		<main class="min-h-0 flex-1 overflow-auto">
			{@render children()}
		</main>

		{#if showBottom}
			<BottomNav items={bottomItems ?? flatItems} {activePath} />
		{/if}
	</div>
</div>
