<script lang="ts">
	import { Surface } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';
	import { descriptor, staticBrowse } from '$lib/gallery/fixtures.svelte';
</script>

<div class="grid max-w-3xl gap-6">
	<h1 class="text-lg font-semibold">Surface.Toolbar</h1>
	<p class="-mt-4 text-sm text-muted-foreground">
		The escalation bar, and the default is not to have one. It holds only chrome that belongs to
		neither pane — a scope switcher, a surface-wide action. Search, filters and the count live in
		<a class="underline" href="/gallery/list-header">Surface.ListHeader</a>, because they belong to
		the list. It has no title: the nav rail already names the surface.
	</p>

	<Case
		title="empty"
		note="Nothing supplied, so it renders an empty 56px bar. That is the tell that a surface should have omitted it — most surfaces have no chrome in this bucket at all."
	>
		<Surface.Root {descriptor} browse={staticBrowse()}>
			<Surface.Toolbar />
		</Surface.Root>
	</Case>

	<Case
		title="scope switcher"
		note="The canonical reason to escalate. A year selector changes what BOTH panes are looking at, so it cannot ride in the list's header."
	>
		<Surface.Root {descriptor} browse={staticBrowse()}>
			<Surface.Toolbar>
				{#snippet leading()}
					<div class="flex shrink-0 rounded-md border border-input p-0.5 text-xs">
						{#each ['2024', '2025', '2026'] as y (y)}
							<span
								class="rounded px-2 py-1 {y === '2026' ? 'bg-accent text-accent-foreground' : ''}"
								>{y}</span
							>
						{/each}
					</div>
				{/snippet}
			</Surface.Toolbar>
		</Surface.Root>
	</Case>

	<Case
		title="surface-wide action"
		note="An action that operates on the surface rather than on the list or the open record — import, export, reset. A 'New …' is NOT one of these: it creates a row, so it belongs to the list."
	>
		<Surface.Root {descriptor} browse={staticBrowse()}>
			<Surface.Toolbar>
				{#snippet actions()}
					<button class="h-9 rounded-md border border-input px-3 text-sm hover:bg-muted"
						>Export</button
					>
				{/snippet}
			</Surface.Toolbar>
		</Surface.Root>
	</Case>
</div>
