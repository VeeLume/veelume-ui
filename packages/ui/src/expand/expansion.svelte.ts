/**
 * Which rows are open — the L1 half of the accordion.
 *
 * ⚑ Expansion is NOT selection, and the difference is the whole reason this
 * is separate from browse state. Selection is a state you were *in*, so it
 * belongs in the URL and in history. Expanding a row is transient
 * exploration: back should not walk your carets. Hearth reached this
 * independently (a page-local `SvelteSet`), and `browse/` has said so in a
 * comment since before this existed — what was missing was the 30 lines that
 * stop every consumer re-deriving them.
 *
 * Module scope in the consumer, like a workset: a set that died on navigation
 * would reopen everything on every visit, which is the opposite of what
 * exploration state is for.
 */

import { SvelteSet } from 'svelte/reactivity';

export type ExpansionMode = 'one' | 'many';

export type Expansion = ReturnType<typeof createExpansion>;

/**
 * @param mode `'many'` (default) — opening a row leaves the others alone, the
 * model with no hidden action; Hearth's crafting page wants it, and comparing
 * two rows is only possible here. `'one'` closes the previous row, which is
 * the deep-read accordion's norm (Starlume's catalogs) because a tall
 * expansion makes a long list unnavigable if several are open at once.
 */
export function createExpansion(mode: ExpansionMode = 'many') {
	const open = new SvelteSet<string>();

	return {
		mode,
		has(key: string): boolean {
			return open.has(key);
		},
		toggle(key: string): void {
			if (open.has(key)) {
				open.delete(key);
				return;
			}
			if (mode === 'one') open.clear();
			open.add(key);
		},
		open(key: string): void {
			if (open.has(key)) return;
			if (mode === 'one') open.clear();
			open.add(key);
		},
		close(key: string): void {
			open.delete(key);
		},
		clear(): void {
			open.clear();
		},
		/** Iteration order is insertion order — useful for "collapse the oldest". */
		get keys(): string[] {
			return [...open];
		},
		get size(): number {
			return open.size;
		}
	};
}
