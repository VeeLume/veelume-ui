/**
 * The shell parts, as a namespace so the compound shape is visible at the
 * call site — the same contract as `Surface`:
 *
 *   <Shell.Root {groups}>
 *     <Shell.Rail {footer} />
 *     <Shell.Content {banner}>
 *       {#snippet bottom()}<Shell.BottomBar items={…} />{/snippet}
 *       {@render children()}
 *     </Shell.Content>
 *   </Shell.Root>
 *
 * Omitting `bottom` IS rail-only — there is no strategy flag to keep in sync
 * with what is rendered. A part may be replaced by the app's own component
 * reading `getShellContext()`, which is how divergence slots in while
 * everything not replaced keeps updating with the kit.
 *
 * `AppShell` is the default arrangement of these parts, for apps with no
 * frame opinion. `NavRail` / `BottomNav` stay exported standalone: they are
 * the markup the parts drive, usable outside a shell (a settings drawer, a
 * storybook case) without the frame's decisions attached.
 */

import Root from './Root.svelte';
import Rail from './Rail.svelte';
import Content from './Content.svelte';
import BottomBar from './BottomBar.svelte';
import SettingsFooter from './SettingsFooter.svelte';
import AccountFooter from './AccountFooter.svelte';

// The two footers are the default occupants of the rail's bottom block —
// SettingsFooter for apps without accounts, AccountFooter for apps with them.
// Both host the settings entry; both are just snippet content, so an app with
// a third idea writes its own.
export const Shell = { Root, Rail, Content, BottomBar, SettingsFooter, AccountFooter };

export { default as AppShell } from './AppShell.svelte';
export { default as NavRail } from './NavRail.svelte';
export { default as BottomNav } from './BottomNav.svelte';
export { breakpoints } from './breakpoints.svelte.js';
export { getShellContext, type ShellContext } from './context.svelte.js';
export { activeNavPath } from './types.js';
export type { NavGroup, NavIcon, NavItem, NavStrategy } from './types.js';
