// A reactive props object the host can mutate after mount: Svelte 5 only
// creates $state inside .svelte(.js) modules, so the bridge gets it here.
export function reactiveProps(init) {
	const props = $state(init);
	return props;
}
