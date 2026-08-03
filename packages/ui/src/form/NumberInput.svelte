<script lang="ts">
	/**
	 * A locale-aware number field, because the native one cannot be made to work
	 * here: `<input type="number">` follows the BROWSER's locale, so a German
	 * user on an en-US browser cannot type `1,50`. There is no attribute that
	 * overrides it, and in a browser app you do not control the setting.
	 *
	 * `type="text"` with `inputmode="decimal"` gets the numeric keypad on mobile
	 * without inheriting that behaviour.
	 *
	 * Raw while focused, formatted on blur — formatting mid-keystroke fights the
	 * caret, and stripping the separator the user just typed is worse than not
	 * formatting at all.
	 */
	import { getKitContext } from '../context/index.js';
	import { formatLocaleNumber, parseLocaleNumber } from './number.js';

	let {
		value,
		onchange,
		format,
		/** Stored = displayed × scale. Lets a cents column edit as euros. */
		scale = 1,
		id,
		disabled = false,
		class: klass = ''
	}: {
		value: number | null;
		onchange: (next: number | null) => void;
		format?: Intl.NumberFormatOptions;
		scale?: number;
		id?: string;
		disabled?: boolean;
		class?: string;
	} = $props();

	const kit = getKitContext();

	let focused = $state(false);
	let raw = $state('');

	const displayed = $derived(value == null ? null : value / scale);
	const formatted = $derived(
		displayed == null ? '' : formatLocaleNumber(displayed, kit.formattingLocale, format)
	);
	const shown = $derived(focused ? raw : formatted);

	function onFocus() {
		// Seed the editing buffer with a plain, ungrouped rendering: grouping
		// separators are noise to type around.
		raw =
			displayed == null
				? ''
				: formatLocaleNumber(displayed, kit.formattingLocale, {
						useGrouping: false,
						maximumFractionDigits: 20
					});
		focused = true;
	}

	function onBlur() {
		focused = false;
		const parsed = parseLocaleNumber(raw, kit.formattingLocale);
		onchange(parsed == null ? null : parsed * scale);
	}
</script>

<input
	{id}
	{disabled}
	type="text"
	inputmode="decimal"
	class="h-9 rounded-md border border-input bg-background px-3 text-sm tabular-nums {klass}"
	value={shown}
	oninput={(e) => (raw = e.currentTarget.value)}
	onfocus={onFocus}
	onblur={onBlur}
/>
