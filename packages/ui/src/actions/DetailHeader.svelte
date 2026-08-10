<script lang="ts">
	/**
	 * The header bar for a record or a form: back · title · actions.
	 *
	 * The detail pane's half of the two-header layout. Its peer is
	 * `Surface.ListHeader`, and both are `<Bar>` — same height, same inset, same
	 * control size — so nothing shifts when you navigate between them. A cluster
	 * in a fixed place is only half the promise if the bar it sits in changes.
	 *
	 * ⚑ The leading slot is ALWAYS occupied — a back button, or an empty spacer of
	 * the same width. Lifted verbatim from stibu, where the reasoning is: it
	 * anchors the title at the same x as a list's search field (both sit after a
	 * 36px leading control), so the title does not jump on navigation. Dropping
	 * the spacer is the obvious "simplification" that reintroduces the jump.
	 */
	import type { Snippet } from 'svelte';
	import Bar from './Bar.svelte';
	import { getKitContext } from '../context/index.js';
	import { breakpoints } from '../theme/breakpoints.svelte.js';

	let {
		title,
		onback = undefined,
		backOnDesktop = false,
		actions,
		class: klass = ''
	}: {
		title: string;
		onback?: () => void;
		/**
		 * Single-pane screens need the back arrow on desktop too. A list-detail
		 * screen leaves this false — the list beside it IS the way back.
		 */
		backOnDesktop?: boolean;
		/** Put an `<Actions>` here; the tiers do the rest. */
		actions?: Snippet;
		class?: string;
	} = $props();

	const kit = getKitContext();
	const showBack = $derived(!!onback && (!breakpoints.isDesktop || backOnDesktop));
	const reserveSpacer = $derived(!!onback && !showBack);
</script>

<Bar class={klass}>
	{#if showBack}
		<button
			type="button"
			onclick={onback}
			aria-label={kit.labels.back()}
			class="inline-flex size-9 shrink-0 items-center justify-center rounded-md
			       transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40
			       focus-visible:outline-none"
		>
			<svg
				viewBox="0 0 16 16"
				class="size-4"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M10 3 5 8l5 5" />
			</svg>
		</button>
	{:else if reserveSpacer}
		<div class="size-9 shrink-0" aria-hidden="true"></div>
	{/if}

	<h2 class="min-w-0 flex-1 truncate text-base font-semibold">{title}</h2>

	{#if actions}{@render actions()}{/if}
</Bar>
