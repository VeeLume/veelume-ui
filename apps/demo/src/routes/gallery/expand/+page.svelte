<script lang="ts">
	import { Expand, createExpansion, type Fact } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';

	const tiers = createExpansion('many');
	const nested = createExpansion('many');
	const single = createExpansion('one');
	const cols = createExpansion('many');

	const facts: Fact[] = [
		{ label: 'Type', value: 'Hardcover' },
		{ label: 'Pages', value: '387' },
		{ label: 'Published', value: '1974' },
		{ label: 'ISBN', value: '978-0-06-105488-7', mono: true }
	];

	const anchorRows = Array.from({ length: 12 }, (_, i) => ({
		key: `a${i}`,
		title: `Row ${i + 1}`
	}));
</script>

<div class="grid max-w-3xl gap-6">
	<h1 class="text-lg font-semibold">Expand</h1>

	<p class="-mt-4 text-sm text-muted-foreground">
		One row anatomy — <code>gutter · caret · title (+ meta) … right · actions</code> — filled by
		omission. There is no <code>expandable</code> prop: supplying children is what makes a row
		expandable, and supplying <code>onselect</code> is what splits the caret from the body.
	</p>

	<Case
		title="complexity by slots, not by variant"
		note="Same component four times. A plain line, then a gutter, then a right-hand readout, then an expandable row with a meta line — the donor's tiers fall out of which slots are filled without being modelled."
		frame={false}
	>
		<div class="rounded-lg border border-border bg-card">
			<Expand.Row title="Plain line — nothing to open, so it is not a button" />
			<Expand.Row title="With a gutter">
				{#snippet gutter()}
					<span class="rounded border border-border px-1 text-xs tabular-nums">2/3</span>
				{/snippet}
			</Expand.Row>
			<Expand.Row title="With a right-hand readout">
				{#snippet right()}1974{/snippet}
			</Expand.Row>
			<Expand.Row
				title="Expandable, with a meta line"
				open={tiers.has('d')}
				ontoggle={() => tiers.toggle('d')}
			>
				{#snippet meta()}
					<span class="rounded-full bg-muted px-2 py-0.5 text-xs">paperback</span>
					<span class="rounded-full bg-muted px-2 py-0.5 text-xs">reprint</span>
				{/snippet}
				{#snippet right()}1974{/snippet}
				<Expand.Facts {facts} />
			</Expand.Row>
		</div>
	</Case>

	<Case
		title="nested rows"
		note="The expansion holds the same component one level in. Per-row indent, unlike a grouped list's uniform depth: a leaf sits under its parent and its sibling may not, so only the row knows."
		frame={false}
	>
		<div class="rounded-lg border border-border bg-card">
			<Expand.Row
				title="The Dispossessed"
				subtitle="Ursula K. Le Guin"
				open={nested.has('w')}
				ontoggle={() => nested.toggle('w')}
			>
				<Expand.Row
					title="Hardcover"
					indent={1}
					open={nested.has('e1')}
					ontoggle={() => nested.toggle('e1')}
				>
					{#snippet right()}1974{/snippet}
					<Expand.Facts {facts} />
				</Expand.Row>
				<Expand.Row title="Paperback" indent={1}>
					{#snippet right()}1975{/snippet}
				</Expand.Row>
			</Expand.Row>
		</div>
	</Case>

	<Case
		title="single-open + the viewport anchor"
		note="`createExpansion('one')` closes the previous row. Open Row 1, scroll down, then open Row 8 — the row you click keeps its position instead of sliding out from under the cursor. That jank is what made accordions feel worse than a detail pane, and it is a defect of the implementation, not the pattern."
		frame={false}
	>
		<div class="h-64 overflow-auto rounded-lg border border-border bg-card">
			{#each anchorRows as r (r.key)}
				<Expand.Row title={r.title} open={single.has(r.key)} ontoggle={() => single.toggle(r.key)}>
					<div class="grid gap-2 text-sm text-muted-foreground">
						<p>A deliberately tall expansion, so closing one above genuinely moves the list.</p>
						<Expand.Facts {facts} />
						<p>More body text to make the height obvious when it collapses.</p>
						<p>And another line.</p>
					</div>
				</Expand.Row>
			{/each}
		</div>
	</Case>

	<Case
		title="two-column body"
		note="A CONTAINER query, not a media query: the donor keyed on a 1100px viewport, which is wrong the moment the list sits in a split — the pane can be narrow on a wide screen. Drag the browser narrow and this collapses on its own width, not the window's."
		frame={false}
	>
		<div class="rounded-lg border border-border bg-card">
			<Expand.Row
				title="Convoy Under Attack"
				subtitle="Citizens For Prosperity"
				open={cols.has('m')}
				ontoggle={() => cols.toggle('m')}
			>
				{#snippet right()}~171.250{/snippet}
				<Expand.Cols>
					{#snippet main()}
						<p class="text-sm">
							We've lost contact with a supply convoy and are concerned it might be under attack.
							Last comm reported hostile ships incoming, but we haven't heard anything since.
						</p>
					{/snippet}
					{#snippet side()}
						<Expand.Facts
							facts={[
								{ label: 'Type', value: 'Mercenary' },
								{ label: 'Faction', value: 'Citizens For Prosperity' },
								{ label: 'Difficulty', value: '6/8' },
								{ label: 'Record', value: '4f2a9c11', mono: true }
							]}
						/>
					{/snippet}
				</Expand.Cols>
			</Expand.Row>
		</div>
	</Case>
</div>
