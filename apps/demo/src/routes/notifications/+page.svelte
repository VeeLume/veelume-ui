<script lang="ts">
	/**
	 * The notification center as a PAGE — the bar-width answer. At rail
	 * widths the bell anchors Notify.Center beside it; at bar widths the
	 * rail (and bell) is gone, so the More page carries a Notifications
	 * entry with the unread count and it lands here, on the same
	 * Notify.List the panel renders.
	 *
	 * Same policy as the Center: arriving marks everything read.
	 */
	import { Notify, clearAll, markAllRead, notifications } from '@veelume/ui';

	$effect(() => {
		markAllRead();
	});
</script>

<div class="mx-auto max-w-2xl space-y-4 p-4">
	<div class="flex items-center justify-between">
		<h1 class="text-lg font-semibold">Notifications</h1>
		{#if notifications.items.length > 0}
			<button
				type="button"
				class="text-xs text-muted-foreground underline-offset-2 hover:underline"
				onclick={clearAll}
			>
				Clear all
			</button>
		{/if}
	</div>

	<div class="overflow-hidden rounded-lg border border-border bg-card">
		<Notify.List />
	</div>
</div>
