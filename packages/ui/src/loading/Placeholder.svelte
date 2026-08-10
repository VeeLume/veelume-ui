<script lang="ts">
	/**
	 * The "nothing selected yet" state — a centred, quiet line telling you what
	 * to do next.
	 *
	 * Distinct from `Surface.List`'s empty state, which says *this list found
	 * nothing*; this says *you have not chosen anything*. The first is a result,
	 * the second is an invitation, and rendering them identically is how an
	 * empty search starts looking like a broken app.
	 *
	 * `Settings.Placeholder` is this with the bag's category message baked in.
	 */
	import type { Snippet } from 'svelte';

	let {
		class: klass = '',
		children
	}: {
		class?: string;
		children: Snippet;
	} = $props();
</script>

<div class="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground {klass}">
	<p>{@render children()}</p>
</div>
