<script lang="ts">
	import { breakpoints } from '@veelume/ui';
	import { m } from '$lib/i18n';
</script>

<div class="p-[var(--density-padding)]">
	<h1 class="text-2xl font-semibold">{m.home_title()}</h1>
	<p class="mt-2 text-sm text-muted-foreground">
{m.home_subtitle()}	</p>

	<!-- Handy while wiring layout; delete once the real UI lands. -->
	<p class="mt-6 font-mono text-xs text-muted-foreground">
		{breakpoints.width}px · rail: {breakpoints.showRail} · labels: {breakpoints.showLabels} · bottom
		nav: {breakpoints.showBottomNav}
	</p>
</div>
