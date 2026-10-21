// Produces every CODE-DERIVED file of an app's Claude design system from the
// app's repository, so the system is a build output and never drifts:
//
//   project/tokens.json            from the app's :root blocks (app.css, theme.css)
//   project/tokens.css             compiled from tokens.json
//   project/fonts/*                the files the app's @font-face rules load
//   project/components/bundle.js   the app's INSTALLED kit, bridged to React
//   project/components/bundle.css  kit build + :root values tokens.json cannot hold + app idioms
//   project/components/index.d.ts
//   assets/Logos/*.svg             the app's icon sources (uploads, not files)
//   sync.json                      provenance and what changed against --previous
//
// Written docs (README, sections, component cards) are the system's own and
// are never produced here.
//
//   node scripts/produce.mjs --app ../../../starlume --namespace Starlume [--previous tokens.json] [--out dir]
//   node scripts/produce.mjs --app ../../../starlume --previous tokens.json --check
//
// `--previous` is the system's current tokens.json: its usage notes, samples
// and type details are kept, and anything it has that the app no longer
// defines is kept and listed (removing a token is the person's call).
// `--check` builds nothing: it exits 1 when an input changed since the
// commit `--previous` was produced from.

import { execFileSync } from 'node:child_process';
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(here, '..');

// ── arguments and app config ──────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : fallback;
};
// Paths are relative to where the command was typed (pnpm --filter runs us
// in this package, and records the caller's directory as INIT_CWD).
const cwd = process.env.INIT_CWD || process.cwd();
const app = path.resolve(cwd, opt('app', '.'));
const configFile = path.join(app, 'design-system.config.json');
// The defaults are the template-tauri layout every VeeLume app shares.
const config = {
	namespace: undefined,
	css: 'src/app.css',
	theme: 'src/theme.css',
	static: 'static',
	icons: 'src-tauri/icons/source',
	...(existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {})
};
const appName = JSON.parse(readFileSync(path.join(app, 'package.json'), 'utf8')).name;
const namespace =
	opt('namespace') || config.namespace || appName.charAt(0).toUpperCase() + appName.slice(1);
const previousFile = opt('previous');
const previous = previousFile
	? JSON.parse(readFileSync(path.resolve(cwd, previousFile), 'utf8'))
	: null;
const out = path.resolve(cwd, opt('out', path.join(pkg, 'dist', namespace, 'ds')));

const appCss = path.join(app, config.css);
const themeCss = existsSync(path.join(app, config.theme)) ? path.join(app, config.theme) : null;
const kitDir = path.join(app, 'node_modules', '@veelume', 'ui');
const kitVersion = JSON.parse(readFileSync(path.join(kitDir, 'package.json'), 'utf8')).version;
// The kit's version is compared on its own (meta.kit), so package.json is not
// an input: a release bump does not make the system stale.
const inputs = [config.css, config.theme, config.static + '/fonts', config.icons];

const git = (...a) => execFileSync('git', ['-C', app, ...a], { encoding: 'utf8' }).trim();
const sha = git('rev-parse', '--short', 'HEAD');
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
const remote = git('remote', 'get-url', 'origin')
	.replace(/^.*github\.com[:/]/, '')
	.replace(/\.git$/, '');
const dirty = git('status', '--porcelain', '--', ...inputs);

// ── --check ───────────────────────────────────────────────────────────────
if (flag('check')) {
	if (!previous?.meta?.ref) throw new Error('--check needs --previous with meta.ref');
	const was = previous.meta.ref.split('@').pop();
	const commits = git('log', '--format=%h %s', `${was}..HEAD`, '--', ...inputs);
	const kitWas = previous.meta.kit;
	const stale = [];
	if (commits) stale.push(`inputs changed since ${was}:\n${commits.replace(/^/gm, '  ')}`);
	if (dirty) stale.push(`uncommitted changes:\n${dirty.replace(/^/gm, '  ')}`);
	if (kitWas && kitWas !== kitVersion) stale.push(`kit ${kitWas} → ${kitVersion}`);
	console.log(stale.length ? `STALE\n${stale.join('\n')}` : `up to date with ${remote}@${sha}`);
	process.exit(stale.length ? 1 : 0);
}

