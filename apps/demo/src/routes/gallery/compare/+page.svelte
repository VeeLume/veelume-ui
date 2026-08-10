<script lang="ts">
	import { Compare, type CompareAttribute } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';

	type Ship = {
		key: string;
		name: string;
		fireRate: number;
		damage: number;
		recoil: number;
		price: number;
		crew: number;
		note: string | null;
	};

	const ships: Ship[] = [
		{
			key: 'a',
			name: 'Arclight',
			fireRate: 450,
			damage: 22.5,
			recoil: 0.19,
			price: 4950,
			crew: 1,
			note: 'Standard issue'
		},
		{
			key: 'b',
			name: 'Coda',
			fireRate: 380,
			damage: 31,
			recoil: 0.31,
			price: 7250,
			crew: 1,
			note: null
		},
		{
			key: 'c',
			name: 'S-38',
			fireRate: 600,
			damage: 18,
			recoil: 0.14,
			price: 7250,
			crew: 2,
			note: 'Imported'
		}
	];

	const attributes: CompareAttribute<Ship>[] = [
		{ key: 'rate', label: 'Fire rate', value: (s) => s.fireRate, better: 'higher' },
		{
			key: 'dmg',
			label: 'Damage / shot',
			value: (s) => s.damage,
			format: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
			better: 'higher'
		},
		{
			key: 'recoil',
			label: 'Recoil',
			value: (s) => s.recoil,
			format: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
			better: 'lower'
		},
		{
			key: 'price',
			label: 'Price',
			value: (s) => s.price,
			format: { style: 'currency', currency: 'EUR' },
			better: 'lower'
		},
		// Neutral on purpose — no `better`, so nothing is marked even though
		// the numbers differ.
		{ key: 'crew', label: 'Crew', value: (s) => s.crew },
		{ key: 'note', label: 'Note', value: (s) => s.note }
	];

	const noBetter = attributes.map(({ better: _b, ...rest }) => rest);
	const many = Array.from({ length: 12 }, (_, i) => ({
		...ships[i % 3],
		key: `m${i}`,
		name: `${ships[i % 3].name} ${i + 1}`,
		price: 4000 + i * 310
	}));
</script>

<div class="grid max-w-3xl gap-6">
	<h1 class="text-lg font-semibold">Compare</h1>

	<p class="-mt-4 text-sm text-muted-foreground">
		The third view of a working set: a Split shows two entities interactively, this shows N of them
		aligned and read-only. Transposed — attributes down, entities across — because the other
		orientation puts the reader back to eye-alignment and would add nothing over two panes. The demo
		drives it from the catalog's tab strip (pin two works, then <em>Compare</em>).
	</p>

	<Case
		title="declared directions win, taste does not"
		note="Only attributes with `better` get a marked best value: fire rate and damage highest, recoil and price lowest. Crew differs too but is NEUTRAL — the kit cannot know that more crew is better, and a table asserting a winner on taste would be lying. Only the winner is marked, never a ranking: the two ships tied at 7.250 € are simply not it. And when EVERY entity holds the same value, nothing is marked at all, because 'the same' is not a win."
		frame={false}
	>
		<div class="rounded-lg border border-border bg-card">
			<Compare entities={ships} {attributes} keyOf={(s) => s.key} labelOf={(s) => s.name} />
		</div>
	</Case>

	<Case
		title="no directions at all"
		note="The same data with every `better` removed: a plain aligned readout. Nothing is highlighted, which is the honest rendering when the domain has no better-or-worse."
		frame={false}
	>
		<div class="rounded-lg border border-border bg-card">
			<Compare
				entities={ships}
				attributes={noBetter}
				keyOf={(s) => s.key}
				labelOf={(s) => s.name}
			/>
		</div>
	</Case>

	<Case
		title="strings, nulls, and the formatting locale"
		note="A string value never competes. `null` renders an em dash — absent is not zero, the same distinction StatusBadge draws. Prices go through the kit's number formatter, so they read in the app's FORMATTING locale (de-DE here) rather than the browser's."
		frame={false}
	>
		<div class="rounded-lg border border-border bg-card">
			<Compare
				entities={ships.slice(0, 2)}
				attributes={attributes.slice(3)}
				keyOf={(s) => s.key}
				labelOf={(s) => s.name}
			/>
		</div>
	</Case>

	<Case
		title="many entities — sticky in both axes"
		note="Twelve columns. The attribute column survives a sideways scroll and the heading row a vertical one, and the table scrolls inside ITS OWN container rather than widening the page."
		frame={false}
	>
		<div class="rounded-lg border border-border bg-card">
			<Compare
				entities={many}
				{attributes}
				keyOf={(s) => s.key}
				labelOf={(s) => s.name}
				class="max-h-72"
			/>
		</div>
	</Case>

	<Case
		title="nothing selected"
		note="Absence is neutral here too — an empty entity list renders the bag's message, not an empty grid."
		frame={false}
	>
		<div class="rounded-lg border border-border bg-card">
			<Compare entities={[]} {attributes} keyOf={(s) => s.key} labelOf={(s) => s.name} />
		</div>
	</Case>
</div>
