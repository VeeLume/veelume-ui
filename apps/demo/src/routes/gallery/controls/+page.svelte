<script lang="ts">
	/**
	 * The small controls, alone and composed. The composed cases are the
	 * point: a control is only "done" when it sits in a `Settings.Row` or a
	 * Section without looking dropped in.
	 */
	import { Segmented, Settings, Switch } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';

	let a = $state(true);
	let b = $state(false);
	let mode = $state('auto');
	let level = $state('medium');
</script>

<div class="grid max-w-3xl gap-6 p-4">
	<div>
		<h2 class="text-lg font-semibold">Switch · Segmented · Settings.Row</h2>
		<p class="text-sm text-muted-foreground">
			Switch is Hearth's toggle, adopted across Starlume: stateless, reports the requested next
			value, the caller stays the source of truth. Segmented is stibu's settings picker. Both are
			designed to hang from a Settings.Row's right edge — that shared row idiom, not the controls
			themselves, is what makes a page of them look composed.
		</p>
	</div>

	<Case title="Switch states" note="Off, on, disabled-off, disabled-on. Stateless — these two are live.">
		<div class="flex items-center gap-4">
			<Switch checked={a} label="live a" onchange={(v) => (a = v)} />
			<Switch checked={b} label="live b" onchange={(v) => (b = v)} />
			<Switch checked={false} disabled label="disabled off" />
			<Switch checked={true} disabled label="disabled on" />
		</div>
	</Case>

	<Case
		title="Segmented states"
		note="Two and three options, live; disabled. Options are SelectOption — switching a field between segmented and select is a data edit, not a reshape."
	>
		<div class="flex flex-wrap items-center gap-4">
			<Segmented
				options={[
					{ value: 'auto', label: 'Auto' },
					{ value: 'manual', label: 'Manual' }
				]}
				value={mode}
				onchange={(v) => (mode = v)}
			/>
			<Segmented
				options={[
					{ value: 'low', label: 'Low' },
					{ value: 'medium', label: 'Medium' },
					{ value: 'high', label: 'High' }
				]}
				value={level}
				onchange={(v) => (level = v)}
			/>
			<Segmented
				options={[
					{ value: 'on', label: 'On' },
					{ value: 'off', label: 'Off' }
				]}
				value="on"
				disabled
				onchange={() => {}}
			/>
		</div>
	</Case>

	<Case
		title="Composed: Settings.Rows in a Section"
		note="The row idiom — text from one left edge, controls hanging from one right edge. Compare with a bare control dropped under a heading."
	>
		<div class="w-full max-w-xl">
			<Settings.Section title="Notifications" description="How the demo would nag you, if it nagged.">
				<Settings.Row label="Overdue reminders" hint="Remind me when a loan falls overdue.">
					<Switch checked={a} label="Overdue reminders" onchange={(v) => (a = v)} />
				</Settings.Row>
				<Settings.Row label="Weekly digest" hint="One summary mail, Mondays.">
					<Switch checked={b} label="Weekly digest" onchange={(v) => (b = v)} />
				</Settings.Row>
				<Settings.Row label="Delivery">
					<Segmented
						options={[
							{ value: 'auto', label: 'Auto' },
							{ value: 'manual', label: 'Manual' }
						]}
						value={mode}
						onchange={(v) => (mode = v)}
					/>
				</Settings.Row>
			</Settings.Section>
		</div>
	</Case>

	<Case
		title="Wide control: under the heading, not in a Row"
		note="A Segmented with long labels would collide with a Row's label on a phone — stibu's Darstellung answer is heading above, control below, left-hugging (the Section's justify-items-start is what stops it stretching)."
	>
		<div class="w-full max-w-xl">
			<Settings.Section title="Density" description="'Comfortable' is larger; 'Compact' shows more at once.">
				<Segmented
					options={[
						{ value: 'comfortable', label: 'Comfortable' },
						{ value: 'compact', label: 'Compact' }
					]}
					value="comfortable"
					onchange={() => {}}
				/>
			</Settings.Section>
		</div>
	</Case>
</div>
