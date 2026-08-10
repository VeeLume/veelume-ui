/**
 * Window-size classes, Material's set.
 *
 * The shell asks this ("showRail?"), never the raw width — so changing where
 * the rail gives way to a bottom bar is one edit here rather than a grep across
 * components.
 *
 * Exported because apps legitimately need the same answer: stibu moves Kunden
 * into a "Mehr" page on compact, which is a content decision the shell cannot
 * make for it.
 */

const COMPACT = 600;
const MEDIUM = 840;
const LARGE = 1200;
const XLARGE = 1600;

class Breakpoints {
	// 1024 rather than 0 for the pre-browser value: SSR and the first paint
	// should assume the common case, not collapse to mobile and then jump.
	width = $state(typeof window === 'undefined' ? 1024 : window.innerWidth);

	constructor() {
		if (typeof window !== 'undefined') {
			window.addEventListener('resize', () => {
				this.width = window.innerWidth;
			});
		}
	}

	get isCompact() {
		return this.width < COMPACT;
	}
	get isMedium() {
		return this.width >= COMPACT && this.width < MEDIUM;
	}
	get isExpanded() {
		return this.width >= MEDIUM && this.width < LARGE;
	}
	get isLarge() {
		return this.width >= LARGE && this.width < XLARGE;
	}
	get isExtraLarge() {
		return this.width >= XLARGE;
	}
	get isDesktop() {
		return this.width >= MEDIUM;
	}

	/** Compact and medium get the bottom bar; anything wider gets the rail. */
	get showBottomNav() {
		return this.isCompact || this.isMedium;
	}
	get showRail() {
		return this.isDesktop;
	}
	/** The rail only earns its labels once there is width to spare. */
	get showLabels() {
		return this.isLarge || this.isExtraLarge;
	}
}

export const breakpoints = new Breakpoints();
