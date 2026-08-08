<script lang="ts">
	import { Settings } from '@veelume/ui';
	import Segmented from '$lib/components/Segmented.svelte';
	import { locales, getLocale, selectLocale, hasExplicitLocale } from '$lib/i18n';

	const options = [
		{ value: 'system', label: 'System' },
		...locales.map((l: string) => ({ value: l, label: l.toUpperCase() }))
	];
</script>

<Settings.Page title="Language">
	<Settings.Section
		title="UI language"
		description="Changing the language reloads the window. Formatting stays pinned to de-DE — the two locales are independent on purpose."
	>
		<Segmented
			{options}
			current={hasExplicitLocale() ? getLocale() : 'system'}
			pick={(v) => selectLocale(v as 'system')}
		/>
	</Settings.Section>
</Settings.Page>
