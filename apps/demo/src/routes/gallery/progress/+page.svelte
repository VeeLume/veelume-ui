<script lang="ts">
	import { Progress, Actions, Loading } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';
	import { Plus } from 'lucide-svelte';

	// A moving specimen — a static bar cannot show that the fill is animated.
	let value = $state(35);
	$effect(() => {
		const id = setInterval(() => (value = value >= 100 ? 0 : value + 5), 700);
		return () => clearInterval(id);
	});

	let busy = $state(false);
	function run() {
		busy = true;
		setTimeout(() => (busy = false), 2000);
	}
</script>

<div class="grid max-w-3xl gap-6">
	<h1 class="text-lg font-semibold">Progress & busy actions</h1>

	<p class="-mt-4 text-sm text-muted-foreground">
		For work whose completion is reportable — a data cook, a patch apply, a download.
		<code>Loading</code> says "something is happening"; this says "how far along".
	</p>

	<Case
		title="determinate"
		note="`value` present → a filled track. The readout defaults to the percentage and goes through the kit's number formatter, so it follows the formatting locale like every other number."
		frame
	>
		<Progress {value} label="Cooking reference data" />
	</Case>

	<Case
		title="indeterminate"
		note="`value` ABSENT — not a mode prop. Determinate-vs-not is whether you know the number; a variant flag would let a caller claim a percentage it does not have."
		frame
	>
		<Progress label="Scanning installs" />
	</Case>

	<Case
		title="custom detail, no label"
		note="The trailing slot takes a count, an ETA, a file name. Both label and detail are optional — a bar under its own heading needs neither."
		frame
	>
		<Progress value={62} max={100} detail="1,204 of 1,940 keys" />
		<div class="mt-3"><Progress value={3} max={4} /></div>
	</Case>

	<Case
		title="Action.busy"
		note="The pending state as a tier property, so the position invariant covers it too. The spinner takes the ICON slot rather than adding a glyph — the button must not resize when its work starts — and busy implies disabled. Click Apply."
		frame
	>
		<Actions
			primary={{ label: 'Apply', icon: Plus, onclick: run, busy }}
			secondary={[{ label: 'Re-scan', onclick: run, busy }]}
			overflow={[{ label: 'Remove', destructive: true, onclick: run, busy }]}
		/>
	</Case>

	<Case
		title="beside Loading"
		note="The two are different claims. Loading is the boot screen and the pane-sized placeholder; a bar belongs where the work has a measurable extent."
		frame
	>
		<div class="flex items-center gap-6">
			<Loading label="Starting up" />
			<div class="flex-1"><Progress value={45} label="Downloading update" /></div>
		</div>
	</Case>
</div>
