import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

// DS_NAMESPACE: the global the bundle assigns (`window.<namespace>`), which is
//   what a canvas mounts: `component-from-global-scope="Starlume.Select"`.
// DS_KIT_SRC: the kit source to compile. scripts/produce.mjs points it at the
//   app's INSTALLED kit, so the bundle is the version the app pins; default is
//   this workspace's packages/ui/src.
// DS_THEME_PATH: the app's theme bridge (its theme.css). Default: the kit's
//   stylesheet alone, on the kit's fallback tokens.
const namespace = process.env.DS_NAMESPACE || 'Starlume';
const kitSrc = process.env.DS_KIT_SRC || fileURLToPath(new URL('../ui/src', import.meta.url));
const themePath = process.env.DS_THEME_PATH;

const slash = (p) => p.replaceAll('\\', '/');
const cache = fileURLToPath(new URL('./.cache/', import.meta.url));
mkdirSync(cache, { recursive: true });
// An app's theme.css imports the kit's stylesheet itself (`@veelume/ui/styles.css`,
// resolved from the app, so the same installed kit as DS_KIT_SRC).
writeFileSync(
	cache + 'theme-entry.css',
	`@import 'tailwindcss';\n@import '${slash(themePath || `${kitSrc}/styles.css`)}';\n`
);

export default defineConfig({
	plugins: [tailwindcss(), svelte()],
	resolve: {
		alias: {
			$kit: kitSrc,
			$theme: cache + 'theme-entry.css'
		},
		// One Svelte runtime and one bits-ui, or contexts split (the kit's
		// pinning rule) — the kit source may live outside this package.
		dedupe: ['svelte', 'bits-ui', '@floating-ui/dom', '@internationalized/date']
	},
	define: {
		__NAMESPACE__: JSON.stringify(namespace),
		'process.env.NODE_ENV': '"production"'
	},
	build: {
		outDir: `dist/${namespace}`,
		emptyOutDir: true,
		minify: true,
		cssCodeSplit: false,
		lib: {
			entry: 'src/entry.js',
			formats: ['iife'],
			name: '__veelumeDesignBundle',
			fileName: () => 'bundle.js',
			cssFileName: 'bundle'
		}
	}
});
