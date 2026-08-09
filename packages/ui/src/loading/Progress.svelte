<script lang="ts">
	/**
	 * The progress bar — for work whose completion the app can actually report:
	 * a data cook, a patch apply, an update download.
	 *
	 * ⚑ Determinate-vs-indeterminate is NOT a mode prop. It is whether you know
	 * the number: `value` present → a filled track; absent → the sweep. A
	 * `variant="indeterminate"` flag would let a caller claim a percentage it
	 * does not have, and a second fact that can disagree with the first is
	 * exactly what the shell's no-`strategy`-flag rule exists to prevent.
	 *
	 * `Loading` remains the boot-screen spinner: it says "something is
	 * happening", this says "how far along". A list uses neither — `Surface.
	 * List`'s own status states speak for it.
	 */
	import { getKitContext } from '../context/index.js';

	let {
		value = undefined,
		max = 100,
		label = undefined,
		detail = undefined,
		class: klass = ''
	}: {
		/** 0…`max`. Omit for indeterminate — the honest state when the total is
		 *  unknown, which is most of a scan's life. */
		value?: number;
		max?: number;
		/** Names the work. Omit on a bar that sits under its own heading. */
		label?: string;
		/** The trailing readout — a count, an ETA, a file name. Defaults to the
		 *  percentage when the value is known and no detail is supplied. */
		detail?: string;
		class?: string;
	} = $props();

	const kit = getKitContext();

	const determinate = $derived(value !== undefined);
	// Clamped: a backend that reports 7 of 5 must not paint outside the track.
	const pct = $derived(
		determinate ? Math.max(0, Math.min(100, (value! / (max || 1)) * 100)) : undefined
	);
	const readout = $derived(
		detail ?? (pct !== undefined ? kit.format.number(Math.round(pct)) + '%' : undefined)
	);
</script>

<div class={klass}>
	{#if label || readout}
		<div class="mb-1 flex items-baseline gap-2 text-xs">
			{#if label}<span class="min-w-0 flex-1 truncate">{label}</span>{/if}
			{#if readout}
				<span class="shrink-0 tabular-nums text-muted-foreground">{readout}</span>
			{/if}
		</div>
	{/if}
	<div
		class="h-1.5 overflow-hidden rounded-full bg-muted"
		role="progressbar"
		aria-label={label ?? kit.labels.loading()}
		aria-valuemin={determinate ? 0 : undefined}
		aria-valuemax={determinate ? max : undefined}
		aria-valuenow={determinate ? value : undefined}
	>
		{#if determinate}
			<div class="h-full rounded-full bg-primary transition-[width]" style:width="{pct}%"></div>
		{:else}
			<!-- Same sweep as Surface.List's throbber, and scoped for the same
			     reason: the consumer's Tailwind build cannot be relied on for
			     custom keyframes (the kit arrives via symlink), while component
			     CSS compiles wherever the component does. -->
			<div class="sweep h-full w-1/3 rounded-full bg-primary"></div>
		{/if}
	</div>
</div>

<style>
	.sweep {
		animation: sweep 1.2s ease-in-out infinite;
		position: relative;
	}
	@keyframes sweep {
		from {
			left: -35%;
		}
		to {
			left: 100%;
		}
	}
</style>
