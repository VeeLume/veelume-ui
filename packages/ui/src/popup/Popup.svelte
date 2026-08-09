<script lang="ts">
	/**
	 * The anchored-panel base — extracted from its two derivations
	 * (`Surface.FilterButton`, `Notify.Center`) once they disagreed about
	 * dismissal: one had an outside-click catcher and no Escape, the other
	 * neither. The base owns the semantics so a consumer cannot get them
	 * half-right:
	 *
	 *   - outside click closes (a transparent catcher, so the click that
	 *     closes does NOT also activate what it landed on)
	 *   - Escape closes
	 *   - focus returns to the trigger when closing dropped it on <body> —
	 *     and only then, so a close that moved focus deliberately keeps it
	 *
	 * Placement is INTENT, not classes: `side`/`align` name the preference
	 * and floating-ui measures at open time — flip renders on the opposite
	 * side when the preferred one would overflow, shift slides the panel
	 * along its axis to stay inside the clipping ancestors. The class-string
	 * era's failure mode (a right-aligned panel authored for a screen-right
	 * trigger, clipped when the trigger sat elsewhere) is gone structurally.
	 *
	 * The panel stays inside the consumer's `relative` wrapper (the anchor
	 * is the panel's offsetParent — no anchor prop needed). Portalling to
	 * <body>, which would also escape overflow clipping entirely, is the
	 * remaining upgrade; it adds z-stacking and teleport concerns flip/shift
	 * do not, so it waits for a consumer that needs it.
	 */
	import type { Snippet } from 'svelte';
	import { autoUpdate, computePosition, flip, offset as offsetBy, shift } from '@floating-ui/dom';

	let {
		open = false,
		onclose,
		side = 'bottom',
		align = 'start',
		offset = 8,
		label = undefined,
		class: klass = '',
		children
	}: {
		open?: boolean;
		onclose: () => void;
		/** Preferred side of the trigger. Flips when it would not fit. */
		side?: 'top' | 'bottom' | 'left' | 'right';
		/** Alignment along that side. Shifts when it would poke out. */
		align?: 'start' | 'center' | 'end';
		/** Gap to the trigger, px. */
		offset?: number;
		/** Accessible name for the panel. */
		label?: string;
		/** Sizing and padding — width is the consumer's call. */
		class?: string;
		children: Snippet;
	} = $props();

	let panel = $state<HTMLElement | null>(null);
	// Hidden (but measurable) until the first computed position lands, so the
	// panel never paints a frame at 0,0 before floating-ui places it.
	let positioned = $state(false);

	const placement = $derived(align === 'center' ? side : (`${side}-${align}` as const));

	$effect(() => {
		if (!open || !panel) {
			positioned = false;
			return;
		}
		const el = panel;
		// The consumer's `relative` wrapper — the same implicit anchor the
		// class-string era used, now measured instead of assumed.
		const anchor = el.offsetParent;
		if (!(anchor instanceof HTMLElement)) return;

		const cleanup = autoUpdate(anchor, el, () => {
			computePosition(anchor, el, {
				placement,
				strategy: 'absolute',
				middleware: [offsetBy(offset), flip(), shift({ padding: 8 })]
			}).then(({ x, y }) => {
				el.style.left = `${x}px`;
				el.style.top = `${y}px`;
				positioned = true;
			});
		});
		return cleanup;
	});

	let lastFocus: HTMLElement | null = null;

	$effect(() => {
		if (open) {
			lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		} else if (lastFocus) {
			// Restore only when closing stranded focus on <body> (Escape, or the
			// catcher unmounting under the pointer). If focus landed somewhere
			// real, the user put it there.
			if (document.activeElement === document.body || document.activeElement === null) {
				lastFocus.focus();
			}
			lastFocus = null;
		}
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
		}
	}
</script>

<svelte:window onkeydown={open ? onkeydown : undefined} />

{#if open}
	<button
		type="button"
		class="fixed inset-0 z-40 cursor-default"
		tabindex="-1"
		aria-hidden="true"
		onclick={onclose}
	></button>

	<div
		bind:this={panel}
		role="dialog"
		aria-label={label}
		class="absolute top-0 left-0 z-50 rounded-lg border border-border bg-popover
		       text-popover-foreground shadow-lg {positioned ? '' : 'invisible'} {klass}"
	>
		{@render children()}
	</div>
{/if}
