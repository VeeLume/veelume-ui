// The settings categories, in display order — stibu's pattern: adding a
// setting is one entry here plus one small page under routes/settings/<id>/.
import type { SettingsCategory } from '@veelume/ui';
import { Palette, Languages, Wrench } from 'lucide-svelte';

export const settingsCategories: SettingsCategory[] = [
	{
		id: 'general',
		label: 'General',
		description: 'Onboarding and startup',
		icon: Wrench,
		path: '/settings/general'
	},
	{
		id: 'appearance',
		label: 'Appearance',
		description: 'Theme and density',
		icon: Palette,
		path: '/settings/appearance'
	},
	{
		id: 'language',
		label: 'Language',
		description: 'UI language — formatting stays German on purpose',
		icon: Languages,
		path: '/settings/language'
	}
];
