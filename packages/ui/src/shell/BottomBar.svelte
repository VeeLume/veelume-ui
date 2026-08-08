<script lang="ts">
	/**
	 * The bottom bar as a shell part: `BottomNav` driven by the frame.
	 *
	 * Mounting it is the declaration — registration in the shell context is
	 * what tells the rail to yield the narrow widths. It renders only when the
	 * width calls for it, so composing it is unconditional.
	 *
	 * The default arrangement is stibu's: the hero (start) item dead centre,
	 * and when the nav does not fit, the outer-right slot becomes a More
	 * collector pointing at `moreHref` — a ROUTE the app provides (compose
	 * `Shell.MoreList` there), not a popup. The collector owns every path it
	 * collected, so it stays lit while the user is inside one.
	 *
	 * Escape hatches, in escalation order: `hero`/`slots`/`moreHref`/
	 * `moreOwns`/`moreIcon` tune the default; an explicit `items` array
	 * replaces the computation entirely (hand-picked slots, stibu-style hubs
	 * via `NavItem.owns`).
	 */
	import { onDestroy } from 'svelte';
	import BottomNav from './BottomNav.svelte';
	import MoreIcon from './MoreIcon.svelte';
	import { splitBottomNav, type NavIcon, type NavItem } from './types.js';
	import { getShellContext } from './context.svelte.js';
	import { getKitContext } from '../context/index.js';

	let {
		items = undefined,
		hero = undefined,
		slots = 5,
		moreHref = '/more',
		moreOwns = undefined,
		moreIcon = undefined,
		class: klass = ''
	}: {
		/** Explicit slots, in order — replaces the split entirely. */
		items?: NavItem[];
		/** Path of the centred item. Defaults to the first nav item; `false`
		 *  keeps declaration order. */
		hero?: string | false;
		/** Bar width in items. Five is stibu's thumb rule. */
		slots?: number;
		/** The More collector's route. The app owns the page — compose
		 *  `Shell.MoreList` there. */
		moreHref?: string;
		/** Extra paths the collector claims beyond what it collected —
		 *  destinations reachable only through the More page (settings). */
		moreOwns?: string[];
		/** Replaces the built-in `⋯` — pass the app's icon set for consistency. */
		moreIcon?: NavIcon;
		class?: string;
	} = $props();

	const shell = getShellContext();
	const kit = getKitContext();
	onDestroy(shell.registerBottomBar());

	const flatItems = $derived(shell.groups.flatMap((g) => g.items));
	const computed = $derived(
		items ??
			splitBottomNav(flatItems, {
				hero,
				slots,
				more: {
					label: kit.labels.more(),
					path: moreHref,
					icon: moreIcon ?? MoreIcon,
					owns: moreOwns
				}
			}).bar
	);
</script>

{#if shell.showBottom}
	<BottomNav items={computed} activePath={shell.activePath} class={klass} />
{/if}
