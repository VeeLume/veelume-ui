<script lang="ts">
	import { Surface } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';

	let wideOpen = $state(true);
	let narrowOpen = $state(true);
	let resizeOpen = $state(true);
	let resizeWidth = $state<number | null>(null);
</script>

{#snippet filler(label: string)}
	<div class="grid gap-3 p-4">
		<p class="text-sm font-medium">{label}</p>
		{#each { length: 12 } as _, i (i)}
			<div class="h-10 rounded-md border border-border bg-card"></div>
		{/each}
	</div>
{/snippet}

<div class="grid gap-6">
	<h1 class="text-lg font-semibold">Surface.Supporting</h1>
	<p class="-mt-4 max-w-3xl text-sm text-muted-foreground">
		Material's supporting-pane layout: the work on the left, a pane that only means something beside
		it on the right. The toggle has one position in every state — the top-right corner — so open and
		collapsed are the same control, and a collapsed pane is a 48px rail that still names itself.
	</p>

	<Case
		title="docked — the box fits both"
		note="Side by side at Material's 30% (360px floor). `open` is the app's, controlled: hide it, and the rail keeps the toggle in exactly the spot the header had it. Each pane scrolls on its own."
		frame={false}
	>
		<div class="h-80 overflow-hidden rounded-lg border border-border">
			<Surface.Supporting title="Preview" open={wideOpen} onopen={(next) => (wideOpen = next)}>
				{#snippet main()}{@render filler('Main pane')}{/snippet}
				{#snippet pane()}
					<p class="text-sm text-muted-foreground">Click the panel icon to collapse to the rail.</p>
				{/snippet}
			</Surface.Supporting>
		</div>
	</Case>

	<Case
		title="resizable — `onresize` supplied"
		note="Material's pane expansion on the APG window-splitter contract. The seam is a 12px hit zone over the border with the 4×48 pill always drawn. Drag it (neither pane below 360px), arrow keys step 16px (Shift 64), Home/End jump to the limits, Enter collapses, double-click resets to the default 30%. Release a drag below 180px and the pane collapses to the rail — the width is kept, so reopening restores it. The width is committed once per gesture, never per pixel."
		frame={false}
	>
		<div class="h-80 overflow-hidden rounded-lg border border-border">
			<Surface.Supporting
				title="Preview"
				open={resizeOpen}
				onopen={(next) => (resizeOpen = next)}
				width={resizeWidth}
				onresize={(next) => (resizeWidth = next)}
			>
				{#snippet main()}{@render filler('Main pane')}{/snippet}
				{#snippet pane()}
					<p class="text-sm text-muted-foreground">
						width: {resizeWidth === null ? 'default (30%)' : `${resizeWidth}px`}
					</p>
				{/snippet}
			</Surface.Supporting>
		</div>
	</Case>

	<Case
		title="sheet — the box is narrower than 840px"
		note="Decided by the CONTAINER, not the window — this box is 600px on any screen. The pane opens over the main pane behind a scrim scoped to the box, and its open state is the component's own and starts closed: narrowing must never bury the work. Escape or the scrim closes it; focus goes in and comes back. The `open` prop here is true and ignored, which is the point."
		frame={false}
	>
		<div class="h-80 w-[600px] max-w-full overflow-hidden rounded-lg border border-border">
			<Surface.Supporting title="Preview" open={narrowOpen} onopen={(next) => (narrowOpen = next)}>
				{#snippet main()}{@render filler('Main pane')}{/snippet}
				{#snippet pane()}
					<p class="text-sm text-muted-foreground">The sheet. Escape closes it.</p>
				{/snippet}
			</Surface.Supporting>
		</div>
	</Case>
</div>
