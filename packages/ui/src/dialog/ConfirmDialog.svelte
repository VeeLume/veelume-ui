<script lang="ts">
	/**
	 * The decision gate for destructive and irreversible actions — stibu's
	 * `ConfirmDialog`, on the kit's modal base and the label bag (stibu
	 * hardcoded "Bestätigen"/"Abbrechen"; the per-call labels like "Delete"
	 * stay props, because naming the consequence is app content).
	 *
	 * Cancel is rendered FIRST, so the focus trap's initial stop is the safe
	 * choice — Enter on a freshly opened destructive dialog must never
	 * destroy anything.
	 */
	import Dialog from './Dialog.svelte';
	import Button from '../actions/Button.svelte';
	import { getKitContext } from '../context/index.js';

	let {
		open = false,
		onclose,
		onconfirm,
		title,
		description = undefined,
		confirmLabel = undefined,
		cancelLabel = undefined,
		destructive = false
	}: {
		open?: boolean;
		/** Closes without confirming — Escape, overlay, and Cancel all land here. */
		onclose: () => void;
		/** The caller closes (or navigates) itself — confirming may fail, and
		 *  a dialog that auto-closed before the error has nowhere to show it. */
		onconfirm: () => void;
		title: string;
		/** What will actually happen — consequence, not restatement. */
		description?: string;
		/** Defaults to the label bag's Confirm; name the consequence when you can. */
		confirmLabel?: string;
		cancelLabel?: string;
		destructive?: boolean;
	} = $props();

	const kit = getKitContext();
</script>

<Dialog {open} {onclose} {title}>
	<div class="grid gap-4 p-4">
		{#if description}
			<p class="text-sm text-muted-foreground">{description}</p>
		{/if}
		<div class="flex justify-end gap-2">
			<Button variant="outline" onclick={onclose}>
				{cancelLabel ?? kit.labels.cancel()}
			</Button>
			<Button variant={destructive ? 'destructive' : 'primary'} onclick={onconfirm}>
				{confirmLabel ?? kit.labels.confirm()}
			</Button>
		</div>
	</div>
</Dialog>
