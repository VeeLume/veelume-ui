# veelume-ui

A Svelte UI kit **and** the app that exercises it, in one pnpm workspace.

```
packages/ui/     @veelume/ui — the kit. Ships source, no build step.
apps/demo/       Tauri 2 + SvelteKit harness. The kit's first consumer and its test bed.
```

**The demo is a harness, not a product.** Its domain (a reading tracker) is deliberately dull
and deliberately awkward — the schema exists to provoke the hard cases: N:1 row derivation,
an overlay joined at render, concurrent writes, four different shapes of "delete", a scoped
collection beside an unscoped one. If a demo feature is fun but tests nothing, it does not
belong.

**The kit is built *inside* the harness, not demoed after it.** Building a showcase for a kit
that does not exist yet gets the order wrong.

## Before touching `packages/ui`

Read **`packages/ui/CLAUDE.md`** — the kit's rules are binding and several are non-obvious
(layer split, coupling contract, `derive` before `filter`, URL-backed browse state, no
hardcoded strings). It is short.

The *why* behind every rule, the evidence, and the running casebook live in the vault at
`Programmieren/Projects/veelume-ui.md`. That note is the design record; the CLAUDE.md files
are the rules.

## State

The kit has the L1 primitives (context, collections, browse state, windowing),
the L2 surfaces, form and action system, and the L3 shell. Every piece is
exercised by a real surface in `apps/demo`, and `/gallery` shows each component
in every state. Two transports are wired — fixtures in the browser, Rust over
Tauri IPC — which is what keeps the frontend honest about not being coupled to
either.

The collection settled on a **10k envelope**: below it a set is held whole and
search/filter/counts are answered locally; above it the set reports `capped` and
refinement pushes down to the backend. `/stress` (1.5M rows) is the instrument,
with `/stress/list` and `/stress/catalog` running both archetypes at that scale.
The five failed designs behind this are in `packages/ui/src/collection/DESIGN.md`
— read it before touching that primitive.

**Two transports, named by shape: Tauri IPC and HTTP + SSE.** The backend's
language sits below that line and is an app choice — Axum, Litestar, anything —
so "Litestar" and "Axum" are one case, not two. **Both are built**: Tauri
commands in `src-tauri/src/demo_commands.rs`, an Axum server in
`demo_http.rs` (`just serve`, consumed by `/http`), and the browser fixtures as
a third IO adapter. All three call the *same* domain in `demo.rs` — each
mutation returns the change it caused, and the adapter decides how to announce
it. A closer that behaves differently on one transport means logic leaked into
an adapter.

What is NOT built, deliberately: TrailBase behind a backend, user-visible
pages, and a `Picker`/`StatusBadge`. See `Deliberately not built` in the kit's
rulebook and the vault note's Next list.

## Running it

```
just dev        # tauri dev (apps/demo)
just check      # what CI runs: fmt, clippy -D warnings, svelte-check
just build
```

`apps/demo` also runs in a **plain browser** — when `window.__TAURI_INTERNALS__` is absent it
installs `mockIPC` with fixtures, so `pnpm dev` gives a fully working app on localhost with no
Rust and no backend. That is not a convenience: it is the third IO adapter beside TrailBase and
Tauri `invoke`, it makes write-conflict cases *deterministic* instead of racy, and it keeps the
frontend inspectable. **Keep it working** — it is wired into `just check` because an
unexercised target rots silently.

## Template provenance

Two copier templates, two answers files — never hand-edit either:

- `.copier-answers.yml` → `gh:VeeLume/template-rust` (justfile, git hooks, CI caller)
- `apps/demo/.copier-answers-tauri.yml` → `gh:VeeLume/template-tauri` (the app scaffold)

The root `Cargo.toml` is a **hand-written** virtual workspace (`members = ["apps/demo/src-tauri"]`,
profiles at root). template-tauri was scaffolded with `workspace=false` precisely so it would
not create a second workspace root inside `apps/demo` — cargo cannot nest them.

This repo is also `template-tauri`'s **integration** case. The template gates itself with its
own `just smoke` matrix; when something slips through and breaks here, add a variant there.

## Git

Conventional Commits, enforced by `.githooks/commit-msg`. `pre-commit` runs `cargo fmt` and
re-stages; `pre-push` runs fmt + clippy. Hooks activate via `git config core.hooksPath .githooks`
(per clone, not committed).
