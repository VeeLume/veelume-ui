/**
 * Time-sliced reveal — render to a **paint budget**, never to a row count.
 *
 * The usual answer is a fixed step (Starlume reveals 60 rows at a time). That
 * is a guess about row cost, and the guess is wrong in both directions:
 * measured here, 100 000 simple rows paint fine and stay responsive, while a
 * few thousand expensive ones would not. A constant cannot know which list it
 * is in.
 *
 * So this measures instead. It renders a small probe, learns the actual cost
 * per row, and from then on either:
 *
 *   - renders everything at once, when the estimate fits the budget — no
 *     slicing, no bookkeeping, no behavioural difference from not using this
 *     at all; or
 *   - hands the browser as many rows as fit one frame, repeatedly, so the page
 *     stays interactive throughout instead of freezing once.
 *
 * ⚑ The important property is that **it never blocks past the budget**. A list
 * too big to paint does not become a stall to sit through; it becomes a list
 * that fills in. That is the difference between "slow" and "broken".
 *
 * `.svelte.ts` — it holds runes.
 */

/**
 * A number, or a getter for one.
 *
 * The getter form exists for the same reason `scope` is a getter on
 * collections: a plain value is captured at creation, so a control bound to it
 * silently does nothing. `svelte-check` catches this one
 * (`state_referenced_locally`), which is more than it does for most of the
 * kit's reactivity traps.
 */
type Reactive = number | (() => number);

export type RevealOptions = {
	/**
	 * What a single render is allowed to cost. Above this, slicing starts.
	 * ~120ms is roughly where a UI stops feeling like it responded to you.
	 */
	budgetMs?: Reactive;
	/** Work handed to one frame while slicing. Under a 16ms frame, with room
	 *  left for the browser's own work. */
	frameMs?: Reactive;
	/** Rows in the first render, before anything has been measured. Small
	 *  enough to be cheap on any row, large enough to time reliably. */
	probe?: number;
};

export type Reveal = {
	/** How many rows to render right now. */
	readonly count: number;
	/** Everything is on screen. */
	readonly done: boolean;
	/** Measured cost per row, or 0 before the first measurement. */
	readonly msPerRow: number;
	/** Whether slicing is active — i.e. the list exceeded the budget. */
	readonly slicing: boolean;
};

export function createReveal(getTotal: () => number, options: RevealOptions = {}): Reveal {
	const read = (v: Reactive | undefined, fallback: number): number =>
		typeof v === 'function' ? v() : (v ?? fallback);
	const budget = () => read(options.budgetMs, 120);
	const frame = () => read(options.frameMs, 8);
	const probe = options.probe ?? 100;

	let count = $state(0);
	let slicing = $state(false);

	/**
	 * ⚑ The learned cost is a PLAIN variable, mirrored into `$state` only for
	 * display.
	 *
	 * As `$state` it would be read by the effect below and written by the frame
	 * callback — so every measurement would retrigger the effect, reset `count`
	 * to zero and start over. A reveal primitive whose whole purpose is to avoid
	 * freezing, looping forever.
	 */
	let learned = 0;
	let msPerRow = $state(0);

	const total = $derived(getTotal());

	// A frame is scheduled at most once; `pending` is plain (not $state) because
	// it is bookkeeping read and written inside the callback, never rendered.
	let pending = false;
	let markedAt = 0;
	let markedCount = 0;
	/**
	 * ⚑ Plain, and the guard is load-bearing.
	 *
	 * `total` comes from a getter the caller supplies, and in practice that getter
	 * reads a collection view — whose read LAZILY FETCHES. So `total` recomputes
	 * on every set mutation, the effect reruns, resets `count` to zero, and the
	 * reveal restarts forever: `effect_update_depth_exceeded`.
	 *
	 * Only an actual change in length is a reason to re-plan. Recomputing to the
	 * same number is not.
	 */
	let lastTotal = -1;

	function schedule(): void {
		if (pending) return;
		pending = true;
		requestAnimationFrame(() => {
			pending = false;

			// Measure what the last commit actually cost, and learn from it. Two
			// rAFs would be more precise about paint specifically; one is enough to
			// size the next chunk and costs a frame less latency.
			if (markedCount > 0) {
				const per = (performance.now() - markedAt) / markedCount;
				// Smooth, so one janky frame (a GC, a background tab) does not
				// permanently shrink every later chunk.
				learned = learned ? learned * 0.6 + per * 0.4 : per;
				msPerRow = learned;
			}
			markedCount = 0;

			if (count >= total) return;

			const remaining = total - count;
			const perRow = learned || 0.02;
			// Everything left fits the budget → finish in one commit.
			const next =
				remaining * perRow <= budget()
					? remaining
					: Math.max(1, Math.floor(frame() / perRow));

			markedAt = performance.now();
			markedCount = next;
			count = Math.min(total, count + next);
			if (count < total) schedule();
		});
	}

	$effect(() => {
		// Re-reading `total` is what makes this restart when the list changes.
		const n = total;
		if (n === lastTotal) return;
		lastTotal = n;
		count = 0;
		slicing = false;
		if (n === 0) return;

		// ⚑ Nothing paints in a hidden document, and `requestAnimationFrame` does
		// not fire there — so slicing would stall at the probe until the tab came
		// forward. Slicing exists to protect the frame rate; with no frames there
		// is nothing to protect, so render the lot. Found because the whole
		// primitive sat at 100 rows in a background tab.
		if (typeof document !== 'undefined' && document.hidden) {
			count = n;
			return;
		}

		// `learned` survives list changes deliberately: row cost is a property of
		// the ROW, so a second list of the same shape should not re-probe.
		const perRow = learned;
		if (perRow && n * perRow <= budget()) {
			// Known to be cheap: render it all, no slicing, no frames.
			count = n;
			return;
		}
		slicing = true;
		markedAt = performance.now();
		markedCount = Math.min(n, probe);
		count = markedCount;
		if (count < n) schedule();
	});

	return {
		get count() {
			return count;
		},
		get done() {
			return count >= total;
		},
		get msPerRow() {
			return msPerRow;
		},
		get slicing() {
			return slicing && count < total;
		}
	};
}
