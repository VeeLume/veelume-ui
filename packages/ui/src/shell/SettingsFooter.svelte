<script lang="ts">
	/**
	 * Default rail footer for apps WITHOUT an account concept: the settings
	 * entry and nothing else.
	 *
	 * The settled evidence is the position — settings at the bottom of the
	 * rail, below the divider (stibu and Starlume derived it independently).
	 * This is the smallest component that honours it. Apps with a signed-in
	 * user want `AccountFooter` instead; apps with a different idea replace
	 * the footer entirely — it is only a snippet.
	 */
	import { page } from '$app/state';
	import { railRowClass, type NavIcon, type IconOf } from './types.js';
	import { peekShellContext } from './context.svelte.js';
	import { getKitContext } from '../context/index.js';
	import GearIcon from './GearIcon.svelte';

	let {
		href = '/settings',
		icon = undefined,
		showLabels = undefined
	}: {
		href?: string;
		/** Replaces the built-in gear — pass the app's icon set for consistency. */
		icon?: NavIcon;
		/** Defaults to the shell's decision; standalone usage (gallery, a bare
		 *  `NavRail`) passes it explicitly. */
		showLabels?: boolean;
	} = $props();

	const shell = peekShellContext();
	const kit = getKitContext();

	const labels = $derived(showLabels ?? shell?.showLabels ?? false);
	const pathname = $derived(shell?.activePath ?? page.url.pathname);
	const active = $derived(pathname === href || pathname.startsWith(href + '/'));
	const Icon = $derived(icon as IconOf | undefined);
</script>

<a
	{href}
	class={railRowClass}
	class:w-full={labels}
	class:justify-center={!labels}
	class:bg-accent={active}
	class:text-accent-foreground={active}
	class:text-muted-foreground={!active}
	class:hover:bg-accent={!active}
	style="height: var(--density-target)"
	aria-current={active ? 'page' : undefined}
	title={!labels ? kit.labels.settings() : undefined}
>
	{#if Icon}<Icon size={20} class="shrink-0" />{:else}<GearIcon size={20} class="shrink-0" />{/if}
	{#if labels}<span class="truncate">{kit.labels.settings()}</span>{/if}
</a>
