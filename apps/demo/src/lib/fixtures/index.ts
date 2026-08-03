/**
 * The fixture backend — the demo's THIRD IO adapter, beside TrailBase and
 * Tauri `invoke`.
 *
 * Not a convenience. Three things depend on it:
 *
 *  1. **The browser target.** Without it the app boots, mounts, and hangs on
 *     its spinner forever, because `settings.init()` calls a Tauri command that
 *     cannot resolve outside the webview. (Hearth fails identically — silently,
 *     with no console error.) Nothing UI-shaped is inspectable until this runs.
 *  2. **Determinism.** The record-store spike had to *race* two writers to
 *     provoke a write conflict and got non-deterministic ordering. A fixture
 *     that deliberately returns something other than what was written
 *     reproduces it every time.
 *  3. **Iteration.** Frontend-only work needs no Rust rebuild.
 *
 * `mockIPC` is Tauri's own testing hook, and `shouldMockEvents` also mocks
 * `listen`/`emit` — which matters, because the kit's cache invalidation runs on
 * `listen('<noun>-changed')`. A mocked `emit` can therefore drive the whole
 * invalidation path from a browser.
 *
 * Adding a domain: write a module exporting a handler map and register it in
 * `install()` below.
 */

import { mockIPC } from '@tauri-apps/api/mocks';
import { settingsFixtures } from './settings.js';
import { probeFixtures } from './probes.js';
import type { FixtureModule } from './types.js';

export type { FixtureHandler, FixtureModule } from './types.js';

const handlers: FixtureModule = {};

export function registerFixtures(module: FixtureModule): void {
	Object.assign(handlers, module);
}

/**
 * Artificial latency, so loading states are observable instead of instant.
 * `?latency=400` on the URL the app STARTS at.
 *
 * Snapshotted at install rather than read per dispatch, because the app
 * navigates: `/` redirects to `/home`, the query string goes with it, and a
 * per-dispatch read would silently switch itself off after the first
 * navigation. Found exactly that way.
 */
let latencyMs = 0;

function readLatency(): number {
	if (typeof location === 'undefined') return 0;
	const raw = new URLSearchParams(location.search).get('latency');
	const n = raw ? Number(raw) : 0;
	return Number.isFinite(n) && n > 0 ? n : 0;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function dispatch(cmd: string, payload?: Record<string, unknown>): Promise<unknown> {
	if (latencyMs) await sleep(latencyMs);

	const handler = handlers[cmd];
	if (handler) return handler(payload ?? {});

	// Plugins the demo does not fixture (updater, process, opener). Answering
	// "nothing to report" is right: the alternative is a thrown error the caller
	// swallows, which looks identical to a real failure.
	if (cmd.startsWith('plugin:')) return null;

	// Loud on purpose. A missing fixture is a gap to fill, not a null to absorb —
	// silent nulls are exactly how the spinner-hang stayed invisible.
	throw new Error(`fixture backend: no handler for "${cmd}"`);
}

/**
 * Install the fixture backend if we are NOT inside a Tauri webview.
 *
 * Returns whether it installed, so a caller can surface which backend is live.
 * Inside Tauri this is a no-op — the real IPC must never be shadowed.
 */
let installed = false;

/** Whether the app is running against fixtures rather than a real backend. */
export function usingFixtures(): boolean {
	return installed;
}

export function installFixtureBackend(): boolean {
	if (typeof window === 'undefined') return false;
	const inTauri = '__TAURI_INTERNALS__' in window;
	if (inTauri) return false;

	registerFixtures(settingsFixtures);
	registerFixtures(probeFixtures);
	installed = true;
	latencyMs = readLatency();
	mockIPC((cmd, payload) => dispatch(cmd, payload as Record<string, unknown>), {
		shouldMockEvents: true
	});

	console.info(
		`[fixtures] Tauri IPC mocked — in-memory fixtures, latency ${latencyMs}ms. ` +
			'Start at ?latency=400 to make loading states visible.'
	);
	return true;
}
