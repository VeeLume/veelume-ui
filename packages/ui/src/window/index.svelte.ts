/**
 * Viewport windowing — render O(viewport), whatever the list holds.
 *
 * This replaced `createReveal`, and the distinction matters: the reveal
 * throttled how fast rows ENTERED the DOM, but once entered they all paid the
 * update tax forever. Under an order switch every fill page reshuffles every
 * row, so a fully-rendered list rewrites all of it per page — measured on
 * /stress over Tauri: 13.8 s at 19k rendered rows, 22.3 s at 27k, 35 s at 35k,
 * a near-constant ~0.7–1.0 ms per rendered row per fill. Query time scaled
 * with the DOM, not with the data. A window caps the DOM at ~viewport size,
 * which removes that axis entirely instead of picking a point on it.
 *
 * ⚑ A FIXED SPACER AND ABSOLUTE ROWS, not padding. The first version windowed
 * with `padding-top`/`padding-bottom` on the list element, and dragging the
 * scrollbar thumb drifted from the mouse: every window move rewrote the pads,
 * every rewrite relaid out the whole list, and the browser's drag mapping
 * recalibrated against a document that kept shifting under it — the thumb
 * stalled at 72% while the mouse hit the screen edge. With one spacer whose
 * height changes only when MEASUREMENTS change (never with scroll position)
 * and rows placed by `translateY`, scrolling moves nothing and resizes
 * nothing, so there is no layout event left to fight the drag.
 *
 * ⚑ ABSENCE IS NEUTRAL. Below `threshold` rows `active` is false and the
 * consumer renders plain flow — a seven-row loans list renders exactly as if
 * this primitive did not exist. Windowing is a mechanism that engages on
 * size, not an option somebody has to remember to switch on.
 *
 * Variable heights are the normal case, not an extra: a catalog bundle expands
 * IN PLACE and changes height after render. Rendered rows are measured through
 * one shared `ResizeObserver`, unmeasured rows use a rolling average of what
 * has been measured (seeded by `estimate`), and offsets correct as truth
 * arrives.
 *
 * The consumer contract:
 *
 *   <div {@attach win.container}>                          the scroll box
 *     {#if win.active}
 *       <ul style:position="relative" style:height="{win.height}px">
 *         {#each rows.slice(win.start, win.end) as r, i}
 *           <li data-index={win.start + i} {@attach win.item}
 *               style:position="absolute" style:left="0" style:right="0"
 *               style:top="0" style:transform="translateY({win.tops[i]}px)">…
 *     {:else}
 *       <ul> …plain flow, exactly the markup from before windowing… </ul>
 *     {/if}
 *
 * ⚑ `item` reads the row's index from `data-index` AT MEASURE TIME rather than
 * capturing it. A per-index attachment closure changes identity on every
 * render, which would tear down and re-create its observer each time; one
 * stable function attaches once per node and stays correct while the window
 * scrolls underneath it.
 *
 * ⚑ `count()` IS ONLY EVER CALLED FROM THE CONSUMER'S TRACKED READS — never
 * from an effect in here, never from a timer. It reads a derived chain that
 * ends in a collection view, and both alternatives broke for documented
 * reasons: an `$effect` that reads a collection view is the kit's landmine
 * (the read lazily fetches, the fetch writes, the write re-triggers), and an
 * async recompute that called `count()` from its timer read the surface's
 * deriveds from an untracked context and left every scoped surface stuck on
 * its empty state. So the getters capture the count while the template reads
 * them — a plain-variable write, legal during render — and the async
 * recompute only consumes the captured number. The module stays effect-free,
 * which also means no owner requirement: usable from any context.
 *
 * `.svelte.ts` — it holds runes.
 */

export type WindowOptions = {
	/** Row-height guess in px until something is measured. */
	estimate?: number;
	/** Rows rendered beyond the viewport on each side. */
	overscan?: number;
	/** At or below this many rows the window is the whole list. */
	threshold?: number;
};

export type ListWindow = {
	/** First rendered row index. */
	readonly start: number;
	/** One past the last rendered row index — `rows.slice(start, end)`. */
	readonly end: number;
	/** Total height of the spacer, in px. Only meaningful while `active`. */
	readonly height: number;
	/** `translateY` offset for each rendered row, indexed like the slice. */
	readonly tops: readonly number[];
	/** Whether the window is smaller than the list — the consumer's cue to
	 *  render the absolute layout instead of plain flow. */
	readonly active: boolean;
	/** Attach to the scroll container. */
	container: (node: HTMLElement) => () => void;
	/** Attach to every rendered row, alongside `data-index`. */
	item: (node: HTMLElement) => () => void;
};

const DEFAULT_ESTIMATE = 44;
const DEFAULT_OVERSCAN = 10;
const DEFAULT_THRESHOLD = 200;

const EMPTY_TOPS: readonly number[] = [];

