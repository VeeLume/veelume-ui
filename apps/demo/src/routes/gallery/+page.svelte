<script lang="ts">
	import { getKitContext } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';

	const kit = getKitContext();
</script>

<div class="grid max-w-3xl gap-6">
	<div>
		<h1 class="text-lg font-semibold">Gallery</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Every kit component, in every state, on one page each. The controls above are the axes a
			component has to survive — theme, density and formatting locale — so a case that only looks
			right in one of them fails visibly here rather than in an app.
		</p>
		<p class="mt-2 text-xs text-muted-foreground">
			Deliberately hand-written rather than Storybook. Storybook earns its place when live
			args/controls or the a11y and interaction-test addons are actually wanted; until then it is
			maintenance for capability nothing is asking for.
		</p>
	</div>

	<Case
		title="The two locales, side by side"
		note="Message locale is the app's; formatting locale is this subtree's. Change the picker above — only the right column moves."
	>
		<dl class="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
			<dt class="text-muted-foreground">message locale</dt>
			<dd class="font-mono">{kit.messageLocale}</dd>
			<dt class="text-muted-foreground">formatting locale</dt>
			<dd class="font-mono">{kit.formattingLocale}</dd>
			<dt class="text-muted-foreground">hour cycle</dt>
			<dd class="font-mono">{kit.hourCycle}h</dd>
			<dt class="text-muted-foreground">number</dt>
			<dd class="font-mono tabular-nums">{kit.format.number(1234.56)}</dd>
			<dt class="text-muted-foreground">currency</dt>
			<dd class="font-mono tabular-nums">
				{kit.format.number(1234.56, { style: 'currency', currency: 'EUR' })}
			</dd>
			<dt class="text-muted-foreground">date</dt>
			<dd class="font-mono">{kit.format.date('2026-04-05', { dateStyle: 'long' })}</dd>
			<dt class="text-muted-foreground">label (from the bag)</dt>
			<dd class="font-mono">{kit.labels.search()}</dd>
			<dt class="text-muted-foreground">label (kit default)</dt>
			<dd class="font-mono">{kit.labels.resultCount({ count: 3 })}</dd>
		</dl>
	</Case>

	<Case
		title="Why the hour cycle is derived"
		note="bits-ui's date components default to en-US. Omit the prop and a German UI renders am/pm — the bug that is live in connect-neo."
	>
		<p class="text-sm">
			<code class="font-mono">{kit.formattingLocale}</code> resolves to
			<code class="font-mono">{kit.hourCycle}-hour</code>, asked of
			<code class="font-mono">Intl</code> rather than looked up in a region table.
		</p>
	</Case>
</div>
