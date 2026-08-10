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
| `surface/` | L1+L2 | `pipeline.svelte.ts` (derive → search → filter → sort → group → counts) and `Surface.Root/.List/.ListHeader/.FilterButton/.Split/.Toolbar`, plus the workbench chrome `Surface.Tab/.Pane/.PaneBody/.Panes`. Plus the WORKBENCH: `createWorkset` (L1 — the preview/pin tab state machine) and `Surface.TabStrip` (L2 — the strip, owning the URL→workset sync). |
| `form/` | L1+L2 | `createRecordForm` (draft/dirty/submit), `RecordForm`, `NumberInput`, `DateInput`/`TimeInput` (bits-ui DateField/TimeField with the formatting locale + `hourCycle` INJECTED from context — bits defaults to en-US, and an omitted prop is the connect-neo bug; value boundary is ISO strings), `Switch` (stateless, reports the requested next value — the Hearth/Starlume contract), `Segmented` (options are `SelectOption`, so segmented↔select is a data edit), locale-aware number parsing. A `boolean` field renders as a row: label beside the switch, never a floating knob. |
| `actions/` | L2 | `Actions` (the three tiers), `ActionMenu`, `Button`, `Bar` (the shared 56px geometry), `DetailHeader`. |
| `badge/` | L2 | `StatusBadge` + `resolveStatus`: one pill, four tones (`primary/neutral/warning/destructive` — the full set found across the fleet), per-domain status→(label, tone) maps with labels as functions. `Row.badge` takes the resolved form. |
| `dialog/` | L2 | `Dialog`, the MODAL overlay species (Popup is the anchored, light-dismiss one): centred, inert background, focus trap — bits-ui underneath (the ActionMenu argument; every stibu picker hand-rolled this shell and none got a trap), stibu's panel geometry on top. `ConfirmDialog` rides it: bag-default labels, per-call overrides are app content, Cancel first so the trap's initial stop is the safe choice, and the CALLER closes on confirm — confirming may fail, and a dialog that auto-closed has nowhere to show it. |
| `picker/` | L2 | stibu's five pickers as one pair against the four named axes: `items` is a reactive prop (store vs list is invisible), `multiple` (onpick always delivers an array — single = one immediately, multi = selection on confirm, surviving searches), `row` snippet, and inline-vs-dialog as a SPLIT — `Picker` is the embeddable search+list, `PickerDialog` only wraps it in the modal, so the modes cannot drift. Dialog close unmounts → reopening starts clean (stibu reset by hand). |
| `stored/` | L1 | `storedValue(key, initial, validate?)` — a reactive value backed by localStorage with a VALIDATING loader (Hearth's prefs pattern; the demo's appearance store rides it). Rejected reads fall back to `initial` silently; persists as JSON, offers non-JSON reads to the validator raw so donor-era bare strings migrate on first load. |
| `loading/` | L2 | `Loading`, the labelled spinner for boot screens and pane-sized placeholders (Hearth's, minus its domain). A loading LIST uses `Surface.List`'s own states instead. |
| `popup/` | L2 | `Popup`, the anchored-panel base — extracted once FilterButton and Notify.Center disagreed about dismissal. Owns the semantics (outside click via a catcher, Escape, focus return only when close stranded focus on `<body>`) AND the placement: `side`/`align` name the INTENT, floating-ui measures at open — flip when the preferred side would overflow, shift to stay inside the clipping ancestors (the class-string era's clipped-panel bug is structurally gone). Anchor = the consumer's `relative` wrapper (the panel's offsetParent), tracked via `autoUpdate`; the panel is invisible until the first position lands. Portalling to `<body>` is the remaining upgrade — it adds z-stacking/teleport concerns flip/shift do not, and waits for a consumer that needs it. |
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

Every list surface, both archetypes, is the same steps:

```
scoped cache → derive rows → search/filter/sort → group → window → render
```

**⚑ `derive` runs BEFORE `filter`, always.** A catalog filters on properties that only exist
*after* derivation joins an overlay (Hearth filters on `owned`, which no raw record carries).
A 1:1 CRUD surface cannot tell the difference — which is exactly why the order must be pinned
deliberately rather than discovered.

**Grouping is SECTIONS, not bundles.** `groupBy?: GroupDef[]` (levels, outermost first)
partitions the flat sorted rows under headers — presentation only. N records collapsing into
one row with members is a *bundle* and belongs to `derive` (Hearth's mission chains are
bundles; its catalog taxonomy is sections). The rules, each load-bearing:

- **After sort**, so header counts describe the narrowed population and the default group
  order (first appearance) inherits the active sort. A taxonomy with its own order supplies
  `compare` on the level.
- **Empty groups do not exist** — sections are emitted from actual rows, so narrowing removes
  headers with their rows and filter-to-nothing shows the empty state, never a header
  skeleton. Absence stays neutral.
- **Headers are not rows**: never selectable or expandable, skipped by `onselect`, not
  counted by the count strip. The default renders label · visible count; the `group` snippet
  on `Surface.List` replaces it (aggregates read the entry's `rows`).
- **⚑ A hidden document never runs `requestAnimationFrame`.** Anything that has to converge —
  `win.scrollTo`'s passes, `Expand`'s viewport anchor, the window's own `schedule()` — must
  pair rAF with a `setTimeout`, guarded to run once. This is not a headless-harness quirk: it
  is the suspended-tray webview `wakeInvalidation` exists for, so an rAF-only loop silently
  never converges wherever the app is off screen.
- **⚑ Hierarchy is typography PLUS one-directional indentation.** Each header sits at its
  level's edge; **every row indents one step past the deepest level**, so content is always
  right of its label and the nesting cannot read backwards. The row inset is a per-surface
  CONSTANT (`groupDepth`) — legal because sections are uniform depth, which a tree could
  never claim; per-row indent belongs to Expand. Typography still separates the species
  (level 0 a small heading in the primary colour — Hearth's accent-heading move — deeper
  levels uppercase kickers), because indent alone cannot tell a label from a row title.
- **Toggleable grouping is the descriptor being `$derived` from app state** — no mode flag on
  any part.
- **The entry list is flat** (`ListEntry = R | GroupHeader`, branded by a private symbol —
  rows are app-extended, so no property name could be reserved on them) because windowing
  needs one indexable list; ungrouped surfaces get `visible` back unchanged, so flat lists
  pay nothing. **⚑ Sticky headers are deliberately not offered**: `position: sticky` dies
  inside a `translateY`-positioned entry (the transform is the containing block) — a
  structural conflict with windowing, not an oversight.

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
- **⚑ Reconnect and WAKE are the same obligation.** A suspended webview (a tray app hidden to
  the notification area runs no JS) missed events just as surely as a dropped socket did — the
  channel slept instead of breaking. `wakeInvalidation(onChange, { focus?, every?, debounce? })`
  is `sseInvalidation`'s sibling for it: visibility + focus, debounced because one alt-tab
  fires several signals, and its optional poll runs **only while visible** — a hidden poll
  either cannot run or burns a resident app's idle footprint for nobody. Waking says *that*
  you missed something, never what, which the argument-less call already expresses.
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

### Compare — the third view of a working set

A Split shows two entities interactively; `Compare` shows N of them aligned and read-only.

- **Transposed** — attributes down as rows, entities across as columns. The other orientation
  returns the reader to eye-alignment as soon as there are more than a handful of attributes,
  which is exactly what two panes already fail at, so it would add nothing.
- **`better` is opt-in per attribute, and only the winner is marked.** The kit cannot know
  whether more pages is better; an attribute without a direction is rendered, never judged.
  Ties for best mark every tied cell; a value that is the SAME across all entities marks
  nothing, because "identical" is not a win. Strings never compete; `null` renders an em dash,
  since absent is not zero.
- **A compare view is a TAB, not a toggle** — activating any record must leave it, and in ONE
  navigation (`browse.setMany`). Two `set` calls make "record selected, compare still open" a
  real state the back button can land on. **And exactly one tab may read as active**: pass
  `TabStrip.selected={null}` while the detail region shows something that is not a record, or
  the record tab stays lit beside the compare tab and the strip lies about where you are. The
  record's selection stays in the URL untouched, so returning is one click.
- **Placement is the app's**, like `Wizard`'s host: a mode over the detail region, a synthetic
  tab, or a shareable `?compare=a,b,c` route. `entities` is a plain array, so the tab strip is
  the natural feed but not a wiring — which is what lets one record be compared across two
  snapshots, where no tabs exist.
- **Clicking an attribute sorts the COLUMNS by it** — best-first, then reversed, then back to
  the given order. The third state is the point: the entity order is the app's (usually tab
  order), so a sort you cannot undo would destroy it for the session. Missing values sink in
  both directions, because reversing must not promote a blank to a winner.
- Values go through the kit's formatter, so `format`/`scale` behave as everywhere else. ⚑ Pass
  `useGrouping: false` for years — a locale-aware formatter will otherwise render 1984 as
  `1.984`.

### Expand — the accordion row

Shallow in-place structure (variant leaves, chains, region expanders) and the deep-read case.
Its niche narrowed once the workbench existed: *working with several* is tabs, *a few sub-rows
of structure* is this.

- **One anatomy, filled by omission** — `gutter · caret · title (+ meta) … right · actions`.
  Complexity scales by which slots you fill, never by a `variant`. **No `expandable` prop**:
  supplying `children` IS what makes a row expandable (the donor carried both a boolean and
  the content, and the two could disagree). A row that is neither selectable nor expandable
  renders as a plain line, not a dead button.
- **Two gestures, split by omission**: `onselect` supplied → the body selects and the caret
  toggles (peeking must not disturb a working set); omitted → the whole row toggles.
- **`createExpansion(mode)` is page-local, never the URL** — selection is a state you were
  *in*, expansion is transient exploration; back must not walk your carets. `'many'` is the
  default (no hidden action, and only it can compare); `'one'` is the deep-read norm.
- **⚑ The toggled row keeps its viewport position.** Only single-open can move it — closing a
  row *above* pulls everything up and the row you clicked slides out from under the cursor.
  That jank is what makes an accordion feel worse than a detail pane, and it is an
  implementation defect, not a property of the pattern. Corrected twice (after `tick`, then
  after a frame, because a windowed list re-lays out on rAF). Above the windowing threshold a
  row may not be in the DOM at all — that is `win.scrollTo(index)`'s job.
- **Per-row `indent`**, unlike a grouped list's uniform depth: a leaf sits under its parent and
  its sibling may not, so only the row knows.
- **`Expand.Cols` uses a CONTAINER query.** The donor keyed a two-column body on a 1100px
  viewport, which is wrong the moment the list sits in a split — the pane can be narrow on a
  wide screen. What decides is the box the expansion is in.
- `Expand.Facts` takes DATA, not snippets, for the same reason `Row.badge` does: an expansion
  may hold twenty pairs inside a list rendering hundreds of rows.

### The workbench — a working set over a Split

Selection grows a CURATED SET: list + tab strip + pane(s). Settled in the demo catalog's
prototype before any of it froze here.

- **Two authorities, never merged.** ACTIVE is the consumer's, in the URL (a `one` browse
  field — push history, back means "the item I was on"). The TAB SET is a `createWorkset`
  instance at the app's module scope — workspace state like expansion: survives navigation,
  never history. `TabStrip` reads active from the surface context and never stores it.
- **Preview-vs-pinned is what stops tab garbage.** Click previews — ONE slot, replaced by
  the next click; a rapid SECOND activation of the same key pins (`workset.activate`).
  ⚑ **Not a `dblclick`**: the first click navigates, the re-render recreates the element the
  browser counts clicks on, and the pair never completes — it worked when scripted and failed
  under a real double-click, the exact shape of bug synthetic events hide. Timing state
  survives because it is state, not DOM, and Enter-twice now pins for keyboard users too. Closing returns the neighbour; the CONSUMER applies it
  to the URL (`onactivate`). A closed item can come back via `history.back()` — the strip's
  URL sync re-materialises it as a preview, deliberately.
- **The strip owns the URL→workset sync**, untracked with a plain-variable guard. ⚑ This is
  load-bearing, not style: `select()` reads workset state, so an unguarded sync effect
  tracks the workset itself and re-runs BEFORE a pending `goto` lands — resurrecting
  just-closed tabs from the stale URL. The trap is invisible at the effect's call site;
  owning the sync in the strip means consumers cannot re-hit it.
- **Gestures are the kit's, wiring is the app's** — each callback writes app browse state,
  and omission removes the control: no `onbelow`, no split button; no `onback`, no back
  button. An empty workset renders no strip at all.
- **⚑ Tabs follow BROWSER-TAB convention, and the roles oblige it.** The strip declares
  `role="tablist"`/`role="tab"`, which promises arrow-key navigation and a roving tabindex —
  declaring the roles without the interaction is worse than not declaring them, because a
  screen reader then announces a tab list the keyboard refuses to drive. So: arrows move
  focus, Home/End jump, **Delete closes** (the APG gesture; Ctrl+W belongs to the browser and
  a desktop shell can bind it, which makes it the app's), **middle-click closes** as it has
  in every browser since tabs existed, and activation is **manual** (Enter/Space) rather than
  automatic-on-focus, because activation navigates and arrowing across five tabs would push
  five history entries. `role="tab"` sits on the FOCUSABLE button, never a wrapper — a role
  on a non-focusable div silently drops out of the keyboard order. Controls INSIDE a tab are
  `tabindex="-1"`, like a browser's close button, or every tab would cost three Tab presses.
- **The split control is revealed on hover, or kept on the ACTIVE tab** — a control repeated
  on every tab reads as noise past three of them, and splitting is a deliberate act rather
  than a per-tab affordance (browser tabs treat their close button the same way). Toggled by
  OPACITY at a fixed size, never by width: an animated width reflows the strip under the
  pointer you are aiming with.
- **`Surface.Tab` is the tab chrome, and both the strip and the app use it.** An app's
  trailing content has to READ as one of the tabs; hand-copying the border, the
  `border-b-card` blend and the roles is the `Bar` lesson waiting to happen, and it had
  already produced a compare tab whose `role` sat on a non-focusable wrapper. One component
  means an app tab cannot drift from a record tab, and gets scroll-into-view and the
  focusable contract for free.
- **`TabStrip.trailing` is pinned right**, for chrome that belongs to the working set without
  being a member of it — a compare tab, a layout toggle. A trailing slot rather than a workset
  entry precisely because it carries no key.
- **⚑ Collapse is ASYMMETRIC, and the asymmetry is the design.** BOTH halves are the kit's,
  driven by ONE fact on `Surface.Root` (`collapsed` + `oncollapse`, published through the
  surface context because `Split` and `List` are siblings the app wires, not a parent and a
  child a prop could bridge). HIDE renders in the list's own header — it acts on the list, so
  the containment rule puts it in the list's chrome, where it costs no layout at all. SHOW cannot follow that rule, because the
  box it would live in is exactly the box that disappeared, so the kit renders it — **docked**
  in the surface's left gutter rather than laid out, and ONLY while collapsed. Four placements
  were tried: a 12px seam (unfindable), the same seam made weightier and bar-aligned
  (findable, but a permanent column for one button), a 36px rail while collapsed (no
  permanent cost, but still a column with a square handle), and finally an absolutely
  positioned handle that reserves nothing. **Shape follows the same logic**: a splitter is
  read ALONG the seam it opens, so height makes the target and width is pure cost — tall and
  narrow, flat left edge, rounded only towards the content it will push. The collapsed pane
  keeps a handle-wide gutter of its own, because a surface with no padding would otherwise
  have the handle sitting on its card. Controlled, so the state's home is the app's call;
  omit `oncollapse` and neither control exists. `md:`-scoped, because below that the panes
  already take turns being the whole page.
- **The second pane is a PROJECTION by key** (`byKey` reads ALL rows, pre-filter), stacked
  BELOW the first — stacking costs height, not width, so no breakpoint gates it. It is
  independent of the tab set and lives in its own URL param: a compare is a shareable
  state, back closes the split before the selection, and the pane survives both a search
  that empties the list and its own tab closing. It acts as a persistent comparison anchor
  across selection changes.
- **Selection is followed into view by `Surface.List` itself**, with no prop: `win.scrollTo`
  computes the offset from measured heights, so it works above the threshold where the target
  row is not in the DOM and `scrollIntoView` has nothing to call. `nearest` means an
  already-visible row never moves; the retry is keyed on `status`, never on the entry list,
  because reading entries tracked reaches the collection's lazy `ensure()`.

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

## The demo's standard

**`apps/demo` may define DATA, never UI.** Descriptors, facets, sorts, groupings, compare
attributes, domain maps, the derive — those are what exercise the kit. Anything else is a bug
report about a missing part.

The mechanical test is `class="` in a route file: a class string there means the app is
styling something the kit should own. `/catalog` is the reference — **zero class attributes
and zero raw elements**, and getting it there is what produced `Surface.Tab`, `.Pane`,
`.PaneBody`, `.Panes`, `RadioGroup` and `Placeholder`, plus the surface gutter and the
matrix's fill becoming defaults instead of things every caller passes.

A layout hint passed to a kit part (`class="p-3"`) is the softer version of the same smell:
if two surfaces pass the same one, it is a default the kit is refusing to have.

## Conventions

- Ships **source**, no build step, while workspace-linked. `exports` points at `src/index.ts`.
- Svelte 5 runes throughout. `.svelte.ts` for rune-bearing modules.
- Nothing enters `src/index.ts` until it has a consumer in `apps/demo`.
- **⚑ The three behaviour-bearing UI dependencies are pinned EXACTLY** — `bits-ui` (2.18.1),
  `@internationalized/date` (3.12.3), `@floating-ui/dom` (1.8.0) — **and `bits-ui` to the same
  version in every consumer.** A caret range on these is an unversioned *behaviour* contract,
  not just an API one: bits-ui 2.18 silently stopped unmounting closed overlay content under a
  `^2.16` pin, which type-checked clean and left a dismissed modal (and, found by sweeping, a
  dismissed `⋮` menu) on screen swallowing clicks. Only the gallery would ever notice.
  - Each carries its own hazard beyond the version: **bits-ui** owns overlay presence, focus
    and context; **@internationalized/date** hands `CalendarDate` objects across the boundary,
    so a second copy breaks identity checks, not merely types; **@floating-ui/dom** decides
    where a panel lands, and a placement regression reads as a CSS bug.
  - So: bump deliberately, one at a time, and **re-walk the gallery specimens that exercise
    them** — dialog, picker, wizard's host, actions' overflow menu (bits); date & time (both
    bits and `@internationalized/date`); list-header's filter panel and Notify.Center
    (floating-ui, via `Popup`).
  - Keep a consumer's `bits-ui` pin identical to this one: two resolved copies split its
    contexts the way two Svelte runtimes split `getContext`. (A peer dependency owned by the
    consumer is the reach for if the fleet ever disagrees on a version.)
  - `clsx` / `tailwind-merge` stay on carets deliberately — pure string functions with no
    lifecycle, no DOM and no cross-boundary objects, so a minor bump cannot regress behaviour
    invisibly.
