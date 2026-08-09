/**
 * The notification funnel — Hearth's design, with Starlume's port supplying
 * the named variation (a `source` tag; adapter-fed entries that skip the
 * toast stack; external identity for dedupe).
 *
 * ONE entry point drives every surface: `notify()` for in-app code,
 * `ingest()` for transport adapters (a backend `notify` event, a hydration
 * sweep after the webview was suspended). Two surfaces read one list — the
 * transient toast stack and the persistent center — so nothing can appear
 * in one and be missing from the other.
 *
 * Session-memory only, bounded. Durable notification history is a backend
 * concern (Starlume keeps a Rust-side ring buffer and re-syncs on focus);
 * the store's job is what THIS session was told. Likewise the native-toast
 * fallback for hidden windows lives in the app's Rust, not here — a
 * suspended webview runs no JS, so no frontend store can cover that case.
 *
 * A module singleton, like `breakpoints`: every donor converged on exactly
 * one funnel per app, and two stores would mean two bells disagreeing.
 */

export type NotifLevel = 'info' | 'success' | 'warning' | 'error';

export type NotifAction = { label: string; href: string };

export type NotifInput = {
	level: NotifLevel;
	title: string;
	body?: string | null;
	action?: NotifAction | null;
	/** Who raised it — a module or service id, rendered as a tag (Starlume's delta). */
	source?: string | null;
};

export type Notification = NotifInput & {
	id: string;
	ts: number;
	read: boolean;
	/** Whether the toast stack should surface it — false for hydrated backlog:
	 *  returning to a wall of stale toasts is noise; the bell badge covers them. */
	popToast: boolean;
};

/**
 * Which levels' toasts persist until dismissed. Identical in both donors:
 * outcomes you glance at fade, problems you must act on stay.
 */
const STICKY: Record<NotifLevel, boolean> = {
	info: false,
	success: false,
	warning: true,
	error: true
};

export function isSticky(level: NotifLevel): boolean {
	return STICKY[level];
}

/** Both donors bound the log; Starlume matches its backend ring buffer. */
const MAX_ITEMS = 100;

let items = $state<Notification[]>([]);
let counter = 0;
/** External keys already ingested — an adapter may deliver the same record
 *  via a live event AND a later hydration sweep. */
const seenKeys = new Set<string>();

function insert(n: Notification) {
	items = [n, ...items].sort((a, b) => b.ts - a.ts).slice(0, MAX_ITEMS);
}

/** Reactive read access — components use `notifications.items` / `.unread`. */
export const notifications = {
	get items() {
		return items;
	},
	get unread() {
		return items.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
	},
	get hasUnread() {
		return items.some((n) => !n.read);
	}
};

/** The in-app entry point. Always toasts — code that does not want a toast
 *  is describing backlog, which is `ingest`'s case. */
export function notify(input: NotifInput): Notification {
	const n: Notification = {
		id: `l${counter++}`,
		ts: Date.now(),
		read: false,
		popToast: true,
		level: input.level,
		title: input.title,
		body: input.body ?? null,
		action: input.action ?? null,
		source: input.source ?? null
	};
	insert(n);
	return n;
}

/**
 * The adapter entry point. `key` is the record's identity on its own
 * transport — ingesting the same key twice is a no-op, which is what lets a
 * live event stream and a catch-up sweep overlap without double entries.
 * `toast: false` is the hydrated-backlog case; `ts` keeps the record's own
 * ordering rather than arrival time.
 */
export function ingest(
	input: NotifInput & { key: string; ts?: number },
	opts: { toast?: boolean } = {}
): Notification | null {
	if (seenKeys.has(input.key)) return null;
	seenKeys.add(input.key);
	const n: Notification = {
		id: `k${input.key}`,
		ts: input.ts ?? Date.now(),
		read: false,
		popToast: opts.toast ?? true,
		level: input.level,
		title: input.title,
		body: input.body ?? null,
		action: input.action ?? null,
		source: input.source ?? null
	};
	insert(n);
	return n;
}

export function dismiss(id: string) {
	items = items.filter((n) => n.id !== id);
}

export function markAllRead() {
	if (items.some((n) => !n.read)) {
		items = items.map((n) => (n.read ? n : { ...n, read: true }));
	}
}

export function clearAll() {
	items = [];
}

/**
 * Level accents for the two surfaces — one source so a toast and a center
 * row can never disagree about what an error looks like. Same palette logic
 * as StatusBadge: tokens where the convention has them, amber for warning.
 */
export const notifLevelClass: Record<NotifLevel, { accent: string; glyph: string }> = {
	info: { accent: 'border-l-border', glyph: 'text-muted-foreground' },
	success: { accent: 'border-l-primary', glyph: 'text-primary' },
	warning: {
		accent: 'border-l-amber-500',
		glyph: 'text-amber-700 dark:text-amber-400'
	},
	error: { accent: 'border-l-destructive', glyph: 'text-destructive' }
};

/** Text glyphs, not an icon dependency — the donors' choice, kept. */
export const notifGlyph: Record<NotifLevel, string> = {
	info: '•',
	success: '✓',
	warning: '!',
	error: '✕'
};
