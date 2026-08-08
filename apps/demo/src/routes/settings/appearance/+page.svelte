<script lang="ts">
	import { Settings } from '@veelume/ui';
	import Segmented from '$lib/components/Segmented.svelte';
	import { appearance, type Theme, type Density } from '$lib/stores/appearance.svelte';

	const themes: { value: Theme; label: string }[] = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'system', label: 'System' }
	];

	const densities: { value: Density; label: string }[] = [
		{ value: 'comfortable', label: 'Comfortable' },
		{ value: 'compact', label: 'Compact' }
	];
</script>

<Settings.Page title="Appearance">
	<Settings.Section title="Theme" description="'System' follows the device's setting.">
		<Segmented options={themes} current={appearance.theme} pick={(v) => appearance.setTheme(v as Theme)} />
	</Settings.Section>

	<Settings.Section
		title="Density"
		description="'Comfortable' is larger and finger-friendly; 'Compact' shows more at once."
	>
		<Segmented
			options={densities}
			current={appearance.density}
			pick={(v) => appearance.setDensity(v as Density)}
		/>
	</Settings.Section>
</Settings.Page>
