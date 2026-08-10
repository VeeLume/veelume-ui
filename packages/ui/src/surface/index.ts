/**
 * The surface parts, as a namespace so the compound shape is visible at the
 * call site:
 *
 *   <Surface.Root {descriptor} {browse} selected={id}>
 *     <Surface.Split>
 *       {#snippet list()}<Surface.List {status} />{/snippet}
 *       {#snippet detail()}…{/snippet}
 *     </Surface.Split>
 *   </Surface.Root>
 *
 * Note what is NOT there: a toolbar. Search and filters ride inside
 * `<Surface.List>`, which owns them because it owns what they act on.
 * `<Surface.Toolbar>` is added only for chrome that belongs to neither pane —
 * a scope switcher, a surface-wide action — and most surfaces have none.
 *
 * Parts may be OMITTED — Root's defaults are neutral, so a missing part means
 * nothing is filtered rather than a filter with no UI to reach it. Parts may not
 * be REARRANGED; that is where opinionated would stop being opinionated.
 */

import Root from './Root.svelte';
import Toolbar from './Toolbar.svelte';
import ListHeader from './ListHeader.svelte';
import FilterButton from './FilterButton.svelte';
import List from './List.svelte';
import Split from './Split.svelte';
import TabStrip from './TabStrip.svelte';
import Tab from './Tab.svelte';

export const Surface = { Root, Toolbar, ListHeader, FilterButton, List, Split, TabStrip, Tab };

export { createSurface } from './pipeline.svelte.js';
export { createWorkset } from './workset.svelte.js';
export type { Workset, WorksetTab } from './workset.svelte.js';
export type { Surface as SurfaceState } from './pipeline.svelte.js';
export { isGroupHeader } from './types.js';
export type {
	FacetDef,
	FacetOption,
	GroupDef,
	GroupHeader,
	ListEntry,
	Row,
	SortDef,
	SurfaceBrowse,
	SurfaceDescriptor
} from './types.js';
