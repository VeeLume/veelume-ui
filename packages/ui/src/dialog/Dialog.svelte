<script lang="ts">
	/**
	 * The modal base — the other overlay species beside `Popup`. A Popup is
	 * anchored and light-dismiss; a Dialog is centred, the background is
	 * inert, focus is trapped, and leaving requires a decision. Every stibu
	 * picker and its ConfirmDialog hand-rolled this shell (overlay, Escape,
	 * panel focus) and none of them got a focus trap — which is exactly the
	 * ActionMenu argument for bits-ui: the hard part is precisely what it
	 * does (trap, inert, scroll lock, Escape, overlay dismiss, portalling).
	 *
	 * The kit owns the geometry: stibu's settled panel — centred, max-w-md,
	 * max-h-[80vh], column flex so a scrolling body works out of the box.
	 */
	import type { Snippet } from 'svelte';
	import { Dialog as BitsDialog } from 'bits-ui';

	let {
		open = false,
		onclose,
		title = undefined,
		label = undefined,
		class: klass = '',
		children
	}: {
		open?: boolean;
		/** Called on Escape, overlay click, or a close the content requests. */
		onclose: () => void;
		/** Header line, wired as the accessible name. Omit to render your own. */
		title?: string;
		/** Accessible name when there is no `title`. */
		label?: string;
		/** Sizing overrides — width, height. */
		class?: string;
		children: Snippet;
	} = $props();
</script>

<BitsDialog.Root {open} onOpenChange={(v) => !v && onclose()}>
	<BitsDialog.Portal>
		<BitsDialog.Overlay class="fixed inset-0 z-50 bg-black/50" />
		<BitsDialog.Content
			class="fixed top-1/2 left-1/2 z-50 flex max-h-[80vh] w-[calc(100vw-2rem)] max-w-md
			       -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border
			       border-border bg-card text-card-foreground shadow-lg {klass}"
			aria-label={title ? undefined : label}
		>
			{#if title}
				<div class="shrink-0 border-b border-border p-3">
					<BitsDialog.Title class="text-sm font-semibold">{title}</BitsDialog.Title>
				</div>
			{/if}
			{@render children()}
		</BitsDialog.Content>
	</BitsDialog.Portal>
</BitsDialog.Root>
