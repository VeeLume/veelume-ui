<script lang="ts">
	/**
	 * The frame: a full-height flex row that owns the shell context.
	 *
	 * No visual opinion beyond the frame itself — what sits in the row is the
	 * composition's call. `AppShell` is the default arrangement; an app with a
	 * different frame composes these parts itself (or its own parts reading the
	 * same context) and keeps every piece it did not replace in sync.
	 */
	import type { Snippet } from 'svelte';
	import type { NavGroup } from './types.js';
	import { createShellContext, setShellContext } from './context.svelte.js';

	let {
		groups,
		activePath = undefined,
		children
	}: {
		groups: NavGroup[];
		/** Defaults to the current route; override for tests or nested routers. */
		activePath?: string;
		children: Snippet;
	} = $props();

	setShellContext(
		createShellContext({
			groups: () => groups,
			activePath: () => activePath
		})
	);
</script>

<div class="flex h-svh overflow-hidden bg-background">
	{@render children()}
</div>
