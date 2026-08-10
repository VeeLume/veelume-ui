<script lang="ts">
	/**
	 * The unread signal: a 36px chrome button with a count bubble. It owns
	 * NOTHING else — what opening it means (the kit's `Notify.Center`, a
	 * route, a drawer) is the app's, which is why the only contract is
	 * `onclick`. Compose it beside a `<Notify.Center>` in a relative wrapper
	 * for the donors' arrangement.
	 */
	import { getKitContext } from '../context/index.js';
	import { notifications } from './notifications.svelte.js';

	let {
		onclick,
		class: klass = ''
	}: {
		onclick: () => void;
		class?: string;
	} = $props();

	const kit = getKitContext();
	const badge = $derived(
		notifications.unread > 99
			? '99+'
			: notifications.unread > 0
				? String(notifications.unread)
				: null
	);
</script>

<button
	type="button"
	{onclick}
	aria-label={kit.labels.notifications()}
	class="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full
	       text-muted-foreground transition-colors hover:bg-accent hover:text-foreground
	       focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none {klass}"
>
	<svg
		viewBox="0 0 24 24"
		class="size-5"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
		<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
	</svg>
	{#if badge}
		<span
			class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center
			       rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
		>
			{badge}
		</span>
	{/if}
</button>
