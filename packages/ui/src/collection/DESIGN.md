# The collection primitive — design history

Five successive designs, written down because four of them failed for reasons
that are not obvious from the outside. The fifth shipped broken, was diagnosed
here, and now runs fixed — as E′ below.

Read this before changing `index.svelte.ts`. Every approach below looked correct
when written; most were disproved by measurement rather than by review.

The *project-level* why lives in the vault note `Programmieren/Projects/veelume-ui.md`.
This file is the subsystem's own history.

---

## The problem

A list surface needs, at the same time:

- **client-side filtering and contextual counts** — which require holding the
  whole matching set;
- **1.5M rows** — which make holding the whole set impossible;
- **a UI that stays responsive** while data arrives.

Those three are in tension, and every design below is an attempt to resolve it.
The test bed is `apps/demo/src/routes/stress`, a real 1.5M-record dataset over
both transports.

*(Resolved 2026-08: the tension is not resolvable in plain JS on the main
thread, and nobody else resolves it there either. The commitment that replaces
it is at the end — [The envelope](#the-envelope--committed-goals-2026-08).)*

---

## A — scope-keyed entries *(original)*

```ts
entries: Record<scopeKey, { data: T[]; status }>
```

One array per scope, replaced wholesale by `fetchAll`.

**Why it went:** it cannot express partial data at all. `scope` was supposed to
be the answer to unbounded collections — partition into units the user already
thinks in (year, account) — but that only *delays* the problem: whether a
partition is small enough is a property of the data you cannot know in advance.
A year with 200 000 orders defeats it.

It also conflated two things the rest of this history keeps separating: the
records themselves, and the answer to a query.

---

## B — cache / working-set split, server-owned key lists

```ts
records: Map<key, T>                          // the cache
sets:    Map<setKey, { keys: K[], total?, fetchedCount, complete, ... }>
```

Rows = `set.keys.map(k => records.get(k))`. The fetch produced the key list; the
set *was* the server's answer.

**What it got right, and what survives:** separating records from queries. Once
split, a record fetched by id (deep link, search hit) is available to every set
that should contain it, and a write upserts once rather than into every entry
holding that record.

**How it failed — four ways, all measured:**

| symptom | cause |
|---|---|
| `loadMore()` silently did nothing | `cap` was part of the set key, so raising it built a *second* set while the view read the first |
| 20 000-row accumulation took **5623 ms**; the IPC cost was **13 ms** | published after every page; each publish rebuilt the whole key→record array (~800k lookups) |
| a 10 000-row query went **0.3 s → 13 s** | "conservatively" invalidating a hydration memo whenever a fetch replaced an already-cached record — and re-fetching records you already hold is the *normal* case, not the exception |
| UI froze while a counter ticked up | `records` was a deep `$state` object: one reactive write per record, one dependency per key read. The counter moving *was* the render loop |

**The lesson that repeats:** every one of those is *state maintained by hand at
each mutation site*. None was a logic error; all were bookkeeping that drifted.

It also left a question it could not answer: *after a create, does this record
belong to a set with pushed-down predicates?* The client can evaluate local
predicates but not server ones.

---

## C — rows derived from the cache *(pull, memoised)*

```ts
set  = (predicate, order, cap)     // the only fixed part
rows = cache.filter(matches).sort(compare).slice(cap)
fetch = a cache filler, not the set's contents
```

**Why:** it deletes the hand-maintained key lists, and with them the create
question — a record matches the predicate or it does not. `preview`,
`canPreview`, `lastReady` and a cross-scope leak all disappeared because
"show local matches while loading" stopped being a special case and became the
normal path.

Also replaced tracked `complete` with `stopped: 'exhausted' | 'capped'` — a
readout of why the last fill ended rather than an invariant needing three rules.
That removed a real hole: completeness used to compare `fetched >= total`, and
under over-fetch-and-filter-locally `total` counts the *wider* query.

**How it failed:** deriving is O(cache), and the memo was keyed on a version
bumped **per page**, so a 20-page fill did twenty full derivations over a growing
cache — scan 49 000, filter, sort 6 000 matches, twenty times. **21 s, main
thread blocked.**

---

## D — incremental derivation *(append log)*

`addLog[v]` = the batch that became visible at version `v+1`. A memo last derived
at version `m` needs exactly `addLog.slice(m)`: filter the new records, sort
them, merge two sorted runs in linear time.

**Why it was still not enough:** the merge *allocates a new array*, so every
publish handed Svelte a fresh reference and every downstream stage re-walked
everything:

```
derive merge          O(n)
slice(0, cap)         O(cap)
slice(0, reveal)      O(rendered)
each-block walk       O(rendered)
reveal restart        total changed
```

**Everything except the fetch scaled with what was already on screen.** A fill of
k pages cost O(k · n) and interrupted the UI k times. That is why tuning
`PUBLISH_EVERY` between 1 and 8 kept trading one bad behaviour for another:
per-page publishing made *growth* smooth and the *frame rate* choppy; a coarse
cadence did the reverse. A cadence only picks a point on the k axis — it cannot
remove the k · n.

---

## E — live sets, maintained in place *(current — BROKEN)*

```ts
rows:  $state<T[]>        // mutated, never replaced
index: Map<key, position>
```

Arrival → binary-search insert. Replacement → swap in place, or remove+reinsert
if its sort position moved. Disappearance → remove by index. A full re-derive
only when the set's *identity* changes.

The intent: make a change cost O(what changed) rather than O(what is displayed),
which removes the publish cadence entirely — Svelte sees the mutations, so there
is nothing left to schedule.

**⚑ It is worse than D, and measurably so.** Reproduction: load 10 000 → search
"Jonas", let it settle → search "Kira". Query time **105 s**; the webview reached
**~1 GB** for ~20 000 cached records.

Two causes, both introduced by this design:

1. **`reindexFrom(at)` walks from the insertion point to the end**, so every
   insert is O(n). Inserting 10 000 records into a 10 000-row set is ~10⁸
   operations. Compounded because **live sets are never dropped** — every search
   term adds another set that must be offered every arriving record.
2. **`$state<T[]>` deep-proxies.** Every record pushed in gets a Proxy plus
   per-property signals, and every `splice` invalidates every index signal after
   the insertion point. That is both the memory and a second source of the
   freeze.

Neither is a flaw in "maintain in place" as an idea. Both are the implementation
choosing the wrong primitives for it.

---

## E′ — live sets, maintained by batch *(current)*

E's two bugs fixed by taking D's algorithm and B's reactivity:

- **Batches, not records.** `cache()` hands the whole page to each live set as
  one batch: filter it, sort it, one merge pass — O(n + k log k) per page where
  E paid O(n · k). The key→position map is gone entirely; membership is a `Set`
  and nothing needs positions, because a replacement is "strip in one filter
  pass, re-add through the merge".
- **Plain array + version counter**, the pattern `records` already used. One
  signal instead of a proxy per record; `derive()` builds through the same
  batch path, so building *is* maintaining.
- **Comparator gets a PK tiebreak**, making the client order total — the same
  guarantee the wire contract demands of the backend.
- **Maintenance is tied to observation** (landed just after the above).
  `createSubscriber` tells a live set when its last reactive reader leaves; it
  then deletes itself from the maintenance map. Records stay, the declaration
  stays, and a return visit is one re-derive — measured at **36 ms** to rebuild
  a 28 700-row set from cache. The stress panel now shows `live sets`, which
  hovers at 1 where E accumulated one immortal set per search term.

**Measured, same machine, dev server, browser fixtures (E → E′):**

| case | E | E′ |
|---|---|---|
| 10 000 → search "Jonas" → search "Kira" | 105 s | **≈ 350–400 ms per search** |
| clear search (cache hit, set already held) | — | **93 ms** |
| webview heap | ~1 GB @ 20k cached | **240 MB total** — *including* the 1.5M-row fixture dataset itself |

**New finding, recorded for the windowing work:** flipping to `desc` cost
13.7 s — and the collection is not where it went. The new set first derives
~29k cached matches, then every fill page arrives *in front of* them
(descending ids), and the stress list — unkeyed and fully rendered — rewrites
the text of every DOM row below the insertion point, ~30k rows × 20 pages.
Maintenance is O(page + n); the DOM strategy is O(rendered · pages). This is
the standing argument for windowed rendering, and it interacts with the
semantic change below (`view.all` returned 28 720 rows against a cap of
10 000, because derivation answers from the whole cache).

---

## Cross-cutting failure patterns

Five things bit more than once. They are worth more than the designs.

**1. The instrument was the bug, three times.**
- The stress page called `refresh()` (which forces), so it measured a cold fetch
  every time and *never once exercised the cache* — which looked exactly like a
  broken cache.
- `createReveal` sized its chunks from the interval between `requestAnimationFrame`
  callbacks. That interval is ~16.7 ms whatever the chunk contains, so a small
  chunk measured a whole frame, reported a huge per-row cost, and shrank the next
  chunk further: **19.17 ms/row and one row per frame**, a list that never
  finishes.
- The panel rendered `Object.keys(records).length`, building a 100 000-element
  array on every render — which is why the UI stayed laggy *after* shrinking the
  list, since the cache had not shrunk.

**2. Type-checking proves almost nothing here.** `$state` in a plain `.ts` file
passes `svelte-check` and throws `rune_outside_svelte` at runtime. Reading a
collection view inside an `$effect` type-checks and produces
`effect_update_depth_exceeded`, because the read *lazily fetches* and the write
re-triggers the effect that caused it.

**3. Conservative guards fire constantly.** "Invalidate whenever a fetch replaces
a cached record" sounds safe and cost 13 s, because re-fetching records you
already hold is the normal case. Precise invalidation at the one place staleness
can occur beats a blanket rule.

**4. What looks fine at 8 rows falls over at 100 000.** Every design here worked
on `/loans`. `/stress` exists because nothing else in the demo could tell these
approaches apart.

**5. Measure the artefact that actually fails.** A production build and the dev
server scan sources differently; a hidden browser tab clamps `setTimeout` to ~1 s
and never fires `requestAnimationFrame`. Several numbers in this history were
harness artefacts.

**6. A destructive teardown on a reactive lifecycle is a split brain waiting
to happen.** The first set-lifecycle implementation deleted the live set the
moment `createSubscriber` reported zero observers — but the count transiently
crosses zero during re-renders (a scope switch destroys old effects before new
ones attach), so the template kept rendering instance A while a recreated B
took its place in the map, and every later event mutated a set nobody
rendered. A keyed delete that logged `rows 7 → 6` against a DOM stuck at 7 is
what exposed it. The fix is a grace period: schedule the forget, cancel it on
re-observation. Related: the subscription failure path was silently swallowed
(`void promise` with no catch), which made "listener never registered" look
identical to "events broken" — error paths that cannot speak cost sessions.

**7. A corrupted toolchain wears a code bug's face perfectly.** An abruptly
killed dev server left a partial Vite dependency pre-bundle; the next server
served a split module graph — two Svelte runtime copies — and every scoped
surface rendered its empty state while unscoped ones worked, which read
exactly like a scope-routing regression. Hours went into bisecting working-
tree changes that were all innocent: the tree reverted to a commit VERIFIED
working still failed. The tell, in hindsight: kit labels silently fell back to
English defaults — context lookups fail across runtime copies, and data
plumbed through context dies with them. When a bisect reaches "identical code,
different behaviour", stop bisecting code: purge `.vite` and `.svelte-kit`,
reinstall, and re-test before believing anything.

---

## Where it stands

**Working:** the cache/set split, `stopped` instead of tracked `complete`,
keyset accumulation, `matches` + `compare` as the definition of a set,
chunked initial derivation, `createWindow`'s viewport rendering (which
retired `createReveal`), and — since E′ — batch-maintained live sets.

**Built since (2026-08): deletion, tiers 1 and 2.**

- Tier 1 — we did it: `discard(...keys)` removes locally after the server
  confirmed a delete this client initiated. Loans' `cancel` uses it.
- Tier 2 — the event carries keys: `ChangeInfo` gained `kind`, and a
  `delete` + keys event removes from the cache, the scope index, every live
  set and the working-set bookkeeping — no refetch. Keys with any other kind
  refresh exactly those records via `fetchOne` (a key the server no longer
  answers falls back to a reload, which self-heals); keyless events reload as
  before. The deferral queue is now a real queue — collapsing several pending
  events into one entry was fine when every event meant "reload", and loses a
  delete the moment it doesn't.
- Both transports emit `loans-changed` (Rust `Emitter`, fixtures through the
  mocked event bus), so the whole chain runs in a plain browser.

**Built since (2026-08): halting a superseded fill.**

Typing commits intermediate queries whose fills all ran to completion behind
the current one — and with page-wise interleaving they thrashed the backend's
single-entry query memo: every page missed, every miss re-scanned 1.5M rows.
Measured over Tauri (debug build): a search that costs ~1.5 s clean cost
**25 s** behind two abandoned fills. Three fixes, one per layer:

- **The fill halts when its set stops being read.** Every view getter stamps a
  `lastRead` timestamp (plain map, written during render — the `inflight`
  rule); the fill checks it between pages and stops once the set was read and
  then went a second unread. Verified: a fill abandoned mid-flight broke at
  5 000 of 10 000, ~1.2 s after its last read; observed fills never false-halt
  (every page bump re-renders the reader, which re-stamps). A pure prefetch —
  never read — still completes: warming a set nobody reads yet is its job.
  ⚑ NOT via `createSubscriber` teardown, which measured up to **15 s late** —
  fine for the memory lifecycle, useless for cancellation.
- **The backend memo became a small recency map** (8 entries, both twins), so
  legitimately interleaved fills stop thrashing it.
- **`[profile.dev.package.veelume-ui-demo] opt-level = 2`** — the debug-build
  scan cost ~1.5 s where release costs ~100 ms, making every dev-mode /stress
  number a harness artefact (failure pattern 5 again).

**Built since (2026-08): windowed rendering (`createWindow`).**

The order-switch measurements above ended the reveal era: once entered, every
rendered row paid the update tax on every fill page, so query time scaled with
the DOM (~1 ms per rendered row per fill) rather than with the data.
`createWindow` renders O(viewport): scroll-driven window, measured row heights
through one shared `ResizeObserver` (a catalog bundle expanding in place
re-measures automatically), a **fixed-height spacer with rows placed by
`translateY`**, and — the load-bearing property — **neutrality below its
threshold**: a seven-row loans list renders byte-for-byte as before, plain
flow, nothing measured. `Surface.List` windows by default with no new props;
the stress page consumes the L1 primitive directly. Measured in the browser:
the desc flip fell 13.7 s → 181 ms with 22 DOM rows where 28 700 used to
rewrite twenty times. It supersedes `createReveal`, deleted.

The spacer is not a styling choice. The first version windowed with
`padding-top`/`padding-bottom`, and dragging the scrollbar thumb drifted from
the mouse — stalled at 72 % of the track with the mouse at the screen edge —
because every window move rewrote the pads, relaid out the whole list, and
the browser's drag mapping kept recalibrating against a shifting document.
With one spacer whose height changes only when measurements change (the
browser-measured `scrollHeight` went from wobbling per recompute to a stable
constant) and rows positioned by transform, scrolling moves and resizes
nothing, so there is no layout event left to fight the drag.
`overflow-anchor: none` on the container stays as the belt to those braces.

Two lessons from building it, both nearly casebook-grade:

- The first version put `$effect(() => { void count(); schedule(); })` in the
  primitive — `count()` reads a collection view, which is the documented
  landmine, now demonstrated to apply to LIBRARY primitives reading consumer
  deriveds, not just app effects. The shipped design is effect-free: getters
  capture the count during the consumer's tracked reads and schedule an async
  catch-up; `requestAnimationFrame` is used for alignment only, never for
  progress (a visible-but-not-compositing document fires no frames and is not
  `document.hidden` — found as a window frozen at 0–22 under a scrollTop of
  165 000).

**Designed, not built:**

- **Deletion, tier 3.** No keys from the backend: the fill reconciles the
  **key interval** it covered. Absence is only meaningful inside a range the
  server enumerated. `FetchPage.from` exists for this and is not yet consumed.
- **Eviction by age or reference.** Supersedes the old "explicit only, no LRU"
  decision, which was taken when the cache was per-scope and small.

**Known semantic change to watch:** `view.all` no longer applies `cap` — capping
is the consumer's business and `cap` governs fill depth only.

---

## The likely fixes for E

Recorded so the next attempt would not rediscover them — and then applied:
all of the below landed as E′.

- **Drop `reindexFrom`.** A key→position map cannot survive insertions cheaply.
  Use a `Set` for membership and locate by binary search plus a short linear
  probe within the equal-sort-key run. Insert then costs O(log n) plus a native
  splice memmove.
- **Do not use `$state` for the rows array.** Use a plain array with a version
  counter, exactly as `records` already does — mutation stays a memmove and
  reactivity is one signal instead of a proxy per record.
- **Apply batches, not records.** `cache()` hands each record to `apply()`
  individually, so every arrival pays its own binary search + splice + reindex —
  design D already had the O(n + k) shape: filter the page, sort the page, one
  merge pass. D's algorithm was right; only its reactivity (fresh array per
  publish) was wrong. Keep the merge, mutate the target, bump the version.
