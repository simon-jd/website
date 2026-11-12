// WCAG 2.2 contrast of the color tokens, in both themes, read from tokens.css itself.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
const TOKEN = /--([a-z-]+):\s*light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)/gi;
const tokens = new Map([...css.matchAll(TOKEN)].map((m) => [m[1], { day: m[2], night: m[3] }]));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('tokens.css pairs a day and a night value for every color token', () => {
  expect([...tokens.keys()].sort()).toEqual(
    ['accent', 'bg', 'ink', 'line', 'mark', 'muted', 'on-accent', 'panel'],
  );
});

const PAIRS: [fg: string, bg: string, min: number][] = [
  ['ink', 'bg', 4.5],
  ['ink', 'panel', 4.5],
  ['muted', 'bg', 4.5],
  ['muted', 'panel', 4.5],
  ['accent', 'bg', 4.5],
  ['accent', 'panel', 4.5],
  ['on-accent', 'accent', 4.5],
  ['mark', 'bg', 3],
  ['mark', 'panel', 3],
];

test.each(PAIRS.flatMap(([fg, bg, min]) => (['day', 'night'] as const).map((t) => [fg, bg, t, min] as const)))(
  '%s on %s (%s) is at least %d:1',
  (fg, bg, t, min) => {
    const ratio = contrast(tokens.get(fg)![t], tokens.get(bg)![t]);
    expect(ratio).toBeGreaterThanOrEqual(min);
  },
);
