<script lang="ts">
	/**
	 * Default rail footer for apps WITH an account concept: who is signed in,
	 * plus the settings entry — the avatar + cog block stibu's NavRail and
	 * Starlume's sidebar derived independently.
	 *
	 * The component settles the GEOMETRY: expanded it is one row (avatar, name,
	 * cog trailing), collapsed it stacks avatar over cog. What it does not
	 * settle is the app's: what clicking the account means (`href`, optional —
	 * without it the block is display-only), and what the avatar shows (the
	 * `avatar` snippet replaces the initials once an app has real pictures).
	 */
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import type { NavIcon, IconOf } from './types.js';
	import { peekShellContext } from './context.svelte.js';
	import { getKitContext } from '../context/index.js';
	import GearIcon from './GearIcon.svelte';

	let {
		name,
		detail = undefined,
		href = undefined,
		settingsHref = '/settings',
		settingsIcon = undefined,
		avatar = undefined,
		showLabels = undefined
	}: {
		/** Display name of the signed-in account. */
		name: string;
		/** Second line — email, org, role. Rendered only when labels show. */
		detail?: string;
		/** Where the account block links; display-only when omitted. */
		href?: string;
		settingsHref?: string;
		/** Replaces the built-in gear — pass the app's icon set for consistency. */
		settingsIcon?: NavIcon;
		/** Replaces the initials circle. Receives the size the slot expects. */
		avatar?: Snippet<[{ size: number }]>;
		/** Defaults to the shell's decision; standalone usage passes it. */
		showLabels?: boolean;
	} = $props();

	const shell = peekShellContext();
	const kit = getKitContext();

	const labels = $derived(showLabels ?? shell?.showLabels ?? false);
	const pathname = $derived(shell?.activePath ?? page.url.pathname);
	const settingsActive = $derived(
		pathname === settingsHref || pathname.startsWith(settingsHref + '/')
	);
	const SettingsIcon = $derived(settingsIcon as IconOf | undefined);

	// First letter of the first two words — enough to identify, never clever.
	const initials = $derived(
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]!.toUpperCase())
			.join('')
	);
</script>

{#snippet avatarBlock(size: number)}
	{#if avatar}
		{@render avatar({ size })}
	{:else}
		<span
			class="flex shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
			style="width: {size}px; height: {size}px"
			aria-hidden="true"
		>
			{initials}
		</span>
	{/if}
{/snippet}

{#snippet cog()}
	<a
		href={settingsHref}
		class="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors"
		class:bg-accent={settingsActive}
		class:text-accent-foreground={settingsActive}
		class:text-muted-foreground={!settingsActive}
		class:hover:bg-accent={!settingsActive}
		aria-current={settingsActive ? 'page' : undefined}
		aria-label={kit.labels.settings()}
		title={kit.labels.settings()}
	>
		{#if SettingsIcon}<SettingsIcon size={20} />{:else}<GearIcon size={20} />{/if}
	</a>
{/snippet}

{#if labels}
	<div class="flex w-full items-center gap-1">
		<svelte:element
			this={href ? 'a' : 'div'}
			{href}
			class="flex min-w-0 flex-1 items-center gap-3 rounded-full px-2 py-1.5 transition-colors"
			class:hover:bg-accent={href}
		>
			{@render avatarBlock(36)}
			<span class="min-w-0">
				<span class="block truncate text-sm font-medium">{name}</span>
				{#if detail}
					<span class="block truncate text-xs text-muted-foreground">{detail}</span>
				{/if}
			</span>
		</svelte:element>
		{@render cog()}
	</div>
{:else}
	<div class="flex flex-col items-center gap-1">
		<svelte:element
			this={href ? 'a' : 'div'}
			{href}
			class="flex items-center justify-center rounded-full p-1 transition-colors"
			class:hover:bg-accent={href}
			title={name}
		>
			{@render avatarBlock(32)}
		</svelte:element>
		{@render cog()}
	</div>
{/if}
