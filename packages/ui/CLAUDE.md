# @veelume/ui

A Svelte 5 UI kit distilled from four apps (stibu, connect-neo, Hearth, Starlume) so the next
app starts from solved problems. **Opinionated by default, escapable by design.**

This file is the **rulebook** — what must hold. The *why*, the evidence behind each decision,
and the running casebook live in the vault note `Programmieren/Projects/veelume-ui.md`. If a
rule here looks arbitrary, the reason is there; don't relitigate it from scratch.

---

## Layers

Every piece belongs to exactly one, decided by: **is there one right answer?**

| | Contains | Distribution | Drift |
|---|---|---|---|
| **L1** | logic, **no markup** — caches, state machines, derivations | versioned | must not drift; central fix reaches everyone |
| **L2** | compound components; every part overridable via `Snippet` | versioned | must not drift |
| **L3** | opinionated arrangements + theme | copy-in | drift is the *feature* |

L1 cannot constrain the UI because it has no opinion about the DOM. That is what makes the
split work: **the part with the most value has the least surface area.**

## The cage rules

1. **Design from named variation, not instance count.** A generic design does not need a second
   app; it needs the axis of variation to be *nameable* — what would differ between two uses,
   and does the design absorb it without a flag? Can't name it → you are generalising instance
   #1's accidents. **Designing is cheap; *freezing* an API others depend on is not — commit at
   the version bump, not at the design.**
2. **Forking is supported, not a failure.** An app that outgrows an L2 component copies it in and
   stops importing it, while keeping the L1 dependency. The expensive part was never the markup.
3. **No prop for a one-app need.** The answer is a snippet override or a fork — never
   `variant="someapp"`, never a fourth boolean. Every such prop taxes every consumer forever,
   and they compound into exactly the rigid-system-plus-workarounds this kit exists to avoid.
4. **Pin by tag, break freely.** Every consumer is ours. A breaking change is a coordinated bump,
   not an ecosystem event — do not contort an API to preserve compatibility nobody is owed.

## Coupling contract

A kit component may depend on:

- **design tokens** — freely
- **props / snippets** — freely
- **injected context** — deliberately (labels, locales, appearance prefs)

**Never a direct app-store import.** This one rule is the whole difference between a portable
component and connect-neo's `CollectionSurface`, which was excellent and unportable because it
reached for `session.soleMarket`, `entryFor(navId)`, `appearance.listCollapsed`, a German URL
param and five hardcoded German strings.

Corollary: **no hardcoded user-facing strings anywhere in this package.**

---

## Architecture — the decided parts

### The pipeline

Every list surface, both archetypes, is the same five steps:

```
scoped cache → derive rows → search/filter/sort → window → render
```

**⚑ `derive` runs BEFORE `filter`, always.** A catalog filters on properties that only exist
*after* derivation joins an overlay (Hearth filters on `owned`, which no raw record carries).
A 1:1 CRUD surface cannot tell the difference — which is exactly why the order must be pinned
deliberately rather than discovered.

### L1 — collections

- **Scope is a reactive input** (`scope?: () => S`), never an argument. Call sites stay clean;
  unscoped collections omit it and get a constant key. Compound scopes supply `scopeKey`.
- **Entries are keyed by scope**, so switching scope needs no reset — the old entry stays warm.
- **Reads are pull-based getters** that read `scope()` inside the getter, so Svelte tracks it.
  **No `$effect`** — a module-level store has no effect owner and would need `$effect.root()`
  plus manual teardown.
- **Inflight dedupe lives in a plain `Map`; data lives in `$state`.** That split is what makes
  touching dedupe bookkeeping during render legal.
- **Lazy `ensure()` on read, plus an imperative `prefetch()`** — the same function, two callers,
  so a prefetch and a page mount share one request.
- **`at(scope)` is the escape hatch** for cross-scope reads; the ambient accessors *are*
  `at(scope())`.
- **Eviction is explicit.** No LRU, no TTL.
- **Status is a discriminated union**, not booleans:
  `idle | loading | refreshing | ready | error`. `refreshing` is non-negotiable — it is the
  stale-while-revalidate state, and boolean flags collapse it into `ready`.
- **Writes are optional** on the same primitive. Not every collection writes; bolting writes on
  from outside would be the wrong default.
- **Errors are a typed union**, never a string: at minimum `offline`, `blocked-by-policy`
  (refused by an app policy gate ≠ network failure), `auth-expired`, `validation` (carrying
  *field-level* detail), `write-diverged`, `unknown`. Adapters normalise via an optional
  `classifyError`.
