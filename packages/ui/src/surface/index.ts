/**
 * The surface parts, as a namespace so the compound shape is visible at the
 * call site:
 *
 *   <Surface.Root {descriptor} {browse}>
 *     <Surface.Toolbar />
 *     <Surface.Split selected={!!id}>
 *       {#snippet list()}<Surface.List {status} selected={id} />{/snippet}
 *       {#snippet detail()}…{/snippet}
 *     </Surface.Split>
 *   </Surface.Root>
 *
 * Parts may be OMITTED — Root's defaults are neutral, so a missing Toolbar
 * means nothing is filtered rather than a filter with no UI to reach it. Parts
 * may not be REARRANGED; that is where opinionated would stop being
 * opinionated.
 */

import Root from './Root.svelte';
import Toolbar from './Toolbar.svelte';
import List from './List.svelte';
import Split from './Split.svelte';

export const Surface = { Root, Toolbar, List, Split };

export { createSurface } from './pipeline.svelte.js';
export type { Surface as SurfaceState } from './pipeline.svelte.js';
export type {
	FacetDef,
	FacetOption,
	Row,
	SortDef,
	SurfaceBrowse,
	SurfaceDescriptor
} from './types.js';
