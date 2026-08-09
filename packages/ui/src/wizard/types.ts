/**
 * Wizard types.
 *
 * A step is DATA carrying a snippet — the same shape the settings categories
 * and the action tiers use, and for the same reason: the frame decides the
 * arrangement, the app decides the content.
 */

import type { Snippet } from 'svelte';

export type WizardStep = {
	/** Stable identity. Also the keyed `{#each}` key, so a reactive step list
	 *  can grow and shrink without remounting its neighbours. */
	id: string;
	title: string;
	/** A provenance chip beside the title — Starlume names the contributing
	 *  module here, so a step spliced in from a registry says where it came
	 *  from. Omit for the app's own steps. */
	tag?: string;
	/**
	 * Gate the forward action. Omit and the step is always passable, which is
	 * the safer default for a flow whose whole job is to be finishable.
	 *
	 * ⚑ A GETTER, not an imperative `setCanContinue(ok)` handed to the step.
	 * Starlume's steps are components that call such an API from an effect;
	 * snippet steps have no effect scope of their own, so the imperative form
	 * would have to be called during the consumer's render — writing a signal
	 * that outlives that evaluation, i.e. `state_unsafe_mutation`, the exact
	 * landmine in this kit's own gotcha list. Read declaratively there is no
	 * write at all, and reactivity comes free from the app's own state.
	 */
	canContinue?: () => boolean;
	step: Snippet;
};