export function createWindow(count: () => number, options: WindowOptions = {}): ListWindow {
	const estimate = options.estimate ?? DEFAULT_ESTIMATE;
	const overscan = options.overscan ?? DEFAULT_OVERSCAN;
	const threshold = options.threshold ?? DEFAULT_THRESHOLD;

	/** `.raw`, replaced wholesale — one signal for everything a template reads
	 *  together. */
	let win = $state.raw({ start: 0, end: 0, height: 0, tops: EMPTY_TOPS });

	/** The row count as of the consumer's last tracked read — the ONLY place
	 *  `count()` gets called. See the module note. */
	let lastCount = 0;

	/**
	 * Measured heights by row index. Plain typed arrays — measurement happens
	 * in observer callbacks, and per-row reactivity is the E-design mistake
	 * this module must not repeat. Indices go stale when rows shift; that is
	 * accepted: heights are approximations that re-converge as rows render.
	 */
	let heights = new Float64Array(0);
	let known = new Uint8Array(0);
	let knownCount = 0;
	let knownSum = 0;

	let box: HTMLElement | null = null;
	let scheduled = false;

	const avg = () => (knownCount ? knownSum / knownCount : estimate);
	const heightOf = (i: number) => (known[i] ? heights[i] : avg());

	function ensureCapacity(n: number): void {
		if (heights.length >= n) return;
		const next = new Float64Array(Math.max(n, heights.length * 2, 256));
		next.set(heights);
		const nextKnown = new Uint8Array(next.length);
		nextKnown.set(known);
		heights = next;
		known = nextKnown;
	}

	function record(index: number, h: number): void {
		if (h <= 0 || index < 0) return;
		ensureCapacity(index + 1);
		if (known[index]) {
			if (heights[index] === h) return;
			knownSum -= heights[index];
		} else {
			known[index] = 1;
			knownCount += 1;
		}
		heights[index] = h;
		knownSum += h;
		schedule();
	}

	function compute(): void {
		const n = lastCount;
		if (n <= threshold) {
			// The window is the whole list — but still with a valid absolute
			// layout, so a consumer that renders one branch (the stress page)
			// works at any size. `active` is false here, which is what lets
			// Surface.List fall back to plain flow instead.
			ensureCapacity(n);
			const tops: number[] = [];
			let off = 0;
			for (let j = 0; j < n; j += 1) {
				tops.push(off);
				off += heightOf(j);
			}
			if (win.start !== 0 || win.end !== n || Math.abs(off - win.height) > 1) {
				win = { start: 0, end: n, height: off, tops };
			}
			return;
		}
		ensureCapacity(n);

		// No container yet (first render, SSR): a viewport-sized guess that the
		// attachment corrects on mount.
		const top = box ? box.scrollTop : 0;
		const view = box ? box.clientHeight : 800;

		// Linear walks, on purpose. At the envelope's scale a full pass is tens of
		// microseconds; an offset tree would be complexity spent on a case the
		// envelope excludes.
		let i = 0;
		let y = 0;
		while (i < n && y + heightOf(i) < top) {
			y += heightOf(i);
			i += 1;
		}
		const start = Math.max(0, i - overscan);
		let offset = y;
		for (let j = i - 1; j >= start; j -= 1) offset -= heightOf(j);
		offset = Math.max(0, offset);

		let end = i;
		let bottom = y;
		while (end < n && bottom < top + view) {
			bottom += heightOf(end);
			end += 1;
		}
		end = Math.min(n, end + overscan);

		const tops: number[] = [];
		let off = offset;
		for (let j = start; j < end; j += 1) {
			tops.push(off);
			off += heightOf(j);
		}

		let height = off;
		for (let j = end; j < n; j += 1) height += heightOf(j);

		if (
			start !== win.start ||
			end !== win.end ||
			Math.abs(height - win.height) > 1 ||
			Math.abs((tops[0] ?? 0) - (win.tops[0] ?? 0)) > 1
		) {
			win = { start, end, height, tops };
		}
	}

	/**
	 * One recompute per frame, however many signals arrive.
	 *
	 * ⚑ `requestAnimationFrame` is for ALIGNMENT, never for progress. A hidden
	 * document never fires it (the reveal's lesson) — and neither does a
	 * visible-but-not-compositing one, where `document.hidden` is still false,
	 * so checking hiddenness is not enough. Found exactly that way: a window
	 * that froze at 0–22 while scrollTop said 165 000. The timeout races the
	 * frame and whichever lands first computes.
	 */
	function schedule(): void {
		if (scheduled) return;
		scheduled = true;
		const run = () => {
			if (!scheduled) return;
			scheduled = false;
			compute();
		};
		if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
		setTimeout(run, 40);
	}

	/** One observer for every rendered row — see the module note on `item`. */
	let observer: ResizeObserver | null = null;
	const measure = (el: Element) => {
		const index = Number((el as HTMLElement).dataset.index);
		if (Number.isInteger(index)) record(index, (el as HTMLElement).offsetHeight);
	};
	const observerFor = (): ResizeObserver => {
		observer ??= new ResizeObserver((entries) => {
			for (const entry of entries) measure(entry.target);
		});
		return observer;
	};

	/** Capture the count in the CONSUMER'S tracked context and schedule the
	 *  async catch-up. Plain-variable writes plus a timer — legal during
	 *  render, the `ensure()` pattern. */
	const observe = () => {
		lastCount = count();
		schedule();
	};

	return {
		get start() {
			observe();
			return win.start;
		},
		get end() {
			observe();
			return win.end;
		},
		get height() {
			return win.height;
		},
		get tops() {
			return win.tops;
		},
		get active() {
			observe();
			return win.end - win.start < lastCount;
		},
		container(node: HTMLElement) {
			box = node;
			// Belt to the spacer's braces: even with a stable-height spacer, the
			// browser must not re-anchor scrollTop around row content swaps.
			const prevAnchor = node.style.overflowAnchor;
			node.style.overflowAnchor = 'none';
			const onScroll = () => schedule();
			node.addEventListener('scroll', onScroll, { passive: true });
			const ro = new ResizeObserver(() => schedule());
			ro.observe(node);
			schedule();
			return () => {
				node.removeEventListener('scroll', onScroll);
				ro.disconnect();
				node.style.overflowAnchor = prevAnchor;
				if (box === node) box = null;
			};
		},
		item(node: HTMLElement) {
			measure(node);
			const ro = observerFor();
			ro.observe(node);
			return () => {
				ro.unobserve(node);
			};
		}
	};
}