- **`derive()` must sort once, not insert sorted.** Building a 10 000-row set
  via per-record sorted insert is itself quadratic — filter matches into a plain
  buffer per chunk, sort at the end.

---

## The envelope — committed goals (2026-08)

The five designs above churned because the requirement was over-scoped, not
because the implementations were wrong. "Client-side filtering + contextual
counts over 1.5M rows, responsive, in plain JS objects on the main thread" is a
constraint set nobody satisfies — at that scale the industry weakens one of the
three: push queries to a server (AG Grid server-side model, faceted search),
hold the data in an indexed engine (SQLite WASM, PowerSync, RxDB), or maintain
views with real incremental view maintenance (TanStack DB, Rocicorp Zero —
which is what C→E were reinventing, badly). Even Linear, the poster child for
"sync everything, filter locally", is bounded (~10⁵ objects) and grew partial
sync when workspaces outgrew it.

So the tension is resolved by commitment, not cleverness:

### The goals

- **View cap: 10 000 rows.** Not a tunable — the envelope. `DEFAULT_CAP`
  becomes 10 000 and the two regimes below hang off `stopped`.
- **Architecture: frontend → backend → DB.** Svelte talks only to *our*
  backend, which talks to SQLite (local) or TrailBase (remote). The frontend
  wire contract is therefore ours to define; DB quirks are the backend's
  problem.
