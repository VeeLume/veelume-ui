<script lang="ts">
	/**
	 * The small controls, alone and composed. The composed cases are the
	 * point: a control is only "done" when it sits in a `Settings.Row` or a
	 * Section without looking dropped in.
	 */
	import { Segmented, Select, Settings, Switch } from '@veelume/ui';
	import type { SelectOption } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';

	let a = $state(true);
	let b = $state(false);
	let mode = $state('auto');
	let level = $state('medium');
	let rsvp = $state('pending');
	let shelf = $state('reading');
	let genre = $state('');
	let edition = $state('pb');
	let pick = $state('all');

	const shelves: SelectOption[] = [
		{ value: 'want', label: 'Want to read' },
		{ value: 'reading', label: 'Reading' },
		{ value: 'paused', label: 'Paused' },
		{ value: 'read', label: 'Read' },
		{ value: 'dropped', label: 'Dropped' }
	];
	// Past `searchFrom` (12) the list carries a search field; groups by data.
	const genres: SelectOption[] = [
		['Fantasy', 'Fiction'],
		['Science fiction', 'Fiction'],
		['Crime', 'Fiction'],
		['Horror', 'Fiction'],
		['Romance', 'Fiction'],
		['Literary', 'Fiction'],
		['Historical', 'Fiction'],
		['Biography', 'Non-fiction'],
		['History', 'Non-fiction'],
		['Science', 'Non-fiction'],
		['Travel', 'Non-fiction'],
		['Essays', 'Non-fiction'],
		['Cookery', 'Non-fiction'],
		['Poetry', 'Other'],
		['Comics', 'Other']
	].map(([label, group]) => ({ value: label.toLowerCase(), label, group }));
	// A score per option: how far each shelf's reading goal is.
	const progress: SelectOption[] = [
		{ value: 'all', label: 'Every shelf' },
		...(
			[
				['Fantasy', 0.82],
				['Crime', 0.55],
				['Science', 0.31],
				['Poetry', 0.12]
			] as const
		).map(([label, v]) => ({
			value: label.toLowerCase(),
			label,
			group: 'One shelf',
			meter: v,
			detail: `${Math.round(v * 100)}%`,
			tone: (v >= 0.65 ? 'success' : v >= 0.4 ? 'warning' : 'destructive') as SelectOption['tone']
		}))
	];
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

	<Case
		title="Switch states"
		note="Off, on, disabled-off, disabled-on. Stateless — these two are live."
	>
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
		title="Select states"
		note="Past a handful of options: a field's trigger and a list the kit draws on Popup (never the OS dropdown). The whole trigger opens it; ↓ ↑ Enter, Escape, Tab. Under 12 options typing jumps to a prefix; from 12 the list carries a search field. Grouped by the option's `group`. Disabled, and a placeholder while the value matches nothing."
	>
		<div class="flex flex-wrap items-center gap-4">
			<Select options={shelves} value={shelf} label="Shelf" onchange={(v) => (shelf = v)} />
			<Select
				options={genres}
				value={genre}
				label="Genre"
				placeholder="Any genre"
				onchange={(v) => (genre = v)}
			/>
			<Select options={shelves} value="read" label="Shelf" disabled onchange={() => {}} />
		</div>
	</Case>

	<Case
		title="Select with figures"
		note="An option's meter (0–1, coloured by its tone) and detail end its row, in columns — for choices a score ranks, so how each fares is read before picking it. Options without figures keep the slots empty; the trigger shows the label alone."
	>
		<Select options={progress} value={pick} label="Goal" onchange={(v) => (pick = v)} />
	</Case>

	<Case
		title="Select inside a card that clips"
		note="Popup positions fixed, so a list opened from a card with overflow hidden (a rounded art ground) is not cut at the card's edge — the case Starlume's mining cards hit."
	>
		<div class="h-24 w-72 overflow-hidden rounded-lg border border-border p-3">
			<Select
				options={[
					{ value: 'pb', label: 'Paperback' },
					{ value: 'hb', label: 'Hardback' },
					{ value: 'eb', label: 'E-book' },
					{ value: 'ab', label: 'Audiobook' },
					{ value: 'lp', label: 'Large print' }
				]}
				value={edition}
				label="Edition"
				onchange={(v) => (edition = v)}
			/>
		</div>
	</Case>

	<Case
		title="Segmented with a tone per option"
		note="Options that MEAN something: the selected state takes the option's tone (the badge's tint, so a status here and a status in a list read the same) instead of the filled primary. stibu's participant status — pending / accepted / declined."
	>
		<Segmented
			options={[
				{ value: 'pending', label: 'Pending', tone: 'warning' },
				{ value: 'accepted', label: 'Accepted', tone: 'success' },
				{ value: 'declined', label: 'Declined', tone: 'destructive' }
			]}
			value={rsvp}
			onchange={(v) => (rsvp = v)}
		/>
	</Case>

	<Case
		title="Composed: Settings.Rows in a Section"
		note="The row idiom — text from one left edge, controls hanging from one right edge. Compare with a bare control dropped under a heading."
	>
		<div class="w-full max-w-xl">
			<Settings.Section
				title="Notifications"
				description="How the demo would nag you, if it nagged."
			>
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
		title="A Row adapts by content, not breakpoint"
		note="The same Row at two container widths: inline while the control actually fits beside the label, wrapped below it (left-aligned — stibu's Darstellung arrangement) the moment it does not. No prop, no breakpoint — flex-wrap against the label's minimum width, so a narrow Switch stays inline where a wide Segmented drops."
	>
		<div class="grid w-full gap-4">
			<div class="w-full max-w-xl rounded-md border border-dashed border-border p-3">
				<Settings.Row label="Density" hint="Wide container: the control rides inline.">
					<Segmented
						options={[
							{ value: 'comfortable', label: 'Comfortable' },
							{ value: 'compact', label: 'Compact' }
						]}
						value="comfortable"
						onchange={() => {}}
					/>
				</Settings.Row>
			</div>
			<div class="w-80 rounded-md border border-dashed border-border p-3">
				<Settings.Row label="Density" hint="Narrow container: it wrapped on its own.">
					<Segmented
						options={[
							{ value: 'comfortable', label: 'Comfortable' },
							{ value: 'compact', label: 'Compact' }
						]}
						value="comfortable"
						onchange={() => {}}
					/>
				</Settings.Row>
			</div>
		</div>
	</Case>
</div>
