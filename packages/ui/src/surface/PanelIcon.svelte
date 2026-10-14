<script lang="ts">
	/**
	 * The pane toggles' glyph — lucide's `panel-{left,right}-{open,close}`
	 * (ISC), inlined like the kit's other chrome glyphs so the toggles render
	 * without an icon library. One component, because the list's collapse and
	 * the supporting pane's are the same control mirrored: only the divider
	 * side and the chevron change.
	 */
	let {
		side,
		open,
		class: klass = ''
	}: { side: 'left' | 'right'; open: boolean; class?: string } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	class="size-4 {klass}"
	aria-hidden="true"
>
	<rect width="18" height="18" x="3" y="3" rx="2" />
	{#if side === 'right'}
		<path d="M15 3v18" />
		<!-- Open → the chevron points at the edge (it will close towards it). -->
		<path d={open ? 'm8 9 3 3-3 3' : 'm10 15-3-3 3-3'} />
	{:else}
		<path d="M9 3v18" />
		<path d={open ? 'm16 15-3-3 3-3' : 'm14 9 3 3-3 3'} />
	{/if}
</svg>
