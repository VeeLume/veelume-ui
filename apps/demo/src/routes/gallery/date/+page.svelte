<script lang="ts">
	/**
	 * The date and time fields, in the one place their reason-to-exist is
	 * VISIBLE: the gallery's formatting-locale switcher (top right) shadows
	 * the kit context, so flipping it reorders the date's segments and
	 * toggles the clock between 24h and am/pm — live proof the fields follow
	 * the DOCUMENT's locale, which is exactly what a native input and an
	 * unwrapped bits-ui field cannot do.
	 */
	import { DateInput, TimeInput, getKitContext } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';

	const kit = getKitContext();

	let date = $state<string | null>('2026-04-05');
	let time = $state<string | null>('15:30');
</script>

<div class="grid max-w-3xl gap-6 p-4">
	<div>
		<h2 class="text-lg font-semibold">DateInput &amp; TimeInput</h2>
		<p class="text-sm text-muted-foreground">
			The rulebook's oldest promise: the kit owns date/time inputs, because a native field follows
			the browser's locale and bits-ui defaults to en-US — the bug live in connect-neo. Here the
			formatting locale and hourCycle are injected from the kit context and cannot be omitted. Flip
			the locale switcher above and watch the segments.
		</p>
	</div>

	<Case
		title="DateInput"
		note="Segments follow the formatting locale: de-DE renders 05.04.2026, en-US 4/5/2026, ja-JP year-first. The value boundary stays an ISO string either way — locale is presentation, never data."
	>
		<div class="flex flex-wrap items-center gap-4">
			<DateInput value={date} onchange={(d) => (date = d)} />
			<span class="text-xs text-muted-foreground">
				value: <code>{date ?? 'null'}</code> · locale: {kit.formattingLocale}
			</span>
		</div>
	</Case>

	<Case
		title="TimeInput"
		note="hourCycle is derived from the formatting locale: de-DE shows 15:30, en-US 3:30 PM — same value. This is the axis the two-locale design exists for: an English UI with German formatting keeps the 24h clock."
	>
		<div class="flex flex-wrap items-center gap-4">
			<TimeInput value={time} onchange={(t) => (time = t)} />
			<span class="text-xs text-muted-foreground">
				value: <code>{time ?? 'null'}</code> · hourCycle: {kit.hourCycle}h
			</span>
		</div>
	</Case>

	<Case
		title="Empty and disabled"
		note="Unset renders placeholder segments in muted; disabled dims the field. Clearing reports null, never an empty string."
	>
		<div class="flex flex-wrap items-center gap-4">
			<DateInput value={null} onchange={() => {}} />
			<DateInput value="2026-04-05" disabled onchange={() => {}} />
			<TimeInput value={null} onchange={() => {}} />
		</div>
	</Case>
</div>
