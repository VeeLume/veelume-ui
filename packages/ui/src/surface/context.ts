/**
 * Surface context — how `<Surface.List>` gets its rows without twelve props.
 *
 * This is what makes omission cheap: parts read shared state from Root rather
 * than being wired to each other, so leaving one out changes nothing for the
 * rest.
 */

import { getContext, setContext } from 'svelte';
import type { Row } from './types.js';
import type { Surface } from './pipeline.svelte.js';

const SURFACE = Symbol('veelume-ui:surface');

// The parts are generic over the concrete row type, but context cannot be —
// each part re-narrows on use. Contained to this file on purpose.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function setSurfaceContext(surface: Surface<any, any>): void {
	setContext(SURFACE, surface);
}

export function getSurfaceContext<R extends Row = Row>(): Surface<any, R> {
	const ctx = getContext<Surface<any, R> | undefined>(SURFACE);
	if (!ctx) {
		throw new Error(
			'veelume-ui: a Surface part was used outside <Surface.Root>. Parts read their state from Root via context.'
		);
	}
	return ctx;
}
