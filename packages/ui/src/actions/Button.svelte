<script lang="ts" module>
	export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'destructive';
	/**
	 * `chrome` is a fixed 36px; `field` binds to `--density-target`.
	 *
	 * This encodes the rule the donors learned the hard way: **density scales
	 * form fields, chrome stays fixed.** At comfortable density a full-height
	 * control grows to exactly a toolbar's own height and fills it edge to edge
	 * while its neighbours sit inset — connect-neo pins its search input to h-9
	 * for precisely this reason.
	 */
	export type ButtonSize = 'chrome' | 'field' | 'icon';

	const VARIANTS: Record<ButtonVariant, string> = {
		primary: 'bg-primary text-primary-foreground shadow-xs hover:opacity-90',
		outline: 'border border-input bg-background shadow-xs hover:bg-muted',
		ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
		destructive: 'bg-destructive text-white shadow-xs hover:opacity-90'
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'primary',
		size = 'chrome',
		href = undefined,
		disabled = false,
		title = undefined,
		onclick = undefined,
		type = 'button',
		class: klass = '',
		children
	}: {
		variant?: ButtonVariant;
		size?: ButtonSize;
		href?: string;
		disabled?: boolean;
		title?: string;
		onclick?: () => void;
		type?: 'button' | 'submit';
		class?: string;
		children: Snippet;
	} = $props();

	const base =
		'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-medium ' +
		'transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none ' +
		'disabled:pointer-events-none disabled:opacity-40';

	const sizing = $derived(
		size === 'icon' ? 'size-9' : size === 'field' ? 'px-3' : 'h-9 px-3'
	);
	const cls = $derived(`${base} ${VARIANTS[variant]} ${sizing} ${klass}`);
	// `field` is the only size that follows density; the others are chrome.
	const style = $derived(size === 'field' ? 'height: var(--density-target)' : undefined);
</script>

{#if href}
	<!-- An anchor when it navigates, a button when it acts. Rendering everything
	     as a button and calling goto() breaks middle-click and "open in new tab". -->
	<a {href} class={cls} {style} {title} aria-disabled={disabled || undefined}>
		{@render children()}
	</a>
{:else}
	<button {type} class={cls} {style} {title} {disabled} {onclick}>
		{@render children()}
	</button>
{/if}
