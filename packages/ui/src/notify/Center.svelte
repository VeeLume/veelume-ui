<script lang="ts">
	/**
	 * The persistent surface: every notification this session, with time,
	 * severity, source tag and optional action. Opening it marks everything
	 * read — the bell badge is the unread signal, and a badge that survives
	 * looking at the list is a badge that lies.
	 *
	 * An anchored panel, not a route: place it in a `relative` wrapper next
	 * to the trigger (default position drops below, right-aligned; `class`
	 * repositions). The panel discipline — outside click, Escape, focus
	 * return — is `Popup`'s; this component owns only what a notification
	 * row looks like.
	 *
	 * Times render through the kit context's `relativeTime`, so they follow
	 * the formatting locale — the donors hand-rolled English strings here,
	 * which is the coupling this package forbids.
	 */
	import type { Snippet } from 'svelte';
	import Popup from '../popup/Popup.svelte';
	import { getKitContext } from '../context/index.js';
	import {
		notifications,
		dismiss,
		clearAll,
		markAllRead,
		notifGlyph,
		notifLevelClass,
		type Notification
	} from './store.svelte.js';

	let {
		open = false,
		onclose,
		item = undefined,
		class: klass = ''
	}: {
		open?: boolean;
		onclose: () => void;
		/** Replaces a row's rendering. The list, header and policy stay the kit's. */
		item?: Snippet<[{ notification: Notification; dismiss: () => void }]>;
		/**
		 * Position classes, REPLACING the default `top-full right-0 mt-2`
		 * (below the trigger, right-aligned) — replaced rather than merged,
		 * because two `top-*` utilities on one element resolve by stylesheet
		 * order, not by author intent. A rail-bottom bell passes something
		 * like `bottom-0 left-full ml-3`.
		 */
		class?: string;
	} = $props();

	const kit = getKitContext();

	$effect(() => {
		if (open) markAllRead();
	});
</script>

<Popup
	{open}
	{onclose}
	position={klass || 'top-full right-0 mt-2'}
	label={kit.labels.notifications()}
	class="flex max-h-96 w-80 flex-col overflow-hidden"
>
	<header class="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
		<span class="text-sm font-semibold">{kit.labels.notifications()}</span>
		{#if notifications.items.length > 0}
			<button
				type="button"
				class="text-xs text-muted-foreground underline-offset-2 hover:underline"
				onclick={clearAll}
			>
				{kit.labels.clearAll()}
			</button>
		{/if}
	</header>

	{#if notifications.items.length === 0}
		<p class="p-6 text-center text-sm text-muted-foreground">{kit.labels.nothingYet()}</p>
	{:else}
		<ul class="min-h-0 flex-1 overflow-y-auto">
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
											onclick={onclose}
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
</Popup>

<style>
	/* The donors tint unread rows with an accent mix; Tailwind has no token
	   for "accent at 8%", so the one non-utility rule in the module. */
	.bg-accent-tint {
		background: color-mix(in srgb, var(--accent) 45%, transparent);
	}
</style>
