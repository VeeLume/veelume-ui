<script lang="ts">
	/**
	 * The built-in `⋯` for the More collector slot, inlined like the kit's
	 * other chrome glyphs. Internal — apps pass their own via `moreIcon`.
	 */
	let { size = 20, class: klass = '' }: { size?: number; class?: string } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="currentColor"
	class={klass}
	aria-hidden="true"
>
	<circle cx="5" cy="12" r="1.6" />
	<circle cx="12" cy="12" r="1.6" />
	<circle cx="19" cy="12" r="1.6" />
</svg>
