import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

// DS_NAMESPACE: the global the bundle assigns (`window.<namespace>`), which is
//   what a canvas mounts: `component-from-global-scope="Starlume.Select"`.
// DS_THEME: a file in themes/ — the app's theme bridge onto the kit's tokens.
const namespace = process.env.DS_NAMESPACE || 'Starlume';
const theme = process.env.DS_THEME || 'starlume';

export default defineConfig({
	plugins: [tailwindcss(), svelte()],
	resolve: {
		alias: {
			$kit: fileURLToPath(new URL('../ui/src', import.meta.url)),
			$theme: fileURLToPath(new URL(`./themes/${theme}.css`, import.meta.url))
		},
		// The kit's sources live in packages/ui; one Svelte runtime and one
		// bits-ui, or contexts split (the kit's pinning rule).
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
