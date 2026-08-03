<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import { Surface } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';
	import { descriptor, staticBrowse } from '$lib/gallery/fixtures.svelte';

	const noFilters = { ...descriptor, facets: [], sorts: [] };
	const noSearch = { ...descriptor, searchIn: undefined };
	const bare = { ...descriptor, searchIn: undefined, facets: [], sorts: [] };
</script>

<div class="grid max-w-3xl gap-6">
	<h1 class="text-lg font-semibold">Surface.ListHeader</h1>
	<p class="-mt-4 text-sm text-muted-foreground">
		<code>[leading] [filters] [search] [action]</code> — and it lives inside the list pane. That
		containment is the design: a child of the list is aligned with the list, hidden with the list on
		a narrow screen, and has no page to name. Rendered automatically by
		<code>Surface.List</code>; shown standalone here.
	</p>

	<Case
		title="default"
		note="What every list gets for free once its descriptor declares a search function and some facets."
	>
		<Surface.Root {descriptor} browse={staticBrowse()}>
			<Surface.ListHeader />
		</Surface.Root>
	</Case>

	<Case
		title="with the list's action"
		note="Tier ① for the list — the one thing you came to it to start. The label collapses below lg so the search field keeps its width, which is why the action wants an icon."
	>
		<Surface.Root {descriptor} browse={staticBrowse()}>
			<Surface.ListHeader action={{ label: 'New record', icon: Plus, onclick: () => {} }} />
		</Surface.Root>
	</Case>

	<Case
		title="active filters"
		note="The badge counts NARROWING fields only — search and sort are excluded, because it answers 'am I looking at everything?', which only filters can change."
	>
		<Surface.Root {descriptor} browse={staticBrowse({ shape: ['badge'] })}>
			<Surface.ListHeader />
		</Surface.Root>
	</Case>

	<Case
		title="open panel — contextual counts"
		note="Each option's count is measured against search plus every OTHER facet, never its own. Counting against the raw list is easier and lies: with a search active it can promise 37 and deliver 0. Click the filter button."
	>
		<Surface.Root {descriptor} browse={staticBrowse()}>
			<Surface.ListHeader />
		</Surface.Root>
	</Case>

	<Case
		title="no facets, no sorts"
		note="The filter trigger disappears rather than opening an empty panel."
	>
		<Surface.Root descriptor={noFilters} browse={staticBrowse()}>
			<Surface.ListHeader />
		</Surface.Root>
	</Case>

	<Case
		title="no searchIn"
		note="Capability is declared by the DESCRIPTOR, not by a flag on the header. A surface with nothing worth searching omits the function and gets no field."
	>
		<Surface.Root descriptor={noSearch} browse={staticBrowse()}>
			<Surface.ListHeader />
		</Surface.Root>
	</Case>

	<Case
		title="nothing to show"
		note="No search, no filters, no action — the header does not render at all and the list keeps the 56px. This is 'avoid a bar unless it earns its space' as a mechanism rather than a rule."
	>
		<Surface.Root descriptor={bare} browse={staticBrowse()}>
			<Surface.ListHeader />
		</Surface.Root>
	</Case>
</div>
