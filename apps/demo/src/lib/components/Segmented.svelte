<script lang="ts">
	/**
	 * The settings pages' segmented picker — a handful of mutually exclusive
	 * values where all options should stay visible (theme, density, locale).
	 * App-level on purpose: the kit has no segmented control yet, and one demo
	 * consumer is not the named variation that would justify promoting it.
	 */
	let {
		options,
		current,
		pick
	}: {
		options: { value: string; label: string }[];
		current: string;
		pick: (value: string) => void;
	} = $props();
</script>

<div class="inline-flex rounded-lg border p-0.5">
	{#each options as option (option.value)}
		<button
			class="rounded-md px-3 text-sm font-medium transition-colors"
			class:bg-primary={current === option.value}
			class:text-primary-foreground={current === option.value}
			class:text-muted-foreground={current !== option.value}
			style="height: calc(var(--density-target) - 0.5rem)"
			onclick={() => pick(option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>