- **⚑ TWO TRANSPORTS, named by shape rather than by language: Tauri IPC and
  HTTP + SSE.** The kit is designed for exactly these two. The backend's
  *language* is a free variable below that line — Axum, Litestar, anything —
  and choosing it is an app decision, not a kit one. Naming the axis this way
  is what keeps it from multiplying: "Litestar" and "Axum" are one case.

  For a fleet already writing Rust for Tauri, the cheap web deployment is a
  second adapter over the same domain crate (the demo's own `demo.rs` /
  `demo_commands.rs` split is exactly this shape) — one implementation of the
  logic, two entry points.

### The two regimes

| `stopped` | filtering / search / counts | mechanism |
|---|---|---|
| `exhausted` (answer fit in ≤10k) | **local** — the pipeline over in-memory rows | sort-once derive is ~ms, per-keystroke filter sub-ms, ~5MB per set |
| `capped` (answer exceeds 10k) | **pushed down** — refinement goes into `SetQuery`, counts come from the server's filtered `total` | UI shows "10 000 of 1.4M — refine to narrow" |

The escalation is mechanical — and it landed one layer LOWER than first
planned: the *collection* routes, not the surface. A query carrying `search`
resolves against its **base** (same declaration, search stripped); if the base
set is `exhausted` and the app supplied `matches`, the search is answered by
narrowing the base's live rows — no set minted, no fetch, `total` exact. If
the base is capped, the search pushes down into the set key as before, and the
base is ensured alongside so a deep-linked search still converges to the local
regime once the base proves it exhausts. Consumers pass `search` in the query
either way and cannot get the routing wrong. This ends the search-set
explosion measured under E: within the envelope, typing never creates sets.
The deterministic test bed is the **paged rig on `/probes`** — 40 records,
cap 20 vs cap 100, a `sets` counter that climbs per pushed term and stands
still per local one.

