<script lang="ts">
	/**
	 * The content column: safe-area inset, optional banner, the scroll
	 * container, and the bottom slot.
	 *
	 * Positions are named snippets because the column's internal order is fixed
	 * geometry (the same call `Surface.Split` makes): the inset must sit above
	 * everything so sticky headers can never slide under the system bar, and a
	 * banner must sit outside the scroll container or it scrolls away.
	 *
	 * `bottom` is where `Shell.BottomBar` goes. Omitting it IS rail-only —
	 * there is no strategy flag to keep consistent with what is rendered.
	 */
	import type { Snippet } from 'svelte';

	let {
		banner = undefined,
		bottom = undefined,
		children
	}: {
		/** Above the scroll container, below the status bar — an update prompt, an offline notice. */
		banner?: Snippet;
		/** Below the scroll container — a `Shell.BottomBar`, or the app's own. */
		bottom?: Snippet;
		children: Snippet;
	} = $props();
</script>

<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
	<!-- Status bar / notch inset (0 on desktop). Non-scrolling, so sticky
	     headers below it can never slide under the system bar. -->
	<div class="shrink-0 bg-background" style="height: env(safe-area-inset-top)"></div>

	{#if banner}{@render banner()}{/if}

	<main class="min-h-0 flex-1 overflow-auto">
		{@render children()}
	</main>

	{#if bottom}{@render bottom()}{/if}
</div>
