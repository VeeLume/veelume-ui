<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { setKitContext } from '@veelume/ui';
	import { m, getLocale } from '$lib/i18n';
	import { appearance } from '$lib/stores/appearance.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { updater } from '$lib/stores/updater.svelte';
	import { breakpoint } from '$lib/breakpoint.svelte';
	import NavRail from '$lib/components/NavRail.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import UpdateBanner from '$lib/components/UpdateBanner.svelte';

	let { children } = $props();

	/**
	 * The kit's only channel into app state. Two locales on purpose:
	 *
	 *   messageLocale     follows Paraglide
	 *   formattingLocale  pinned to de-DE
	 *
	 * The pin is the demo's whole point on this axis — an English UI with German
	 * formatting (24h clock, `1.234,56`, Monday week-start) is a state that can
	 * only exist if the two are independent settings. If they ever fuse, this
	 * screen breaks visibly instead of silently.
	 */
	setKitContext({
		messageLocale: () => getLocale(),
		formattingLocale: () => 'de-DE',
		labels: {
			search: () => m.kit_search(),
			empty: () => m.kit_empty(),
			loading: () => m.kit_loading()
		}
	});

	onMount(async () => {
		// Apply the saved density / colour scheme before anything else renders.
		appearance.init();
		await settings.init();
		// Fire-and-forget: populates the updater store, which drives the banner.
		updater.check();
	});
</script>

{#if settings.loading}
	<div class="flex h-svh items-center justify-center">
		<div
			class="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
		></div>
	</div>
{:else}
	<div class="flex h-svh overflow-hidden bg-background">
		{#if breakpoint.showRail}
			<NavRail showLabels={breakpoint.showLabels} />
		{/if}

		<div class="flex flex-1 flex-col overflow-hidden">
			<!-- Status bar / notch inset (0 on desktop). Non-scrolling, so sticky
			     headers below it can never slide under the system bar. -->
			<div class="shrink-0 bg-background" style="height: env(safe-area-inset-top)"></div>

			<UpdateBanner />

			<main class="flex-1 overflow-auto">
				{@render children()}
			</main>

			{#if breakpoint.showBottomNav}
				<BottomNav />
			{/if}
		</div>
	</div>
{/if}