**Consequence: the D/E arms race is over.** At 10k rows there is nothing left
for incremental merges or IVM to win. The fixes listed above suffice.

### The wire contract (frontend ↔ backend, both transports)

- `fetchPage({ scope, query: { where, search, order }, limit, cursor })`
  → `{ records, cursor?, total?, done? }`, where `total` is the count of the
  **filtered** query, never the table.
- **The backend appends the PK as an order tiebreak**, so every order is total.
  (The client comparator needs the same tiebreak for local sorting.)
- `subscribe` delivers `{ kind: create | update | delete, keys, scope? }` —
  a Tauri event emit on one side, an SSE message on the other. This populates
  `ChangeInfo.keys` and unlocks tier-2 deletion.

`CollectionIO` is already the whole abstraction: both transports implement the
same four functions, and nothing above the adapter can tell them apart. What
differs is not the *shape* but the *physics*, and those differences are what
the kit has to absorb:

| | Tauri IPC | HTTP + SSE |
|---|---|---|
| round trip | ~1–13 ms | 20–300 ms |
| event delivery | guaranteed (same process) | **lossy** — reconnects drop events |
| auth | none | sessions expire (`auth-expired`) |
| concurrent writers | rare | normal (`write-diverged`) |
| failure | command `Result` | status codes *and* network loss |

