<script lang="ts" generics="Src, R extends Row">
	/**
	 * Owns the pipeline and publishes it to the parts.
	 *
	 * Renders only a flex column — the ARRANGEMENT of the parts is the caller's,
	 * within the rule that parts may be OMITTED but not REARRANGED. Root does not
	 * position them because a surface with no list (archetype E) and one with a
	 * list are the same component minus a child.
	 */
	import type { Snippet } from 'svelte';
	import { createSurface } from './pipeline.svelte.js';
	import { setSurfaceContext } from './context.js';
	import type { Row, SurfaceBrowse, SurfaceDescriptor } from './types.js';

	let {
		descriptor,
		browse,
		selected = null,
		collapsed = undefined,
		oncollapse = undefined,
		class: klass = '',
		children
	}: {
		descriptor: SurfaceDescriptor<Src, R>;
		browse: SurfaceBrowse;
		/**
		 * The open row's key, usually straight from the URL. One source of truth
		 * for three parts — see the note on `createSurface`'s third argument.
		 */
		selected?: string | null;
		/**
		 * List collapse. Both halves must be supplied for the controls to exist —
		 * `Split` renders the docked SHOW handle while collapsed, `Surface.List`
		 * the HIDE half-button in its own header, and neither draws anything
		 * without a way to report the change. Controlled like `Switch`, so
		 * whether the state lives in the URL, a preference or page state is the
		 * app's call.
		 */
		collapsed?: boolean;
		oncollapse?: (next: boolean) => void;
		class?: string;
		children: Snippet;
	} = $props();

	// Getters, not values: props change, and capturing them here would pin the
	// surface to whatever the first render saw.
	setSurfaceContext(
		createSurface(
			() => descriptor,
			() => browse,
			() => selected,
			() => (oncollapse ? { collapsed: !!collapsed, set: oncollapse } : undefined)
		)
	);
</script>

<div class="flex h-full min-h-0 flex-col gap-3 {klass}">
	{@render children()}
</div>
