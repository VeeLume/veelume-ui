<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { AppShell, setKitContext } from '@veelume/ui';
	import { Settings } from 'lucide-svelte';
	import { page } from '$app/state';
	import { m, getLocale } from '$lib/i18n';
	import { nav } from '$lib/nav.svelte';
	import { appearance } from '$lib/stores/appearance.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { updater } from '$lib/stores/updater.svelte';
	import UpdateBanner from '$lib/components/UpdateBanner.svelte';

	let { children } = $props();

	const settingsActive = $derived(page.url.pathname.startsWith('/settings'));

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
	<AppShell groups={nav.groups} bottomItems={nav.bottomItems}>
		{#snippet banner()}
			<UpdateBanner />
		{/snippet}

		<!-- The account block is the app's: the kit settles that it sits at the
		     bottom below a divider, not what goes in it. -->
		{#snippet railFooter({ showLabels })}
			<a
				href="/settings"
				class="flex items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors
				       {settingsActive
					? 'bg-accent text-accent-foreground'
					: 'text-muted-foreground hover:bg-accent'}"
				class:w-full={showLabels}
				class:justify-center={!showLabels}
				style="height: var(--density-target)"
				title={!showLabels ? 'Settings' : undefined}
			>
				<Settings size={20} class="shrink-0" />
				{#if showLabels}<span class="truncate">Settings</span>{/if}
			</a>
		{/snippet}

		{@render children()}
	</AppShell>
{/if}
