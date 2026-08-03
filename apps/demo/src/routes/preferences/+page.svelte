<script lang="ts">
	/**
	 * Archetype E — one record as the whole surface.
	 *
	 * The claim under test, from connect-neo's own `frontend-requirements.md` §5:
	 * `SoloSurface` is "archetype B with the collection removed, NOT a second
	 * shell". So this page uses the same `<Surface.Root>` as /loans and simply
	 * omits two children:
	 *
	 *   <Surface.Toolbar />   — search, facets and sort are controls over
	 *                           nothing when there is one record
	 *   list snippet          — a list of one is not a list
	 *
	 * Nothing else changes, and "absence is neutral" is what makes it work: with
	 * no toolbar there is no filter state, so the single row passes through
	 * rather than being silently excluded.
	 */
	import { invoke } from '@tauri-apps/api/core';
	import { Surface, createBrowseState, createCollection, getKitContext, type Row } from '@veelume/ui';
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

	// Still required by Root, and with no toolbar nothing ever writes to it.
	// Whether that is graceful degeneration or dead ceremony is the question this
	// page exists to answer — see the note rendered at the bottom.
	const browse = createBrowseState({});

	const descriptor = {
		sources: () => prefs.all,
		derive: (records: Preferences[]): Row[] =>
			records.map((p) => ({ key: p.id, title: p.display_name })),
		searchIn: () => []
	};

	const me = $derived(prefs.byKey('me'));

	let draft = $state<Partial<Preferences>>({});
	let message = $state<string | null>(null);

	const value = $derived({ ...(me ?? ({} as Preferences)), ...draft });
	const dirty = $derived(Object.keys(draft).length > 0);

	async function save() {
		message = null;
		try {
			await prefs.save('me', draft);
			draft = {};
			message = 'Saved';
		} catch (e) {
			const err = e as { kind?: string; diverged?: string[] };
			message =
				err.kind === 'write-diverged'
					? `Overwritten on: ${err.diverged?.join(', ')}`
					: `Failed: ${err.kind ?? 'error'}`;
		}
	}
</script>

<div class="flex h-full flex-col gap-3 p-4">
	<header class="flex items-baseline gap-3">
		<h1 class="text-lg font-semibold">Preferences</h1>
		<span class="text-xs text-muted-foreground">
			archetype E · Root minus Toolbar and list · status {prefs.status}
		</span>
	</header>

	<Surface.Root {descriptor} {browse} class="flex-1">
		<!-- No <Surface.Toolbar />. No list snippet. Same Root. -->
		<Surface.Split>
			{#snippet detail()}
				<div class="mx-auto h-full w-full max-w-2xl overflow-auto rounded-lg border border-border
				            bg-card p-5">
					{#if !me}
						<p class="text-sm text-muted-foreground">{kit.labels.loading()}</p>
					{:else}
						<div class="grid gap-4">
							<label class="grid gap-1">
								<span class="text-xs text-muted-foreground">Display name</span>
								<input
									class="h-9 rounded-md border border-input bg-background px-3 text-sm"
									value={value.display_name}
									oninput={(e) => (draft = { ...draft, display_name: e.currentTarget.value })}
								/>
							</label>

							<label class="grid gap-1">
								<span class="text-xs text-muted-foreground">Default loan period (days)</span>
								<input
									type="number"
									class="h-9 rounded-md border border-input bg-background px-3 text-sm"
									value={value.default_loan_days}
									oninput={(e) =>
										(draft = { ...draft, default_loan_days: Number(e.currentTarget.value) })}
								/>
							</label>

							<label class="grid gap-1">
								<span class="text-xs text-muted-foreground">Preferred format</span>
								<select
									class="h-9 rounded-md border border-input bg-background px-3 text-sm"
									value={value.preferred_format}
									onchange={(e) =>
										(draft = {
											...draft,
											preferred_format: e.currentTarget.value as Preferences['preferred_format']
										})}
								>
									<option value="hardcover">hardcover</option>
									<option value="paperback">paperback</option>
									<option value="ebook">ebook</option>
								</select>
							</label>

							<div class="grid gap-1">
								<span class="text-xs text-muted-foreground">Fine per day</span>
								<p class="text-sm tabular-nums">
									{kit.format.number(value.fine_per_day_cents / 100, {
										style: 'currency',
										currency: 'EUR'
									})}
								</p>
								<!-- Read-only on purpose. Editing this needs a locale-aware
								     number input: a de-DE user types "1,50", and a native
								     <input type="number"> on an en-US browser will not accept
								     the comma. bits-ui has no number field, so that component
								     is still owed. -->
								<p class="text-xs text-muted-foreground">
									Display-only — a locale-aware number input is still missing from the kit.
								</p>
							</div>

							<label class="grid gap-1">
								<span class="text-xs text-muted-foreground">Notes</span>
								<textarea
									class="h-24 rounded-md border border-input bg-background p-2 text-sm"
									value={value.notes}
									oninput={(e) => (draft = { ...draft, notes: e.currentTarget.value })}
								></textarea>
							</label>

							<div class="flex items-center gap-3">
								<button
									type="button"
									class="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground
									       disabled:opacity-40"
									disabled={!dirty}
									onclick={save}>{kit.labels.save()}</button
								>
								{#if dirty}<span class="text-xs text-amber-600">unsaved</span>{/if}
								{#if message}<span class="text-xs text-muted-foreground">{message}</span>{/if}
							</div>
						</div>
					{/if}
				</div>
			{/snippet}
		</Surface.Split>
	</Surface.Root>
</div>
