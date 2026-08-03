/**
 * Shared fixture types.
 *
 * `AppSettings` is re-exported from the generated bindings rather than
 * redeclared — a fixture that drifts from the Rust contract is worse than no
 * fixture, because it passes while the real backend fails.
 */

export type { AppSettings } from '$lib/bindings';

export type FixtureHandler = (payload: Record<string, unknown>) => unknown | Promise<unknown>;
export type FixtureModule = Record<string, FixtureHandler>;
