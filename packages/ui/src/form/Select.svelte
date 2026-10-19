<script lang="ts">
	/**
	 * One value from a list that outgrew `Segmented` — a field's trigger and
	 * a list the kit draws itself on `Popup`, never the platform's dropdown:
	 * the OS draws a native `<select>`'s open list, so it cannot carry the
	 * app's type, its groups render differently per platform, and it has no
	 * search. Starlume's mockup compared both side by side and kept this.
	 *
	 * - Options are `SelectOption`, as `Segmented`'s: switching a field
	 *   between the two stays a data edit. An option's `group` puts it under
	 *   a header (groups in order of first appearance). `meter` (0–1, in
	 *   its `tone`) and `detail` add a figure at the option's end, for
	 *   choices a score ranks; the trigger shows the label alone.
	 * - A search field appears from `searchFrom` options (12): past that,
	 *   scanning a list is slower than typing two letters of it. Below it,
	 *   typing jumps to the first option starting with what was typed.
	 * - The whole trigger opens the list — text and chevron are one hit
	 *   area, never a lone chevron.
	 * - Keyboard: ↓ ↑ Enter Space open the list from the trigger; in it ↓ ↑
	 *   Home End move, Enter picks, Escape (Popup's) and Tab close. The
	 *   current value is marked and is where the keyboard starts.
	 * - Stateless like `Switch`: renders `value`, reports the picked value.
	 */
	import { tick } from 'svelte';
	import { getKitContext } from '../context/index.js';
	import Popup from '../popup/Popup.svelte';
	import type { StatusTone } from '../theme/types.js';
	import type { SelectOption } from './types.js';

	let {
		options,
		value,
		onchange,
		label = undefined,
		id = undefined,
		disabled = false,
		placeholder = '',
		searchFrom = 12,
		class: klass = ''
	}: {
		options: SelectOption[];
		value: string;
		/** Receives the picked option's value. */
		onchange: (value: string) => void;
		/** Accessible name, when no visible label names the field. */
		label?: string;
		id?: string;
		disabled?: boolean;
		/** Shown while `value` matches no option. */
		placeholder?: string;
		/** The option count from which the list carries a search field. */
		searchFrom?: number;
		class?: string;
	} = $props();

	const kit = getKitContext();
	const uid = $props.id();

	let open = $state(false);
	let query = $state('');
	let active = $state(-1);
	let trigger = $state<HTMLButtonElement | null>(null);
	let listEl = $state<HTMLElement | null>(null);
	let searchEl = $state<HTMLInputElement | null>(null);

	const current = $derived(options.find((o) => o.value === value) ?? null);
	const searchable = $derived(options.length >= searchFrom);
	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
	});
	// Groups in order of first appearance; ungrouped options first.
	const groups = $derived.by(() => {
		const out: { name: string; items: { o: SelectOption; i: number }[] }[] = [];
		shown.forEach((o, i) => {
			const name = o.group ?? '';
			let g = out.find((x) => x.name === name);
			if (!g) {
				g = { name, items: [] };
				if (name) out.push(g);
				else out.unshift(g);
			}
			g.items.push({ o, i });
		});
		return out;
	});
	const optionId = (i: number) => `${uid}-o${i}`;
	// Figures line up in columns: once one option has them, every option
	// keeps their slots.
	const figures = $derived(options.some((o) => o.meter !== undefined || o.detail));
	const meterTone: Record<StatusTone, string> = {
		primary: 'text-primary',
		neutral: 'text-muted-foreground',
		success: 'text-success',
		warning: 'text-warning',
		destructive: 'text-destructive'
	};

	async function show() {
		if (disabled || open) return;
		query = '';
		open = true;
		active = Math.max(
			0,
			options.findIndex((o) => o.value === value)
		);
		await tick();
		focusWhenShown();
	}
	// Popup keeps its panel invisible until floating-ui has placed it, and
	// an invisible element takes no focus — so retry until it does. A
	// timeout beside the frame: a hidden document never fires rAF.
	function focusWhenShown(tries = 20) {
		const el = searchable ? searchEl : listEl;
		if (!open || !el) return;
		el.focus({ preventScroll: true });
		if (document.activeElement === el) {
			scrollToActive();
			return;
		}
		if (tries <= 0) return;
		let done = false;
		const again = () => {
			if (done) return;
			done = true;
			focusWhenShown(tries - 1);
		};
		requestAnimationFrame(again);
		setTimeout(again, 16);
	}
	function close(refocus = true) {
		open = false;
		if (refocus) trigger?.focus();
	}
	function pick(o: SelectOption) {
		close();
		if (o.value !== value) onchange(o.value);
	}
	async function scrollToActive() {
		await tick();
		listEl?.querySelector(`#${CSS.escape(optionId(active))}`)?.scrollIntoView({ block: 'nearest' });
	}
	function move(to: number) {
		if (!shown.length) return;
		active = Math.max(0, Math.min(shown.length - 1, to));
		scrollToActive();
	}

	let typed = '';
	let typedAt = 0;
	function onListKey(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') move(active + 1);
		else if (e.key === 'ArrowUp') move(active - 1);
		else if (e.key === 'Home') move(0);
		else if (e.key === 'End') move(shown.length - 1);
		else if (e.key === 'Enter') {
			if (shown[active]) pick(shown[active]);
		} else if (e.key === 'Tab') {
			close(false);
			return;
		} else if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
			// Typeahead: letters typed in quick succession spell a prefix.
			const now = Date.now();
			typed = now - typedAt < 700 ? typed + e.key.toLowerCase() : e.key.toLowerCase();
			typedAt = now;
			const at = shown.findIndex((o) => o.label.toLowerCase().startsWith(typed));
			if (at >= 0) move(at);
		} else return;
		e.preventDefault();
	}
	function onTriggerKey(e: KeyboardEvent) {
		if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
			e.preventDefault();
			show();
		}
	}
