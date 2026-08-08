<script lang="ts">
	/**
	 * The bottom bar as a shell part: `BottomNav` driven by the frame.
	 *
	 * Mounting it is the declaration — registration in the shell context is
	 * what tells the rail to yield the narrow widths. It renders only when the
	 * width calls for it, so composing it is unconditional.
	 */
	import { onDestroy } from 'svelte';
	import BottomNav from './BottomNav.svelte';
	import type { NavItem } from './types.js';
	import { getShellContext } from './context.svelte.js';

	let {
		items = undefined,
		class: klass = ''
	}: {
		/** Defaults to every nav item, which is right only for small navs —
		 *  pick explicitly past four or five. */
		items?: NavItem[];
		class?: string;
	} = $props();

	const shell = getShellContext();
	onDestroy(shell.registerBottomBar());

	const flatItems = $derived(shell.groups.flatMap((g) => g.items));
</script>

{#if shell.showBottom}
	<BottomNav items={items ?? flatItems} activePath={shell.activePath} class={klass} />
{/if}
