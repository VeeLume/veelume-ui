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
		class: klass = '',
		children
	}: {
		descriptor: SurfaceDescriptor<Src, R>;
		browse: SurfaceBrowse;
		class?: string;
		children: Snippet;
	} = $props();

	// Getters, not values: props change, and capturing them here would pin the
	// surface to whatever the first render saw.
	setSurfaceContext(
		createSurface(
			() => descriptor,
			() => browse
		)
	);
</script>

<div class="flex h-full min-h-0 flex-col gap-3 {klass}">
	{@render children()}
</div>
