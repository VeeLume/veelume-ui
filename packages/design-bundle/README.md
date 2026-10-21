# @veelume/design-bundle

Keeps an app's Claude design system in sync with the app. It produces every **code-derived** file
of the system from the app's repository, and builds the kit's REAL Svelte components into one
classic script plus one stylesheet, so a Design canvas mounts them with
`<x-import component-from-global-scope="Starlume.Select" …>` and gets the kit's own behaviour:
the Select's popup and keyboard, Segmented, Switch, focus rings, density.

Not part of the kit's public surface and never imported by an app.

## Keeping a design system in sync

The repository is the source; the design system is a build output plus its written rules.

| Produced here (never edited on the system's page)  | Written in the system (never produced)        |
| -------------------------------------------------- | --------------------------------------------- |
| `tokens.json`, `tokens.css`, fonts, logos          | README (brand book), further `*.md` sections  |
| `components/bundle.js`, `bundle.css`, `index.d.ts` | component cards (`preview.html`, `README.md`) |

```
# is the system behind the app? (exit 1 and the commits if so)
pnpm --filter @veelume/design-bundle produce --app ../starlume --previous <system's tokens.json> --check

# produce the files (into dist/<Namespace>/ds/, laid out as the system's paths)
pnpm --filter @veelume/design-bundle produce --app ../starlume --namespace Starlume --previous <system's tokens.json>
```

Then publish the changed files under `ds/project/` to the system (upload `ds/assets/Logos/*` only
when they changed), and re-install the system on every canvas that uses it: a canvas keeps a copy
that never updates by itself. `ds/sync.json` lists what was added, what changed and what the
system has that the app no longer defines (kept; removing a token is a person's call).

What `produce` reads, from the template-tauri layout every VeeLume app shares (override any of
them in an optional `design-system.config.json` at the app's root):

- `src/app.css`: its `:root` custom properties become tokens (the comment after a declaration is
  the usage note, unless the system already has one); `--text-*` / `--font-size-*` lengths become
  `type-*` styles (family from a `· display|sans|mono` comment); colour aliases stay aliases;
  values a token cannot hold (`color-mix()`, gradients, motion, weights) go into a `:root` block in
  `bundle.css`; `@font-face` rules list the fonts; every other rule is appended to `bundle.css`
  after the kit, unlayered, as in the app.
- `src/theme.css`: the app's bridge onto the kit's tokens, compiled into the bundle; its `:root`
  aliases become tokens too, its `@theme inline` radius scale too.
- `static/fonts/`, `src-tauri/icons/source/*.svg`.
- `node_modules/@veelume/ui`: the kit **the app has installed** is what gets compiled, so the
  bundle is the version the app pins. `meta.kit` records it; `--check` compares it.

Provenance lands in `tokens.json` `meta` (`repo`, `ref` as `branch@sha`, `kit`, `synced`).

## How the bridge works

- `src/bridge.js` wraps each kit component in a small React component (the canvas mounts React):
  it mounts the Svelte component into a `display: contents` span with `mount()` and pushes props
  into a `$state` object on every render (`src/props.svelte.js`).
- Choice components are **uncontrolled unless `value`/`checked` is passed**: with no handler they
  keep their own state, so a mock works without wiring; `onChange` still reports every change.
- Text children become a Svelte snippet (`createRawSnippet`). Other children are not bridged.
- `options` takes `"A, B, C"`, `["A", "B"]` or `[{ value, label }]`.
- `scripts/finish.mjs` adds the `@ds-bundle` header (namespace + component list from
  `src/names.js`), escapes `<!--` inside Svelte's template strings and copies `types/index.d.ts`.

The bundle alone, without an app: `pnpm --filter @veelume/design-bundle build` (this workspace's
kit, the kit's fallback tokens). `DS_NAMESPACE`, `DS_KIT_SRC` and `DS_THEME_PATH` are what
`produce` sets. `pnpm --filter @veelume/design-bundle smoke` clicks every component in headless
Chrome (`CHROME` points at a Chrome or Edge binary).

## Adding a component

Import it in `src/bridge.js`, add a `wrap(...)` entry mapping React props to the kit's props, add
its name to `src/names.js` and its props to `types/index.d.ts`, then extend the smoke page.

## Not bridged yet

- **Snippet children** beyond text: Surface, Expand, dialog bodies, Bar slots. Needs a bridge
  that renders React children into a snippet's target.
- **SvelteKit imports**: Shell, Settings and browse state import `$app/state` / `$app/navigation`.
  Needs an `$app` shim (a static `page`, a no-op `goto`) aliased in `vite.config.js`. Worth having
  for the kit's own portability too.
- Utilities used only in the APP's own components are not in `bundle.css` (Tailwind scans the
  kit); mocks style app-specific markup with tokens and the app's idiom classes.
