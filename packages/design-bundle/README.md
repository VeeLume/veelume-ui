# @veelume/design-bundle

Builds the kit's REAL Svelte components into one classic script plus one stylesheet that a Claude
design system can carry, so a Design canvas mounts them with
`<x-import component-from-global-scope="Starlume.Select" …>` and gets the kit's own behaviour:
the Select's popup and keyboard, Segmented, Switch, focus rings, density.

Not part of the kit's public surface and never imported by an app. It reads the kit's source from
`packages/ui/src` and is rebuilt whenever a design system should pick up a new kit version.

## How it works

- `src/bridge.js` wraps each kit component in a small React component (the canvas mounts React):
  it mounts the Svelte component into a `display: contents` span with `mount()` and pushes props
  into a `$state` object on every render (`src/props.svelte.js`).
- Choice components are **uncontrolled unless `value`/`checked` is passed**: with no handler they
  keep their own state, so a mock works without wiring; `onChange` still reports every change.
- Text children become a Svelte snippet (`createRawSnippet`). Other children are not bridged.
- `options` takes `"A, B, C"`, `["A", "B"]` or `[{ value, label }]`.
- `themes/<app>.css` is the app's theme bridge onto the kit's tokens (the same mapping the app's
  `theme.css` does). Palette values come from the design system's `tokens.css`, loaded first.
- `scripts/finish.mjs` adds the `@ds-bundle` header (namespace + component list from
  `src/names.js`), escapes `<!--` inside Svelte's template strings and copies `types/index.d.ts`.

## Build

```
pnpm --filter @veelume/design-bundle build      # dist/Starlume/bundle.js, bundle.css, index.d.ts
pnpm --filter @veelume/design-bundle smoke      # headless Chrome: clicks every component
```

`DS_NAMESPACE` sets the global (`window.<namespace>`, default `Starlume`); `DS_THEME` picks
`themes/<name>.css` (default `starlume`). `CHROME` points the smoke test at a Chrome or Edge binary.

## Into a design system

Copy `dist/<namespace>/` to the system's `components/` (`bundle.js`, `bundle.css`,
`index.d.ts`), list `react` and `react-dom` 18 in its index's `libraries`, and give each component
a `components/<Name>/preview.html` and `README.md`. An app-specific idiom stylesheet (Starlume's
`app.css` classes) is appended to `bundle.css` by the system, not here. A canvas loads, after
`support.js`: `tokens.css`, `components/bundle.css`, `components/bundle.js`.

## Adding a component

Import it in `src/bridge.js`, add a `wrap(...)` entry mapping React props to the kit's props, add
its name to `src/names.js` and its props to `types/index.d.ts`, then extend the smoke page.

## Not bridged yet

- **Snippet children** beyond text: Surface, Expand, dialog bodies, Bar slots. Needs a bridge
  that renders React children into a snippet's target.
- **SvelteKit imports**: Shell, Settings and browse state import `$app/state` / `$app/navigation`.
  Needs an `$app` shim (a static `page`, a no-op `goto`) aliased in `vite.config.js`. Worth having
  for the kit's own portability too.
