<script lang="ts">
	/**
	 * The compact-width bottom bar.
	 *
	 * Which items appear is the APP's call, not a truncation the kit performs:
	 * stibu's rule is "at most five slots, settings always takes the last one",
	 * and that is a content judgement about what a phone user reaches for — not
	 * something a component can infer from a nav tree.
	 */
	import { type NavItem , type IconOf } from './types.js';
	import { page } from '$app/state';

	let {
		items,
		activePath = undefined,
		class: klass = ''
	}: {
		items: NavItem[];
		activePath?: string;
		class?: string;
	} = $props();

	const pathname = $derived(activePath ?? page.url.pathname);

	// Exact-or-child match rather than the rail's longest-prefix: the bar shows a
	// hand-picked subset, so "closest ancestor" would light up an entry the user
	// never chose.
	const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');
</script>

<!-- The inset padding keeps the bar clear of the gesture handle on Android. -->
<nav
	class="flex border-t border-border bg-background {klass}"
	style="padding-bottom: env(safe-area-inset-bottom)"
>
	{#each items as item (item.path)}
		{@const active = isActive(item.path)}
		{@const Icon = item.icon as IconOf}
		<a
			href={item.path}
			class="flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors"
			class:text-foreground={active}
			class:text-muted-foreground={!active}
			aria-current={active ? 'page' : undefined}
		>
			<span
				class="flex h-8 w-16 items-center justify-center rounded-full transition-colors"
				class:bg-accent={active}
			>
				{#if item.icon}<Icon size={20} />{/if}
			</span>
			<span>{item.label}</span>
		</a>
	{/each}
</nav>
