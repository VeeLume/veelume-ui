<script lang="ts">
	import { NumberInput, getKitContext, localeSeparators, parseLocaleNumber } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';

	const kit = getKitContext();

	let plain = $state<number | null>(1234.56);
	let money = $state<number | null>(123456);
	let whole = $state<number | null>(28);

	const seps = $derived(localeSeparators(kit.formattingLocale));

	// The parse table is the point of this page: change the locale above and
	// watch which inputs stop being numbers.
	const samples = ['1.234,56', '1,234.56', '1234,56', '1234.56', '1 234,56', 'abc'];
</script>

<div class="grid max-w-2xl gap-6">
	<h1 class="text-lg font-semibold">NumberInput</h1>
	<p class="-mt-4 text-sm text-muted-foreground">
		Exists because the native one cannot be made to work: <code>&lt;input type="number"&gt;</code>
		follows the <em>browser's</em> locale, so a German user on an en-US browser cannot type
		<code>1,50</code>, and no attribute overrides it. In a browser app you do not control that
		setting.
	</p>

	<Case
		title="plain"
		note="Click in: the value goes raw and ungrouped, because grouping separators are noise to type around. Tab out: it formats. Formatting mid-keystroke fights the caret."
	>
		<div class="grid gap-2">
			<NumberInput value={plain} onchange={(n) => (plain = n)} />
			<p class="font-mono text-xs text-muted-foreground">stored: {plain ?? 'null'}</p>
		</div>
	</Case>

	<Case
		title="currency, stored in cents"
		note="scale=100 — euros in the UI, cents in the record, so the record shape never lies about its units."
	>
		<div class="grid gap-2">
			<NumberInput
				value={money}
				scale={100}
				format={{ style: 'currency', currency: 'EUR' }}
				onchange={(n) => (money = n)}
			/>
			<p class="font-mono text-xs text-muted-foreground">stored: {money ?? 'null'} cents</p>
		</div>
	</Case>

	<Case title="integer" note="maximumFractionDigits: 0.">
		<div class="grid gap-2">
			<NumberInput
				value={whole}
				format={{ maximumFractionDigits: 0 }}
				onchange={(n) => (whole = n)}
			/>
			<p class="font-mono text-xs text-muted-foreground">stored: {whole ?? 'null'}</p>
		</div>
	</Case>

	<Case
		title="disabled"
		note="Read-only fields render through the same component rather than a second one."
	>
		<NumberInput value={42} disabled onchange={() => {}} />
	</Case>

	<Case
		title="parsing, per locale"
		note="Separators are asked of Intl, not hardcoded per region — de-DE groups with '.', fr-FR with a narrow no-break space. Switch the locale above and watch the table change."
	>
		<p class="mb-2 font-mono text-xs text-muted-foreground">
			{kit.formattingLocale} — group “{seps.group}” · decimal “{seps.decimal}”
		</p>
		<table class="w-full text-sm">
			<thead>
				<tr class="text-left text-xs text-muted-foreground">
					<th class="pb-1 font-medium">typed</th>
					<th class="pb-1 font-medium">parsed</th>
				</tr>
			</thead>
			<tbody class="font-mono">
				{#each samples as s (s)}
					{@const parsed = parseLocaleNumber(s, kit.formattingLocale)}
					<tr class="border-t border-border/50">
						<td class="py-1">{s}</td>
						<td class="py-1 {parsed === null ? 'text-muted-foreground' : ''}">
							{parsed === null ? 'null' : parsed}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</Case>
</div>
