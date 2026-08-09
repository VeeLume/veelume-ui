<script lang="ts">
	/**
	 * The modal species. The live specimens are the real thing — focus
	 * trapped, background inert, Escape and overlay close. The loans page's
	 * destructive closers are the production consumer.
	 */
	import { Button, ConfirmDialog, Dialog, notify } from '@veelume/ui';
	import Case from '$lib/gallery/Case.svelte';

	let plainOpen = $state(false);
	let confirmOpen = $state(false);
	let destructiveOpen = $state(false);
</script>

<div class="grid max-w-3xl gap-6 p-4">
	<div>
		<h2 class="text-lg font-semibold">Dialog &amp; ConfirmDialog</h2>
		<p class="text-sm text-muted-foreground">
			A Popup is anchored and light-dismiss; a Dialog is centred, the background inert, focus
			trapped, and leaving requires a decision. bits-ui does the hard part — every stibu picker
			hand-rolled this shell and none of them got a focus trap.
		</p>
	</div>

	<Case
		title="Dialog, the base"
		note="Title wired as the accessible name, column flex so a scrolling body works. Tab cycles inside; Escape and overlay close."
	>
		<Button variant="outline" onclick={() => (plainOpen = true)}>Open dialog</Button>
		<Dialog open={plainOpen} onclose={() => (plainOpen = false)} title="A plain dialog">
			<div class="grid gap-3 p-4 text-sm">
				<p>Content is the consumer's. Try Tab — focus stays inside; the page behind is inert.</p>
				<div class="flex justify-end">
					<Button onclick={() => (plainOpen = false)}>Done</Button>
				</div>
			</div>
		</Dialog>
	</Case>

	<Case
		title="ConfirmDialog, neutral"
		note="Bag-default labels (Confirm / Cancel). Cancel renders first, so the trap's initial stop is the safe choice — Enter on a fresh dialog never destroys anything."
	>
		<Button variant="outline" onclick={() => (confirmOpen = true)}>Archive something…</Button>
		<ConfirmDialog
			open={confirmOpen}
			title="Archive this loan?"
			description="It leaves every list but stays on the record — archiving is reversible."
			onclose={() => (confirmOpen = false)}
			onconfirm={() => {
				confirmOpen = false;
				notify({ level: 'success', title: 'Archived', source: 'gallery' });
			}}
		/>
	</Case>

	<Case
		title="ConfirmDialog, destructive"
		note="The destructive variant names the consequence in the confirm label — 'Delete', never 'OK'. The caller closes on confirm itself: confirming may fail, and a dialog that auto-closed has nowhere to show it."
	>
		<Button variant="destructive" onclick={() => (destructiveOpen = true)}>Delete draft…</Button>
		<ConfirmDialog
			open={destructiveOpen}
			destructive
			title="Delete this draft?"
			description="A draft has no history to keep — this deletes it outright."
			confirmLabel="Delete"
			onclose={() => (destructiveOpen = false)}
			onconfirm={() => {
				destructiveOpen = false;
				notify({ level: 'info', title: 'Deleted (pretend)', source: 'gallery' });
			}}
		/>
	</Case>
</div>
