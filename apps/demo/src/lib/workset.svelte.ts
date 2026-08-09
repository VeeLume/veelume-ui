/**
 * The catalog's working set — the kit's state machine, the app's INSTANCE.
 *
 * Module scope is the app's half of the workbench contract: pins are
 * workspace state that must survive navigation, and only the app knows one
 * catalog surface exists to share it. The machinery lives in the kit
 * (`createWorkset`); what stayed here is exactly what should — a lifetime
 * decision.
 */
import { createWorkset } from '@veelume/ui';

export const catalogWorkset = createWorkset();
