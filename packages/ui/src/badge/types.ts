/**
 * StatusBadge's model. Distilled from four stibu components
 * (`OrderStatusBadge`, `GiftCardStatusBadge`, `VoucherStatusBadge`,
 * `DocumentRoleBadge`) that were one component with different maps — the
 * named variation is the status→(label, tone) map and NOTHING else, so the
 * kit ships the pill and the tone set, and each domain ships a map.
 *
 * The tone set itself lives in `theme/types.ts` — the L1 surface types carry
 * a resolved tone, so the vocabulary sits below both modules.
 */

import type { StatusTone } from '../theme/types.js';

export type { StatusTone };

/** Labels are functions so an app wires its i18n (`m.loan_out()`) directly
 *  and it resolves at render time — stibu hardcoded German labels in the
 *  component, which is the coupling this package exists to forbid. */
export type StatusStyle = { label: () => string; tone: StatusTone };

export type StatusMap<S extends string = string> = Partial<Record<S, StatusStyle>>;

/**
 * The tone classes, one source so `StatusBadge` and `Surface.List`'s badge
 * slot cannot drift. All four are tokens — `warning` included, via the pair
 * the kit's own `styles.css` maps (the shadcn convention has none, and the
 * fleet's amber is the fallback there). It was hardcoded `amber-*` until
 * Starlume, whose brand IS amber, showed that a warning badge then reads as
 * an accent badge.
 */
export const statusToneClass: Record<StatusTone, string> = {
	primary: 'bg-primary/10 text-primary',
	neutral: 'bg-muted text-muted-foreground',
	warning: 'bg-warning/15 text-warning',
	destructive: 'bg-destructive/10 text-destructive'
};

/** The settled pill geometry, verbatim across all four donors. */
export const statusBadgeClass = 'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium';

/**
 * Map lookup with the donors' two edge rules baked in: no status → nothing
 * (a badge is optional information, not a required column), unknown status →
 * the RAW string on neutral (show the data, never hide it behind a map miss).
 */
export function resolveStatus(
	map: StatusMap,
	status: string | null | undefined
): { label: string; tone: StatusTone } | null {
	if (status == null || status === '') return null;
	const style = map[status];
	return style ? { label: style.label(), tone: style.tone } : { label: status, tone: 'neutral' };
}
