<script lang="ts">
	/**
	 * The action cluster — the component that makes the position an invariant.
	 *
	 * Renders ① primary → ② secondary → ③ overflow, left to right, right-aligned.
	 * A screen supplies WHAT its actions are; it does not get to decide where
	 * they sit. That is the entire point: stibu's user could not find the forward
	 * action until every screen put it in the same place.
	 *
	 * The overflow renders only when non-empty, so a `⋮` never opens onto nothing.
	 */
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	import ActionMenu from './ActionMenu.svelte';
	import type { Action, IconOf } from './types.js';

	let {
		primary = undefined,
		secondary = [],
		overflow = [],
		leading,
		class: klass = ''
	}: {
		/** At most one. If a screen wants two, one of them is not the forward action. */
		primary?: Action;
		secondary?: Action[];
		overflow?: Action[];
		/** Non-action chrome that belongs in the cluster — a view toggle, a hint. */
		leading?: Snippet;
		class?: string;
	} = $props();
</script>

<div class="flex shrink-0 items-center gap-2 {klass}">
	{#if leading}{@render leading()}{/if}

	{#if primary}
		{@const Icon = primary.icon as IconOf}
		<Button
			variant="primary"
			href={primary.href}
			onclick={primary.onclick}
			disabled={primary.disabled}
			title={primary.title ?? primary.label}
		>
			{#if primary.icon}<Icon class="size-4 shrink-0" />{/if}
			<!-- The label collapses on a phone, where the bar has no room for a
			     sentence; the icon and the position carry it. -->
			<span class="hidden sm:inline">{primary.label}</span>
		</Button>
	{/if}

	{#each secondary as action (action.label)}
		{@const Icon = action.icon as IconOf}
		<Button
			variant="outline"
			href={action.href}
			onclick={action.onclick}
			disabled={action.disabled}
			title={action.title ?? action.label}
		>
			{#if action.icon}<Icon class="size-4 shrink-0" />{/if}
			<span class="hidden sm:inline">{action.label}</span>
		</Button>
	{/each}

	{#if overflow.length}
		<ActionMenu actions={overflow} />
	{/if}
</div>