</script>

<span class="relative inline-flex max-w-full {klass}">
	<button
		bind:this={trigger}
		type="button"
		{id}
		{disabled}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls={open ? `${uid}-list` : undefined}
		aria-label={label ? `${label}: ${current?.label ?? placeholder}` : undefined}
		class="inline-flex h-9 max-w-full min-w-28 items-center justify-between gap-3 rounded-md border
		       bg-background pr-2.5 pl-3 text-sm transition-colors
		       focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none
		       disabled:cursor-default disabled:opacity-50 {open
			? 'border-primary'
			: 'border-input hover:border-primary/50'}"
		onclick={() => (open ? close() : show())}
		onkeydown={onTriggerKey}
	>
		<span class="truncate" class:text-muted-foreground={!current}
			>{current?.label ?? placeholder}</span
		>
		<svg
			viewBox="0 0 10 6"
			aria-hidden="true"
			class="h-1.5 w-2.5 shrink-0 transition-transform {open
				? 'rotate-180 text-primary'
				: 'text-muted-foreground'}"
		>
			<path
				d="M1 1l4 4 4-4"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</button>
	<Popup
		{open}
		onclose={() => close()}
		label={label ?? current?.label}
		offset={6}
		class="min-w-48 {figures ? 'max-w-96' : 'max-w-80'} p-1"
	>
		{#if searchable}
			<input
				bind:this={searchEl}
				bind:value={query}
				type="search"
				role="combobox"
				aria-expanded="true"
				aria-controls="{uid}-list"
				aria-activedescendant={shown[active] ? optionId(active) : undefined}
				placeholder={kit.labels.search()}
				autocomplete="off"
				oninput={() => (active = 0)}
				class="sticky top-0 z-10 mb-1 h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm
				       focus:border-primary focus:outline-none"
				onkeydown={onListKey}
			/>
		{/if}
		<div
			bind:this={listEl}
			id="{uid}-list"
			role="listbox"
			tabindex={searchable ? undefined : -1}
			aria-label={label}
			aria-activedescendant={!searchable && shown[active] ? optionId(active) : undefined}
			class="flex flex-col focus:outline-none"
			onkeydown={searchable ? undefined : onListKey}
		>
			{#each groups as g, gi (g.name)}
				<div
					role="group"
					aria-label={g.name || undefined}
					class="flex flex-col gap-px {gi ? 'mt-1 border-t border-border pt-1' : ''}"
				>
					{#if g.name}
						<span
							class="px-2 pt-1 pb-0.5 text-xs font-medium tracking-wider text-muted-foreground uppercase"
							>{g.name}</span
						>
					{/if}
					{#each g.items as { o, i } (o.value)}
						{@const cur = o.value === value}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
							id={optionId(i)}
							role="option"
							tabindex="-1"
							aria-selected={cur}
							class="flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-1.5 text-sm
							       {cur
								? 'bg-primary/15 font-semibold text-foreground'
								: 'text-muted-foreground hover:bg-accent hover:text-foreground'}
							       {i === active && !cur ? 'bg-accent text-foreground' : ''}
							       {i === active && cur ? 'bg-primary/20' : ''}"
							onclick={() => pick(o)}
							onmousemove={() => (active = i)}
						>
							<span class="min-w-0 flex-1 truncate">{o.label}</span>
							{#if figures}
								<span class="flex shrink-0 items-center gap-2">
									<span
										aria-hidden="true"
										class="h-1 w-10 overflow-hidden rounded-full {o.meter === undefined
											? ''
											: `bg-muted ${meterTone[o.tone ?? 'primary']}`}"
										>{#if o.meter !== undefined}<span
												class="block h-full rounded-full bg-current"
												style:width="{Math.max(0, Math.min(1, o.meter)) * 100}%"
											></span>{/if}</span
									>
									<span class="w-9 text-right font-mono text-xs tabular-nums">{o.detail ?? ''}</span
									>
									<span aria-hidden="true" class="w-3 text-primary">{cur ? '✓' : ''}</span>
								</span>
							{:else if cur}<span aria-hidden="true" class="text-primary">✓</span>{/if}
						</div>
					{/each}
				</div>
			{/each}
			{#if !shown.length}
				<p class="px-2 py-1.5 text-sm text-muted-foreground">{kit.labels.empty()}</p>
			{/if}
		</div>
	</Popup>
</span>
