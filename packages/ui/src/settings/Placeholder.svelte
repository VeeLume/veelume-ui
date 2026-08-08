<script lang="ts">
	/**
	 * The settings root page's content. Rendered only on desktop — at narrow
	 * widths `Settings.Root` shows the category list in this position instead.
	 */
	import { getKitContext } from '../context/index.js';

	const kit = getKitContext();
</script>

<div class="flex h-full items-center justify-center p-8 text-center">
	<p class="text-sm text-muted-foreground">{kit.labels.selectCategory()}</p>
</div>
