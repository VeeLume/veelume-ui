<script lang="ts">
	import { Surface } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';
	import { descriptor, staticBrowse } from '$lib/gallery/fixtures.svelte';

	const bare = { ...descriptor, facets: [], sorts: [] };
</script>

<div class="grid max-w-3xl gap-6">
	<h1 class="text-lg font-semibold">Surface.Toolbar</h1>

	<Case
		title="default"
		note="Fixed positions: search left (aligned with the list it filters), count beside it, actions pushed right."
	>
		<Surface.Root {descriptor} browse={staticBrowse()}>
			<Surface.Toolbar />
		</Surface.Root>
	</Case>

	<Case
		title="with active filters"
		note="The badge counts NARROWING fields only — search and sort are excluded, because it answers 'am I looking at everything?', which only filters can change."
	>
		<Surface.Root {descriptor} browse={staticBrowse({ shape: ['badge'] })}>
			<Surface.Toolbar />
		</Surface.Root>
	</Case>

	<Case title="with actions" note="The one forward action belongs in this slot.">
		<Surface.Root {descriptor} browse={staticBrowse()}>
			<Surface.Toolbar>
				{#snippet actions()}
					<button class="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground">New</button>
				{/snippet}
			</Surface.Toolbar>
		</Surface.Root>
	</Case>

	<Case
		title="no facets, no sorts"
		note="The filter trigger disappears rather than opening an empty panel — absence stays neutral."
	>
		<Surface.Root descriptor={bare} browse={staticBrowse()}>
			<Surface.Toolbar />
		</Surface.Root>
	</Case>

	<Case
		title="open panel — contextual counts"
		note="Each option's count is measured against search plus every OTHER facet, never its own. Counting against the raw list is easier and lies: with a search active it can promise 37 and deliver 0. Click the filter button."
	>
		<Surface.Root {descriptor} browse={staticBrowse()}>
			<Surface.Toolbar />
		</Surface.Root>
	</Case>
</div>
