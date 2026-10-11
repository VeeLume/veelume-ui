<script lang="ts">
	/**
	 * The notification rows, embeddable — the same split as Picker vs
	 * PickerDialog: `Notify.Center` is this list inside an anchored Popup;
	 * a phone-sized surface (the demo's /notifications, reached from the
	 * More page) hosts it as a page instead. One rendering, so a
	 * notification cannot look different depending on where it is read.
	 *
	 * Policy stays with the HOST: the Center marks all read on open; a page
	 * does the same on mount; an inbox-style host might not. The list only
	 * renders and dismisses.
	 *
	 * Live activities (the `activities` store) render first, under "Now",
	 * with the log under "Earlier" — headings only when both are present.
	 * Activity rows are not dismissable and never unread: they leave when
	 * the work does.
	 */
	import type { Snippet } from 'svelte';
	import { getKitContext } from '../context/index.js';
	import { activities, formatElapsed, type Activity } from './activities.svelte.js';
	import {
		notifications,
		dismiss,
		notifGlyph,
		notifLevelClass,
		type Notification
	} from './notifications.svelte.js';

	let {
		item = undefined,
		activity = undefined,
		onnavigate = undefined,
		class: klass = ''
	}: {
		/** Replaces a row's rendering. The list and its policy stay the kit's. */
		item?: Snippet<[{ notification: Notification; dismiss: () => void }]>;
		/** Replaces an activity row's rendering. `now` is the shared 1s clock
		 *  (epoch ms) for elapsed time. */
		activity?: Snippet<[{ activity: Activity; now: number }]>;
		/** Called when a row's action link is followed — the Center closes on
		 *  it; a page host usually has nothing to do. */
		onnavigate?: () => void;
		class?: string;
	} = $props();

	const kit = getKitContext();

	// One clock for every elapsed timer, ticking only while something runs.
	// setInterval, not rAF: a hidden document never runs rAF (rulebook).
	let now = $state(Date.now());
	const ticking = $derived(activities.items.some((a) => a.phase.type === 'running'));
	$effect(() => {
		if (!ticking) return;
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	const headed = $derived(activities.items.length > 0 && notifications.items.length > 0);
</script>

{#snippet heading(text: string)}
	<li
		class="border-b border-border px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wide
		       text-muted-foreground uppercase"
	>
		{text}
	</li>
{/snippet}

{#if notifications.items.length === 0 && activities.items.length === 0}
	<p class="p-6 text-center text-sm text-muted-foreground {klass}">{kit.labels.nothingYet()}</p>
{:else}
	<ul class="min-h-0 flex-1 overflow-y-auto {klass}">
		{#if activities.items.length > 0}
			{#if headed}{@render heading(kit.labels.now())}{/if}
			{#each activities.items as a (a.key)}
				<li class="border-b border-border last:border-b-0">
					{#if activity}
						{@render activity({ activity: a, now })}
					{:else}
						<div class="flex items-start gap-2 px-3 py-2.5">
							<span class="flex w-4 shrink-0 justify-center pt-1" aria-hidden="true">
								{#if a.phase.type === 'running'}
									<span
										class="size-3 rounded-full border-2 border-primary border-t-transparent
										       motion-safe:animate-spin"
									></span>
								{:else}
									<span class="text-sm leading-none font-bold text-muted-foreground">…</span>
								{/if}
							</span>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium">{a.title}</p>
								{#if a.phase.type === 'running' && a.phase.stage}
									<p class="text-xs break-words text-muted-foreground">{a.phase.stage}</p>
								{:else if a.phase.type === 'waiting'}
									<p class="text-xs break-words text-muted-foreground">{a.phase.reason}</p>
								{/if}
								{#if a.phase.type === 'running' || a.source}
									<p class="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
										{#if a.phase.type === 'running'}
											<span class="tabular-nums">{formatElapsed(now - a.started)}</span>
										{/if}
										{#if a.source}
											<span
												class="rounded border border-border px-1 text-[10px] tracking-wide uppercase"
											>
												{a.source}
											</span>
										{/if}
									</p>
								{/if}
							</div>
						</div>
					{/if}
				</li>
			{/each}
			{#if headed}{@render heading(kit.labels.earlier())}{/if}
		{/if}
		{#each notifications.items as n (n.id)}
			<li class="border-b border-border last:border-b-0" class:vk-accent-tint={!n.read}>
				{#if item}
					{@render item({ notification: n, dismiss: () => dismiss(n.id) })}
				{:else}
					<div class="flex items-start gap-2 px-3 py-2.5">
						<span
							class="w-4 shrink-0 text-center text-sm font-bold {notifLevelClass[n.level].glyph}"
							aria-hidden="true">{notifGlyph[n.level]}</span
						>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium">{n.title}</p>
							{#if n.body}
								<p class="text-xs break-words text-muted-foreground">{n.body}</p>
							{/if}
							<p class="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
								<span>{kit.format.relativeTime(n.ts)}</span>
								{#if n.source}
									<span
										class="rounded border border-border px-1 text-[10px] tracking-wide uppercase"
									>
										{n.source}
									</span>
								{/if}
								{#if n.action}
									<a
										href={n.action.href}
										class="font-medium text-primary underline-offset-2 hover:underline"
										onclick={onnavigate}
									>
										{n.action.label} →
									</a>
								{/if}
							</p>
						</div>
						<button
							type="button"
							class="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
							aria-label={kit.labels.dismiss()}
							onclick={() => dismiss(n.id)}
						>
							<svg
								viewBox="0 0 16 16"
								class="size-3.5"
								fill="none"
								stroke="currentColor"
								stroke-width="1.6"
								stroke-linecap="round"
								aria-hidden="true"
							>
								<path d="m4 4 8 8m0-8-8 8" />
							</svg>
						</button>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
