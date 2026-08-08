<script lang="ts">
	/**
	 * The two default rail footers, in both rail states.
	 *
	 * Standalone specimens, so `showLabels` is passed explicitly — inside a
	 * `Shell.Root` the components read it from the shell context instead.
	 */
	import { Shell } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';

	const { SettingsFooter, AccountFooter } = Shell;
</script>

<div class="grid max-w-3xl gap-6 p-4">
	<div>
		<h2 class="text-lg font-semibold">Shell footers</h2>
		<p class="text-sm text-muted-foreground">
			The rail's bottom block, settled by evidence (stibu and Starlume derived it independently):
			settings lives at the bottom, below the divider. Two defaults host it — with and without an
			account concept. Both are plain snippet content, so a third idea replaces them entirely.
		</p>
	</div>

	<Case
		title="SettingsFooter — expanded"
		note="No account concept: the settings entry and nothing else. Label comes from the label bag; the gear is built in (no icon library), replaced here by nothing — this is the zero-wiring look."
	>
		<div class="w-56 rounded-md border border-border p-2">
			<SettingsFooter showLabels={true} />
		</div>
	</Case>

	<Case
		title="SettingsFooter — collapsed"
		note="Icon-only with a title tooltip. The built-in gear is what guarantees this state is never an empty button — 'a collapsing label needs an icon' is satisfied by default."
	>
		<div class="flex w-20 justify-center rounded-md border border-border p-2">
			<SettingsFooter showLabels={false} />
		</div>
	</Case>

	<Case
		title="AccountFooter — expanded"
		note="Avatar + name + cog in one row. Initials are derived from the name; `detail` carries the second line. The account block links only when `href` is given."
	>
		<div class="w-56 rounded-md border border-border p-2">
			<AccountFooter
				showLabels={true}
				name="Valerie Krumtünger"
				detail="valerie@veelume.dev"
				href="/preferences"
			/>
		</div>
	</Case>

	<Case
		title="AccountFooter — collapsed"
		note="Avatar stacks over the cog; the name survives as the avatar's tooltip. Same component, the shell's `showLabels` decides."
	>
		<div class="flex w-20 justify-center rounded-md border border-border p-2">
			<AccountFooter showLabels={false} name="Valerie Krumtünger" href="/preferences" />
		</div>
	</Case>

	<Case
		title="AccountFooter — avatar snippet"
		note="The escape hatch: an app with real pictures replaces the initials circle via the `avatar` snippet, which receives the size the slot expects."
	>
		<div class="w-56 rounded-md border border-border p-2">
			<AccountFooter showLabels={true} name="Valerie Krumtünger" detail="Pro plan">
				{#snippet avatar({ size })}
					<span
						class="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-semibold text-white"
						style="width: {size}px; height: {size}px"
					>
						VK
					</span>
				{/snippet}
			</AccountFooter>
		</div>
	</Case>

	<Case
		title="AccountFooter — display-only account"
		note="Without `href` the account block is not interactive — no hover, no link semantics. Only the cog navigates."
	>
		<div class="w-56 rounded-md border border-border p-2">
			<AccountFooter showLabels={true} name="Kiosk Terminal 3" detail="Shared device" />
		</div>
	</Case>
</div>
