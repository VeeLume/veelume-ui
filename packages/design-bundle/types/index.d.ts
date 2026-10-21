// window.<namespace> — React wrappers that mount the real @veelume/ui Svelte
// components. Choice components are uncontrolled unless `value` / `checked`
// is passed: with no handler they keep their own state, so a mock works
// without wiring. Children are text only.

/** "A, B, C", ["A", "B"], or [{ value, label }] */
export type Options = string | string[] | { value: string; label: string }[];

export interface ButtonProps {
	/** primary: the one thing the surface is for. Default primary. */
	variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
	/** chrome: 36px bar button; field: matches a field's height; icon: square. */
	size?: 'chrome' | 'field' | 'icon';
	href?: string;
	disabled?: boolean;
	title?: string;
	type?: 'button' | 'submit';
	className?: string;
	onClick?: () => void;
	/** The label, as text. */
	children?: string;
}

export interface SegmentedProps {
	/** 2–4 short options. */
	options: Options;
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	disabled?: boolean;
	className?: string;
}

export interface SelectProps {
	/** 5+ options, or options from data. A search field appears from `searchFrom` (12). */
	options: Options;
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	label?: string;
	id?: string;
	disabled?: boolean;
	placeholder?: string;
	searchFrom?: number;
	className?: string;
}

export interface SwitchProps {
	/** A setting, on or off. */
	checked?: boolean;
	defaultChecked?: boolean;
	onChange?: (next: boolean) => void;
	label?: string;
	id?: string;
	disabled?: boolean;
}

export interface RadioGroupProps {
	/** One of many, inside a panel. */
	options: Options;
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	label?: string;
	className?: string;
}

export declare const Button: (props: ButtonProps) => unknown;
export declare const Segmented: (props: SegmentedProps) => unknown;
export declare const Select: (props: SelectProps) => unknown;
export declare const Switch: (props: SwitchProps) => unknown;
export declare const RadioGroup: (props: RadioGroupProps) => unknown;
