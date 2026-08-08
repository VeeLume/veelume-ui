/**
 * StatusBadge's model. Distilled from four stibu components
 * (`OrderStatusBadge`, `GiftCardStatusBadge`, `VoucherStatusBadge`,
 * `DocumentRoleBadge`) that were one component with different maps — the
 * named variation is the status→(label, tone) map and NOTHING else, so the
 * kit ships the pill and the tone set, and each domain ships a map.
 *
 * Exactly four tones appear across the fleet; a fifth is a design decision,
 * not a prop.
 */

export type StatusTone = 'primary' | 'neutral' | 'warning' | 'destructive';

/** Labels are functions so an app wires its i18n (`m.loan_out()`) directly
 *  and it resolves at render time — stibu hardcoded German labels in the
 *  component, which is the coupling this package exists to forbid. */
export type StatusStyle = { label: () => string; tone: StatusTone };

export type StatusMap<S extends string = string> = Partial<Record<S, StatusStyle>>;

/**
 * The tone classes, one source so `StatusBadge` and `Surface.List`'s badge
 * slot cannot drift. `warning` is raw amber: the shadcn token convention has
 * no warning token, amber is the fleet's de facto answer (three of four
 * donor maps), and the dark variants are added here — stibu never had them.
 */
export const statusToneClass: Record<StatusTone, string> = {
	primary: 'bg-primary/10 text-primary',
	neutral: 'bg-muted text-muted-foreground',
	warning: 'bg-amber-500/15 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400',
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
