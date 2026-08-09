<script lang="ts">
	/**
	 * The demo's first-run flow — the kit `Wizard`'s consumer.
	 *
	 * Deliberately shaped like Starlume's, because that is the axis the design
	 * had to absorb: a FEATURE PICKER whose selections splice later steps in
	 * and out, live. Here that is a `$derived` array and nothing else — the
	 * wizard has no registry concept, and the step list simply changes under
	 * it.
	 *
	 * The host is the app's (`Dialog`), per the Picker/PickerDialog split.
	 */
	import { Dialog, Wizard, Switch, Segmented, type WizardStep } from '@veelume/ui';
	import { settings } from '$lib/stores/settings.svelte';

	let { open = false, onclose }: { open?: boolean; onclose: () => void } = $props();

	// Wizard-local draft; nothing is written until Finish.
	let features = $state<string[]>(['loans']);
	let fineRate = $state('');
	let density = $state('comfortable');
	let index = $state(0);
	let busy = $state(false);

	const has = (id: string) => features.includes(id);
	function toggle(id: string, on: boolean) {
		features = on ? [...features, id] : features.filter((f) => f !== id);
	}

	const steps = $derived<WizardStep[]>([
		{ id: 'welcome', title: 'Welcome', step: welcome },
		{ id: 'features', title: 'Choose your features', step: featureStep },
		// Spliced in by SELECTION, and the wizard needs no notion of why.
		...(has('loans')
			? [
					{
						id: 'loans',
						title: 'Loan defaults',
						tag: 'Loans',
						// The GATE, declared: read by the wizard, so no step ever
						// writes state during a render.
						canContinue: () => fineRate !== '',
						step: loanStep
					}
				]
			: []),
		...(has('catalog')
			? [{ id: 'catalog', title: 'Catalog defaults', tag: 'Catalog', step: catalogStep }]
			: []),
		{ id: 'done', title: 'All set', step: done }
	]);

	async function finish() {
		busy = true;
		try {
			await settings.save({ onboarding_completed: true });
			onclose();
		} finally {
			busy = false;
		}
	}

	async function skip() {
		await settings.save({ onboarding_completed: true });
		onclose();
	}
</script>

{#snippet welcome()}
	<p class="text-sm">
		This harness exercises the kit against a deliberately awkward domain. The next step picks which
		parts you want set up.
	</p>
	<p class="mt-2 text-xs text-muted-foreground">
		Nothing here is written until you finish — Skip leaves every default alone.
	</p>
{/snippet}

{#snippet featureStep()}
	<p class="mb-3 text-sm text-muted-foreground">
		Toggling these adds and removes later steps immediately — watch the step count.
	</p>
	<div class="grid gap-3">
		<Switch label="Loans" checked={has('loans')} onchange={(v) => toggle('loans', v)} />
		<Switch label="Catalog" checked={has('catalog')} onchange={(v) => toggle('catalog', v)} />
	</div>
{/snippet}

{#snippet loanStep()}
	<!-- The gated step — Next stays disabled until a rate is chosen. The gate
	     itself is on the step DATA above, not in here. -->
	<p class="mb-3 text-sm text-muted-foreground">Daily fine for an overdue loan.</p>
	<Segmented
		options={[
			{ value: '10', label: '0,10 €' },
			{ value: '25', label: '0,25 €' },
			{ value: '50', label: '0,50 €' }
		]}
		value={fineRate}
		onchange={(v) => (fineRate = v)}
	/>
	{#if fineRate === ''}
		<p class="mt-2 text-xs text-muted-foreground">Pick one to continue.</p>
	{/if}
{/snippet}

{#snippet catalogStep()}
	<p class="mb-3 text-sm text-muted-foreground">Row density for the catalog list.</p>
	<Segmented
		options={[
			{ value: 'comfortable', label: 'Comfortable' },
			{ value: 'compact', label: 'Compact' }
		]}
		value={density}
		onchange={(v) => (density = v)}
	/>
{/snippet}

{#snippet done()}
	<p class="text-sm">
		Set up {features.length === 0 ? 'nothing' : features.join(' and ')}.
	</p>
	<p class="mt-2 text-xs text-muted-foreground">Re-run this any time from Settings → General.</p>
{/snippet}

<Dialog {open} {onclose} label="Setup" class="h-[32rem] max-w-lg">
	<Wizard {steps} bind:index onfinish={finish} onskip={skip} {busy} />
</Dialog>
