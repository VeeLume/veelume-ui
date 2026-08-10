<script lang="ts">
	/**
	 * A labelled one-of-many choice, rendered as radios.
	 *
	 * Extracted from `Surface.FilterButton`'s sort block once an app needed the
	 * same thing beside it (a grouping choice in the filter panel) and wrote its
	 * own radios to match. Two identical decisions rendered by two pieces of
	 * markup is how they stop looking identical — the same argument that made
	 * `Bar` a component.
	 *
	 * ⚑ Radios, not `Segmented`, when the choice lives in a PANEL: `Segmented`
	 * is for a handful of options that stay visible in a bar, and putting one
	 * beside a radio list makes two equivalent choices look like different kinds
	 * of thing. Options are `SelectOption` either way, so moving a choice
	 * between the two is a data edit.
	 */
	import type { SelectOption } from './types.js';

	let {
		label = undefined,
		options,
		value,
		onchange,
		class: klass = ''
	}: {
		/** Omit inside a panel that already names the group. */
		label?: string;
		options: SelectOption[];
		value: string;
		onchange: (value: string) => void;
		class?: string;
	} = $props();
</script>

<div class={klass}>
	{#if label}
		<div class="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
	{/if}
	{#each options as opt (opt.value)}
		<label class="flex items-center gap-2 py-1 text-sm">
			<input type="radio" checked={value === opt.value} onchange={() => onchange(opt.value)} />
			<span class="flex-1">{opt.label}</span>
		</label>
	{/each}
</div>
