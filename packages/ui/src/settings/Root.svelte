<script lang="ts">
	/**
	 * The settings section's frame — stibu's three-state responsive layout,
	 * which is the must-not-drift part of the scaffold:
	 *
	 *   desktop           category list + content, side by side
	 *   narrow, at root   the category list fills the screen
	 *   narrow, deeper    the category page fills the screen (back in its header)
	 *
	 * Goes in the settings route's `+layout.svelte`; `children` is the routed
	 * page. The root `+page.svelte` renders `<Settings.Placeholder>` — it shows
	 * only on desktop, because at narrow widths the root state IS the list.
	 *
	 * The `list` snippet replaces the built-in pane for apps with a different
	 * idea; everything not replaced keeps updating with the kit.
	 */
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { breakpoints } from '../shell/breakpoints.svelte.js';
	import { setSettingsContext } from './context.js';
	import type { SettingsCategory } from './types.js';
	import List from './List.svelte';

	let {
		categories,
		root = '/settings',
		list = undefined,
		children
	}: {
		/** In display order. Visibility policy is the app's — filter before passing. */
		categories: SettingsCategory[];
		/** The section's root route — where back leads and where "at root" is. */
		root?: string;
		/** Replaces the built-in category list. */
		list?: Snippet;
		children: Snippet;
	} = $props();

	setSettingsContext({
		get categories() {
			return categories;
		},
		get root() {
			return root;
		}
	});

	const atRoot = $derived(page.url.pathname === root);
</script>

{#if breakpoints.isDesktop}
	<div class="flex h-full">
		<div class="w-80 shrink-0 border-r border-border lg:w-96">
			{#if list}{@render list()}{:else}<List />{/if}
		</div>
		<div class="min-w-0 flex-1 overflow-auto">
			{@render children()}
		</div>
	</div>
{:else if atRoot}
	{#if list}{@render list()}{:else}<List />{/if}
{:else}
	<div class="h-full overflow-auto">
		{@render children()}
	</div>
{/if}
