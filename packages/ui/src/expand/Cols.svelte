<script lang="ts">
	/**
	 * The two-column expansion body: prose left, everything else right,
	 * collapsing to one column when there is no room.
	 *
	 * ⚑ A CONTAINER query, not a media query. The donor used a 1100px viewport
	 * breakpoint, which is the wrong measure the moment the list sits in a
	 * split — the pane can be 400px wide on a 1600px screen, and the expansion
	 * would confidently render two columns into it. What decides is the width
	 * of the box the expansion is in, which is exactly what a container query
	 * asks.
	 */
	import type { Snippet } from 'svelte';

	let {
		main,
		side,
		class: klass = ''
	}: {
		/** The left column — prose, typically. */
		main: Snippet;
		/** The right column. Omit and the body is simply one column, at any
		 *  width: absence is neutral here too. */
		side?: Snippet;
		class?: string;
	} = $props();
</script>

<div class="@container {klass}">
	<div class="grid gap-x-6 gap-y-3 {side ? '@2xl:grid-cols-2' : ''}">
		<div class="min-w-0">{@render main()}</div>
		{#if side}
			<div class="min-w-0">{@render side()}</div>
		{/if}
	</div>
</div>
