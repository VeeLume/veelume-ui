/**
 * Shell context — how the frame's decisions reach the parts, and how a custom
 * part slots in without re-deriving them.
 *
 * The must-not-drift knowledge lives here: which widths show the rail, when
 * the bottom bar takes over, when the rail earns its labels. A part — kit or
 * app — reads the answers instead of the raw width, so an app that replaces
 * `Shell.Rail` with its own rail stays in sync with the frame for free.
 *
 * There is no `strategy` flag. `Shell.BottomBar` registers itself on mount,
 * and the rail shows at every width exactly when no bottom bar is composed —
 * rail-only is the OMISSION of a part, not a mode someone has to keep
 * consistent with what is actually rendered.
 */

import { getContext, setContext } from 'svelte';
import { breakpoints } from './breakpoints.svelte.js';
import type { NavGroup } from './types.js';

export type ShellContext = {
	/** The app's nav tree, as given to `Shell.Root`. */
	readonly groups: NavGroup[];
	/** Route override from Root; parts fall back to the current route. */
	readonly activePath: string | undefined;
	/** Whether a `Shell.BottomBar` is composed anywhere under this Root. */
	readonly hasBottomBar: boolean;
	/** Rail visibility: always, unless a bottom bar exists to take the narrow widths. */
	readonly showRail: boolean;
	/** Bottom bar visibility: composed AND the width is compact/medium. */
	readonly showBottom: boolean;
	/** Whether the rail has width to spare for labels. */
	readonly showLabels: boolean;
	/** Called by `Shell.BottomBar` on mount. Returns the unregister. */
	registerBottomBar(): () => void;
};

const SHELL = Symbol('veelume-ui:shell');

export function createShellContext(input: {
	groups: () => NavGroup[];
	activePath: () => string | undefined;
}): ShellContext {
	// A count, not a boolean: mount order between Rail and BottomBar is not
	// guaranteed, and a re-render must not lose the registration.
	let bottomBars = $state(0);

	return {
		get groups() {
			return input.groups();
		},
		get activePath() {
			return input.activePath();
		},
		get hasBottomBar() {
			return bottomBars > 0;
		},
		get showRail() {
			return bottomBars === 0 || breakpoints.showRail;
		},
		get showBottom() {
			return bottomBars > 0 && breakpoints.showBottomNav;
		},
		get showLabels() {
			return breakpoints.showLabels;
		},
		registerBottomBar() {
			bottomBars++;
			return () => {
				bottomBars--;
			};
		}
	};
}

export function setShellContext(ctx: ShellContext): void {
	setContext(SHELL, ctx);
}

export function getShellContext(): ShellContext {
	const ctx = getContext<ShellContext | undefined>(SHELL);
	if (!ctx) {
		throw new Error(
			'veelume-ui: a Shell part was used outside <Shell.Root>. Parts read the frame state from Root via context.'
		);
	}
	return ctx;
}
