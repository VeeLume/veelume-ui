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
	 */
	import type { Snippet } from 'svelte';
	import { getKitContext } from '../context/index.js';
	import {
		notifications,
		dismiss,
		notifGlyph,
		notifLevelClass,
		type Notification
	} from './store.svelte.js';

	let {
		item = undefined,
		onnavigate = undefined,
		class: klass = ''
	}: {
		/** Replaces a row's rendering. The list and its policy stay the kit's. */
		item?: Snippet<[{ notification: Notification; dismiss: () => void }]>;
		/** Called when a row's action link is followed — the Center closes on
		 *  it; a page host usually has nothing to do. */
		onnavigate?: () => void;
		class?: string;
	} = $props();

	const kit = getKitContext();
</script>

{#if notifications.items.length === 0}
	<p class="p-6 text-center text-sm text-muted-foreground {klass}">{kit.labels.nothingYet()}</p>
{:else}
	<ul class="min-h-0 flex-1 overflow-y-auto {klass}">
		{#each notifications.items as n (n.id)}
			<li class="border-b border-border last:border-b-0" class:bg-accent-tint={!n.read}>
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

<style>
	/* The donors tint unread rows with an accent mix; Tailwind has no token
	   for "accent at a fraction", so the one non-utility rule in the module. */
	.bg-accent-tint {
		background: color-mix(in srgb, var(--accent) 45%, transparent);
	}
</style>
