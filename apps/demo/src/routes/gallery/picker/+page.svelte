<script lang="ts">
	/**
	 * The picker pair against its four axes. The dialog specimen draws from
	 * the LIVE editions collection — store-vs-list is invisible to the
	 * picker, which is the axis working; the inline and multi specimens use
	 * a local list, same component.
	 */
	import { Button, Picker, PickerDialog, notify } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';
	import { editions } from '$lib/library.svelte';
	import type { Edition } from '$lib/fixtures/library';

	let dialogOpen = $state(false);
	let multiOpen = $state(false);

	const genres = [
		{ id: 'sf', name: 'Science fiction', hint: 'The catalog’s home turf' },
		{ id: 'fantasy', name: 'Fantasy', hint: 'Dragons, occasionally' },
		{ id: 'litfic', name: 'Literary fiction', hint: 'No dragons' },
		{ id: 'nonfic', name: 'Non-fiction', hint: 'True, allegedly' },
		{ id: 'poetry', name: 'Poetry', hint: 'Short lines, long thoughts' }
	];

	let inlinePicked = $state<string | null>(null);
</script>

<div class="grid max-w-3xl gap-6 p-4">
	<div>
		<h2 class="text-lg font-semibold">Picker &amp; PickerDialog</h2>
		<p class="text-sm text-muted-foreground">
			stibu derived this five times; the kit ships it once against the four named axes. Picker is
			the embeddable search + list; PickerDialog only wraps it in the modal — reopening always
			starts clean because closing unmounts.
		</p>
	</div>

	<Case
		title="Single pick, dialog, store-sourced"
		note="items is the live editions collection — the picker cannot tell a store from an array. Focus lands on the search (the trap's first stop); picking closes and delivers [item]."
	>
		<Button variant="outline" onclick={() => (dialogOpen = true)}>Pick an edition…</Button>
		<PickerDialog
			open={dialogOpen}
			onclose={() => (dialogOpen = false)}
			title="Pick an edition"
			items={editions.all}
			key={(e: Edition) => e.id}
			label={(e: Edition) => e.work_title}
			detail={(e: Edition) => `${e.author} · ${e.format}`}
			searchIn={(e: Edition) => [e.work_title, e.author]}
			onpick={([e]) =>
				notify({ level: 'success', title: 'Picked', body: e.work_title, source: 'gallery' })}
		/>
	</Case>

	<Case
		title="Multi pick, dialog"
		note="ParticipantPicker's shape: selection survives searching, the footer confirms the whole set at once. onpick delivers the array."
	>
		<Button variant="outline" onclick={() => (multiOpen = true)}>Pick genres…</Button>
		<PickerDialog
			open={multiOpen}
			onclose={() => (multiOpen = false)}
			title="Pick genres"
			multiple
			items={genres}
			key={(g) => g.id}
			label={(g) => g.name}
			detail={(g) => g.hint}
			onpick={(picked) =>
				notify({
					level: 'info',
					title: `${picked.length} genres picked`,
					body: picked.map((g) => g.name).join(', '),
					source: 'gallery'
				})}
		/>
	</Case>

	<Case
		title="Inline, embedded in the page"
		note="The other half of the inline-vs-dialog axis: the same component in a host's own frame, no modal anywhere. Picking just reports below."
		frame={false}
	>
		<div class="h-64 max-w-sm overflow-hidden rounded-lg border border-border bg-card">
			<Picker
				items={genres}
				key={(g) => g.id}
				label={(g) => g.name}
				detail={(g) => g.hint}
				onpick={([g]) => (inlinePicked = g.name)}
				class="h-full"
			/>
		</div>
		<p class="mt-2 text-xs text-muted-foreground">
			Picked: {inlinePicked ?? '—'}
		</p>
	</Case>
</div>
