<script lang="ts">
	/**
	 * The kit's time field — `DateInput`'s sibling and the other half of the
	 * rulebook promise. Same injection contract: locale and `hourCycle`
	 * arrive from the kit context, so 15:30 in a German UI can never render
	 * as 3:30 PM by omission. `hourCycle` matters MORE here than on dates:
	 * it is derived from the formatting locale, which is how an English UI
	 * with German formatting still gets the 24h clock.
	 *
	 * Value boundary: `HH:MM` (seconds are not a UI concern in any donor).
	 */
	import { TimeField } from 'bits-ui';
	import { parseTime, Time } from '@internationalized/date';
	import { getKitContext } from '../context/index.js';

	let {
		value = null,
		onchange,
		id = undefined,
		disabled = false,
		class: klass = ''
	}: {
		/** `HH:MM` (24h), or null while unset. */
		value?: string | null;
		/** Receives the next `HH:MM`, or null when cleared/incomplete. */
		onchange: (next: string | null) => void;
		id?: string;
		disabled?: boolean;
		class?: string;
	} = $props();

	const kit = getKitContext();

	const parsed = $derived.by(() => {
		if (!value) return undefined;
		try {
			return parseTime(value);
		} catch {
			return undefined;
		}
	});

	const pad = (n: number) => String(n).padStart(2, '0');
</script>

<TimeField.Root
	value={parsed}
	onValueChange={(v: Time | undefined) => onchange(v ? `${pad(v.hour)}:${pad(v.minute)}` : null)}
	locale={kit.formattingLocale}
	hourCycle={kit.hourCycle}
	granularity="minute"
	{disabled}
>
	<TimeField.Input
		{id}
		class="flex h-9 w-fit min-w-0 items-center rounded-md border border-input bg-background
		       px-3 text-sm tabular-nums select-none
		       data-invalid:border-destructive {disabled ? 'opacity-50' : ''} {klass}"
	>
		{#snippet children({ segments })}
			{#each segments as { part, value: segValue }, i (part + i)}
				{#if part === 'literal'}
					<TimeField.Segment {part} class="px-px text-muted-foreground">
						{segValue}
					</TimeField.Segment>
				{:else}
					<TimeField.Segment
						{part}
						class="rounded px-0.5 focus:bg-accent focus:text-accent-foreground
						       focus-visible:outline-none data-placeholder:text-muted-foreground"
					>
						{segValue}
					</TimeField.Segment>
				{/if}
			{/each}
		{/snippet}
	</TimeField.Input>
</TimeField.Root>
