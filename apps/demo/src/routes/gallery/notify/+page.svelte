<script lang="ts">
	/**
	 * The notification funnel, live: fire real notifications into the real
	 * store. Toasts pop from the ROOT layout's stack (bottom-right) — that
	 * it works from here is the point: one funnel, mounted once, reachable
	 * from any code.
	 */
	import { Notify, notify, ingest, notifications, type NotifLevel } from '@veelume/ui';
	import { Button } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';

	let centerOpen = $state(false);
	let backlogCounter = 0;

	const fire = (level: NotifLevel) =>
		notify({
			level,
			title: `A ${level} notification`,
			body: level === 'error' ? 'Sticky: stays until dismissed.' : 'Fades on its own.'
		});
</script>

<div class="grid max-w-3xl gap-6 p-4">
	<div>
		<h2 class="text-lg font-semibold">Notify — one funnel, two surfaces</h2>
		<p class="text-sm text-muted-foreground">
			Hearth's design with Starlume's deltas: everything flows through notify()/ingest() into one
			bounded session log; the toast stack and the center read the same list, the bell counts the
			unread. info/success fade, warning/error stay — outcomes you glance at versus problems you
			must act on.
		</p>
	</div>

	<Case
		title="Fire the four levels"
		note="Toasts appear bottom-right from the root layout's stack. Watch the rail bell's badge count up; open it to see the same entries in the center."
	>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" onclick={() => fire('info')}>Info</Button>
			<Button variant="outline" onclick={() => fire('success')}>Success</Button>
			<Button variant="outline" onclick={() => fire('warning')}>Warning</Button>
			<Button variant="outline" onclick={() => fire('error')}>Error</Button>
		</div>
	</Case>

	<Case
		title="Source tag and action"
		note="Starlume's delta: `source` names the module that raised it, rendered as a tag in the center. An action link travels with the notification through both surfaces."
	>
		<Button
			variant="outline"
			onclick={() =>
				notify({
					level: 'warning',
					title: 'A loan fell overdue',
					body: 'Kindred — due three days ago.',
					source: 'loans',
					action: { label: 'Open loans', href: '/loans' }
				})}
		>
			Overdue loan
		</Button>
	</Case>

	<Case
		title="ingest(): the adapter path"
		note="Backlog hydrated after a suspended window: enters the log and the badge but does NOT toast — returning to a wall of stale toasts is noise. Keyed, so replaying the same records is a no-op."
	>
		<Button
			variant="outline"
			onclick={() =>
				ingest(
					{
						key: `demo-backlog-${backlogCounter++}`,
						level: 'info',
						title: 'Raised while the window was hidden',
						source: 'backend',
						ts: Date.now() - 90_000
					},
					{ toast: false }
				)}
		>
			Hydrate one backlog entry
		</Button>
	</Case>

	<Case
		title="Bell + Center, composed locally"
		note="The same parts the rail uses, in a page context — on the DEFAULT placement, deliberately: below-end would once have clipped against this scroll container's left edge (this exact case carried a manual override), but Popup's shift now slides the panel inside the clipping ancestors on its own. Opening marks everything read — a badge that survives looking at the list lies."
	>
		<div class="relative inline-flex">
			<Notify.Bell onclick={() => (centerOpen = !centerOpen)} />
			<Notify.Center open={centerOpen} onclose={() => (centerOpen = false)} />
		</div>
		<p class="mt-2 text-xs text-muted-foreground">
			{notifications.items.length} in the log · {notifications.unread} unread
		</p>
	</Case>
</div>
