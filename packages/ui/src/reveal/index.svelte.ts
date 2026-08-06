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
	 * How long a frame may take before it counts as dropped. Under it the chunk
	 * doubles, over it the chunk halves.
	 *
	 * ⚑ This replaced a `budgetMs` + `frameMs` pair that drove chunk size from a
	 * measured cost-per-row. That model could not work: the only thing
	 * observable between `requestAnimationFrame` callbacks is the frame
	 * interval, so a small chunk always measures a whole frame and reports a
	 * huge per-row cost, which shrinks the next chunk further.
	 */
	overrunMs?: Reactive;
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
 * A frame this long or longer means we overran and the user saw jank. Under it,
 * we came in on time and can afford more. ~20ms allows 50fps.
 */
const FRAME_OVERRUN_MS = 20;

/** Never shrink below this — one row per frame is indistinguishable from a
 *  hang, which is the failure this primitive is supposed to prevent. */
const MIN_CHUNK = 25;

export function createReveal(getTotal: () => number, options: RevealOptions = {}): Reveal {
	const read = (v: Reactive | undefined, fallback: number): number =>
		typeof v === 'function' ? v() : (v ?? fallback);
	const overrunMs = () => read(options.overrunMs, FRAME_OVERRUN_MS);
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

	/**
	 * ⚑ Chunk size is adapted directly; it is NOT derived from a per-row cost.
	 *
	 * Deriving it was a death spiral. The only thing measurable across
	 * `requestAnimationFrame` callbacks is the FRAME INTERVAL, which is ~16.7ms
	 * whatever the chunk size — so a small chunk measures a whole frame, reports
	 * a huge ms/row, and shrinks the next chunk further. Observed live: 19.17
	 * ms/row and a chunk of one row per frame, i.e. a list that never finishes.
	 *
	 * So: did we hold the frame or not? Under budget, grow. Over, shrink. The
	 * signal is the thing actually cared about — dropped frames — and it cannot
	 * run away, because overrunning is what shrinks it.
	 */
	let chunk = 0;
	let lastFrameAt = 0;

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

			const now = performance.now();
			const delta = lastFrameAt ? now - lastFrameAt : overrunMs();
			lastFrameAt = now;

			if (measurable && markedCount > 0) {
				// Additive-ish growth, halving on overrun. Grows fast enough to reach
				// thousands of rows within a few frames on a cheap list, and backs off
				// immediately on an expensive one.
				chunk =
					delta < overrunMs()
						? Math.min(markedCount * 2, 20_000)
						: Math.max(MIN_CHUNK, Math.floor(markedCount / 2));
				// Reported only. Nothing sizes itself from this any more.
				const per = delta / markedCount;
				learned = learned ? learned * 0.6 + per * 0.4 : per;
				msPerRow = learned;
			}
			markedCount = 0;
			measurable = false;

			if (rendered >= lastTotal) return;

			// One adapted chunk. Nothing here consults ms/row: doubling reaches
			// 20 000 rows within ~8 healthy frames from a 100-row probe, so a cheap
			// list finishes in well under the budget without needing a cost model,
			// and an expensive one halves back without one either.
			const remaining = lastTotal - rendered;
			const next = Math.min(remaining, chunk || probe);

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

		// Small enough that slicing would be pure overhead. A row count, not a cost
		// estimate — the estimate is what kept being wrong.
		if (n <= probe) {
			show(n);
			return;
		}

		slicing = true;
		// A fresh list re-probes rather than trusting a chunk size learned against
		// different rows; a continued one keeps its pace.
		if (keep === 0) chunk = probe;
		lastFrameAt = 0;
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
