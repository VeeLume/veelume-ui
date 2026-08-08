<script lang="ts">
	/**
	 * The rail as a shell part: `NavRail` driven by the frame's decisions.
	 *
	 * Visibility is the context's call, not a prop — with a `Shell.BottomBar`
	 * composed the rail yields the narrow widths to it; without one this rail
	 * shows at every width, so a phone still has navigation. Rendering
	 * divergence slots in through the same snippets `NavRail` takes directly.
	 */
	import type { Snippet } from 'svelte';
	import NavRail from './NavRail.svelte';
	import type { NavItem } from './types.js';
	import { getShellContext } from './context.svelte.js';

	let {
		footer,
		item,
		class: klass = ''
	}: {
		/** The bottom block — avatar, settings, whatever the app puts there. */
		footer?: Snippet<[{ showLabels: boolean }]>;
		/** Replaces a nav row's rendering; the default `<a>` otherwise. */
		item?: Snippet<[{ item: NavItem; active: boolean; showLabels: boolean }]>;
		class?: string;
	} = $props();

	const shell = getShellContext();
</script>

{#if shell.showRail}
	<NavRail
		groups={shell.groups}
		activePath={shell.activePath}
		showLabels={shell.showLabels}
		{footer}
		{item}
		class={klass}
	/>
{/if}
