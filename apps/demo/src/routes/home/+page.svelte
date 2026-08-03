<script lang="ts">
	import { breakpoint } from '$lib/breakpoint.svelte';
	import { m } from '$lib/i18n';
</script>

<div class="p-[var(--density-padding)]">
	<h1 class="text-2xl font-semibold">{m.home_title()}</h1>
	<p class="mt-2 text-sm text-muted-foreground">
{m.home_subtitle()}	</p>

	<!-- Handy while wiring layout; delete once the real UI lands. -->
	<p class="mt-6 font-mono text-xs text-muted-foreground">
		{breakpoint.width}px · rail: {breakpoint.showRail} · labels: {breakpoint.showLabels} · bottom
		nav: {breakpoint.showBottomNav}
	</p>
</div>
