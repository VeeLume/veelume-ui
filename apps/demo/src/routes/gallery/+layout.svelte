<script lang="ts">
	/**
	 * The gallery shell.
	 *
	 * Two controls here rather than in each case, because they are the axes every
	 * component has to survive:
	 *
	 *   theme + density  — kit-level, applied to <html> by the appearance store
	 *   formatting locale — overridden for this subtree by calling setKitContext
	 *                       again, which shadows the root layout's context
	 *
	 * That last one is worth seeing: context is scoped, so a page can re-declare
	 * it without touching the app's own. It is also the fastest way to catch a
	 * component that formatted a number with the wrong locale.
	 */
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { setKitContext } from '@veelume/ui';
	import { appearance } from '$lib/stores/appearance.svelte';
	import { getLocale, m } from '$lib/i18n';

	let { children }: { children: Snippet } = $props();

	let formattingLocale = $state('de-DE');

	setKitContext({
		messageLocale: () => getLocale(),
		formattingLocale: () => formattingLocale,
		labels: {
			search: () => m.kit_search(),
			empty: () => m.kit_empty(),
			loading: () => m.kit_loading(),
			loadMore: () => m.kit_load_more(),
			updatedAt: ({ when }) => m.kit_updated_at({ when }),
			refresh: () => m.kit_refresh()
		}
	});

	const entries = [
		{ path: '/gallery', label: 'Overview' },
		{ path: '/gallery/list', label: 'Surface.List' },
		{ path: '/gallery/list-header', label: 'Surface.ListHeader' },
		{ path: '/gallery/toolbar', label: 'Surface.Toolbar' },
		{ path: '/gallery/split', label: 'Surface.Split' },
		{ path: '/gallery/form', label: 'RecordForm' },
		{ path: '/gallery/number', label: 'NumberInput' },
		{ path: '/gallery/shell-footer', label: 'Shell footers' },
		{ path: '/gallery/badge', label: 'StatusBadge' },
		{ path: '/gallery/controls', label: 'Switch & Segmented' },
		{ path: '/gallery/notify', label: 'Notify' },
		{ path: '/gallery/dialog', label: 'Dialog & Confirm' },
		{ path: '/gallery/picker', label: 'Picker' },
		{ path: '/gallery/date', label: 'Date & Time' }
	];

	const LOCALES = ['de-DE', 'en-US', 'en-GB', 'fr-FR', 'ja-JP'];
</script>

<div class="flex h-full min-h-0">
	<aside class="flex w-52 shrink-0 flex-col gap-1 border-r border-border p-3">
		<p class="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
			Gallery
		</p>
		{#each entries as e (e.path)}
			<a
				href={e.path}
				class="rounded-md px-2 py-1.5 text-sm {page.url.pathname === e.path
					? 'bg-accent text-accent-foreground'
					: 'hover:bg-muted'}">{e.label}</a
			>
		{/each}
	</aside>

	<div class="flex min-h-0 flex-1 flex-col">
		<div class="flex flex-wrap items-center gap-4 border-b border-border p-3 text-xs">
			<label class="flex items-center gap-2">
				Theme
				<select
					class="h-8 rounded-md border border-input bg-background px-2"
					value={appearance.theme}
					onchange={(e) =>
						appearance.setTheme(e.currentTarget.value as 'light' | 'dark' | 'system')}
				>
					<option value="system">system</option>
					<option value="light">light</option>
					<option value="dark">dark</option>
				</select>
			</label>

			<label class="flex items-center gap-2">
				Density
				<select
					class="h-8 rounded-md border border-input bg-background px-2"
					value={appearance.density}
					onchange={(e) =>
						appearance.setDensity(e.currentTarget.value as 'comfortable' | 'compact')}
				>
					<option value="comfortable">comfortable</option>
					<option value="compact">compact</option>
				</select>
			</label>

			<label class="flex items-center gap-2">
				Formatting locale
				<select
					class="h-8 rounded-md border border-input bg-background px-2"
					value={formattingLocale}
					onchange={(e) => (formattingLocale = e.currentTarget.value)}
				>
					{#each LOCALES as l (l)}<option value={l}>{l}</option>{/each}
				</select>
			</label>

			<span class="text-muted-foreground">
				message locale is the app's ({getLocale()}) — the two are independent
			</span>
		</div>

		<div class="min-h-0 flex-1 overflow-auto p-4">
			{@render children()}
		</div>
	</div>
</div>
