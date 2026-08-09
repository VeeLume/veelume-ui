<script lang="ts" generics="T">
	/**
	 * The dialog half of the picker axis: `Dialog` around `Picker`, closing
	 * after delivery. Nothing else — the search, list, selection and rows
	 * are the inline component's, so the two modes cannot drift.
	 *
	 * Search state and selection reset on close for free: the modal base
	 * unmounts its content, so reopening always starts clean (every stibu
	 * picker reset by hand in `close()`).
	 *
	 * The focus trap lands on the first tabbable — the search field — which
	 * is stibu's autofocus behaviour without an autofocus attribute.
	 */
	import type { Snippet } from 'svelte';
	import Dialog from '../dialog/Dialog.svelte';
	import Picker from './Picker.svelte';

	let {
		open = false,
		onclose,
		title,
		onpick,
		items,
		key,
		label,
		detail = undefined,
		searchIn = undefined,
		multiple = false,
		row = undefined
	}: {
		open?: boolean;
		onclose: () => void;
		title: string;
		/** As `Picker`'s — and the dialog closes after delivering. */
		onpick: (picked: T[]) => void;
		items: T[];
		key: (item: T) => string;
		label: (item: T) => string;
		detail?: (item: T) => string | null | undefined;
		searchIn?: (item: T) => (string | null | undefined)[];
		multiple?: boolean;
		row?: Snippet<[{ item: T; picked: boolean; pick: () => void }]>;
	} = $props();
</script>

<Dialog {open} {onclose} {title}>
	<Picker
		{items}
		{key}
		{label}
		{detail}
		{searchIn}
		{multiple}
		{row}
		onpick={(picked) => {
			onpick(picked);
			onclose();
		}}
	/>
</Dialog>
