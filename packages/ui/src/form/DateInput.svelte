<script lang="ts">
	/**
	 * The kit's date field — closing the rulebook's standing promise: the
	 * kit owns date/time/number inputs, because a native `<input type="date">`
	 * follows the BROWSER's locale, not the document's, and nothing overrides
	 * that.
	 *
	 * A wrap of bits-ui's `DateField` whose whole job is INJECTION: bits
	 * defaults to `en-US`, so an omitted `locale` silently renders m/d/y and
	 * am/pm inside a German UI — the bug that is live in connect-neo. Here
	 * the formatting locale and `hourCycle` always come from the kit context
	 * and cannot be forgotten, only overridden by changing the context.
	 *
	 * The value boundary is an ISO 8601 date string (`2026-04-05`) — what
	 * the fleet's records actually carry — so no consumer touches
	 * `@internationalized/date` types unless it wants to.
	 */
	import { DateField } from 'bits-ui';
	import { parseDate, type CalendarDate } from '@internationalized/date';
	import { getKitContext } from '../context/index.js';

	let {
		value = null,
		onchange,
		id = undefined,
		disabled = false,
		class: klass = ''
	}: {
		/** ISO 8601 date (`YYYY-MM-DD`), or null while unset. */
		value?: string | null;
		/** Receives the next ISO date, or null when cleared/incomplete. */
		onchange: (next: string | null) => void;
		id?: string;
		disabled?: boolean;
		class?: string;
	} = $props();

	const kit = getKitContext();

	const parsed = $derived.by(() => {
		if (!value) return undefined;
		try {
			return parseDate(value);
		} catch {
			return undefined;
		}
	});
</script>

<DateField.Root
	value={parsed}
	onValueChange={(v) => onchange(v ? v.toString() : null)}
	locale={kit.formattingLocale}
	hourCycle={kit.hourCycle}
	granularity="day"
	{disabled}
>
	<DateField.Input
		{id}
		class="flex h-9 w-fit min-w-0 items-center rounded-md border border-input bg-background
		       px-3 text-sm tabular-nums select-none
		       data-invalid:border-destructive {disabled ? 'opacity-50' : ''} {klass}"
	>
		{#snippet children({ segments })}
			{#each segments as { part, value: segValue }, i (part + i)}
				{#if part === 'literal'}
					<DateField.Segment {part} class="px-px text-muted-foreground">
						{segValue}
					</DateField.Segment>
				{:else}
					<DateField.Segment
						{part}
						class="rounded px-0.5 focus:bg-accent focus:text-accent-foreground
						       focus-visible:outline-none data-placeholder:text-muted-foreground"
					>
						{segValue}
					</DateField.Segment>
				{/if}
			{/each}
		{/snippet}
	</DateField.Input>
</DateField.Root>
