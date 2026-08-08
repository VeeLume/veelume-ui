<script lang="ts">
	import { Surface } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';
	import { descriptor, rows, staticBrowse, type DemoRow } from '$lib/gallery/fixtures.svelte';

	const browse = staticBrowse();
	const emptyDescriptor = { ...descriptor, sources: () => [] };
</script>

<div class="grid max-w-3xl gap-6">
	<h1 class="text-lg font-semibold">Surface.List</h1>

	<p class="-mt-4 text-sm text-muted-foreground">
		The list owns its own header — search and filters act on the list, so they ride inside it. See
		<a class="underline" href="/gallery/list-header">Surface.ListHeader</a> for that band's own
		states.
	</p>

	<Case
		title="ready"
		note="Row anatomy: title, subtitle, trailing, badge. The last row is deliberately overlong — it must truncate, never wrap or widen the pane."
		frame={false}
	>
		<Surface.Root {descriptor} browse={staticBrowse()}>
			<Surface.List status="ready" />
		</Surface.Root>
	</Case>

	<Case title="selected" note="Selection is passed in, not owned — it comes from the URL." frame={false}>
		<Surface.Root {descriptor} browse={staticBrowse()} selected="b">
			<Surface.List status="ready" />
		</Surface.Root>
	</Case>

	<Case
		title="refreshing"
		note="THE state both donor apps lacked. Data stays on screen while revalidating — collapsing this into `loading` blanks out good data, into `ready` makes it invisible."
		frame={false}
	>
		<Surface.Root {descriptor} browse={staticBrowse()}>
			<Surface.List status="refreshing" />
		</Surface.Root>
	</Case>

	<Case title="loading" frame={false}>
		<Surface.Root descriptor={emptyDescriptor} browse={staticBrowse()}>
			<Surface.List status="loading" />
		</Surface.Root>
	</Case>

	<Case
		title="error"
		note="Reachable only because the gallery renders states directly — talking the backend into failing on demand is exactly the friction that leaves error states unseen."
		frame={false}
	>
		<Surface.Root descriptor={emptyDescriptor} browse={staticBrowse()}>
			<Surface.List status="error" />
		</Surface.Root>
	</Case>

	<Case
		title="empty — nothing matches"
		note="Distinct from 'nothing exists'. The label comes from the app's catalogue, so this one is German."
		frame={false}
	>
		<Surface.Root descriptor={emptyDescriptor} browse={staticBrowse()}>
			<Surface.List status="ready" />
		</Surface.Root>
	</Case>

	<Case
		title="filtered to nothing"
		note="Same empty rendering, different cause: {rows.length} rows exist, the search excludes them all. Note the count strip — it appears ONLY while narrowing, so it costs nothing on a surface nobody has filtered, and when it does appear it answers the question just asked and carries the way out."
		frame={false}
	>
		<Surface.Root {descriptor} browse={staticBrowse({ q: 'zzzz' })}>
			<Surface.List status="ready" />
		</Surface.Root>
	</Case>

	<Case
		title="fetching — the throbber"
		note="A background fill is running. The track above the rows is reserved whenever a caller reports fetch activity at all, so the bar arriving never shifts the rows — and rows stay on screen throughout, which is the same promise `refreshing` makes."
		frame={false}
	>
		<Surface.Root {descriptor} browse={staticBrowse()}>
			<Surface.List status="refreshing" fetching />
		</Surface.Root>
	</Case>

	<Case
		title="truncated — load more"
		note="The count strip's trailing slot, shown only when the source reports more behind its cap. Reset is NOT here: it lives in the filter panel, while a narrowed count over a truncated set is where 'there may be more matches than these' needs its remedy."
		frame={false}
	>
		<Surface.Root {descriptor} browse={staticBrowse({ q: 'a' })}>
			<Surface.List status="ready" hasMore onloadmore={() => {}} />
		</Surface.Root>
	</Case>

	<Case
		title="aged — the 'as of' band"
		note="'As of', never a warning: old is not stale, and a set nobody has changed in an hour is an hour old and correct. It appears only past `staleAfter` (a minute by default, forced here) so a surface keeping up spends nothing on it — an indicator that fires constantly is one people learn to ignore. Bottom, because it is ambient status rather than something you reach for."
		frame={false}
	>
		<Surface.Root {descriptor} browse={staticBrowse()}>
			<Surface.List
				status="ready"
				updatedAt={Date.now() - 8 * 60_000}
				staleAfter={0}
				onrefresh={() => {}}
			/>
		</Surface.Root>
	</Case>

	<Case
		title="custom row snippet"
		note="The escape hatch. /catalog uses exactly this for expandable rows rather than forking the component."
		frame={false}
	>
		<Surface.Root {descriptor} {browse}>
			<Surface.List status="ready">
				<!-- The param needs annotating: the surface context is not generic, so
				     `Surface.List` cannot infer the concrete row type from `Root` and
				     falls back to the base `Row`. A wart of the context approach, not
				     of this page. -->
				{#snippet row(r: DemoRow)}
					<div class="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0">
						<span class="font-mono text-xs text-muted-foreground">{r.key}</span>
						<span class="flex-1 truncate">{r.title}</span>
						<span class="text-xs text-muted-foreground">{r.note}</span>
					</div>
				{/snippet}
			</Surface.List>
		</Surface.Root>
	</Case>
</div>
