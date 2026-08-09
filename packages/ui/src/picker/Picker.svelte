<script lang="ts" generics="T">
	/**
	 * Pick one or several from a collection — the shape stibu derived five
	 * times (`CustomerPicker`, `ProductPickerDialog`, `GiftCardPicker`,
	 * `VoucherPicker`, `ParticipantPicker`). The four named axes, absorbed
	 * without flags beyond the one that IS an axis:
	 *
	 *   store vs list   `items` is a reactive prop — pass `collection.all`
	 *                   or a local array, the picker cannot tell
	 *   single vs multi `multiple`; `onpick` always delivers an array
	 *                   (single = exactly one, immediately; multi = the
	 *                   selection, on confirm — ParticipantPicker's shape,
	 *                   selection surviving searches)
	 *   row rendering   the `row` snippet; label/detail text otherwise
	 *   inline vs dialog THIS component is the inline half — search + list,
	 *                   embeddable anywhere. `PickerDialog` is the modal
	 *                   wrapper, nothing more.
	 *
	 * Deliberately chrome-free: no outer border, so the dialog and an inline
	 * host wrap it in their own frame.
	 */
	import type { Snippet } from 'svelte';
	import { getKitContext } from '../context/index.js';

	let {
		items,
		key,
		label,
		detail = undefined,
		searchIn = undefined,
		multiple = false,
		onpick,
		row = undefined,
		class: klass = ''
	}: {
		items: T[];
		key: (item: T) => string;
		label: (item: T) => string;
		/** Second line under the label in the default row. */
		detail?: (item: T) => string | null | undefined;
		/** What the search matches. Defaults to the label. */
		searchIn?: (item: T) => (string | null | undefined)[];
		multiple?: boolean;
		/** Single: `[item]`, immediately. Multi: the selection, on confirm. */
		onpick: (picked: T[]) => void;
		/** Replaces a row's rendering; `pick` is select-or-toggle. */
		row?: Snippet<[{ item: T; picked: boolean; pick: () => void }]>;
		class?: string;
	} = $props();

	const kit = getKitContext();

	let search = $state('');
	// Reassigned on every toggle so the Set stays reactive — and it survives
	// searches on purpose: a whole workshop gets invited in one pass.
	let selected = $state<Set<string>>(new Set());

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return items;
		const fields = searchIn ?? ((item: T) => [label(item)]);
		return items.filter((item) => fields(item).some((f) => f?.toLowerCase().includes(q)));
	});

	function pick(item: T) {
		if (!multiple) {
			onpick([item]);
			return;
		}
		const k = key(item);
		const next = new Set(selected);
		if (next.has(k)) next.delete(k);
		else next.add(k);
		selected = next;
	}

	function confirm() {
		onpick(items.filter((item) => selected.has(key(item))));
	}
</script>

<div class="flex min-h-0 flex-col {klass}">
	<div class="shrink-0 border-b border-border p-3">
		<input
			type="text"
			class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
			placeholder={kit.labels.search()}
			bind:value={search}
		/>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto">
		{#if filtered.length === 0}
			<p class="p-6 text-center text-sm text-muted-foreground">{kit.labels.empty()}</p>
		{:else}
			{#each filtered as item (key(item))}
				{@const picked = selected.has(key(item))}
				{#if row}
					{@render row({ item, picked, pick: () => pick(item) })}
				{:else}
					<button
						type="button"
						class="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left
						       transition-colors last:border-b-0 hover:bg-accent"
						aria-pressed={multiple ? picked : undefined}
						onclick={() => pick(item)}
					>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-medium">{label(item)}</span>
							{#if detail?.(item)}
								<span class="block truncate text-xs text-muted-foreground">{detail(item)}</span>
							{/if}
						</span>
						{#if multiple && picked}
							<svg
								viewBox="0 0 16 16"
								class="size-4 shrink-0 text-primary"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="m3 8.5 3.5 3.5L13 4.5" />
							</svg>
						{/if}
					</button>
				{/if}
			{/each}
		{/if}
	</div>

	{#if multiple}
		<div class="flex shrink-0 items-center justify-between gap-2 border-t border-border p-3">
			<span class="text-xs tabular-nums text-muted-foreground">
				{kit.labels.resultCount({ count: selected.size })}
			</span>
			<button
				type="button"
				class="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground
				       disabled:pointer-events-none disabled:opacity-40"
				disabled={selected.size === 0}
				onclick={confirm}
			>
				{kit.labels.confirm()}
			</button>
		</div>
	{/if}
</div>