- **Read errors and write errors are different channels.** A failed `save()` does not mean the
  cache is broken — read failures land in the entry's status, write failures throw.
- **The server is authoritative.** The cache never claims its copy wins; divergence is
  *surfaced*. The store diffs requested-vs-returned and raises `write-diverged` — no backend
  cooperation required.
- **Invalidation policy is defer-until-writes-settle**, collapsed to one reload. A naive
  reload-on-every-event starts a fetch before the write commits and can serve pre-write state.
  Invalidation must be idempotent under event storms (one write can emit several events).

### L1 — browse state

- **URL-backed. Never in-memory.** In-memory state can never be restored by `history.back()`;
  that is structural. Back must mean *the state I was just in*, never *one level up*.
- **History discipline is baked in so a consumer cannot get it wrong:**

  | Change | History entry |
  |---|---|
  | selection (open a record) | yes — route, or a param for catalogs |
  | list ↔ table mode, filters, sort | yes — `pushState` |
  | search typing | **no** — `replaceState` |
  | **expansion** (open a row) | **no** — page-local; transient exploration |
  | sidebar collapsed, theme, density | no — preferences, not navigation |

- **Facets encode as repeated params, canonically ordered**: sort values within a param, sort
  params by name, **omit defaults**. Without canonical form the same filter set yields different
  strings and back/forward fills with false entries.

### L2/L3 — components

- **Composable by omission, never rearrangement.** `<Surface.Root>` owns state, parts read it
  from context. Omitting `<Surface.Toolbar>` is supported; moving it below the list is not.
- **Absence must be neutral.** Root's defaults are "no filter, no sort override, no mode", so a
  missing part means nothing is applied — never a filter active with no UI to reach it.
- **i18n via a context label bag** with English defaults. Paraglide is app-level and
  structurally unavailable to a library (`$lib/paraglide/messages` is generated *inside the
  consumer*); shipping our own inlang project would mean two catalogs desyncing on every switch.
- **Two locales in context, not one:** *message locale* (language of text) and *formatting
  locale* (numbers, dates, 24h vs 12h, decimal separator, week start). They are independent —
  an English UI with German formatting must be expressible.
- **The kit owns date/time/number inputs.** Native `<input type="time">` follows the *browser's*
  locale, not the document's, and nothing overrides it — that is unfixable in a browser app.
  Wrap bits-ui's `DateField`/`DatePicker` and inject the formatting locale, because **bits-ui
  defaults to `en-US`** and an omitted prop silently reproduces the bug. A number input is
  hand-rolled (bits-ui has none) via `Intl.NumberFormat`.
- **Density scales form fields; chrome stays fixed.** At comfortable density a full-height
  search input fills a toolbar edge-to-edge while its neighbours sit inset.
- **Theming: the kit ships the mechanism, the app ships the values.** Token *names* are the
  contract; palettes are not. Support is mandatory, exposing a toggle is not.

---

## Vocabulary

- **Record** — an item as the backend returns it. **Row** — an item as the list renders it.
  Not necessarily 1:1.
- **Derivation** — the `records → rows` step. **Overlay** — a second dataset joined during
  derivation (personal state decorating shared reference data).
- **Leaf** — a row with nothing to expand into. **Bundle** — a row standing for several
  collapsed members.
- **Windowing** — rendering a slice of a fully-loaded list. **Fetch paging** — the server
  sending a slice. Not the same thing; see below.
- **Surface** — a concrete screen. **Shell** — a layout wrapper with no data opinion.
  **Part** — a named piece of a compound component.

## Deliberately not built

Adding any of these is a design decision, not an oversight:

- **Fetch paging.** Client-side filtering and contextual counts require the whole set. The
  partitioning strategy is *scope* — partition into units the user already thinks in (year,
  channel, account), not into pages they do not.
- **A shadcn-svelte dependency.** Copy-in has no version; a library cannot depend on it. Build
  on bits-ui directly. Token *names* still follow the shadcn convention deliberately.
- **In-memory browse state.** See above — it forecloses back/forward.
- **A hand-rolled date picker.** bits-ui + `@internationalized/date` already handle locale,
  `hourCycle` and granularity.

## Conventions

- Ships **source**, no build step, while workspace-linked. `exports` points at `src/index.ts`.
- Svelte 5 runes throughout. `.svelte.ts` for rune-bearing modules.
- Nothing enters `src/index.ts` until it has a consumer in `apps/demo`.
