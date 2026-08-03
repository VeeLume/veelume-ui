// SPA: no server to render on, and prerendering a Tauri shell buys nothing.
export const ssr = false;
export const prerender = false;

import { installFixtureBackend } from '$lib/fixtures';

/**
 * Installed here, at module scope, because this file is evaluated before the
 * layout component initialises — and therefore before any store can call a
 * command. Doing it inside the component would be a race: `settings.init()`
 * fires from `onMount`, which is close enough to look fine and late enough to
 * break under a slow import.
 *
 * No-op inside a Tauri webview; the real IPC is never shadowed.
 *
 * Deliberately not exported: SvelteKit validates the exports of a route module
 * and rejects anything outside its known set (load / ssr / csr / prerender /
 * trailingSlash / config / entries, or a `_` prefix). Ask `usingFixtures()`
 * from `$lib/fixtures` instead — which is the better seam anyway, since
 * consumers should not import from a route file.
 */
installFixtureBackend();
