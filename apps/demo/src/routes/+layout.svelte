<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { Loading, Notify, Shell, notifications, setKitContext } from '@veelume/ui';
	import { Settings } from 'lucide-svelte';
	import { m, getLocale } from '$lib/i18n';
	import { nav } from '$lib/nav.svelte';
	import { appearance } from '$lib/stores/appearance.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { updater } from '$lib/stores/updater.svelte';
	import UpdateBanner from '$lib/components/UpdateBanner.svelte';

	let { children } = $props();

	let notifOpen = $state(false);

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
			loading: () => m.kit_loading(),
			loadMore: () => m.kit_load_more(),
			updatedAt: ({ when }) => m.kit_updated_at({ when }),
			refresh: () => m.kit_refresh()
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
		<Loading />
	</div>
{:else}
	<!-- Composed from parts rather than <AppShell> to exercise the composable
	     surface: same arrangement, but each part is slotted in by the app, and
	     omitting the bottom snippet would be rail-only — no strategy flag. -->
	<Shell.Root groups={nav.groups}>
		<Shell.Rail>
			<!-- The brand row: wordmark leading, bell trailing — the donors'
			     arrangement (Starlume's `.brand`), now a deliberate placement
			     instead of an afterthought above the footer. The bell is here
			     because the demo HAS background work to announce (write
			     failures notify); stibu-shaped apps mount no bell at all —
			     presence tracks background work, not app size. At bar widths
			     the rail (and bell) is gone; the More badge carries unread. -->
			{#snippet header({ showLabels })}
				<div
					class="relative flex items-center"
					class:w-full={showLabels}
					class:justify-center={!showLabels}
				>
					{#if showLabels}
						<span class="min-w-0 flex-1 truncate px-3 text-sm font-semibold">Veelume UI</span>
					{/if}
					<Notify.Bell onclick={() => (notifOpen = !notifOpen)} />
					<Notify.Center
						open={notifOpen}
						onclose={() => (notifOpen = false)}
						side="right"
						align="start"
					/>
				</div>
			{/snippet}
			<!-- The demo has no accounts, so the no-account default footer. The
			     icon prop keeps the demo's lucide set; omit it for the built-in
			     gear. AccountFooter is exercised in /gallery/shell-footer. -->
			{#snippet footer({ showLabels })}
				<Shell.SettingsFooter icon={Settings} />
			{/snippet}
		</Shell.Rail>

		<Shell.Content>
			{#snippet banner()}
				<UpdateBanner />
			{/snippet}
			{#snippet bottom()}
				<!-- No items: the kit's default split — Home centred as the hero,
				     the overflow collected behind More. Settings and Notifications
				     are reachable only through /more at this width, so the
				     collector claims them — and carries the unread count, since
				     the rail's bell is gone here. -->
				<Shell.BottomBar
					moreOwns={['/settings', '/notifications']}
					moreBadge={() => notifications.unread || null}
				/>
			{/snippet}

			{@render children()}
		</Shell.Content>
	</Shell.Root>

	<!-- Once, at the root: the transient surface of the notification funnel. -->
	<Notify.Toasts />
{/if}