**Consequences, in the order they bite:**

1. **⚑ A reconnect must be reported as a change.** This is the one genuinely
   new problem, and it is the dangerous kind: a dropped SSE connection means
   missed events, so the cache goes stale *with no way to know it did* —
   silent staleness, which is the failure this primitive exists to prevent.
   The fix needs no new API, and that is the point: `ChangeInfo` is
   all-optional precisely because stibu's events carry neither keys nor scope,
   so **an SSE adapter calls `onChange()` with no argument after every
   reconnect** and the existing degradation path reloads every declaration.
   What was a concession to a poor backend turns out to be the correct
   recovery primitive. An adapter that reconnects *silently* is the bug.
2. **`pageSize` is transport-scaled, not one number.** 500 is right when a
   round trip is free; over HTTP a 10k fill at 500 is 20 sequential requests,
   so ~1000 (TrailBase's ceiling anyway) is the floor to start from. It is
   already per-collection via `options.pageSize` — this is guidance, not a
   change.
3. **The envelope is per-transport too.** Every number in this file was
   measured over free transport. Over real latency the push-down regime
   becomes attractive *below* 10k, so a web surface should expect to pick a
   smaller `cap` than a desktop one. Re-measure before assuming 10k transfers.
4. **Fill halting earns more.** Abandoned fills cost bandwidth and a server's
   attention, not just local CPU.
5. **Two error paths become real** rather than theoretical: `auth-expired` and
   `write-diverged` have had slots in the typed union since the start and have
   never been exercised against a backend that actually produces them.

**Deliberately still open:** the collection cannot express "I am currently
disconnected". The adapter knows; the surface may want to show it. That is
plausibly app-level state rather than a sixth `Status`, and it should not be
decided until a real surface needs it.

### Backend obligations, per DB

**SQLite (whatever the backend is written in):** trivial. Keyset paging is
`WHERE (ord, pk) > (:ord, :pk) ORDER BY ord, pk LIMIT :n`; filtered count is
one `COUNT(*)`; change events are emitted by our own write path.

**TrailBase (the proxy case)** — verified against its docs 2026-08:

- Cursor pagination is **PK-order only** (INTEGER/UUIDv4/UUIDv7 PKs). For any
  other sort the backend falls back to **offset paging** — safe *because* the
  envelope bounds offset at 10k.
- `limit` max is **1024** → a full fill is ~10 upstream requests; use
  `pageSize` ≈ 1000 against TrailBase-backed backends.
- Filters: `filter[col][$op]=v`, AND-only, `$eq/$ne/$gt/$gte/$lt/$lte/$like/$in`.
  Covers facets and prefix search; OR is the backend's job to compose.
- `count=true` returns the filtered `total_count` → maps onto `total`.
- SSE subscriptions carry insert/update/delete with keys, **but are per-table
  opt-in in TrailBase config** — a disabled subscription looks exactly like
  broken invalidation, so the adapter docs must name the prerequisite.

### Build order

1. ✅ Fix E within the envelope: batch merge per page, plain arrays + version
   counter, sort-once derive (the three fixes above). Landed as E′.
2. ✅ Split search — landed in the collection itself, see the regime section
   above. `SetQuery.search` only reaches a set key when it must push down.
3. ✅ Set lifecycle: live-set maintenance tied to `createSubscriber`
   (`svelte/reactivity`); unobserved sets demote to declarations.
4. ✅ Deletion via `ChangeInfo.keys`, now that both backends relay keyed
   events. Tier-3 (interval reconciliation via `FetchPage.from`) stays
   designed-not-built until a backend actually cannot send keys.
5. ✅ Windowed rendering — see the `createWindow` entry above.
6. ✅ **The HTTP + SSE adapter** — `collection/http.ts`, with an Axum backend
   in `apps/demo/src-tauri/src/demo_http.rs` (`just serve`) and `/http` as the
   consumer. The split held exactly as designed: the kit ships
   `sseInvalidation` (the reconnect discipline), `classifyHttpError`
   (status → `KitError`) and the fetch/JSON plumbing; the app supplies
   `routes`, because URL and param building is what differs between Axum,
   Litestar and TrailBase.

   **The reconnect contract took four lines.** `EventSource` reconnects on its
   own and fires `open` each time it succeeds, so every open *after the first*
   is a gap: `if (everOpened) onChange()`. Deliberately no `onerror` handling —
   closing there would turn a blip into a permanently stale cache. Errors are
   pre-classified in `send()` rather than through `CollectionIO.classifyError`,
   because reading a validation body is async and that hook is sync; the store
   passes through anything carrying a `kind`.

   **Making the recovery testable was the other half.** An untestable recovery
   path is an unimplemented one, so the server exposes
   `POST /api/debug/drop-streams`, which ends every open stream — the same
   trick `probes_hijack` plays for write divergence: turn a rare failure into
   a button. Verified three times in the browser: drop the stream, mutate from
   a second client while the first is disconnected, and the missed change
   appears once `EventSource` reconnects (recovery latency is the browser's
   retry, ~3s in Chrome — not something the kit sets).

   Also verified over the wire: keyset paging by cursor, `{records, cursor,
   total, done}` exactly as the contract specifies, keyed SSE events driving
   tier-2 deletion, and tier-1 `discard` composing with them.

   **What building it caught:** the loans *logic* still lived in
   `demo_commands.rs`, so "one domain, two entry points" was not yet true. It
   moved to `demo.rs`, where each mutation now returns the `LoanChange` it
   caused rather than announcing it — the domain decides *what changed*, the
   adapter decides *how to say so* (a Tauri `emit`, an SSE broadcast). That
   refactor immediately exposed a twin divergence the demo exists to catch:
   `loans_create` emitted no event on either backend, so create was the one
   operation still needing a manual `refresh()`.

   **Freshness, and what it is NOT.** `WorkingSet.updatedAt` stamps every
   *successful* fill (a failed one leaves the previous stamp standing — the
   rows really are as of then), surfaced as `view.updatedAt` and rendered by
   `Surface.List` as an "as of" band past a `staleAfter` threshold.

   It is deliberately a property of the **set**, not of the connection, which
   is what makes it meaningful on both transports: over SSE an event-driven
   refresh keeps bumping it, so it stops advancing exactly when updates stop
   arriving; over Tauri IPC it simply says how long ago the data was
   confirmed. But **old is not stale** — a set nobody has changed in an hour is
   an hour old and correct — so the band says "as of" and never warns. The
   threshold is what keeps it honest rather than noisy: an indicator that fires
   constantly is one people learn to ignore.

   **Still deliberately open:** the collection cannot express "currently
   disconnected". A connection signal from `sseInvalidation` (delayed past the
   ~3s retry so a blip is not an alarm) is the design, unbuilt — `updatedAt`
   covers the *informational* half, but a client that is disconnected while
   nothing changes is indistinguishable from one that is merely idle. Also
   open: the envelope has not been re-measured over real latency — the demo's
   LAN-local server is not the test that would settle it.
