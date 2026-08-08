/**
 * The stibu-shaped settings scaffold: a categorized list-detail section where
 * categories are data and each category is a small routed page.
 *
 *   // settings/+layout.svelte
 *   <Settings.Root {categories}>{@render children()}</Settings.Root>
 *
 *   // settings/+page.svelte
 *   <Settings.Placeholder />
 *
 *   // settings/<category>/+page.svelte
 *   <Settings.Page title="Appearance">
 *     <Settings.Section title="Theme" description="'System' follows the device.">
 *       …the control…
 *     </Settings.Section>
 *   </Settings.Page>
 *
 * Adding a setting is one category entry plus one small page. The kit owns
 * the three-state responsive layout and the geometry; the app owns the
 * categories, the wording and the controls.
 */

import Root from './Root.svelte';
import List from './List.svelte';
import Page from './Page.svelte';
import Section from './Section.svelte';
import Placeholder from './Placeholder.svelte';

export const Settings = { Root, List, Page, Section, Placeholder };

export { getSettingsContext, type SettingsContext } from './context.js';
export type { SettingsCategory } from './types.js';
