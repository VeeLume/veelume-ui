<script lang="ts">
	import { Settings, Segmented } from '@veelume/ui';
	import { locales, getLocale, selectLocale, hasExplicitLocale } from '$lib/i18n';

	const options = [
		{ value: 'system', label: 'System' },
		...locales.map((l: string) => ({ value: l, label: l.toUpperCase() }))
	];
</script>

<Settings.Page title="Language">
	<Settings.Section>
		<Settings.Row
			label="UI language"
			hint="Changing the language reloads the window. Formatting stays pinned to de-DE — the two locales are independent on purpose."
		>
			<Segmented
				{options}
				value={hasExplicitLocale() ? getLocale() : 'system'}
				onchange={(v) => selectLocale(v as 'system')}
			/>
		</Settings.Row>
	</Settings.Section>
</Settings.Page>
