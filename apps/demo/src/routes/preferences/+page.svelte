<script lang="ts">
	/**
	 * Archetype E — one record as the whole surface.
	 *
	 * REWRITTEN after the first attempt. That version used `<Surface.Root>` with
	 * the toolbar and list omitted, which worked but was near-worthless reuse:
	 * it had to supply a `derive` producing a row nothing rendered, a `searchIn`
	 * returning `[]`, and a browse state never read — then ignored all of it.
	 *
	 * Re-reading connect-neo's §5, the wording is "the same EDITOR", not the same
	 * surface. So archetype E is the record form with nothing around it, and the
	 * shared piece is `RecordForm` — which a collection surface renders inside a
	 * detail pane instead. No second shell either way, just a different amount of
	 * scaffolding around the same editor.
	 */
	import { invoke } from '@tauri-apps/api/core';
	import {
		RecordForm,
		createCollection,
		createRecordForm,
		getKitContext,
		type FieldSpec
	} from '@veelume/ui';
	import type { Preferences } from '$lib/fixtures/prefs';

	const kit = getKitContext();

	const prefs = createCollection<Preferences, string>({
		keyOf: (p) => p.id,
		fetchAll: () => invoke('prefs_list'),
		write: {
			semantics: 'replace',
			save: (_id, body) => invoke('prefs_save', { body })
		}
	});

	const form = createRecordForm<Preferences>({
		record: () => prefs.byKey('me'),
		save: (patch) => prefs.save('me', patch)
	});

	const fields: FieldSpec<Preferences>[] = [
		{ name: 'display_name', label: 'Display name', kind: 'text', section: 'Identity' },
		{
			name: 'default_loan_days',
			label: 'Default loan period (days)',
			kind: 'number',
			section: 'Lending',
			format: { maximumFractionDigits: 0 }
		},
		{
			name: 'fine_per_day_cents',
			label: 'Fine per day',
			kind: 'number',
			section: 'Lending',
			// Stored in cents, edited in euros — the record shape keeps its units
			// and the user never sees them.
			scale: 100,
			format: { style: 'currency', currency: 'EUR' },
			hint: `Type it the ${kit.formattingLocale} way — the comma is accepted.`
		},
		{
			name: 'preferred_format',
			label: 'Preferred format',
			kind: 'select',
			section: 'Lending',
			options: [
				{ value: 'hardcover', label: 'hardcover' },
				{ value: 'paperback', label: 'paperback' },
				{ value: 'ebook', label: 'ebook' }
			]
		},
		{
			name: 'notify_overdue',
			label: 'Overdue reminders',
			kind: 'boolean',
			section: 'Lending',
			hint: 'Remind me when a loan falls overdue.'
		},
		{ name: 'notes', label: 'Notes', kind: 'textarea', section: 'Notes' }
	];
</script>

<div class="flex h-full flex-col gap-3 p-4">
	<header class="flex items-baseline gap-3">
		<h1 class="text-lg font-semibold">Preferences</h1>
		<span class="text-xs text-muted-foreground">
			archetype E · the form, no surface · status {prefs.status} · {kit.formattingLocale}
		</span>
	</header>

	<div
		class="mx-auto w-full max-w-2xl flex-1 overflow-auto rounded-lg border border-border
	            bg-card p-5"
	>
		{#if !form.record}
			<p class="text-sm text-muted-foreground">{kit.labels.loading()}</p>
		{:else}
			<RecordForm {form} {fields} />
		{/if}
	</div>
</div>
