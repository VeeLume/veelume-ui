// React → Svelte bridge for @veelume/ui.
//
// The Design canvas mounts React components (`<x-import
// component-from-global-scope="Ns.Comp">`); the kit is Svelte 5. Each export
// here is a React component that mounts the REAL kit component into a
// `display: contents` span and forwards props on every render.
//
// Mock-friendly by default: a controlled kit component (value + onchange)
// keeps its own state in the wrapper when the canvas passes no handler, so a
// Select selects and a Switch switches with no wiring. Pass `value` and
// `onChange` to control it from the artboard's state instead.
//
// Not bridged yet: children other than text (Surface, Expand, dialog bodies
// take snippets) and components importing SvelteKit's `$app/*` (Shell,
// Settings, browse state) — those need a children bridge and an `$app` shim.

import { mount, unmount, createRawSnippet } from 'svelte';
import Button from '$kit/actions/Button.svelte';
import RadioGroup from '$kit/form/RadioGroup.svelte';
import Segmented from '$kit/form/Segmented.svelte';
import Select from '$kit/form/Select.svelte';
import Switch from '$kit/form/Switch.svelte';
import { reactiveProps } from './props.svelte.js';

const R = () => window.React;

const esc = (s) =>
	String(s).replace(
		/[&<>"]/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
	);

/** Text children → a Svelte snippet. Elements other than text are not bridged. */
function textOf(children) {
	if (children == null || children === false) return '';
	if (Array.isArray(children)) return children.map(textOf).join('');
	if (typeof children === 'string' || typeof children === 'number') return String(children);
	return '';
}
function snippetOf(children) {
	const text = textOf(children);
	return createRawSnippet(() => ({ render: () => `<span>${esc(text)}</span>` }));
}

/** "By ore, By place" or [{value,label}] or ["a","b"] → SelectOption[] */
function optionsOf(options) {
	if (options == null) return [];
	const list = typeof options === 'string' ? options.split(',') : options;
	return list.map((o) =>
		typeof o === 'object' && o !== null
			? { ...o, value: String(o.value ?? o.label), label: String(o.label ?? o.value) }
			: { value: String(o).trim(), label: String(o).trim() }
	);
}

/**
 * Wrap a Svelte component. `toSvelte(props, local, setLocal)` returns the
 * Svelte props for this render; `initial(props)` seeds the wrapper's state.
 */
function wrap(name, Component, toSvelte, initial = () => ({})) {
	function Wrapped(props) {
		const React = R();
		const host = React.useRef(null);
		const live = React.useRef(null);
		const [local, setLocal] = React.useState(() => initial(props));
		const next = toSvelte(props, local, setLocal);

		React.useLayoutEffect(() => {
			const p = reactiveProps({ ...next });
			const instance = mount(Component, { target: host.current, props: p });
			live.current = p;
			return () => {
				live.current = null;
				unmount(instance);
			};
		}, []);
		React.useLayoutEffect(() => {
			if (live.current) Object.assign(live.current, next);
		});
		return React.createElement('span', { ref: host, style: { display: 'contents' } });
	}
	Wrapped.displayName = name;
	return Wrapped;
}

/** value/defaultValue + onChange, uncontrolled unless `value` is given. */
function choice(props, local, setLocal, fallback) {
	const value = props.value !== undefined ? String(props.value) : (local.value ?? fallback);
	const onchange = (v) => {
		if (props.value === undefined) setLocal({ ...local, value: v });
		props.onChange?.(v);
	};
	return { value, onchange };
}

// Keep in step with NAMES in ./names.js (the bundle header lists them).
export const components = {
	Button: wrap('Button', Button, (p) => ({
		variant: p.variant ?? 'primary',
		size: p.size ?? 'chrome',
		href: p.href,
		disabled: !!p.disabled,
		title: p.title,
		type: p.type ?? 'button',
		class: p.className ?? '',
		onclick: p.onClick,
		children: snippetOf(p.children)
	})),

	Segmented: wrap(
		'Segmented',
		Segmented,
		(p, local, setLocal) => {
			const options = optionsOf(p.options);
			return {
				options,
				disabled: !!p.disabled,
				class: p.className ?? '',
				...choice(p, local, setLocal, options[0]?.value ?? '')
			};
		},
		(p) => ({ value: p.defaultValue })
	),

	Select: wrap(
		'Select',
		Select,
		(p, local, setLocal) => {
			const options = optionsOf(p.options);
			return {
				options,
				label: p.label,
				id: p.id,
				disabled: !!p.disabled,
				placeholder: p.placeholder ?? '',
				searchFrom: p.searchFrom ?? 12,
				class: p.className ?? '',
				...choice(p, local, setLocal, options[0]?.value ?? '')
			};
		},
		(p) => ({ value: p.defaultValue })
	),

	RadioGroup: wrap(
		'RadioGroup',
		RadioGroup,
		(p, local, setLocal) => {
			const options = optionsOf(p.options);
			return {
				label: p.label,
				options,
				class: p.className ?? '',
				...choice(p, local, setLocal, options[0]?.value ?? '')
			};
		},
		(p) => ({ value: p.defaultValue })
	),

	Switch: wrap(
		'Switch',
		Switch,
		(p, local, setLocal) => {
			const checked = p.checked !== undefined ? !!p.checked : local.checked;
			return {
				checked,
				disabled: !!p.disabled,
				id: p.id,
				label: p.label ?? (textOf(p.children) || undefined),
				onchange: (next) => {
					if (p.checked === undefined) setLocal({ checked: next });
					p.onChange?.(next);
				}
			};
		},
		(p) => ({ checked: !!p.defaultChecked })
	)
};
