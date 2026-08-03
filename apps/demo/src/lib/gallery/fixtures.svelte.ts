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
