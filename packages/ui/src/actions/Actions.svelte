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
	import Spinner from './Spinner.svelte';
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
			disabled={primary.disabled || primary.busy}
			title={primary.title ?? primary.label}
		>
			<!-- Busy takes the ICON slot rather than adding a glyph: the button
			     must not change width when its work starts. An action with no
			     icon still gets one, which is the honest trade — a moment of
			     motion beats a dead button with no explanation. -->
			{#if primary.busy}
				<Spinner />
			{:else if primary.icon}
				<Icon class="size-4 shrink-0" />
			{/if}
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
			disabled={action.disabled || action.busy}
			title={action.title ?? action.label}
		>
			{#if action.busy}
				<Spinner />
			{:else if action.icon}
				<Icon class="size-4 shrink-0" />
			{/if}
			<span class="hidden sm:inline">{action.label}</span>
		</Button>
	{/each}

	{#if overflow.length}
		<ActionMenu actions={overflow} />
	{/if}
</div>
