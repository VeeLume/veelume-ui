<script lang="ts">
	/**
	 * The persistent surface as an anchored panel: header (title, clear all)
	 * over `Notify.List`, inside a `Popup`. Opening marks everything read —
	 * the bell badge is the unread signal, and a badge that survives looking
	 * at the list lies.
	 *
	 * Place it in a `relative` wrapper next to the trigger. The panel
	 * discipline is `Popup`'s; the rows are `Notify.List`'s (which a page
	 * host can embed directly — the demo's /notifications does, for the
	 * widths where a rail bell does not exist); this component owns only
	 * the anchored arrangement.
	 */
	import type { Snippet } from 'svelte';
	import Popup from '../popup/Popup.svelte';
	import List from './List.svelte';
	import { getKitContext } from '../context/index.js';
	import { notifications, clearAll, markAllRead, type Notification } from './store.svelte.js';

	let {
		open = false,
		onclose,
		item = undefined,
		side = 'bottom',
		align = 'end'
	}: {
		open?: boolean;
		onclose: () => void;
		/** Replaces a row's rendering. The list, header and policy stay the kit's. */
		item?: Snippet<[{ notification: Notification; dismiss: () => void }]>;
		/** Placement INTENT, passed to Popup — flip/shift handle the rest. A
		 *  rail-bottom bell passes side="right" align="end"; the default suits
		 *  a toolbar trigger. */
		side?: 'top' | 'bottom' | 'left' | 'right';
		align?: 'start' | 'center' | 'end';
	} = $props();

	const kit = getKitContext();

	$effect(() => {
		if (open) markAllRead();
	});
</script>

<Popup
	{open}
	{onclose}
	{side}
	{align}
	label={kit.labels.notifications()}
	class="flex max-h-96 w-80 flex-col overflow-hidden"
>
	<header class="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
		<span class="text-sm font-semibold">{kit.labels.notifications()}</span>
		{#if notifications.items.length > 0}
			<button
				type="button"
				class="text-xs text-muted-foreground underline-offset-2 hover:underline"
				onclick={clearAll}
			>
				{kit.labels.clearAll()}
			</button>
		{/if}
	</header>

	<List {item} onnavigate={onclose} />
</Popup>
