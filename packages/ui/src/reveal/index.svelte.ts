/**
 * Time-sliced reveal — render to a **paint budget**, never to a row count.
 *
 * A fixed step (Starlume reveals 60 at a time) is a guess about row cost, and
 * the guess is wrong in both directions: 100 000 simple rows paint fine and
 * stay responsive, while a few thousand expensive ones would not. A constant
 * cannot know which list it is in. So this measures, then either renders
 * everything at once when the estimate fits the budget — no slicing, no
 * bookkeeping, indistinguishable from not using it — or hands the browser as
 * many rows as fit one frame, repeatedly.
 *
 * ⚑ It budgets REPLACEMENT as well as growth, which the first version did not.
 * Dropping from 5 000 rendered rows to a 100-row probe destroys ~4 900 DOM
 * nodes in one blocking commit — the same freeze this exists to prevent, at the
 * other end. Observed directly: switching sort order made the UI chug and sent
 * ms/row from ~5 to ~250. So a list that is *replaced* keeps its rendered count
 * and lets the each-block update rows in place; only a genuinely shorter list
 * shrinks.
 *
 * ⚑ Consumers should render the sliced rows **unkeyed**. A keyed block destroys
 * and recreates every row when identity changes, which is exactly the cost this
 * is trying not to pay; positional rendering reuses the nodes and updates text.
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

/**
 * Above this, a sample is not a row render — it is a teardown, a GC pause or a
 * backgrounded tab. Folding it into the average makes every later chunk tiny
 * and the reveal crawls, which is how a transient stall becomes permanent.
 */
const IMPLAUSIBLE_MS_PER_ROW = 20;

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
	 * display. As `$state` it would be read by the effect below and written by
	 * the frame callback — so every measurement would retrigger the effect,
	 * reset `count` and start over. A reveal primitive whose whole purpose is to
	 * avoid freezing, looping forever.
	 */
	let learned = 0;
	let msPerRow = $state(0);

	const total = $derived(getTotal());

	let pending = false;
	let markedAt = 0;
	let markedCount = 0;
	/** Whether the pending commit is worth measuring. A transition frame is not:
	 *  it carries teardown that has nothing to do with per-row cost. */
	let measurable = false;
	/**
	 * ⚑ Plain mirror of `count`, and plain guard for `total`.
	 *
	 * `total` comes from a getter that in practice reads a collection view —
	 * whose read lazily FETCHES. So it recomputes on every set mutation and the
	 * effect reruns; reading `count` inside it would close the read/write loop.
	 * Both of these exist so the effect reads no `$state` it also writes.
	 */
	let rendered = 0;
	let lastTotal = -1;

	function show(n: number): void {
		rendered = n;
		count = n;
	}

	function schedule(): void {
		if (pending) return;
		pending = true;
		requestAnimationFrame(() => {
			pending = false;

			if (measurable && markedCount > 0) {
				const per = (performance.now() - markedAt) / markedCount;
				// Discard implausible samples rather than smoothing them in — one
				// janky frame should not permanently shrink every later chunk.
				if (per < IMPLAUSIBLE_MS_PER_ROW) {
					learned = learned ? learned * 0.6 + per * 0.4 : per;
					msPerRow = learned;
				}
			}
			markedCount = 0;
			measurable = false;

			if (rendered >= lastTotal) return;

			const remaining = lastTotal - rendered;
			const perRow = learned || 0.02;
			const next =
				remaining * perRow <= budget() ? remaining : Math.max(1, Math.floor(frame() / perRow));

			markedAt = performance.now();
			markedCount = next;
			// A pure append is the only commit that measures cleanly, and this is
			// the only place one happens — every commit from the effect carries a
			// list change with it.
			measurable = true;
			show(Math.min(lastTotal, rendered + next));
			if (rendered < lastTotal) schedule();
		});
	}

	$effect(() => {
		const n = total;
		if (n === lastTotal) return;
		const first = lastTotal < 0;
		lastTotal = n;
		slicing = false;

		if (n === 0) {
			show(0);
			return;
		}

		// ⚑ Nothing paints in a hidden document and `requestAnimationFrame` does
		// not fire there, so slicing would stall at the probe until the tab came
		// forward. Slicing protects the frame rate; with no frames there is
		// nothing to protect, so render the lot.
		if (typeof document !== 'undefined' && document.hidden) {
			show(n);
			return;
		}

		// ⚑ A REPLACED list keeps what is already on screen.
		//
		// Resetting to the probe would destroy every rendered row in one commit —
		// 5 000 nodes going away so 100 can appear — which is the stall this
		// primitive exists to avoid. Holding the count lets an unkeyed each-block
		// update those rows in place instead, and the reveal continues from where
		// it was. Only a genuinely shorter list shrinks, and only to its length.
		const keep = first ? 0 : Math.min(rendered, n);

		const perRow = learned;
		if (perRow && n * perRow <= budget()) {
			show(n);
			return;
		}

		slicing = true;
		const start = keep > 0 ? keep : Math.min(n, probe);
		markedAt = performance.now();
		markedCount = start;
		// The transition frame carries teardown or a wholesale data swap, so it
		// says nothing about per-row cost. Measuring it is what sent ms/row from
		// ~5 to ~250 and then throttled every later chunk to a crawl.
		measurable = false;
		show(start);
		if (start < n) schedule();
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
