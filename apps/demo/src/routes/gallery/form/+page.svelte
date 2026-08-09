<script lang="ts">
	import { RecordForm, createRecordForm, type FieldSpec, type KitError } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';

	type Demo = {
		name: string;
		amount_cents: number;
		format: string;
		insured: boolean;
		due: string | null;
		notes: string;
		created: string;
	} & Record<string, unknown>;

	const record: Demo = {
		name: 'Valerie',
		amount_cents: 123456,
		format: 'paperback',
		insured: false,
		due: '2026-05-01',
		notes: '',
		created: '2026-04-05'
	};

	const fields: FieldSpec<Demo>[] = [
		{ name: 'name', label: 'Name', kind: 'text', section: 'Identity' },
		{
			name: 'created',
			label: 'Created',
			kind: 'display',
			section: 'Identity',
			render: (r) => new Date(r.created).toISOString().slice(0, 10)
		},
		{
			name: 'amount_cents',
			label: 'Amount',
			kind: 'number',
			section: 'Money',
			scale: 100,
			format: { style: 'currency', currency: 'EUR' },
			hint: 'Stored in cents, edited in euros — the record keeps its units.'
		},
		{
			name: 'format',
			label: 'Format',
			kind: 'select',
			section: 'Money',
			options: [
				{ value: 'hardcover', label: 'hardcover' },
				{ value: 'paperback', label: 'paperback' },
				{ value: 'ebook', label: 'ebook' }
			]
		},
		{
			name: 'insured',
			label: 'Insured shipping',
			kind: 'boolean',
			section: 'Money',
			hint: 'A boolean renders as a row — label beside the switch, never a floating knob.'
		},
		{
			name: 'due',
			label: 'Due date',
			kind: 'date',
			section: 'Money',
			hint: 'Segments follow the formatting locale — flip the switcher above.'
		},
		{ name: 'notes', label: 'Notes', kind: 'textarea', section: 'Notes' },
		{ name: 'name', label: 'Read-only name', kind: 'text', section: 'Notes', readonly: true }
	];

	// Live specimen — edit it, Save resolves.
	const live = createRecordForm<Demo>({
		record: () => record,
		save: async (patch) => ({ ...record, ...patch })
	});

	// A form parked in the diverged state, so the field-level marking is visible
	// without racing two writers.
	const diverged = createRecordForm<Demo>({
		record: () => record,
		save: async () => {
			throw {
				kind: 'write-diverged',
				requested: { name: 'mine' },
				returned: { ...record, name: 'OTHER WRITER' },
				diverged: ['name'],
				message: 'write diverged on: name'
			} satisfies KitError;
		}
	});
</script>

<div class="grid max-w-2xl gap-6">
	<h1 class="text-lg font-semibold">RecordForm</h1>
	<p class="-mt-4 text-sm text-muted-foreground">
		What archetype E actually reuses. A solo record is this with nothing around it; a collection
		surface is this inside a detail pane.
	</p>

	<Case
		title="all field kinds, grouped into sections"
		note="Sections come from the descriptor in first-appearance order, so the descriptor IS the layout. Edit anything: Save arms, Cancel appears, and setting a field back to its stored value disarms them again."
	>
		<RecordForm form={live} {fields} />
	</Case>

	<Case
		title="write-diverged"
		note="Press Save. The draft is deliberately KEPT — the cache already holds the server's value, so clearing it would erase your intent before you had seen what happened to it. The affected field is marked individually, because 'someone overwrote your change' is only actionable if you can see which change."
	>
		<RecordForm form={diverged} fields={fields.slice(0, 1)} />
	</Case>
</div>
