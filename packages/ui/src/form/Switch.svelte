<script lang="ts">
	/**
	 * The on/off toggle — Hearth's component, adopted across Starlume's
	 * settings, with the contract both derived: STATELESS. It renders
	 * `checked` and reports the requested next value; the caller stays the
	 * source of truth, because these toggles usually gate a backend call
	 * rather than flip a local flag, and an optimistic knob that snaps back
	 * on failure must be the caller's decision.
	 *
	 * No visible label — `Settings.Row` or a form field owns the text; the
	 * `label` prop is the accessible name for when nothing else names it.
	 */
	let {
		checked = false,
		disabled = false,
		id = undefined,
		label = undefined,
		onchange = undefined
	}: {
		checked?: boolean;
		disabled?: boolean;
		id?: string;
		/** Accessible name (aria-label). */
		label?: string;
		/** Receives the requested NEXT state, not the event. */
		onchange?: (next: boolean) => void;
	} = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-label={label}
	{id}
	{disabled}
	class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors
	       focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none
	       disabled:cursor-default disabled:opacity-50"
	class:bg-primary={checked}
	class:border-primary={checked}
	class:bg-muted={!checked}
	class:border-input={!checked}
	onclick={() => onchange?.(!checked)}
>
	<span
		class="pointer-events-none absolute top-0.5 left-0.5 size-[0.875rem] rounded-full shadow-sm
		       transition-transform {checked ? 'translate-x-4 bg-primary-foreground' : 'bg-foreground/60'}"
	></span>
</button>
