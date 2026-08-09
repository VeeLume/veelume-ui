# @veelume/ui

A Svelte 5 UI kit distilled from four apps (stibu, connect-neo, Hearth, Starlume) so the next
app starts from solved problems. **Opinionated by default, escapable by design.**

This file is the **rulebook** — what must hold. The *why*, the evidence behind each decision,
and the running casebook live in the vault note `Programmieren/Projects/veelume-ui.md`. If a
rule here looks arbitrary, the reason is there; don't relitigate it from scratch.

---

## What exists

| Module | Layer | What it is |
|---|---|---|
| `context/` | L1 | Label bag + **two locales** (message, formatting) + memoised `Intl` + derived `hourCycle`. No runes — reactivity comes from the app's getters. |
| `collection/` | L1 | Scoped cache, keyset accumulation, optional write layer. `.svelte.ts`. |
| `collection/http` | L1 | The HTTP + SSE transport: `createHttpIO`, `sseInvalidation` (reconnect discipline), `classifyHttpError`. Plain `.ts`. |
| `window/` | L1 | Viewport windowing — spacer + `translateY`, neutral below its threshold. `.svelte.ts`. |
| `browse/` | L1 | URL-backed query/facets/sort. Canonical encoding, history split. |
| `surface/` | L1+L2 | `pipeline.svelte.ts` (derive → search → filter → sort → counts) and `Surface.Root/.List/.ListHeader/.FilterButton/.Split/.Toolbar`. |
| `form/` | L1+L2 | `createRecordForm` (draft/dirty/submit), `RecordForm`, `NumberInput`, `DateInput`/`TimeInput` (bits-ui DateField/TimeField with the formatting locale + `hourCycle` INJECTED from context — bits defaults to en-US, and an omitted prop is the connect-neo bug; value boundary is ISO strings), `Switch` (stateless, reports the requested next value — the Hearth/Starlume contract), `Segmented` (options are `SelectOption`, so segmented↔select is a data edit), locale-aware number parsing. A `boolean` field renders as a row: label beside the switch, never a floating knob. |
| `actions/` | L2 | `Actions` (the three tiers), `ActionMenu`, `Button`, `Bar` (the shared 56px geometry), `DetailHeader`. |
| `badge/` | L2 | `StatusBadge` + `resolveStatus`: one pill, four tones (`primary/neutral/warning/destructive` — the full set found across the fleet), per-domain status→(label, tone) maps with labels as functions. `Row.badge` takes the resolved form. |
| `dialog/` | L2 | `Dialog`, the MODAL overlay species (Popup is the anchored, light-dismiss one): centred, inert background, focus trap — bits-ui underneath (the ActionMenu argument; every stibu picker hand-rolled this shell and none got a trap), stibu's panel geometry on top. `ConfirmDialog` rides it: bag-default labels, per-call overrides are app content, Cancel first so the trap's initial stop is the safe choice, and the CALLER closes on confirm — confirming may fail, and a dialog that auto-closed has nowhere to show it. |
| `picker/` | L2 | stibu's five pickers as one pair against the four named axes: `items` is a reactive prop (store vs list is invisible), `multiple` (onpick always delivers an array — single = one immediately, multi = selection on confirm, surviving searches), `row` snippet, and inline-vs-dialog as a SPLIT — `Picker` is the embeddable search+list, `PickerDialog` only wraps it in the modal, so the modes cannot drift. Dialog close unmounts → reopening starts clean (stibu reset by hand). |
| `stored/` | L1 | `storedValue(key, initial, validate?)` — a reactive value backed by localStorage with a VALIDATING loader (Hearth's prefs pattern; the demo's appearance store rides it). Rejected reads fall back to `initial` silently; persists as JSON, offers non-JSON reads to the validator raw so donor-era bare strings migrate on first load. |
| `loading/` | L2 | `Loading`, the labelled spinner for boot screens and pane-sized placeholders (Hearth's, minus its domain). A loading LIST uses `Surface.List`'s own states instead. |
| `popup/` | L2 | `Popup`, the anchored-panel base — extracted once FilterButton and Notify.Center disagreed about dismissal. Owns the semantics (outside click via a catcher, Escape, focus return only when close stranded focus on `<body>`); the consumer owns the `relative` wrapper, width and content. `position` REPLACES the default anchor classes (two `top-*` utilities resolve by stylesheet order). Flip/shift + portalling is the planned upgrade inside it, changing no consumer API. |
| `notify/` | L1+L2 | The notification funnel (Hearth's design + Starlume's deltas). ONE store: `notify()` for in-app code, `ingest()` for adapters (keyed dedupe; `toast: false` for hydrated backlog — a suspended webview runs no JS, so catch-up entries badge but never toast). Sticky-by-level (info/success fade, warning/error persist), bounded at 100, session-only — durable history and native-toast fallback are backend concerns. Surfaces compose independently: `Notify.Toasts` (once, root layout), `Notify.Bell` (unread count; `onclick` is the whole contract), `Notify.Center` (anchored panel, marks read on open, position classes REPLACE the default — merged `top-*` utilities resolve by stylesheet order), `Notify.List` (the Center's rows, embeddable — the Picker/PickerDialog split; a page host is the bar-width answer, mark-read policy stays the host's). |
| `shell/` | L3 | `Shell.Root/.Rail/.Content/.BottomBar` (parts on the Surface contract), `Shell.SettingsFooter`/`.AccountFooter` (default rail footers, without/with an account concept), `AppShell` (the default arrangement), `NavRail`, `BottomNav`, `breakpoints`. |
| `settings/` | L2+L3 | The stibu-shaped settings scaffold: `Settings.Root` (three-state responsive list-detail), `.List`, `.Page` (`DetailHeader` + content column), `.Section` (title optional — untitled it supplies only the rule and rhythm around Rows), `.Row` (label+hint left, control trailing; adapts by CONTENT via flex-wrap against the label's min width — inline while the control fits, wrapped below it when not, so a Switch stays inline on a phone where a wide Segmented drops. No prop, no breakpoint), `.Placeholder`. Categories are data (`SettingsCategory[]`); adding a setting is one entry plus one small routed page. |

Everything is exercised by a real surface in `apps/demo` — Catalog (derive +
overlay), Loans (scoped, four closers), Preferences (solo record), and
`/gallery` for every component state.

## Layers

Every piece belongs to exactly one, decided by: **is there one right answer?**

| | Contains | Distribution | Drift |
|---|---|---|---|
| **L1** | logic, **no markup** — caches, state machines, derivations | versioned | must not drift; central fix reaches everyone |
| **L2** | compound components; every part overridable via `Snippet` | versioned | must not drift |
| **L3** | default arrangements of L2 parts + theme | versioned | divergence is legitimate, and it happens by **recomposition**: the app writes its own arrangement *in the app* from kit parts, which keep updating centrally. Never copy-in. |

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

#### Two transports, named by shape (the five-design casebook is `collection/DESIGN.md` — read it before changing `index.svelte.ts`)

The kit is designed for exactly two: **Tauri IPC** and **HTTP + SSE**. The backend's
*language* sits below that line and is an app choice (Axum, Litestar, …) — naming the axis by
shape is what stops it multiplying. `CollectionIO` is the whole abstraction; both implement the
same four functions and nothing above the adapter can tell them apart.

What differs is physics, not shape: round trips cost 20–300ms instead of ~1–13ms, sessions
expire, concurrent writers are normal, and **events are lossy**.

- **⚑ An adapter over a lossy channel MUST call `onChange()` with no argument on every
  reconnect.** A dropped connection means missed events, so a silent reconnect leaves the cache
  stale with no way to know it is. No new API: every `ChangeInfo` field is optional, so an
  argument-less call already means "something changed, I cannot say what" and reloads every
  declaration.
- **`pageSize` and `cap` are transport-scaled.** 500/10k were measured over free transport;
  over HTTP start at ~1000 pages and expect the push-down regime to pay off below 10k.
  Re-measure rather than assuming the desktop numbers transfer.

#### The envelope

- **`cap` is a fetch and memory budget, not a render budget.** Windowing removed the rendering
  cost, so the cap now bounds only how deep a fill reads and how fast the cache grows. Default
  10k; apps tune per query via `SetQuery.cap`.
- **Two regimes, and the collection picks — never the consumer.** A query carrying `search`
  resolves against its base (same declaration, search stripped): base `exhausted` + `matches`
  supplied → answered locally by narrowing the base's rows, no set minted, no fetch, exact
  `total`. Base `capped` → the search pushes down into the set key. Consumers pass `search`
  either way and cannot get the routing wrong.
- **Maintenance is tied to observation.** Live sets are dropped when their last reactive reader
  leaves (`createSubscriber`), after a **grace period** — the subscriber count transiently
  crosses zero during re-renders, and dropping on that crossing splits the brain (the template
  renders instance A while a recreated B takes its place in the map).
- **⚑ Reactive signals must OUTLIVE the instances they describe.** A per-instance signal dies
  with its instance, so every derived that captured it is permanently disconnected when the
  lifecycle recreates the set — bumps land on the new instance, old dependents never wake,
  nobody re-reads, so the new instance is never observed either. Silent, total deadlock with no
  error. This is what makes forget-and-recreate safe at all.
- **A fill halts when its set stops being read** (a `lastRead` stamp per set, checked between
  pages) and self-resumes if a read arrives right after the halt. Superseded fills otherwise run
  to completion behind the current one and thrash the backend's per-query state.
- **Deletion has three tiers**, in order of what is known: we did it (`discard`) · the event
  carries keys (`ChangeInfo.kind: 'delete'`) · neither, in which case the fill must reconcile
  the key interval it covered. Absence is only meaningful inside a range the server enumerated.

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
  from context. Omitting `<Surface.Toolbar>` is not merely supported, it is the
  default; moving it below the list is not supported at all.
- **The shell follows the same contract.** `Shell.Root` owns the frame decisions (rail vs
  bottom bar, labels, safe-area) in context; parts read them, and an app's custom part reads
  `getShellContext()` and stays in sync with the frame for free. **There is no `strategy`
  flag on the parts**: mounting `Shell.BottomBar` is what makes the rail yield the narrow
  widths, so rail-only is the *omission* of a part — a mode flag would be a second fact that
  could disagree with what is rendered. `AppShell` is the default arrangement (its `strategy`
  prop gates the *mount*); an app with a frame opinion composes the parts itself, like
  apps/demo's root layout does.
- **The bottom bar's default is stibu's arrangement**: the hero (start) item dead centre, and
  when the nav overflows the slot count (five, the thumb rule) the outer-right slot becomes a
  **More collector** — a link to a ROUTE (`moreHref`, default `/more`; compose `Shell.MoreList`
  there), never a popup. The collector `owns` every path it collected (plus `moreOwns`, for
  destinations only reachable from that page, like settings), so it stays lit inside them —
  `NavItem.owns` is the general hub mechanism, stibu's Finanzen case. `splitBottomNav` is pure
  and shared: the bar and the More page run the SAME computation and cannot disagree about what
  overflowed. Escapes, in order: `hero`/`slots`/`moreHref`/`moreOwns` tune it; explicit `items`
  replaces it. `NavItem.badge` is a reactive count getter rendered by `BottomNav` and
  `MoreList` (`moreBadge` feeds the collector's): at bar widths the rail's bell is gone, so the
  More slot carries the unread count and the More page carries the entry to the notifications
  route — the app supplies the count source, the shell has no data opinion.
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

### L2 — actions and bars

- **The invariant is POSITION.** The one forward action sits top-right on every
  surface. Tiers are **data, not snippets**, so no screen can invent its own
  arrangement: `① primary` (filled, at most one) → `② secondary` (outline) →
  `③ overflow` (`⋮`, rare/destructive, rendered only when non-empty), left to
  right in a right-aligned cluster.
- **⚑ Three owners of chrome, and the control's owner decides its bar.** This is
  the placement test — apply it per control, not per screen:

  | Owner | Examples | Bar |
  |---|---|---|
  | the **list** | search, filters, sort, "New …" | `Surface.ListHeader` — *inside* `Surface.List` |
  | the **record** | back, title, save, overflow | `DetailHeader` — inside the detail pane |
  | the **surface** (neither pane) | scope switcher, list↔table, import/export | `Surface.Toolbar` |

  **The default is two bars, not three.** Most surfaces have an empty third
  bucket, omit `Surface.Toolbar`, and spend the 56px on rows. A toolbar is an
  escalation you can justify control-by-control, never a frame you start from.
  A "New …" is *not* surface chrome — it creates a row, so it is the list's.
- **Search and filters live inside the list, and the containment is the design.**
  A page-level bar produced three defects at once: the controls sat at the page's
  left edge while the list they filtered started further in; they survived into
  the detail view on a narrow screen; and the bar needed a title to justify its
  width, duplicating the nav rail's label. A child of the list is aligned with
  it, hidden with it, and has no page to name — none of the three is reachable.
- **`Surface.Toolbar` has no `title`.** The nav rail already names the surface.
- **All three bars are `<Bar>`** — one class string, so 56px / `px-3` / 36px
  controls cannot disagree between a list and a record. This was three copies
  held together by a comment and it drifted by 13px; a comment is not an
  enforcement mechanism.
- **`DetailHeader`'s leading slot is always occupied** — back button, or an empty
  36px spacer. Removing the spacer is the obvious simplification that
  reintroduces the title jump.
- **`Button` sizes encode the density rule**: `field` follows
  `--density-target`, `chrome` is a fixed 36px.
- **A collapsing label needs an icon.** Hiding the text below a breakpoint so a
  neighbour keeps its width renders an *empty button* when the action has no
  icon. Collapse conditionally, never unconditionally.

### L2 — what renders is declared by the descriptor

Chrome is not switched on by flags on the component; it follows from what the
surface says it can do. `searchIn` present → a search field. Facets or sorts →
a filter button. An `action` → a button. **None of them → `ListHeader` does not
render at all and the list keeps the 56px.** "Avoid a bar unless it earns its
space" is therefore a mechanism, not a rule someone has to remember.

Same principle for the count strip: it appears **only while narrowing**. Against
an unfiltered list "34 results" restates the list and costs vertical space on
every surface forever; against a narrowed one it answers the question just asked.
Its trailing slot carries **Load more** (only when the source reports more) —
reset lives in the filter panel, while a narrowed count over a truncated set is
exactly where "there may be more matches than these" needs its remedy beside it.

And again for the **"as of" band**: `updatedAt` renders at the bottom of the list
only once the data is older than `staleAfter`. Three rules hold it in place:

- **It is "as of", never a warning.** Old is not stale — a set nobody has changed
  in an hour is an hour old and perfectly correct. Wording that implies fault
  ("out of date", "connection lost") claims knowledge the client does not have.
- **The threshold is the design.** "Updated 2 seconds ago" is chrome that says
  nothing, and an indicator that fires constantly is one people learn to
  ignore — the same "conservative guards fire constantly" lesson the collection
  learned the expensive way.
- **Bottom, and paired with a remedy.** Ambient status goes below; the top is for
  things you reach for. A band that states an age and offers no action is just
  anxiety, so the refresh button renders only when the consumer supplies
  `onrefresh`.

`selected` lives on `Surface.Root`, not on three parts. Which pane a narrow
screen shows, which row the list highlights, and whether the toolbar steps aside
are one fact — passing it three times is three chances to disagree.

## Gotchas that cost real time

Each of these type-checks clean and fails at runtime, or fails silently:

- **⚑ Never read a collection view inside an `$effect` without `untrack`.**
  `view.all` / `.status` / `.complete` lazily call `ensure()`, which writes the
  set — so the effect re-triggers itself through the write it caused, and the
  page freezes with `effect_update_depth_exceeded`. It looks like reading a
  property and it type-checks. Safe in templates, where the read is a render
  dependency; a landmine in effects. Pair `untrack()` with a **plain-variable**
  guard (`if (n === last) return`) so a re-run on an unchanged value does not
  re-plan — and never make that guard `$state`, or it becomes the same bug.
- **Runes need `.svelte.ts`.** `$state` in a plain `.ts` passes `svelte-check`
  and throws `rune_outside_svelte` when it runs. No static check catches it.
- **The consumer must tell Tailwind about this package.** It arrives through a
  symlink under `node_modules`, which Tailwind v4's auto-detection skips, so
  kit-only classes silently vanish from the stylesheet and layouts break in ways
  that look like bad flex rules. Consumers need
  `@source "…/packages/ui/src"`. The tell: kit components HMR via `/@fs/` paths.
- **Icon props need the `IconOf` cast in markup.** `NavIcon`/`ActionIcon` are a
  union so both Svelte component eras work; a union is not constructable in a
  template. Do not cast to `never`.
- **Verify against the artefact that fails.** A production build and the dev
  server scan sources differently — checking the wrong one "disproved" a correct
  fix once.
- **⚑ A lazy read path must not write a PRE-EXISTING signal synchronously.**
  Derive-on-first-read runs inside the consumer's `$derived`, and Svelte only
  permits writing state *created during* that evaluation — which is the sole
  reason a per-instance counter ever worked there. Any signal that outlives the
  evaluation (as it must, see collections above) turns the same write into
  `state_unsafe_mutation`. Do the work, defer the bump to a task.
- **`requestAnimationFrame` is for ALIGNMENT, never for progress.** A hidden
  document never fires it — and neither does a visible-but-not-compositing one,
  where `document.hidden` is still `false`. Anything that must make progress
  races a `setTimeout` alongside it.
- **A windowed list must not relayout on scroll.** Pads (`padding-top`) rewritten
  per window move relayout the whole list, and the browser's scrollbar-drag
  mapping recalibrates against it — the thumb visibly drifts from the mouse. Use
  a spacer whose height changes only with *measurements* plus `translateY` rows,
  and `overflow-anchor: none` on the container.
- **When a bisect reaches "identical code, different behaviour", stop bisecting
  code.** A partial Vite dependency pre-bundle (from a killed dev server) serves
  two Svelte runtime copies, which breaks every `getContext` lookup and mimics an
  app-level regression perfectly — a commit verified working still failed. The
  tell is kit labels falling back to English. Purge `.vite` and `.svelte-kit`,
  reinstall, re-test before believing anything.

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

- **User-visible pages.** The collection *does* page the wire (accumulation, keyset), but the
  client never exposes pages: no page numbers, no next/prev, no "page 3 of 40". Below the
  envelope the set is held whole; above it the answer is to narrow the query, not to paginate
  through it. Partitioning is *scope* — units the user already thinks in (year, channel,
  account), never pages they do not.
- **A shadcn-svelte dependency.** Copy-in has no version; a library cannot depend on it. Build
  on bits-ui directly. Token *names* still follow the shadcn convention deliberately.
- **In-memory browse state.** See above — it forecloses back/forward.
- **A hand-rolled date picker.** bits-ui + `@internationalized/date` already handle locale,
  `hourCycle` and granularity.

## Conventions

- Ships **source**, no build step, while workspace-linked. `exports` points at `src/index.ts`.
- Svelte 5 runes throughout. `.svelte.ts` for rune-bearing modules.
- Nothing enters `src/index.ts` until it has a consumer in `apps/demo`.
