<script lang="ts">
	/**
	 * One status, as a toned pill. The component is deliberately nothing but
	 * `resolveStatus` + the shared classes — the map is where a domain's
	 * design lives, and rows inside `Surface.List` get the same rendering
	 * through `Row.badge` without mounting a component per row.
	 */
	import { resolveStatus, statusBadgeClass, statusToneClass, type StatusMap } from './types.js';

	let {
		status,
		map,
		class: klass = ''
	}: {
		status: string | null | undefined;
		map: StatusMap;
		class?: string;
	} = $props();

	const resolved = $derived(resolveStatus(map, status));
</script>

{#if resolved}
	<span class="{statusBadgeClass} {statusToneClass[resolved.tone]} {klass}">{resolved.label}</span>
{/if}
