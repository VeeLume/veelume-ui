<script lang="ts">
	/**
	 * A handful of mutually exclusive values where every option stays visible
	 * (theme, density, locale) — stibu's settings pages and the demo derived
	 * the same control independently, which is what promoted it.
	 *
	 * For values that grow past a handful, that is a `select` field, not a
	 * wider Segmented. Options reuse `SelectOption` on purpose: switching a
	 * field between the two is a data edit, not a reshape.
	 *
	 * Buttons follow the density target minus the container inset, so the
	 * control sits flush in settings rows and toolbars at either density.
	 */
	import type { SelectOption } from './types.js';

	let {
		options,
		value,
		onchange,
		disabled = false,
		class: klass = ''
	}: {
		options: SelectOption[];
		value: string;
		/** Receives the selected option's value. */
		onchange: (value: string) => void;
		disabled?: boolean;
		class?: string;
	} = $props();
</script>

<div class="inline-flex rounded-lg border border-input p-0.5 {klass}" role="group">
	{#each options as option (option.value)}
		{@const selected = value === option.value}
		<button
			type="button"
			{disabled}
			aria-pressed={selected}
			class="rounded-md px-3 text-sm font-medium transition-colors
			       focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none
			       disabled:opacity-50"
			class:bg-primary={selected}
			class:text-primary-foreground={selected}
			class:text-muted-foreground={!selected}
			class:hover:text-foreground={!selected && !disabled}
			style="height: calc(var(--density-target) - 0.5rem)"
			onclick={() => onchange(option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>
