<script lang="ts">
	/**
	 * The More route — where the bottom bar's collector lands. The kit ships
	 * the list; the page (title, what rides along beyond the overflow) is the
	 * app's. Settings and Notifications are appended here because at bar
	 * widths neither the rail footer nor the bell exists, making this the
	 * only route to both — the notifications entry carries the unread count
	 * the way the collector slot itself does.
	 *
	 * `splitBottomNav` with no `more` runs the same computation as the bar,
	 * so the two cannot disagree about what overflowed.
	 */
	import { Shell, notifications, splitBottomNav, type NavItem } from '@veelume/ui';
	import { Bell } from 'lucide-svelte';
	import { nav, settingsItem } from '$lib/nav.svelte';

	const notificationsItem: NavItem = {
		label: 'Notifications',
		icon: Bell,
		path: '/notifications',
		badge: () => notifications.unread || null
	};

	const items = $derived([...splitBottomNav(nav.items).overflow, notificationsItem, settingsItem]);
</script>

<div class="mx-auto max-w-2xl space-y-4 p-4">
	<h1 class="text-lg font-semibold">More</h1>
	<Shell.MoreList {items} />
</div>
