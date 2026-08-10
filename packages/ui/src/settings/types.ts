/**
 * The settings navigation model, lifted from stibu: categories as DATA, in
 * display order. Adding a setting is one entry here plus one small page under
 * the settings route — nothing else changes.
 *
 * stibu's `demoOnly` flag is deliberately NOT here: which categories an
 * account sees is an app policy, and the general mechanism is filtering the
 * array before passing it — no kit API needed.
 */

import type { Icon } from '../theme/types.js';

export type SettingsCategory = {
	id: string;
	label: string;
	/** One line under the label — what lives in this category. */
	description?: string;
	icon?: Icon;
	path: string;
};
