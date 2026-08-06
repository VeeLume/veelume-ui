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
import { tick } from 'svelte';

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
	/** Rows in the first render, before anything has been measured. Big enough
	 *  that a cheap list is essentially done after one commit, small enough that
	 *  an expensive one does not stall on it. */
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
 * Work allowed per frame. Deliberately under a 16.7ms frame: the commit cost we
 * measure covers JS and DOM mutation but NOT the layout and paint the browser
 * does afterwards, so the remainder is headroom for the part we cannot see.
 */
const FRAME_OVERRUN_MS = 10;

/** Never shrink below this — a few rows per frame is indistinguishable from a
 *  hang, which is the failure this primitive is supposed to prevent. */
const MIN_CHUNK = 50;

/** Never hand more than this to one commit, however cheap the rows measure. A
 *  bad estimate should cost one long frame, not a lockup. */
const MAX_CHUNK = 20_000;

export function createReveal(getTotal: () => number, options: RevealOptions = {}): Reveal {
	const read = (v: Reactive | undefined, fallback: number): number =>
		typeof v === 'function' ? v() : (v ?? fallback);
	const overrunMs = () => read(options.overrunMs, FRAME_OVERRUN_MS);
	const probe = options.probe ?? 400;

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

	/**
	 * ⚑ Fill by MEASURED COMMIT COST, packing as many chunks into a frame as fit.
	 *
	 * The previous version did one chunk per `requestAnimationFrame` and sized it
	 * from the frame interval. Both halves were wrong. The interval is ~16.7ms
	 * whatever the chunk contains, so it measures the browser's clock rather than
	 * our work; and one chunk per frame wastes whatever is left of the frame,
	 * which for cheap rows is most of it. 20 000 rows took dozens of frames to
	 * appear when the actual DOM work was a fraction of that.
	 *
	 * `await tick()` resolves once Svelte has flushed to the DOM, so the elapsed
	 * time around it is the real cost of that commit — a per-row figure that is
	 * about the rows. With it, chunk size is arithmetic rather than a guess, and
	 * the loop keeps going until the frame's allowance is spent.
	 *
	 * The frame-overrun check survives as a safety net, because `tick()` does not
	 * cover layout and paint: if the previous frame ran long anyway, the
	 * allowance is cut for the next one.
	 */
	let pumping = false;
	let penalty = 1;

	const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));

	async function pump(): Promise<void> {
		if (pumping) return;
		pumping = true;
		try {
			while (rendered < lastTotal) {
				const frameStarted = await nextFrame();
				const allowance = overrunMs() * penalty;
				let spent = 0;

				while (rendered < lastTotal && spent < allowance) {
					const perRow = learned || 0.005;
					const size = Math.max(
						MIN_CHUNK,
						Math.min(MAX_CHUNK, lastTotal - rendered, Math.floor((allowance - spent) / perRow))
					);

					const t0 = performance.now();
					show(Math.min(lastTotal, rendered + size));
					await tick();
					const cost = performance.now() - t0;

					spent += cost;
					learned = learned ? learned * 0.6 + (cost / size) * 0.4 : cost / size;
					msPerRow = learned;
				}

				// What the frame ACTUALLY cost, layout and paint included. If the
				// browser is struggling, take less next time even though our own
				// measurements looked fine.
				const frameCost = performance.now() - frameStarted;
				penalty = frameCost > overrunMs() * 3 ? Math.max(0.25, penalty / 2) : Math.min(1, penalty * 1.5);
			}
		} finally {
			pumping = false;
		}
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
		// A fresh list re-probes rather than trusting a cost learned against
		// different rows; a continued one keeps what it knows.
		if (keep === 0) learned = 0;
		penalty = 1;
		const start = keep > 0 ? keep : Math.min(n, probe);
		show(start);
		if (start < n) void pump();
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
