/**
 * The notification funnel and its surfaces, as a namespace:
 *
 *   <Notify.Toasts />                          — once, in the root layout
 *
 *   <div class="relative">                     — wherever the bell lives
 *     <Notify.Bell onclick={() => (open = !open)} />
 *     <Notify.Center {open} onclose={() => (open = false)} />
 *   </div>
 *
 * The parts are independent on purpose: an app can run toasts alone, a bell
 * that routes to its own page instead of the Center, or feed the store from
 * a transport adapter via `ingest` without mounting any kit surface at all.
 * What holds them together is the ONE store — anything toasted is in the
 * center, anything in the center counts toward the bell.
 */

import Bell from './Bell.svelte';
import Toasts from './Toasts.svelte';
import Center from './Center.svelte';
import List from './List.svelte';

// List is the embeddable half of Center (the Picker/PickerDialog split): a
// page-sized host — the More-page route at bar widths — renders the same
// rows the anchored panel does.
export const Notify = { Bell, Toasts, Center, List };

export {
	notifications,
	notify,
	ingest,
	dismiss,
	markAllRead,
	clearAll,
	isSticky,
	notifGlyph,
	notifLevelClass
} from './store.svelte.js';
export type { NotifAction, NotifInput, NotifLevel, Notification } from './store.svelte.js';
