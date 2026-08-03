<script lang="ts">
	/**
	 * The bar geometry, in exactly one place.
	 *
	 * `Surface.ListHeader`, `DetailHeader` and `Surface.Toolbar` are peers — same
	 * 56px height, same `px-3` inset, same 36px controls — so nothing shifts when
	 * you move between a list and a record. stibu states the contract in both of
	 * its headers ("same 56px bar, same 36px controls as the list header") and
	 * enforces it with a comment in two files.
	 *
	 * ⚑ A comment is not an enforcement mechanism: this kit's copy drifted by 13px
	 * before anyone measured it. There is now one class string, so the peers
	 * cannot disagree — the parity is structural rather than remembered.
	 */
	import type { Snippet } from 'svelte';

	let { class: klass = '', children }: { class?: string; children: Snippet } = $props();
</script>

<header
	class="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 {klass}"
>
	{@render children()}
</header>
