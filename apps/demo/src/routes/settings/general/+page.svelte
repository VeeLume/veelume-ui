<script lang="ts">
	import { Settings, Switch } from '@veelume/ui';
	import { settings } from '$lib/stores/settings.svelte';
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
	</Settings.Section>
</Settings.Page>
