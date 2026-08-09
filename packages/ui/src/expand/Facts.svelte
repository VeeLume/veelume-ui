<script lang="ts">
	/**
	 * Glued label/value pairs — the first thing inside an expansion, and the
	 * densest way to state a record's facts without a table's ceremony.
	 *
	 * Facts are DATA, not snippets, for the same reason `Row.badge` is: an
	 * expansion may hold twenty of them inside a list that renders hundreds of
	 * rows, and a component per pair is a cost with nothing to show for it.
	 * The `fact` snippet is the escape hatch when a value needs real markup.
	 */
	import type { Snippet } from 'svelte';
	import type { Fact } from './types.js';

	let {
		facts,
		fact,
		class: klass = ''
	}: {
		facts: Fact[];
		/** Replace the rendering of every pair. */
		fact?: Snippet<[Fact]>;
		class?: string;
	} = $props();
</script>

<!-- Wrapping inline flow rather than a grid: facts are read as a sentence of
     pairs, and a grid would strand a short value in a wide column. -->
<div class="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm {klass}">
	{#each facts as f (f.label)}
		{#if fact}
			{@render fact(f)}
		{:else}
			<span class="inline-flex items-baseline gap-1.5">
				<span class="text-xs tracking-wider text-muted-foreground uppercase">{f.label}</span>
				<span class={f.mono ? 'font-mono text-xs' : ''}>{f.value}</span>
			</span>
		{/if}
	{/each}
</div>
