<script lang="ts">
	import { Settings, Switch, Button } from '@veelume/ui';
	import { settings } from '$lib/stores/settings.svelte';
	import Onboarding from '$lib/components/Onboarding.svelte';

	let setupOpen = $state(false);
</script>

<Settings.Page title="General">
	<Settings.Section title="Onboarding">
		<Settings.Row
			label="Onboarding completed"
			hint="Switch off to see the first-launch flow again on the next start."
		>
			<Switch
				label="Onboarding completed"
				checked={settings.current?.onboarding_completed ?? false}
				disabled={!settings.current}
				onchange={(next) => settings.save({ onboarding_completed: next })}
			/>
		</Settings.Row>
		<Settings.Row
			label="Re-run setup"
			hint="The Wizard's other host: the same flow the first launch shows."
		>
			<Button variant="outline" onclick={() => (setupOpen = true)}>Run setup</Button>
		</Settings.Row>
	</Settings.Section>
</Settings.Page>

<Onboarding open={setupOpen} onclose={() => (setupOpen = false)} />
