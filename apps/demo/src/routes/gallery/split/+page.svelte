<script lang="ts">
	import { Surface } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';
	import { descriptor, staticBrowse } from '$lib/gallery/fixtures.svelte';

	let collapsed = $state(false);
</script>

<div class="grid max-w-4xl gap-6">
	<h1 class="text-lg font-semibold">Surface.Split</h1>
	<p class="-mt-4 text-sm text-muted-foreground">
		The one place the layout opinion lives. Narrow the window to see the responsive half: on a phone
		the list IS the page, and picking a record makes it step aside.
	</p>

	<Case
		title="collapsible list"
		note="Asymmetric on purpose. HIDE belongs to the list's own header — it acts on the list, so containment puts it there and it costs no layout. SHOW is the kit's, and exists only while collapsed, because the box it would otherwise live in is exactly the one that disappeared. A permanent divider column reserved for one button was the version before this. Controlled like Switch; omit `oncollapse` and neither control exists. `md:` and up, since below that the panes already take turns being the whole page."
		frame={false}
	>
		<div class="h-56">
			<Surface.Root
				{descriptor}
				browse={staticBrowse()}
				selected="b"
				{collapsed}
				oncollapse={(next) => (collapsed = next)}
			>
				<Surface.Split>
					{#snippet list()}
						<Surface.List status="ready"></Surface.List>
					{/snippet}
					{#snippet detail()}
						<div class="grid h-full place-items-center rounded-lg border border-border bg-card">
							<p class="text-sm text-muted-foreground">
								{collapsed
									? 'Full width — click › to bring the list back.'
									: 'Click ‹ in the list header.'}
							</p>
						</div>
					{/snippet}
				</Surface.Split>
			</Surface.Root>
		</div>
	</Case>

	<Case title="list + detail — nothing selected" frame={false}>
		<div class="h-56">
			<Surface.Root {descriptor} browse={staticBrowse()}>
				<Surface.Split>
					{#snippet list()}<Surface.List status="ready" />{/snippet}
					{#snippet detail()}
						<div class="grid h-full place-items-center rounded-lg border border-border bg-card">
							<p class="text-sm text-muted-foreground">Pick a record.</p>
						</div>
					{/snippet}
				</Surface.Split>
			</Surface.Root>
		</div>
	</Case>

	<Case title="list + detail — selected" frame={false}>
		<div class="h-56">
			<!-- `selected` lives on Root: which pane a narrow screen shows and which
			     row the list highlights are one fact, not two props. -->
			<Surface.Root {descriptor} browse={staticBrowse()} selected="b">
				<Surface.Split>
					{#snippet list()}<Surface.List status="ready" />{/snippet}
					{#snippet detail()}
						<div class="h-full rounded-lg border border-border bg-card p-3 text-sm">
							Use of Weapons
						</div>
					{/snippet}
				</Surface.Split>
			</Surface.Root>
		</div>
	</Case>

	<Case
		title="detail only — archetype E"
		note="The list snippet is simply omitted and the detail takes the full width. No second shell. Note though: /preferences ended up NOT using Split at all — a solo record is the record form with nothing around it, so this case documents that omission works, not that it is the right tool there."
		frame={false}
	>
		<div class="h-40">
			<Surface.Root {descriptor} browse={staticBrowse()}>
				<Surface.Split>
					{#snippet detail()}
						<div class="h-full rounded-lg border border-border bg-card p-3 text-sm">
							One record, full width.
						</div>
					{/snippet}
				</Surface.Split>
			</Surface.Root>
		</div>
	</Case>

	<Case title="list only" note="Omit the detail snippet and the list keeps the pane." frame={false}>
		<div class="h-40">
			<Surface.Root {descriptor} browse={staticBrowse()}>
				<Surface.Split>
					{#snippet list()}<Surface.List status="ready" />{/snippet}
				</Surface.Split>
			</Surface.Root>
		</div>
	</Case>
</div>
