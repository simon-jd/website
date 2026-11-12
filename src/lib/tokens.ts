// The color tokens' day and night values, read from tokens.css itself, for the places
// CSS cannot reach: the theme-color meta tags and the social cards. Read from disk, as
// the allowlist is, because vitest blanks imported CSS.
import { readFileSync } from 'node:fs';

const TOKEN = /--([a-z-]+):\s*light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)/gi;

const css = readFileSync('src/styles/tokens.css', 'utf8');

/** `bg` → `{ day: '#f4f2ed', night: '#232824' }`, for every light-dark() token. */
export const TOKENS: Record<string, { day: string; night: string }> = Object.fromEntries(
  [...css.matchAll(TOKEN)].map(([, name, day, night]) => [name, { day, night }]),
);

/** A token's day value; throws for a name tokens.css does not define. */
export function day(name: string): string {
  const token = TOKENS[name];
  if (!token) throw new Error(`tokens.css has no color token --${name}`);
  return token.day;
}
