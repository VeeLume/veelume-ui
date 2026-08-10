<script lang="ts">
	/**
	 * One tab's chrome — the shape, the active state, and the roles.
	 *
	 * Extracted because the strip is not the only thing that puts a tab in the
	 * strip: an app's `trailing` content (a compare view, a layout mode) has to
	 * read as one of the tabs, and the demo was hand-copying the border, the
	 * `border-b-card` blend and the roles to get there. That is the `Bar`
	 * lesson again — **if two things must agree on an appearance, they must
	 * share the code that expresses it**, because a comment saying "keep this
	 * in sync" is not an enforcement mechanism.
	 *
	 * ⚑ `role="tab"` sits on the BUTTON, never the wrapper. The strip's
	 * arrow-key navigation focuses whatever carries the role, and `.focus()` on
	 * a non-focusable div does nothing — a role on the wrapper silently drops
	 * the tab out of the keyboard order, which is exactly how the demo's own
	 * compare tab went unreachable by `End`.
	 */
	import type { Snippet } from 'svelte';

	let {
		active = false,
		muted = false,
		title = undefined,
		tabKey = undefined,
		focusable = false,
		onclick,
		onauxclick = undefined,
		onmousedown = undefined,
		actions,
		children
	}: {
		active?: boolean;
		/** Renders italic — the workset's preview state. */
		muted?: boolean;
		title?: string;
		/** Read back by the strip's `Delete` handler. */
		tabKey?: string;
		/**
		 * Part of the roving tabindex. Exactly ONE tab in a strip should be
		 * `true`; every other tab stays reachable by arrow keys, which focus
		 * explicitly and ignore tabindex.
		 */
		focusable?: boolean;
		onclick: () => void;
		onauxclick?: (event: MouseEvent) => void;
		onmousedown?: (event: MouseEvent) => void;
		/** Controls inside the tab — close, split. Kept out of the tab order. */
		actions?: Snippet;
		children: Snippet;
	} = $props();
</script>

<!-- The attachment reads `active`, so a tab brought forward by ANY route —
     click, close-promotes-the-neighbour, back/forward, a deep link — scrolls
     into view when the strip overflows. It lives here rather than in the strip
     because it is a property of being the active tab, which is also what makes
     it work for an app's trailing tab for free. -->
<div
	class="group flex shrink-0 items-center rounded-t-md border
	       {active
		? 'border-border border-b-card bg-card'
		: 'border-transparent text-muted-foreground hover:text-foreground'}"
	{@attach (node) => {
		if (active) node.scrollIntoView({ inline: 'nearest', block: 'nearest' });
	}}
>
	<button
		type="button"
		role="tab"
		aria-selected={active}
		tabindex={focusable ? 0 : -1}
		data-tab-key={tabKey}
		{title}
		class="h-9 max-w-48 truncate px-3 text-sm {muted ? 'italic' : ''}"
		{onclick}
		{onauxclick}
		{onmousedown}
	>
		{@render children()}
	</button>
	{#if actions}
		{@render actions()}
	{/if}
</div>
