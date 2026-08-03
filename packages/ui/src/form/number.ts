/**
 * Locale-aware number parsing.
 *
 * Formatting is easy (`Intl.NumberFormat`); PARSING is the gap, and it is a
 * real one. A German user types `1.234,56`. A native `<input type="number">` on
 * an en-US browser silently rejects the comma, and `Number("1.234,56")` is
 * `NaN`. bits-ui has no number field, so this is owed rather than optional.
 *
 * Separators are asked of the runtime rather than hardcoded per region:
 * de-DE groups with `.` and decimates with `,`, fr-FR groups with a narrow
 * no-break space, en-US is the reverse of de-DE. A lookup table would be wrong
 * within a year.
 */

const cache = new Map<string, { group: string; decimal: string }>();

export function localeSeparators(locale: string): { group: string; decimal: string } {
	let hit = cache.get(locale);
	if (hit) return hit;
	let group = ',';
	let decimal = '.';
	try {
		const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
		group = parts.find((p) => p.type === 'group')?.value ?? group;
		decimal = parts.find((p) => p.type === 'decimal')?.value ?? decimal;
	} catch {
		/* fall through to the en-US-ish default */
	}
	hit = { group, decimal };
	cache.set(locale, hit);
	return hit;
}

/**
 * Parse what a user typed, in their locale. Returns `null` for anything that is
 * not a number — including the empty string, so a caller can distinguish
 * "cleared" from "zero".
 *
 * Uses split/join rather than a regex: the group separator is often `.`, and
 * building a regex from it invites an escaping bug that only shows up in one
 * locale.
 */
export function parseLocaleNumber(input: string, locale: string): number | null {
	const { group, decimal } = localeSeparators(locale);
	let s = input.trim();
	if (!s) return null;

	// Every kind of space, including the narrow no-break space fr-FR groups with.
	s = s.replace(/[\s  ]/g, '');
	s = s.split(group).join('');
	if (decimal !== '.') s = s.split(decimal).join('.');
	// Anything left that is not a digit, sign or point is not ours to guess at.
	s = s.replace(/[^0-9.\-+]/g, '');

	if (!s || s === '-' || s === '+' || s === '.') return null;
	const n = Number(s);
	return Number.isFinite(n) ? n : null;
}

export function formatLocaleNumber(
	value: number,
	locale: string,
	options?: Intl.NumberFormatOptions
): string {
	try {
		return new Intl.NumberFormat(locale, options).format(value);
	} catch {
		return String(value);
	}
}
