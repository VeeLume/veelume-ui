<script lang="ts">
	/**
	 * The settings section on the kit scaffold. The kit owns the three-state
	 * responsive layout; this file owns nothing but the category data.
	 */
	import { Settings } from '@veelume/ui';
	import { settingsCategories } from '$lib/settingsNav';

	let { children } = $props();
</script>

<Settings.Root categories={settingsCategories}>
	{@render children()}
</Settings.Root>
