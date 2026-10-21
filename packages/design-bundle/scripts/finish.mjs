// After `vite build`: make dist/<namespace>/bundle.js a valid design-system
// bundle — the `@ds-bundle` header first, and no sequence that would end or
// escape the inline <script> a consumer may put it in. Copies the types.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NAMES } from '../src/names.js';

const namespace = process.env.DS_NAMESPACE || 'Starlume';
const dir = fileURLToPath(new URL(`../dist/${namespace}/`, import.meta.url));

let js = readFileSync(dir + 'bundle.js', 'utf8');
// Svelte's template strings carry "<!---->" markers; escape inside the literal.
js = js.split('<!--').join('\\x3C!--');
if (/<\/script/i.test(js)) throw new Error('bundle.js contains </script');
const header = { format: 4, namespace, components: NAMES.map((name) => ({ name })) };
writeFileSync(dir + 'bundle.js', `/* @ds-bundle: ${JSON.stringify(header)} */\n${js}`);

const css = readFileSync(dir + 'bundle.css', 'utf8');
if (/<\/style/i.test(css)) throw new Error('bundle.css contains </style');

copyFileSync(fileURLToPath(new URL('../types/index.d.ts', import.meta.url)), dir + 'index.d.ts');
console.log(
	`dist/${namespace}: bundle.js ${(js.length / 1024).toFixed(0)} KB, bundle.css ${(css.length / 1024).toFixed(0)} KB, ${NAMES.join(', ')}`
);
