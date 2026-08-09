/**
 * Wake invalidation — the sibling of `sseInvalidation`, for a channel that can
 * SLEEP rather than drop.
 *
 * ⚑ The rule it extends: *an adapter over a lossy channel must call
 * `onChange()` with no argument whenever it may have missed events.* SSE
 * learned that from reconnects — a dropped socket means missed messages, so a
 * silent reconnect leaves the cache stale with no way to know it. A suspended
 * webview is the same fact in TIME instead of space: the events were delivered
 * losslessly and nobody was awake to hear them.
 *
 * That is Starlume's whole catch-up story (a WebView2 suspended in the tray
 * runs no JS, so focus is the only honest resume point), and it also covers
 * the liveness-without-push case — polling a server that has no event channel
 * yet, which is where the friends page's 20s interval came from.
 *
 * Plain `.ts`, no runes: this is an event-plumbing function, and the reactive
 * work belongs to whatever collection consumes the callback.
 */

export type WakeOptions = {
	/**
	 * Fire when the document becomes visible or the window regains focus.
	 * Default true — it is the whole point of the function.
	 */
	focus?: boolean;
	/**
	 * Also poll every N ms. ⚑ Only WHILE VISIBLE: a background poll in a
	 * suspended webview either does not run (so it buys nothing) or keeps a
	 * hidden tray app talking to a server for nobody's benefit, and a resident
	 * companion's idle footprint is a product feature. The wake fires on
	 * return anyway, so the poll is for staying fresh on screen, never for
	 * catching up.
	 */
	every?: number;
	/**
	 * Collapse a burst of wake signals into one call, in ms. Default 250.
	 * `visibilitychange` and `focus` both fire on a single alt-tab, and a
	 * window manager can deliver several — the same idempotence the
	 * invalidation policy demands of event storms.
	 */
	debounce?: number;
};

/**
 * Wire wake-up catch-up to `onChange`. Returns the unsubscribe.
 *
 * Argument-less by design: waking tells you *that* you may have missed
 * something, never what — which is exactly what `onChange()` with no
 * `ChangeInfo` already means, so this needs no new API to express.
 */
export function wakeInvalidation(onChange: () => void, options: WakeOptions = {}): () => void {
	// SSR / non-DOM: nothing to listen to, and returning a no-op keeps the
	// call site free of environment checks.
	if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};

	const useFocus = options.focus ?? true;
	const debounceMs = options.debounce ?? 250;

	let timer: ReturnType<typeof setTimeout> | undefined;
	let poll: ReturnType<typeof setInterval> | undefined;
	let disposed = false;

	const fire = () => {
		if (disposed) return;
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (!disposed) onChange();
		}, debounceMs);
	};

	const visible = () => document.visibilityState === 'visible';

	const startPoll = () => {
		if (poll !== undefined || !options.every) return;
		poll = setInterval(() => {
			// Guard as well as gate: a browser may throttle rather than stop
			// the timer, and a fire from a hidden document is the exact waste
			// this is meant to avoid.
			if (visible()) onChange();
		}, options.every);
	};

	const stopPoll = () => {
		clearInterval(poll);
		poll = undefined;
	};

	const onVisibility = () => {
		if (visible()) {
			// Woke up: the gap is unknowable, so report it.
			fire();
			startPoll();
		} else {
			stopPoll();
		}
	};

	if (useFocus) {
		// Both, deliberately: `visibilitychange` misses a focus return between
		// two visible windows, and `focus` misses an un-minimise that never
		// takes focus. The debounce is what makes the overlap free.
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('focus', fire);
	}

	if (visible()) startPoll();

	return () => {
		disposed = true;
		clearTimeout(timer);
		stopPoll();
		if (useFocus) {
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('focus', fire);
		}
	};
}
