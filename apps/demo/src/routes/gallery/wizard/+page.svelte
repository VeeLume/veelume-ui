<script lang="ts">
	import { Wizard, Switch, Progress, Actions, type WizardStep } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';

	// Three independent specimens, each with its own index so they can sit on
	// one page without fighting.
	let iStatic = $state(0);
	let iGated = $state(1);
	let iReactive = $state(1);
	let gateOk = $state(false);
	let extras = $state(false);
	let busyDemo = $state(false);

	const staticSteps: WizardStep[] = [
		{ id: 'a', title: 'Welcome', step: plain },
		{ id: 'b', title: 'Details', step: plain },
		{ id: 'c', title: 'All set', step: plain }
	];

	const gatedSteps = $derived<WizardStep[]>([
		{ id: 'a', title: 'Welcome', step: plain },
		{ id: 'b', title: 'Pick something', canContinue: () => gateOk, step: gateStep },
		{ id: 'c', title: 'All set', step: plain }
	]);

	const reactiveSteps = $derived<WizardStep[]>([
		{ id: 'a', title: 'Welcome', step: plain },
		{ id: 'features', title: 'Choose features', step: featureStep },
		...(extras ? [{ id: 'x', title: 'Extra setup', tag: 'Extras', step: plain }] : []),
		{ id: 'done', title: 'All set', step: plain }
	]);

	const noop = () => {};
</script>

{#snippet plain()}
	<p class="text-sm text-muted-foreground">Step body — the app's content, rendered as a snippet.</p>
{/snippet}

{#snippet gateStep()}
	<p class="mb-3 text-sm text-muted-foreground">Next is disabled until this is on.</p>
	<Switch label="I picked something" checked={gateOk} onchange={(v) => (gateOk = v)} />
{/snippet}

{#snippet featureStep()}
	<p class="mb-3 text-sm text-muted-foreground">
		Toggling this splices a step in and out — watch the count in the footer.
	</p>
	<Switch label="Extras" checked={extras} onchange={(v) => (extras = v)} />
{/snippet}

<div class="grid max-w-3xl gap-6">
	<h1 class="text-lg font-semibold">Wizard</h1>

	<p class="-mt-4 text-sm text-muted-foreground">
		The step frame — header, body, footer — and nothing about where it lives. The demo hosts it in a <code
			>Dialog</code
		>
		(Settings → General → Run setup); Starlume runs the same component full-screen. Steps are a reactive
		prop, so a registry-contributed list is just a
		<code>$derived</code> array.
	</p>

	<Case
		title="static steps"
		note="Back is always free — it never validates, so a user cannot be trapped. The footer states an exact count rather than a percentage bar."
		frame={false}
	>
		<div class="h-72 overflow-hidden rounded-lg border border-border bg-card">
			<Wizard steps={staticSteps} bind:index={iStatic} onfinish={noop} />
		</div>
	</Case>

	<Case
		title="gated step"
		note="`canContinue` is a GETTER on the step data, read by the wizard — not an imperative API handed to the step. A snippet has no effect scope, so the imperative form would write state during the consumer's render: state_unsafe_mutation, the kit's own documented landmine."
		frame={false}
	>
		<div class="h-72 overflow-hidden rounded-lg border border-border bg-card">
			<Wizard steps={gatedSteps} bind:index={iGated} onfinish={noop} />
		</div>
	</Case>

	<Case
		title="reactive list + tag + skip"
		note="The Hearth-vs-Starlume axis: who supplies the steps. Toggling Extras splices a step in live and the count follows; its `tag` names the contributor. `onskip` is supplied here — omit it and no skip button renders."
		frame={false}
	>
		<div class="h-72 overflow-hidden rounded-lg border border-border bg-card">
			<Wizard steps={reactiveSteps} bind:index={iReactive} onfinish={noop} onskip={noop} />
		</div>
	</Case>

	<Case
		title="busy finish"
		note="Finishing may be async and may fail, so the wizard never closes itself — the caller does, on success. `busy` disables both footer actions meanwhile."
		frame={false}
	>
		<div class="h-72 overflow-hidden rounded-lg border border-border bg-card">
			<Wizard
				steps={staticSteps}
				index={2}
				busy={busyDemo}
				onfinish={() => {
					busyDemo = true;
					setTimeout(() => (busyDemo = false), 1500);
				}}
			/>
		</div>
	</Case>
</div>
