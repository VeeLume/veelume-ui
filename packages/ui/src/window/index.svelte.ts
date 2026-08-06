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
 * ⚑ ABSENCE IS NEUTRAL. Below `threshold` rows the window is the whole list,
 * the pads are zero, and nothing is measured — a seven-row loans list renders
 * exactly as if this primitive did not exist. Windowing is a mechanism that
 * engages on size, not an option somebody has to remember to switch on.
 *
 * Variable heights are the normal case, not an extra: a catalog bundle expands
 * IN PLACE and changes height after render. Rendered rows are measured through
 * one shared `ResizeObserver`, unmeasured rows use a rolling average of what
 * has been measured (seeded by `estimate`), and the pads correct as truth
 * arrives.
 *
 * The consumer contract, deliberately small:
 *
 *   <div {@attach win.container}>                          the scroll box
 *     <ul style:padding-top="{win.padTop}px"
 *         style:padding-bottom="{win.padBottom}px">
 *       {#each rows.slice(win.start, win.end) as r, i}
 *         <li data-index={win.start + i} {@attach win.item}>…
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
	/** Height of the unrendered rows above, in px. */
	readonly padTop: number;
	/** Height of the unrendered rows below, in px. */
	readonly padBottom: number;
	/** Whether the window is smaller than the list. */
	readonly active: boolean;
	/** Attach to the scroll container. */
	container: (node: HTMLElement) => () => void;
	/** Attach to every rendered row, alongside `data-index`. */
	item: (node: HTMLElement) => () => void;
};

const DEFAULT_ESTIMATE = 44;
const DEFAULT_OVERSCAN = 10;
const DEFAULT_THRESHOLD = 200;

export function createWindow(count: () => number, options: WindowOptions = {}): ListWindow {
	const estimate = options.estimate ?? DEFAULT_ESTIMATE;
	const overscan = options.overscan ?? DEFAULT_OVERSCAN;
	const threshold = options.threshold ?? DEFAULT_THRESHOLD;

	/** `.raw`, replaced wholesale — one signal for the four numbers a template
	 *  reads together. */
	let win = $state.raw({ start: 0, end: 0, padTop: 0, padBottom: 0 });

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
			if (win.start !== 0 || win.end !== n || win.padTop !== 0 || win.padBottom !== 0) {
				win = { start: 0, end: n, padTop: 0, padBottom: 0 };
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
		let padTop = y;
		for (let j = i - 1; j >= start; j -= 1) padTop -= heightOf(j);

		let end = i;
		let bottom = y;
		while (end < n && bottom < top + view) {
			bottom += heightOf(end);
			end += 1;
		}
		end = Math.min(n, end + overscan);

		let padBottom = 0;
		for (let j = end; j < n; j += 1) padBottom += heightOf(j);

		if (
			start !== win.start ||
			end !== win.end ||
			Math.abs(padTop - win.padTop) > 1 ||
			Math.abs(padBottom - win.padBottom) > 1
		) {
			win = { start, end, padTop: Math.max(0, padTop), padBottom: Math.max(0, padBottom) };
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
		get padTop() {
			return win.padTop;
		},
		get padBottom() {
			return win.padBottom;
		},
		get active() {
			observe();
			return win.end - win.start < lastCount;
		},
		container(node: HTMLElement) {
			box = node;
			const onScroll = () => schedule();
			node.addEventListener('scroll', onScroll, { passive: true });
			const ro = new ResizeObserver(() => schedule());
			ro.observe(node);
			schedule();
			return () => {
				node.removeEventListener('scroll', onScroll);
				ro.disconnect();
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
