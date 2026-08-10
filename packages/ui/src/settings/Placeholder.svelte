<script lang="ts">
	/**
	 * The settings root page's content. Rendered only on desktop — at narrow
	 * widths `Settings.Root` shows the category list in this position instead.
	 *
	 * The generic `Placeholder` with the bag's category message baked in —
	 * a wrapper, so the two cannot drift.
	 */
	import Placeholder from '../loading/Placeholder.svelte';
	import { getKitContext } from '../context/index.js';

	const kit = getKitContext();
</script>

<Placeholder class="h-full">{kit.labels.selectCategory()}</Placeholder>
