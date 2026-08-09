import Row from './Row.svelte';
import Facts from './Facts.svelte';
import Cols from './Cols.svelte';

/** Namespaced like `Surface` — the parts are only meaningful together. */
export const Expand = { Row, Facts, Cols };

export { createExpansion } from './expansion.svelte.js';
export type { Expansion, ExpansionMode } from './expansion.svelte.js';
export type { Fact } from './types.js';
