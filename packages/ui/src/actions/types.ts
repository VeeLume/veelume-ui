/**
 * The three-tier action system.
 *
 * The invariant is POSITION, not appearance: the one forward action sits
 * top-right on every surface — a list, a record, a form — so a user never hunts
 * for it. stibu arrived at this watching a real user struggle, and connect-neo
 * adopted it ("Tier ① and therefore last, so the one forward action sits
 * top-right on every surface exactly as it does inside a record").
 *
 *   ① primary    filled. THE forward action. At most one.
 *   ② secondary  outline. Edit, export — reachable but not the point.
 *   ③ overflow   `⋮` menu. Rare or destructive. Rendered only when non-empty.
 *
 * Left-to-right within a right-aligned cluster, so the primary anchors the
 * group and the overflow ends it.
 *
 * Tiers are DATA rather than snippets on purpose: the whole value is that no
 * screen gets to invent its own arrangement. An app that genuinely needs
 * something other than a button passes `leading`.
 */

import type { Icon, IconOf } from '../theme/types.js';

/** The shared icon union (`theme/types.ts`), under this module's name. */
export type ActionIcon = Icon;

export type { IconOf };

export type Action = {
	label: string;
	icon?: ActionIcon;
	/** Use one or the other — `href` renders an anchor, `onclick` a button. */
	onclick?: () => void;
	href?: string;
	disabled?: boolean;
	/**
	 * The action is running: renders disabled with a spinner in the icon slot.
	 *
	 * A plain boolean, matching `disabled` on this same type rather than the
	 * getter `NavItem.badge` uses — consistency within a type beats precedent
	 * across types, and the failure mode is identical either way (an action
	 * array built outside a `$derived` never updates either flag).
	 *
	 * Every app in the fleet hand-rolls `disabled={busy}` on its async
	 * buttons; making it a tier property means the position invariant covers
	 * the pending state too, instead of each screen inventing one.
	 */
	busy?: boolean;
	/** Overflow only: renders in the destructive tone. */
	destructive?: boolean;
	/** Falls back to `label`; useful when the label is collapsed on narrow. */
	title?: string;
};
