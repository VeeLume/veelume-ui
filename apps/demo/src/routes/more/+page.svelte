<script lang="ts">
	/**
	 * The More route — where the bottom bar's collector lands. The kit ships
	 * the list; the page (title, what rides along beyond the overflow) is the
	 * app's. Settings is appended here because at bar widths the rail footer
	 * does not exist, making this the only route to it.
	 *
	 * `splitBottomNav` with no `more` runs the same computation as the bar,
	 * so the two cannot disagree about what overflowed.
	 */
	import { Shell, splitBottomNav } from '@veelume/ui';
	import { nav, settingsItem } from '$lib/nav.svelte';

	const items = $derived([...splitBottomNav(nav.items).overflow, settingsItem]);
</script>

<div class="mx-auto max-w-2xl space-y-4 p-4">
	<h1 class="text-lg font-semibold">More</h1>
	<Shell.MoreList {items} />
</div>