// ── read the app's custom properties ──────────────────────────────────────
// Every `--name: value;` in a :root block (and an @theme inline block), with
// the comment that follows it on its line as the usage note.
function declarations(file) {
	const src = readFileSync(file, 'utf8');
	const found = [];
	const block = /(:root|@theme\s+inline)\s*\{/g;
	let m;
	while ((m = block.exec(src))) {
		let depth = 1;
		let i = block.lastIndex;
		while (depth && i < src.length) {
			if (src[i] === '{') depth++;
			else if (src[i] === '}') depth--;
			i++;
		}
		const body = src.slice(block.lastIndex, i - 1);
		const decl = /(?:\/\*[\s\S]*?\*\/)|(--[\w-]+|[a-z-]+)\s*:\s*([^;{}]+);([^\n]*)/g;
		let d;
		while ((d = decl.exec(body))) {
			if (!d[1]) continue;
			const note = /^\s*\/\*\s*([\s\S]*?)\s*\*\//.exec(d[3]);
			found.push({
				name: d[1],
				value: d[2].replace(/\s+/g, ' ').trim(),
				note: note ? note[1] : '',
				theme: m[1] !== ':root',
				file
			});
		}
	}
	return found;
}
const decls = [...declarations(appCss), ...(themeCss ? declarations(themeCss) : [])];

const COLOR = /^(#[0-9a-f]{3,8}|(rgba?|hsla?|oklch|oklab|lab|lch|color)\([^()]*\))$/i;
const VAR = /^var\(--([\w-]+)\)$/;
const LENGTH = /^-?\d*\.?\d+(px|rem|em|%)?$/;
const byName = new Map();
for (const d of decls) if (d.name.startsWith('--') && !d.theme) byName.set(d.name.slice(2), d);

const colors = new Map();
const isColor = (name, seen = new Set()) => {
	if (colors.has(name)) return true;
	const d = byName.get(name);
	if (!d || seen.has(name)) return false;
	if (COLOR.test(d.value)) return true;
	const v = VAR.exec(d.value);
	return v ? isColor(v[1], seen.add(name)) : false;
};

const tokens = { color: [], spacing: [], radius: [], shadow: [], layout: [] };
const families = {};
const styles = [];
const extras = []; // what tokens.json cannot hold; declared in bundle.css
for (const d of decls) {
	if (!d.name.startsWith('--')) {
		if (!d.theme) extras.push(`${d.name}: ${d.value}`);
		continue;
	}
	const name = d.name.slice(2);
	const entry = { name, usage: d.note };
	if (d.theme) {
		// @theme inline: only the radius scale is a token; the rest maps
		// utilities and is compiled into the kit build already.
		if (/^radius-/.test(name) && LENGTH.test(d.value))
			tokens.radius.push({ ...entry, value: d.value });
		continue;
	}
	const alias = VAR.exec(d.value);
	if (isColor(name)) {
		colors.set(name, true);
		tokens.color.push({ ...entry, value: alias ? `{${alias[1]}}` : d.value.toLowerCase() });
	} else if (/^font-(?!size)/.test(name)) {
		const target = alias && byName.get(alias[1]);
		families[name.slice(5)] = target ? target.value : d.value;
		extras.push(`${d.name}: ${d.value}`);
	} else if ((/^text-/.test(name) || /^font-size-/.test(name)) && LENGTH.test(d.value)) {
		const fam = /·\s*(display|sans|mono)/.exec(d.note);
		styles.push({
			name: 'type-' + name.replace(/^(text|font-size)-/, ''),
			fontSize: d.value,
			family: fam ? fam[1] : name === 'text-mono' ? 'mono' : 'sans',
			usage: d.note.replace(/\s*·.*$/, '')
		});
		extras.push(`${d.name}: ${d.value}`);
	} else if (/^radius/.test(name) && LENGTH.test(d.value))
		tokens.radius.push({ ...entry, value: d.value });
	else if (/^(space|gap|pad|content-pad|density)/.test(name) && LENGTH.test(d.value))
		tokens.spacing.push({ ...entry, value: d.value });
	else if (/^shadow/.test(name) && !/var\(/.test(d.value))
		tokens.shadow.push({ ...entry, value: d.value });
	else if (/-width$/.test(name) && LENGTH.test(d.value))
		tokens.layout.push({ ...entry, value: d.value });
	else extras.push(`${d.name}: ${d.value}`);
}

// One name, one token: the first definition wins (app.css before theme.css).
for (const k of Object.keys(tokens)) {
	const seen = new Set();
	tokens[k] = tokens[k].filter((t) => !seen.has(t.name) && seen.add(t.name));
}

// ── merge with the system's current tokens.json ───────────────────────────
const report = { added: [], changed: [], keptNotInSource: [] };
const prevFamily = (fam) =>
	fam === 'type'
		? (previous?.type?.groups ?? []).flatMap((g) =>
				g.styles.map((s) => ({ ...s, group: g.name, gfamily: g.family }))
			)
		: (previous?.[fam]?.tokens ?? []);
function merge(fam, list) {
	const prev = new Map(prevFamily(fam).map((t) => [t.name, t]));
	const next = list.map((t) => {
		const p = prev.get(t.name);
		if (!p) {
			report.added.push(`${fam}:${t.name}`);
			return t;
		}
		const pv =
			typeof p.value === 'object' && p.value !== null ? Object.values(p.value)[0] : p.value;
		if (fam !== 'type' && pv !== t.value)
			report.changed.push(`${fam}:${t.name} ${pv} → ${t.value}`);
		if (fam === 'type' && p.fontSize !== t.fontSize)
			report.changed.push(`type:${t.name} ${p.fontSize} → ${t.fontSize}`);
		// The source decides values; the system keeps its written notes and
		// details (a type style also keeps the group, so its family, it was put in).
		const { family, ...fromSource } = t;
		return { ...p, ...(fam === 'type' ? fromSource : t), usage: p.usage || t.usage };
	});
	const names = new Set(list.map((t) => t.name));
	for (const p of prev.values())
		if (!names.has(p.name)) {
			report.keptNotInSource.push(`${fam}:${p.name}`);
			next.push(p);
		}
	return next;
}
const prevGroups = previous?.type?.groups;
const mergedStyles = merge('type', styles);
const groups = prevGroups
	? prevGroups.map((g) => ({
			...g,
			styles: mergedStyles
				.filter((s) => (s.group ?? null) === g.name || (!s.group && s.family === g.family))
				.map(({ group, gfamily, family, ...s }) =>
					family && family !== g.family ? { ...s, family } : s
				)
		}))
	: ['display', 'sans', 'mono'].map((family) => ({
			name: family,
			family,
			styles: mergedStyles.filter((s) => s.family === family).map(({ family, ...s }) => s)
		}));

// ── fonts from @font-face ─────────────────────────────────────────────────
const fonts = [];
const cssSrc = readFileSync(appCss, 'utf8');
for (const f of cssSrc.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
	const get = (prop) => new RegExp(`${prop}\\s*:\\s*([^;]+);`).exec(f[1])?.[1].trim();
	const url = /url\(["']?([^"')]+)["']?\)/.exec(get('src') ?? '')?.[1];
	if (!url) continue;
	fonts.push({
		family: get('font-family').replace(/["']/g, ''),
		file: `fonts/${path.basename(url)}`,
		weight: get('font-weight') ?? '400',
		style: get('font-style') ?? 'normal',
		from: path.join(app, config.static, url.replace(/^\//, ''))
	});
}

const meta = {
	...(previous?.meta ?? {}),
	source: 'github',
	repo: remote,
	ref: `${branch}@${sha}${dirty ? '+dirty' : ''}`,
	kit: kitVersion,
	paths: {
		tokens: [config.css, config.theme],
		fonts: [`${config.static}/fonts/`],
		assets: [config.icons]
	},
	synced: new Date().toISOString().slice(0, 10)
};

const tokensJson = {
	name: previous?.name ?? namespace,
	version: previous?.version ?? 1,
	meta,
	color: {
		...(previous?.color ?? {}),
		themes: previous?.color?.themes ?? [{ id: 'dark', name: 'Dark' }],
		tokens: merge('color', tokens.color)
	},
	type: {
		fonts: fonts.map(({ from, ...f }) => f),
		families: { ...(previous?.type?.families ?? {}), ...families },
		groups
	},
	spacing: { ...(previous?.spacing ?? {}), tokens: merge('spacing', tokens.spacing) },
	radius: { ...(previous?.radius ?? {}), tokens: merge('radius', tokens.radius) },
	shadow: { ...(previous?.shadow ?? {}), tokens: merge('shadow', tokens.shadow) },
	layout: { ...(previous?.layout ?? {}), tokens: merge('layout', tokens.layout) }
};

// ── tokens.css, compiled the way the design system's page compiles it ─────
const val = (v) => (typeof v === 'string' && /^\{.+\}$/.test(v) ? `var(--${v.slice(1, -1)})` : v);
const firstTheme = tokensJson.color.themes[0].id;
const one = (v) =>
	typeof v === 'object' && v !== null ? (v[firstTheme] ?? Object.values(v)[0]) : v;
const title = config.title || `${namespace} Design System`;
const tokensCss = [
	`/* ${title} — generated from tokens.json */`,
	`:root, [data-theme="${firstTheme}"] {`,
	...tokensJson.color.tokens.map((t) => `  --${t.name}: ${val(one(t.value))};`),
	...tokensJson.shadow.tokens.map((t) => `  --${t.name}: ${one(t.value)};`),
	'}',
	':root {',
	...['spacing', 'radius', 'layout'].flatMap((f) =>
		tokensJson[f].tokens.map((t) => `  --${t.name}: ${t.value};`)
	),
	...Object.entries(tokensJson.type.families).map(([k, v]) => `  --font-${k}: ${v};`),
	'}',
	...tokensJson.type.groups.flatMap((g) =>
		g.styles.map((s) => {
			const d = [`font-family: var(--font-${s.family ?? g.family})`, `font-size: ${s.fontSize}`];
			if (s.lineHeight) d.push(`line-height: ${s.lineHeight}`);
			if (s.fontWeight) d.push(`font-weight: ${s.fontWeight}`);
			if (s.letterSpacing) d.push(`letter-spacing: ${s.letterSpacing}`);
			return `.${s.name} { ${d.join('; ')}; }`;
		})
	),
	...tokensJson.type.fonts.map(
		(f) =>
			`@font-face { font-family: "${f.family}"; src: url("${f.file}") format("woff2"); font-weight: ${f.weight}; font-style: ${f.style}; font-display: swap; }`
	)
].join('\n');

// ── the bundle: the app's installed kit, its theme.css ────────────────────
execFileSync(
	process.execPath,
	[path.join(pkg, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
	{
		cwd: pkg,
		stdio: 'inherit',
		env: {
			...process.env,
			DS_NAMESPACE: namespace,
			DS_KIT_SRC: path.join(kitDir, 'src'),
			...(themeCss ? { DS_THEME_PATH: themeCss } : {})
		}
	}
);
execFileSync(process.execPath, [path.join(here, 'finish.mjs')], {
	cwd: pkg,
	stdio: 'inherit',
	env: { ...process.env, DS_NAMESPACE: namespace }
});
const built = path.join(pkg, 'dist', namespace);

// App idioms: app.css without its imports, @font-face rules and :root blocks
// (those became tokens.css and the :root below).
let idioms = cssSrc.replace(/@import[^;]+;/g, '').replace(/@font-face\s*\{[^}]*\}/g, '');
for (const m of [...idioms.matchAll(/:root\s*\{/g)].reverse()) {
	let depth = 1;
	let i = m.index + m[0].length;
	while (depth && i < idioms.length) {
		if (idioms[i] === '{') depth++;
		else if (idioms[i] === '}') depth--;
		i++;
	}
	idioms = idioms.slice(0, m.index) + idioms.slice(i);
}
const bundleCss = [
	`/* ${namespace}: @veelume/ui ${kitVersion} (Tailwind 4, preflight, ${config.theme}), then the :root values tokens.json cannot hold, then ${config.css}'s own rules. Produced from ${remote}@${sha}. */`,
	readFileSync(path.join(built, 'bundle.css'), 'utf8'),
	`:root {\n${extras.map((e) => `  ${e};`).join('\n')}\n}`,
	idioms.trim()
].join('\n\n');
if (/<\/style/i.test(bundleCss)) throw new Error('bundle.css contains </style');

// ── write ─────────────────────────────────────────────────────────────────
const write = (rel, data) => {
	const file = path.join(out, rel);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, data);
};
write('project/tokens.json', JSON.stringify(tokensJson, null, 2) + '\n');
write('project/tokens.css', tokensCss + '\n');
write('project/components/bundle.css', bundleCss + '\n');
for (const f of ['bundle.js', 'index.d.ts'])
	copyFileSync(path.join(built, f), path.join(out, 'project/components', f));
mkdirSync(path.join(out, 'project/fonts'), { recursive: true });
for (const f of fonts) copyFileSync(f.from, path.join(out, 'project', f.file));
const iconDir = path.join(app, config.icons);
const logos = existsSync(iconDir) ? readdirSync(iconDir).filter((f) => f.endsWith('.svg')) : [];
mkdirSync(path.join(out, 'assets/Logos'), { recursive: true });
for (const f of logos)
	copyFileSync(
		path.join(iconDir, f),
		path.join(out, 'assets/Logos', `${namespace.toLowerCase()}-${f}`)
	);
write(
	'sync.json',
	JSON.stringify(
		{ namespace, from: `${remote}@${sha}`, dirty: !!dirty, kit: kitVersion, ...report },
		null,
		2
	) + '\n'
);

console.log(`\n${namespace} design system files → ${out}`);
console.log(
	`  from ${remote}@${sha}${dirty ? ' (uncommitted input changes!)' : ''}, kit ${kitVersion}`
);
for (const [k, v] of Object.entries(report)) if (v.length) console.log(`  ${k}: ${v.join(', ')}`);
