/**
 * Static specimens for the gallery.
 *
 * Deliberately NOT the fixture backend: a gallery case must be able to show a
 * state the backend cannot easily be talked into, and `error` is the obvious
 * one. Rendering states directly is what lets every branch be seen at once
 * rather than one per session.
 */

import type { Row, SurfaceBrowse } from '@veelume/ui';

export type DemoRow = Row & { note: string };

export const rows: DemoRow[] = [
	{ key: 'a', title: 'The Dispossessed', subtitle: 'Ursula K. Le Guin', note: 'plain' },
	{
		key: 'b',
		title: 'Use of Weapons',
		subtitle: 'Iain M. Banks',
		trailing: '2/3',
		note: 'trailing'
	},
	{ key: 'c', title: 'Kindred', subtitle: 'Octavia Butler', badge: 'out', note: 'badge' },
	{
		key: 'd',
		title: 'A very long title that has to truncate rather than wrap or push the row wider',
		subtitle: 'Also a long subtitle, for the same reason',
		trailing: '10/10',
		badge: 'archived',
		note: 'overflow'
	}
];

/**
 * A browse state that is NOT URL-backed — the gallery must be able to render a
 * filtered specimen without navigating, and a case that changed the address bar
 * would fight the surrounding page.
 */
export function staticBrowse(initial: Record<string, string | string[]> = {}): SurfaceBrowse {
	const values = $state<Record<string, string | string[]>>({ ...initial });
	return {
		get values() {
			return values;
		},
		set(key: string, value: never) {
			values[key] = value;
		},
		toggle(key: string, option: string) {
			const current = Array.isArray(values[key]) ? (values[key] as string[]) : [];
			values[key] = current.includes(option)
				? current.filter((v) => v !== option)
				: [...current, option];
		},
		reset() {
			for (const k of Object.keys(values)) delete values[k];
		},
		get activeCount() {
			return Object.values(values).filter((v) => (Array.isArray(v) ? v.length : v)).length;
		}
	};
}

// ── Grouping specimens ─────────────────────────────────────────────────────

export type GroupedRow = DemoRow & { era: string; author: string };

const g = (key: string, era: string, author: string, title: string): GroupedRow => ({
	key,
	title,
	subtitle: author,
	era,
	author,
	note: ''
});

/** Eight rows across three eras and six authors — enough that one-level and
 *  two-level grouping produce visibly different structures (Le Guin spans two
 *  eras, so "by author" merges what "by era → author" separates). */
export const groupedRows: GroupedRow[] = [
	g('g1', '1960s', 'Frank Herbert', 'Dune'),
	g('g2', '1960s', 'Ursula K. Le Guin', 'A Wizard of Earthsea'),
	g('g3', '1970s', 'Ursula K. Le Guin', 'The Dispossessed'),
	g('g4', '1970s', 'Octavia Butler', 'Kindred'),
	g('g5', '1970s', 'Larry Niven', 'Ringworld'),
	g('g6', '1980s', 'Iain M. Banks', 'Consider Phlebas'),
	g('g7', '1980s', 'Iain M. Banks', 'Use of Weapons'),
	g('g8', '1980s', 'William Gibson', 'Neuromancer')
];

const groupedBase = {
	sources: () => groupedRows,
	derive: (rs: GroupedRow[]) => rs,
	searchIn: (r: GroupedRow) => [r.title, r.author],
	sorts: [
		{
			value: 'title',
			label: 'Title',
			compare: (a: GroupedRow, b: GroupedRow) => a.title.localeCompare(b.title)
		}
	]
};

export const groupedByAuthor = {
	...groupedBase,
	groupBy: [{ key: (r: GroupedRow) => r.author }]
};

/** Two levels, and the outer one supplies `compare`: rows are sorted by title,
 *  so first-appearance would order the eras by whichever title sorts first —
 *  a taxonomy wants its own order instead. */
export const groupedByEraAuthor = {
	...groupedBase,
	groupBy: [
		{ key: (r: GroupedRow) => r.era, compare: (a: string, b: string) => a.localeCompare(b) },
		{ key: (r: GroupedRow) => r.author }
	]
};

/** 600 deterministic rows in decade sections — past the windowing threshold,
 *  so headers are proven to measure and position like any other entry. */
export const bigGroupedRows: GroupedRow[] = Array.from({ length: 600 }, (_, i) => {
	const decade = 1900 + Math.floor(i / 50) * 10;
	return g(`big${i}`, `${decade}s`, `Author ${(i % 7) + 1}`, `Work no. ${i + 1} (${decade}s)`);
});

export const bigGroupedDescriptor = {
	...groupedBase,
	sources: () => bigGroupedRows,
	groupBy: [{ key: (r: GroupedRow) => r.era }]
};

export const descriptor = {
	sources: () => rows,
	derive: (rs: DemoRow[]) => rs,
	searchIn: (r: DemoRow) => [r.title, r.subtitle ?? null],
	facets: [
		{
			id: 'shape',
			label: 'Shape',
			mode: 'many' as const,
			options: [
				{ value: 'trailing', label: 'Has trailing', test: (r: DemoRow) => !!r.trailing },
				{ value: 'badge', label: 'Has badge', test: (r: DemoRow) => !!r.badge }
			]
		}
	],
	sorts: [
		{
			value: 'title',
			label: 'Title',
			compare: (a: DemoRow, b: DemoRow) => a.title.localeCompare(b.title)
		}
	]
};
