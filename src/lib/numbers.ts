// The numeric tokens of a text, in the canonical form the content check compares.
// Text that only looks numeric (URLs, link targets, href/src values, ISO dates,
// versions, years) is removed or exempted, so it never needs to be in the bank.

const TOKEN = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

/**
 * Removed before tokenizing, in this order. href/src values and link targets go
 * before bare URLs, and a URL ends at a quote, angle bracket or backtick, so a
 * number written right after the markup that holds a URL is still checked.
 */
const REMOVED = [
  /\b(?:href|src)\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\}|[^\s>]+)/g,
  /\]\([^)]*\)/g,
  /https?:\/\/[^\s"'<>`]+/g,
  // A real date (1900–2099, month 01–12, day 01–31): `1024-64` is two numbers, not a date.
  /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?\b/g,
  /\bv?\d+(?:\.\d+){2,}\b/g,
  /\bv\d+(?:\.\d+)?\b/g,
];

/** A bare four-digit integer from 1990 to 2035, written without a comma. */
function isYear(raw: string): boolean {
  return /^\d{4}$/.test(raw) && Number(raw) >= 1990 && Number(raw) <= 2035;
}

/** Drops thousands commas and leading zeros of the integer part; decimals stay as written. */
export function canonical(token: string): string {
  const [int, frac] = token.replaceAll(',', '').split('.');
  const whole = int.replace(/^0+(?=\d)/, '');
  return frac === undefined ? whole : `${whole}.${frac}`;
}

/** The canonical numeric tokens of `text`, in order, without the removed and exempt ones. */
export function extractNumbers(text: string): string[] {
  // Each removed span becomes a space, so the digits on either side never join.
  const kept = REMOVED.reduce((t, pattern) => t.replace(pattern, ' '), text);
  return [...kept.matchAll(TOKEN)].map((m) => m[0]).filter((raw) => !isYear(raw)).map(canonical);
}

/** Every canonical token in every string inside `value` (arrays and objects are walked). */
export function numbersIn(value: unknown): Set<string> {
  const found = new Set<string>();
  const walk = (v: unknown): void => {
    if (typeof v === 'string') for (const n of extractNumbers(v)) found.add(n);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v !== null && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(value);
  return found;
}
