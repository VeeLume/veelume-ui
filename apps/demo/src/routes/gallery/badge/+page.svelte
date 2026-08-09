<script lang="ts">
	/**
	 * StatusBadge in every state: the four tones, the two edge rules
	 * (unknown → raw string on neutral; null → nothing), and the resolved
	 * form rows use through `Row.badge`.
	 */
	import { StatusBadge, type StatusMap } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';
	import { loanStatusMap } from '$lib/loanStatus';

	// A second domain map, so the page shows the split: one pill, per-domain maps.
	const memberMap: StatusMap = {
		guest: { label: () => 'Guest', tone: 'neutral' },
		member: { label: () => 'Member', tone: 'primary' },
		expiring: { label: () => 'Expiring soon', tone: 'warning' },
		banned: { label: () => 'Banned', tone: 'destructive' }
	};
</script>

<div class="grid max-w-3xl gap-6 p-4">
	<div>
		<h2 class="text-lg font-semibold">StatusBadge</h2>
		<p class="text-sm text-muted-foreground">
			Four stibu components were one pill with different maps, so the kit ships the pill and four
			tones; the domain ships a status→(label, tone) map. Labels are functions, so an app wires its
			i18n directly — stibu hardcoded German in the component, which is the coupling this kit
			forbids.
		</p>
	</div>

	<Case
		title="The four tones"
		note="The full tone set found across the fleet — a fifth tone is a design decision, not a prop. Loans map: draft=warning, out=primary, returned/archived=neutral, lost=destructive."
	>
		<div class="flex flex-wrap items-center gap-2">
			<StatusBadge status="draft" map={loanStatusMap} />
			<StatusBadge status="out" map={loanStatusMap} />
			<StatusBadge status="returned" map={loanStatusMap} />
			<StatusBadge status="lost" map={loanStatusMap} />
		</div>
	</Case>

	<Case
		title="A second domain, the same pill"
		note="The named variation is the map and nothing else — geometry and tones cannot drift between domains."
	>
		<div class="flex flex-wrap items-center gap-2">
			<StatusBadge status="guest" map={memberMap} />
			<StatusBadge status="member" map={memberMap} />
			<StatusBadge status="expiring" map={memberMap} />
			<StatusBadge status="banned" map={memberMap} />
		</div>
	</Case>

	<Case
		title="Unknown status"
		note="A map miss shows the RAW value on neutral — show the data, never hide it. The tell for a stale map after a backend adds a status."
	>
		<StatusBadge status="quarantined" map={loanStatusMap} />
	</Case>

	<Case
		title="No status"
		note="null renders nothing — a badge is optional information, not a required column (stibu's DocumentRoleBadge rule). The frame here is empty on purpose."
	>
		<StatusBadge status={null} map={loanStatusMap} />
	</Case>

	<Case
		title="In a row: the resolved form"
		note="derive passes resolveStatus(map, status) into Row.badge — resolved data, not a component, because a windowed list renders thousands. Same classes, same result."
	>
		<div class="flex items-center gap-3 rounded-md border border-border px-3 py-2">
			<span class="min-w-0 flex-1 truncate text-sm">The Dispossessed</span>
			<!-- Surface.List renders Row.badge from the same class source, so this
			     is exactly what a real row shows. -->
			<StatusBadge status="out" map={loanStatusMap} />
		</div>
	</Case>
</div>
