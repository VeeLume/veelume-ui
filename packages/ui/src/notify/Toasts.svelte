<script lang="ts">
	/**
	 * The transient surface: watches the funnel and pops a toast for each
	 * newly-added notification. Non-sticky levels auto-fade; warning/error
	 * stay until dismissed. Dismissing a toast removes it from THIS stack
	 * only — the notification lives on in the center, which is the whole
	 * two-surfaces-one-list contract.
	 *
	 * Mount once, in the root layout. `item` replaces a toast's rendering;
	 * the stack, its policy and its timers stay the kit's.
	 */
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { getKitContext } from '../context/index.js';
	import {
		notifications,
		isSticky,
		notifGlyph,
		notifLevelClass,
		type Notification
	} from './notifications.svelte.js';

	let {
		autoDismissMs = 6500,
		item = undefined,
		class: klass = ''
	}: {
		/** How long a non-sticky toast stays. The donors' 6.5s default. */
		autoDismissMs?: number;
		/** Replaces a toast's rendering. Call `dismiss` to close it. */
		item?: Snippet<[{ notification: Notification; dismiss: () => void }]>;
		/** Repositions the stack — bottom-right is the default. */
		class?: string;
	} = $props();

	const kit = getKitContext();

	type ActiveToast = { n: Notification; timer?: ReturnType<typeof setTimeout> };
	let active = $state<ActiveToast[]>([]);
	const seen = new Set<string>();
	let ready = false;

	onMount(() => {
		// Anything already in the store predates this surface — it belongs to
		// the center and the badge, not to a wall of stale toasts.
		for (const n of notifications.items) seen.add(n.id);
		ready = true;
		return () => {
			for (const t of active) if (t.timer) clearTimeout(t.timer);
		};
	});

	$effect(() => {
		const list = notifications.items;
		if (!ready) return;
		for (const n of list) {
			if (seen.has(n.id)) continue;
			seen.add(n.id);
			if (!n.popToast) continue;
			const t: ActiveToast = { n };
			if (!isSticky(n.level)) {
				t.timer = setTimeout(() => remove(n.id), autoDismissMs);
			}
			active = [t, ...active];
		}
	});

	function remove(id: string) {
		const t = active.find((a) => a.n.id === id);
		if (t?.timer) clearTimeout(t.timer);
		active = active.filter((a) => a.n.id !== id);
	}
</script>

{#if active.length > 0}
	<div
		class="fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 {klass}"
	>
		{#each active as t (t.n.id)}
			{#if item}
				{@render item({ notification: t.n, dismiss: () => remove(t.n.id) })}
			{:else}
				<div
					role="status"
					class="flex items-start gap-2 rounded-lg border border-l-[3px] border-border bg-card
					       p-3 shadow-lg {notifLevelClass[t.n.level].accent}"
				>
					<span
						class="w-4 shrink-0 text-center text-sm font-bold {notifLevelClass[t.n.level].glyph}"
						aria-hidden="true">{notifGlyph[t.n.level]}</span
					>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-semibold">{t.n.title}</p>
						{#if t.n.body}
							<p class="text-xs text-muted-foreground">{t.n.body}</p>
						{/if}
						{#if t.n.action}
							<a
								href={t.n.action.href}
								class="mt-1 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
								onclick={() => remove(t.n.id)}
							>
								{t.n.action.label} →
							</a>
						{/if}
					</div>
					<button
						type="button"
						class="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
						aria-label={kit.labels.dismiss()}
						onclick={() => remove(t.n.id)}
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
		{/each}
	</div>
{/if}
