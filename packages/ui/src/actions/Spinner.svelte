<script lang="ts">
	/**
	 * The icon-slot spinner for a busy action. Sized to match an action icon
	 * (`size-4`) so a button does not resize when its work starts — the same
	 * reasoning as `Surface.List` reserving its throbber track.
	 */
	let { class: klass = '' }: { class?: string } = $props();
</script>

<span
	class="size-4 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current {klass}"
	aria-hidden="true"
></span>
