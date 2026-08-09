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
		class: klass = ''
	}: {
		open?: boolean;
		onclose: () => void;
		/** Replaces a row's rendering. The list, header and policy stay the kit's. */
		item?: Snippet<[{ notification: Notification; dismiss: () => void }]>;
		/**
		 * Position classes, REPLACING the default `top-full right-0 mt-2`
		 * (below the trigger, right-aligned) — replaced rather than merged,
		 * because two `top-*` utilities on one element resolve by stylesheet
		 * order, not by author intent. A rail-bottom bell passes something
		 * like `bottom-0 left-full ml-3`.
		 */
		class?: string;
	} = $props();

	const kit = getKitContext();

	$effect(() => {
		if (open) markAllRead();
	});
</script>

<Popup
	{open}
	{onclose}
	position={klass || 'top-full right-0 mt-2'}
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
