// The loans domain's status map — the per-domain half of StatusBadge. One
// module, consumed by both transports' pages (/loans and /http), because the
// map is domain design, not page code.
import type { StatusMap } from '@veelume/ui';
import type { LoanStatus } from '$lib/fixtures/loans';

export const loanStatusMap: StatusMap<LoanStatus> = {
	draft: { label: () => 'Draft', tone: 'warning' },
	out: { label: () => 'Out', tone: 'primary' },
	returned: { label: () => 'Returned', tone: 'neutral' },
	lost: { label: () => 'Lost', tone: 'destructive' },
	archived: { label: () => 'Archived', tone: 'neutral' }
};
