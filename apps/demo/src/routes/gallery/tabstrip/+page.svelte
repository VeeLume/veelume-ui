<script lang="ts">
	import { Surface, createWorkset } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';
	import {
		descriptor,
		staticBrowse,
		bigGroupedDescriptor,
		bigGroupedRows
	} from '$lib/gallery/fixtures.svelte';

	// Pre-seeded worksets, one per case — the gallery renders STATES directly.
	// Labels come from the surface context's `byKey`, so each strip sits inside
	// a Root over the fixture rows.
	const preview = createWorkset();
	// selected="a" + the strip's own URL→workset sync will preview it on mount;
	// nothing to seed.

	const mixed = createWorkset();
	mixed.pin('a');
	mixed.pin('b');
	mixed.select('c');

	const singlePane = createWorkset();
	singlePane.pin('a');
	singlePane.pin('c');

	const overflow = createWorkset();
	for (const r of bigGroupedRows.slice(0, 14)) overflow.pin(r.key);

	const noop = () => {};
</script>

<div class="grid max-w-3xl gap-6">
	<h1 class="text-lg font-semibold">Surface.TabStrip</h1>

	<p class="-mt-4 text-sm text-muted-foreground">
		The working set's strip. ACTIVE comes from the surface context (the URL); the tab set from a
		<code>createWorkset</code> instance the app holds at module scope. An empty workset renders nothing
		at all — a surface that never opens tabs never sees a strip.
	</p>

	<Case
		title="preview tab"
		note="The strip's own URL→workset sync minted this tab from `selected` alone — a deep link lands as a preview without any app wiring. Italic = preview: ONE slot, replaced by the next selection; the title carries the pin gesture."
		frame={false}
	>
		<Surface.Root {descriptor} browse={staticBrowse()} selected="a">
			<Surface.TabStrip workset={preview} onactivate={noop} onbelow={noop} />
			<div class="h-24 rounded-lg rounded-tl-none border border-border bg-card"></div>
		</Surface.Root>
	</Case>

	<Case
		title="pinned set + preview, one active"
		note="Pinned tabs accumulate in pin order and render upright; the preview trails in italic. The active tab blends into the pane card below it — the strip expects that card DIRECTLY beneath, with rounded-tl-none while tabs exist."
		frame={false}
	>
		<Surface.Root {descriptor} browse={staticBrowse()} selected="b">
			<Surface.TabStrip workset={mixed} onactivate={noop} onbelow={noop} />
			<div class="h-24 rounded-lg rounded-tl-none border border-border bg-card"></div>
		</Surface.Root>
	</Case>

	<Case
		title="single-pane — onbelow omitted"
		note="Composable by omission, per gesture: no onbelow, no split button; no onback, no narrow-width back button. The strip never has to be told to hide a control it should not have drawn."
		frame={false}
	>
		<Surface.Root {descriptor} browse={staticBrowse()} selected="c">
			<Surface.TabStrip workset={singlePane} onactivate={noop} />
			<div class="h-24 rounded-lg rounded-tl-none border border-border bg-card"></div>
		</Surface.Root>
	</Case>

	<Case
		title="trailing slot"
		note="Pinned to the right, after a flexible gap: for chrome that belongs to the working set rather than being a member of it — the demo puts a Compare tab here. It is a trailing slot rather than a workset entry precisely because it carries no key. Built from `Surface.Tab`, the same chrome the strip uses for its own tabs, so an app tab cannot drift from a record tab."
		frame={false}
	>
		<Surface.Root {descriptor} browse={staticBrowse()} selected="b">
			<Surface.TabStrip workset={mixed} onactivate={noop} onbelow={noop}>
				{#snippet trailing()}
					<Surface.Tab active={false} onclick={noop}>⊞ Compare 3</Surface.Tab>
				{/snippet}
			</Surface.TabStrip>
			<div class="h-24 rounded-lg rounded-tl-none border border-border bg-card"></div>
		</Surface.Root>
	</Case>

	<Case
		title="overflow — 14 pins"
		note="The strip scrolls horizontally, and an attachment reading isActive follows activation by ANY route — click, close-promotes-neighbour, back/forward — so the active tab is always in view."
		frame={false}
	>
		<Surface.Root descriptor={bigGroupedDescriptor} browse={staticBrowse()} selected="big7">
			<Surface.TabStrip workset={overflow} onactivate={noop} onbelow={noop} />
			<div class="h-24 rounded-lg rounded-tl-none border border-border bg-card"></div>
		</Surface.Root>
	</Case>
</div>
