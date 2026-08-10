<script lang="ts">
	/**
	 * A pane's scrolling body — the region under a `DetailHeader`.
	 *
	 * Separate from `Pane` because not every pane has one: `Compare` manages
	 * its own scroll container (it has to, for the sticky axes), so wrapping it
	 * in a padded scroller would nest two scrollbars. A pane is a card; what
	 * scrolls inside it is a choice.
	 */
	import type { Snippet } from 'svelte';

	let { class: klass = '', children }: { class?: string; children: Snippet } = $props();
</script>

<div class="min-h-0 flex-1 overflow-auto p-4 {klass}">
	{@render children()}
</div>
