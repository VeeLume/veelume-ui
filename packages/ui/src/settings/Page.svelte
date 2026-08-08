<script lang="ts">
	/**
	 * One category page: `DetailHeader` (back · title · actions) over a
	 * centred content column of `Settings.Section`s.
	 *
	 * Back leads to the section root and shows only at narrow widths — on
	 * desktop the category list beside the page IS the way back, the exact
	 * rule `DetailHeader` already encodes for list-detail surfaces. The header
	 * still reserves the 36px leading spacer there, so the title sits at the
	 * same x either way.
	 */
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import DetailHeader from '../actions/DetailHeader.svelte';
	import { getSettingsContext } from './context.js';

	let {
		title,
		onback = undefined,
		actions = undefined,
		children
	}: {
		title: string;
		/** Defaults to navigating to the section root. */
		onback?: () => void;
		/** Put an `<Actions>` here; the tiers do the rest. */
		actions?: Snippet;
		children: Snippet;
	} = $props();

	const ctx = getSettingsContext();
	const back = $derived(onback ?? (() => goto(ctx.root)));
</script>

<div class="flex h-full flex-col">
	<DetailHeader {title} onback={back} {actions} />
	<div class="min-h-0 flex-1 overflow-auto">
		<div class="mx-auto w-full max-w-2xl p-4 sm:p-6">
			{@render children()}
		</div>
	</div>
</div>
