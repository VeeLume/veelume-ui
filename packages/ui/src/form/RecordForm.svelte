<script lang="ts" generics="T extends Record<string, unknown>">
	/**
	 * Renders a record from a field descriptor list, plus the save affordance.
	 *
	 * This is what archetype E actually reuses — connect-neo's own wording is
	 * "the same EDITOR", not the same surface. A solo record is this component
	 * with nothing around it; a collection surface is this component in a detail
	 * pane. Neither needs a second shell.
	 *
	 * The save cluster follows the actions rule — top-right, tiers as data —
	 * in one of two places, and that is the `placement` prop:
	 *
	 *   own   the cluster sits top-right OF THE FORM. For a solo record with
	 *         nothing around it: there is no other bar to hold it.
	 *   host  the form renders no cluster; the host puts `recordFormActions(form)`
	 *         in the bar the record owns (`DetailHeader`, `Settings.Page`).
	 *
	 * Either way the status line (saved · error) stays with the fields, where
	 * the eye returns after the click.
	 */
	import { getKitContext } from '../context/index.js';
	import Actions from '../actions/Actions.svelte';
	import type { Action } from '../actions/types.js';
	import NumberInput from './NumberInput.svelte';
	import DateInput from './DateInput.svelte';
	import TimeInput from './TimeInput.svelte';
	import Switch from './Switch.svelte';
	import { recordFormActions } from './actions.js';
	import { sectionsOf, type FieldSpec } from './types.js';
	import type { RecordForm } from './recordForm.svelte.js';

	let {
		form,
		fields,
		placement = 'own',
		secondary = [],
		overflow = [],
		class: klass = ''
	}: {
		form: RecordForm<T>;
		fields: FieldSpec<T>[];
		/** Where the save cluster renders — see the component doc. */
		placement?: 'own' | 'host';
		/** `own` only: further ② actions beside Cancel — the closing operations. */
		secondary?: Action[];
		/** `own` only: ③ actions — a delete belongs here, destructive. */
		overflow?: Action[];
		class?: string;
	} = $props();

	const kit = getKitContext();
	const sections = $derived(sectionsOf(fields));
	// Derived, so a swapped `form` prop gets its own cluster.
	const fa = $derived(recordFormActions(form, kit));

	const divergedFields = $derived(form.error?.kind === 'write-diverged' ? form.error.diverged : []);
</script>

<div class="grid gap-5 {klass}">
	{#if placement === 'own'}
		<Actions
			primary={fa.primary}
			secondary={[...fa.secondary, ...secondary]}
			{overflow}
			class="justify-end"
		/>
	{/if}

	{#if form.saved || (form.error && form.error.kind !== 'write-diverged')}
		<p
			class="text-xs"
			class:text-muted-foreground={form.saved}
			class:text-destructive={!!form.error}
		>
			{#if form.saved}✓{:else}{form.error?.message ?? form.error?.kind}{/if}
		</p>
	{/if}

	{#each sections as section (section.name)}
		<section class="grid gap-3">
			{#if section.name}
				<h3 class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
					{section.name}
				</h3>
			{/if}

			{#each section.fields as f (f.name)}
				{@const diverged = divergedFields.includes(f.name)}
				<div class="grid gap-1">
					{#if f.kind === 'boolean'}
						<!-- A boolean is a ROW — label beside the control, not above it.
						     A lone knob under a floating label reads as unanchored, and
						     every donor lays toggles out label-first, control-trailing. -->
						<div class="flex items-center justify-between gap-4">
							<label class="text-sm" for={f.name}>{f.label}</label>
							<Switch
								id={f.name}
								checked={Boolean(form.value[f.name])}
								disabled={f.readonly}
								onchange={(next) => form.set(f.name, next as T[typeof f.name])}
							/>
						</div>
					{:else}
						<label class="text-xs text-muted-foreground" for={f.name}>{f.label}</label>

						{#if f.kind === 'display'}
							<p class="text-sm">
								{f.render ? f.render(form.value as T) : String(form.value[f.name] ?? '—')}
							</p>
						{:else if f.kind === 'number'}
							<NumberInput
								id={f.name}
								value={(form.value[f.name] as number | null) ?? null}
								format={f.format}
								scale={f.scale ?? 1}
								disabled={f.readonly}
								onchange={(n) => form.set(f.name, n as T[typeof f.name])}
							/>
						{:else if f.kind === 'date'}
							<DateInput
								id={f.name}
								value={(form.value[f.name] as string | null) ?? null}
								disabled={f.readonly}
								onchange={(d) => form.set(f.name, d as T[typeof f.name])}
							/>
						{:else if f.kind === 'time'}
							<TimeInput
								id={f.name}
								value={(form.value[f.name] as string | null) ?? null}
								disabled={f.readonly}
								onchange={(t) => form.set(f.name, t as T[typeof f.name])}
							/>
						{:else if f.kind === 'select'}
							<select
								id={f.name}
								disabled={f.readonly}
								class="h-9 rounded-md border border-input bg-background px-3 text-sm"
								value={String(form.value[f.name] ?? '')}
								onchange={(e) => form.set(f.name, e.currentTarget.value as T[typeof f.name])}
							>
								{#each f.options ?? [] as o (o.value)}
									<option value={o.value}>{o.label}</option>
								{/each}
							</select>
						{:else if f.kind === 'textarea'}
							<textarea
								id={f.name}
								disabled={f.readonly}
								class="h-24 rounded-md border border-input bg-background p-2 text-sm"
								value={String(form.value[f.name] ?? '')}
								oninput={(e) => form.set(f.name, e.currentTarget.value as T[typeof f.name])}
							></textarea>
						{:else}
							<!-- `type` picks the phone's keyboard; the value stays a string. -->
							<input
								id={f.name}
								type={f.inputType ?? 'text'}
								disabled={f.readonly}
								class="h-9 rounded-md border border-input bg-background px-3 text-sm"
								value={String(form.value[f.name] ?? '')}
								oninput={(e) => form.set(f.name, e.currentTarget.value as T[typeof f.name])}
							/>
						{/if}
					{/if}

					{#if diverged}
						<!-- Field-level, because "someone overwrote your change" is only
						     actionable if you can see WHICH change. -->
						<p class="text-xs text-destructive">
							Overwritten by another writer — now “{String(form.value[f.name] ?? '')}”
						</p>
					{/if}
					{#if f.hint}
						<p class="text-xs text-muted-foreground">{f.hint}</p>
					{/if}
				</div>
			{/each}
		</section>
	{/each}
</div>
