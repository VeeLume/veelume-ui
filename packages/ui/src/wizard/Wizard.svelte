<script lang="ts">
	/**
	 * The step frame: header, body, footer — nothing about where it lives.
	 *
	 * Two donors built this and disagreed on exactly one thing: who supplies
	 * the steps. Hearth hardcoded them; Starlume derives them from a module
	 * registry, so toggling a module adds and removes its steps live. That is
	 * the named variation, and it costs the design NOTHING to absorb —
	 * `steps` is a reactive prop, so a consumer passes a `$derived` array and
	 * the wizard follows. There is no registry concept in here.
	 *
	 * ⚑ It does NOT own an overlay. That is the Picker/PickerDialog split
	 * again: Starlume runs this full-screen, another app puts it in `Dialog`,
	 * and because there is only one wizard the two hosts cannot drift. A
	 * `modal` prop would be a second arrangement to keep in sync.
	 *
	 * Composable by omission: no `onskip` → no skip button.
	 */
	import { getKitContext } from '../context/index.js';
	import Bar from '../actions/Bar.svelte';
	import Button from '../actions/Button.svelte';
	import type { WizardStep } from './types.js';

	let {
		steps,
		index = $bindable(0),
		onfinish,
		onskip = undefined,
		finishLabel = undefined,
		busy = false,
		class: klass = ''
	}: {
		/** Reactive: a `$derived` list may grow or shrink between renders. */
		steps: WizardStep[];
		/** Bindable so a host can deep-link a step or reset on reopen. */
		index?: number;
		/** The last step's forward action. May be async — pass `busy` while it
		 *  runs; the wizard does not close itself, because finishing can fail
		 *  (the ConfirmDialog rule). */
		onfinish: () => void;
		/** Complete without finishing. Omit and no skip button renders. */
		onskip?: () => void;
		/** Defaults to the bag's Finish. */
		finishLabel?: string;
		/** Disables both footer actions while the finish runs. */
		busy?: boolean;
		class?: string;
	} = $props();

	const kit = getKitContext();

	/**
	 * Clamped rather than assumed valid: the step list is reactive, so
	 * deselecting a module can delete the step you are standing on. Landing on
	 * the new last step beats rendering `undefined`.
	 */
	const safeIndex = $derived(Math.min(index, Math.max(0, steps.length - 1)));
	const current = $derived(steps[safeIndex]);
	const atEnd = $derived(safeIndex >= steps.length - 1);

	/** Absent gate = passable. No per-step bookkeeping to reset, and a step
	 *  spliced in beside a gated one cannot inherit its neighbour's state. */
	const canContinue = $derived(current?.canContinue?.() ?? true);

	function go(to: number) {
		index = Math.max(0, Math.min(to, steps.length - 1));
	}
</script>

{#if current}
	<div class="flex min-h-0 flex-1 flex-col {klass}">
		<!-- Same Bar as every other header in the kit, so a wizard hosted in a
		     dialog matches the surfaces behind it. -->
		<Bar>
			<h2 class="min-w-0 flex-1 truncate text-sm font-semibold">{current.title}</h2>
			{#if current.tag}
				<span class="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
					{current.tag}
				</span>
			{/if}
			{#if onskip}
				<Button variant="ghost" onclick={onskip} disabled={busy}>
					{kit.labels.skip()}
				</Button>
			{/if}
		</Bar>

		<div class="min-h-0 flex-1 overflow-auto p-4">
			{@render current.step()}
		</div>

		<footer class="flex h-14 shrink-0 items-center gap-2 border-t border-border px-3">
			<!-- Progress as text, not a bar: the count is exact and a reactive
			     list makes a percentage a moving target — "2 of 5" that becomes
			     "2 of 7" is honest, a bar that jumps backwards is not. -->
			<span class="text-xs text-muted-foreground tabular-nums">
				{kit.labels.stepCount({ step: safeIndex + 1, total: steps.length })}
			</span>
			<div class="ml-auto flex items-center gap-2">
				<!-- Back is always free — it never validates. Only forward can be
				     gated, so a user can never be trapped on a step. -->
				<Button
					variant="outline"
					onclick={() => go(safeIndex - 1)}
					disabled={safeIndex === 0 || busy}
				>
					{kit.labels.back()}
				</Button>
				{#if atEnd}
					<Button variant="primary" onclick={onfinish} disabled={!canContinue || busy}>
						{finishLabel ?? kit.labels.finish()}
					</Button>
				{:else}
					<Button
						variant="primary"
						onclick={() => go(safeIndex + 1)}
						disabled={!canContinue || busy}
					>
						{kit.labels.next()}
					</Button>
				{/if}
			</div>
		</footer>
	</div>
{/if}
