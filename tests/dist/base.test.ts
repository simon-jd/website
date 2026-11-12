// The Base layout as built: run after `npm run build`.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parse } from 'node-html-parser';
import { expect, test } from 'vitest';
import { THEME_INIT, THEME_TOGGLE } from '../../src/lib/theme.ts';

const html = readFileSync('dist/index.html', 'utf8');
const root = parse(html);

/** Every stylesheet the page uses: its inline <style> blocks plus any linked files. */
const css = [
  ...root.querySelectorAll('style').map((s) => s.rawText),
  ...root
    .querySelectorAll('link[rel="stylesheet"]')
    .map((l) => readFileSync(`dist${l.getAttribute('href')}`, 'utf8')),
].join('\n');

const FONTS = [
  'cormorant-garamond-500-normal',
  'cormorant-garamond-400-italic',
  'inter-400-normal',
  'jetbrains-mono-400-normal',
];

/** `/_astro/inter-400-normal.Ab12Cd.woff2` → `inter-400-normal`. */
const face = (url: string) => basename(url).split('.')[0];

test('theme init runs before the first stylesheet', () => {
  const init = html.indexOf(THEME_INIT);
  const styles = [html.indexOf('<style'), html.indexOf('rel="stylesheet"')].filter((i) => i >= 0);
  expect(init).toBeGreaterThanOrEqual(0);
  expect(styles.length).toBeGreaterThan(0);
  expect(init).toBeLessThan(Math.min(...styles));
});

test('the skip link is the first link and targets main', () => {
  expect(root.querySelector('body a')?.getAttribute('href')).toBe('#main');
  expect(root.querySelector('main#main')).not.toBeNull();
});

test('the theme toggle ships hidden for visitors without JS', () => {
  const button = root.querySelector('button#theme-toggle');
  expect(button).not.toBeNull();
  expect(button!.hasAttribute('hidden')).toBe(true);
});

test('the toggle script comes after the button it un-hides', () => {
  expect(html.indexOf(THEME_TOGGLE)).toBeGreaterThan(html.indexOf('id="theme-toggle"'));
});

test('only the four font files are referenced', () => {
  const woff2 = [...css.matchAll(/url\(\s*["']?([^"')\s]+\.woff2)/g)].map((m) => face(m[1]));
  expect(new Set(woff2)).toEqual(new Set(FONTS));
});

test('bold is Inter 400 thickened by a stroke, so no bold font file loads', () => {
  // The minifier may reorder the declarations, so each is checked on its own.
  const rule = css.match(/(?:^|[}\s])strong\s*\{([^}]*)\}/)?.[1] ?? '';
  expect(rule).toMatch(/font-weight:\s*400/);
  expect(rule).toMatch(/-webkit-text-stroke:\s*0?\.035em\s+currentcolor/i);
});

test('link underlines use longhands, which Safari before 26.2 can apply', () => {
  // Safari before 26.2 fails a `text-decoration` shorthand holding var() at computed-value
  // time and drops the underline altogether, so links lose their non-color cue.
  const shorthands = [...css.matchAll(/text-decoration\s*:\s*([^;}]*)/g)].map((m) => m[1].trim());
  expect(shorthands.filter((value) => value.includes('var('))).toEqual([]);
  const linkRules = [...css.matchAll(/(?:^|\})\s*a\s*\{([^}]*)\}/g)].map((m) => m[1]);
  expect(linkRules.some((body) => /text-decoration-line\s*:\s*underline/.test(body))).toBe(true);
});

test('the display font is preloaded', () => {
  const fonts = root.querySelectorAll('link[rel="preload"][as="font"]');
  expect(fonts).toHaveLength(1);
  const href = fonts[0].getAttribute('href')!;
  expect(face(href)).toBe('cormorant-garamond-500-normal');
  expect(fonts[0].hasAttribute('crossorigin')).toBe(true);
  // The preload must fetch the same file the @font-face uses, or the font downloads twice.
  expect(css).toContain(href);
});
