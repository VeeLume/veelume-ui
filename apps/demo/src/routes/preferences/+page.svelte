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
		Surface,
		storedValue,
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

	// Whether the preview is docked open on a wide window — a per-device view
	// preference, so it survives a reload. The narrow-window sheet keeps its
	// own state inside the kit.
	const previewOpen = storedValue<boolean>(
		'veelume-ui-demo:preferences.previewOpen',
		true,
		(v): v is boolean => typeof v === 'boolean'
	);
	// Its dragged width, same reasoning; `null` is the kit's default.
	const previewWidth = storedValue<number | null>(
		'veelume-ui-demo:preferences.previewWidth',
		null,
		(v): v is number | null => v === null || (typeof v === 'number' && v > 0)
	);

	const DAY = 86_400_000;
	const preview = $derived.by(() => {
		if (!form.record) return null;
		const v = form.value;
		return {
			due: kit.format.date(new Date(Date.now() + v.default_loan_days * DAY), {
				dateStyle: 'full'
			}),
			late: [3, 7, 14].map((days) => ({
				days,
				fine: kit.format.number((days * v.fine_per_day_cents) / 100, {
					style: 'currency',
					currency: 'EUR'
				})
			})),
			remind: v.notify_overdue
		};
	});
</script>

<!-- Starlume's Text Patching shape in the reading tracker's terms: a solo
     record on the left, a supporting pane on the right showing what the edit
     MEANS. It reads `form.value` — the record with the unsaved draft laid over
     it — so the preview moves while you type, before anything is saved. -->
<Surface.Supporting
	title="Loan preview"
	open={previewOpen.value}
	onopen={(next) => (previewOpen.value = next)}
	width={previewWidth.value}
	onresize={(next) => (previewWidth.value = next)}
>
	{#snippet main()}
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
	{/snippet}

	{#snippet pane()}
		{#if preview}
			<dl class="grid gap-4 text-sm">
				<div>
					<dt class="text-muted-foreground">A loan started today is due</dt>
					<dd class="font-medium">{preview.due}</dd>
				</div>
				{#each preview.late as l (l.days)}
					<div>
						<dt class="text-muted-foreground">Returned {l.days} days late</dt>
						<dd class="font-medium">{l.fine}</dd>
					</div>
				{/each}
				<div>
					<dt class="text-muted-foreground">Overdue reminder</dt>
					<dd class="font-medium">{preview.remind ? 'sent on the due date' : 'never sent'}</dd>
				</div>
			</dl>
		{:else}
			<p class="text-sm text-muted-foreground">{kit.labels.loading()}</p>
		{/if}
	{/snippet}
</Surface.Supporting>
