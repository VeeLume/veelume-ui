<script lang="ts">
	/**
	 * Tier ③ — rare or destructive actions behind a `⋮`.
	 *
	 * bits-ui's DropdownMenu rather than a hand-rolled panel, because this is the
	 * one place the accessibility work is not optional: roving focus, Escape,
	 * outside-click, `aria-expanded`, and returning focus to the trigger. The
	 * filter panel gets away with a plain disclosure; a menu does not.
	 */
	import { DropdownMenu } from 'bits-ui';
	import { getKitContext } from '../context/index.js';
	import Spinner from './Spinner.svelte';
	import type { Action, IconOf } from './types.js';

	let {
		actions,
		label = undefined
	}: {
		actions: Action[];
		label?: string;
	} = $props();

	const kit = getKitContext();
	const trigger = $derived(label ?? kit.labels.moreActions());

	/**
	 * ⚑ Controlled only so the Portal can be gated — the same bits-ui 2.18
	 * presence regression `Dialog` hit: the content stayed MOUNTED and visible
	 * at `data-state="closed"`, so a dismissed menu hung over the page and
	 * swallowed clicks. Nothing else reads this; bits still drives every
	 * open/close decision through the binding.
	 */
	let open = $state(false);
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger
		class="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground
		       transition-colors hover:bg-accent hover:text-accent-foreground
		       focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
		aria-label={trigger}
		title={trigger}
	>
		<!-- Inline rather than an icon dependency: the kit must not pick the app's
		     icon library, and this glyph is part of the pattern's identity. -->
		<svg viewBox="0 0 16 16" class="size-4" fill="currentColor" aria-hidden="true">
			<circle cx="8" cy="3" r="1.4" />
			<circle cx="8" cy="8" r="1.4" />
			<circle cx="8" cy="13" r="1.4" />
		</svg>
	</DropdownMenu.Trigger>

	{#if open}
		<DropdownMenu.Portal>
			<DropdownMenu.Content
				class="z-50 min-w-52 rounded-md border border-border bg-popover p-1
			       text-popover-foreground shadow-md"
				align="end"
				sideOffset={6}
			>
				{#each actions as action (action.label)}
					{@const Icon = action.icon as IconOf}
					<DropdownMenu.Item
						onSelect={action.onclick}
						disabled={action.disabled || action.busy}
						class="flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2.5 text-sm
					       outline-none select-none data-disabled:pointer-events-none
					       data-disabled:opacity-50 {action.destructive
							? 'text-destructive data-highlighted:bg-destructive/10'
							: 'data-highlighted:bg-accent data-highlighted:text-accent-foreground'}"
					>
						<!-- Busy reads the same here as in the cluster: spinner in the
					     icon slot, item disabled. A menu closes on select, so this
					     is mostly seen when the menu is reopened during the work. -->
						{#if action.busy}
							<Spinner />
						{:else if action.icon}
							<Icon class="size-4 shrink-0" />
						{/if}
						{action.label}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	{/if}
</DropdownMenu.Root>
