// The home page's transfer budget, measured without a browser: run after `npm run build`.
// Text is measured gzipped with node:zlib at its default level. Fonts and images are
// already compressed and servers send them as they are, so they count at file size.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'node-html-parser';
import { expect, test } from 'vitest';

const KB = 1024;
const gzipped = (text: string) => gzipSync(text).length;
/** A root-relative URL from the build, as its file in dist. */
const file = (url: string) => join('dist', new URL(url, 'https://site.invalid/').pathname);

const pages = readdirSync('dist', { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
  .map((entry) => join(entry.parentPath, entry.name))
  .sort();
const assets = readdirSync('dist/_astro');

const html = readFileSync('dist/index.html', 'utf8');
const home = parse(html);

/** The four faces every page draws with; bold is Inter 400 with a stroke, so there is no fifth file. */
const HOME_FACES = [
  'cormorant-garamond-500-normal',
  'cormorant-garamond-400-italic',
  'inter-400-normal',
  'jetbrains-mono-400-normal',
];

/** The size of the one woff2 file of `face` in dist/_astro. */
function woff2(face: string): number {
  const found = assets.filter((name) => name.startsWith(`${face}.`) && name.endsWith('.woff2'));
  expect(found, face).toHaveLength(1);
  return statSync(join('dist/_astro', found[0])).size;
}

test('home HTML, with its inlined CSS, plus any linked CSS is at most 40 KB', () => {
  const linked = home
    .querySelectorAll('link[rel="stylesheet"]')
    .map((link) => gzipped(readFileSync(file(link.getAttribute('href')!), 'utf8')));
  const total = gzipped(html) + linked.reduce((a, b) => a + b, 0);
  expect(total).toBeLessThanOrEqual(40 * KB);
});

test.each(pages)('inline plus linked JS on %s is at most 5 KB', (page) => {
  const scripts = parse(readFileSync(page, 'utf8')).querySelectorAll('script');
  const inline = scripts.filter((s) => !s.hasAttribute('src')).map((s) => s.rawText);
  const linked = scripts
    .filter((s) => s.hasAttribute('src'))
    .map((s) => gzipped(readFileSync(file(s.getAttribute('src')!), 'utf8')));
  const total = (inline.length ? gzipped(inline.join('\n')) : 0) + linked.reduce((a, b) => a + b, 0);
  expect(total).toBeLessThanOrEqual(5 * KB);
});

test('each relief AVIF is at most 60 KB', () => {
  const reliefs = assets.filter((name) => name.startsWith('relief-') && name.endsWith('.avif'));
  expect(reliefs.length).toBeGreaterThan(0);
  for (const name of reliefs) expect(statSync(join('dist/_astro', name)).size, name).toBeLessThanOrEqual(60 * KB);
});

test('the four faces together are at most 110 KB', () => {
  const faces = HOME_FACES.map(woff2).reduce((a, b) => a + b, 0);
  expect(faces).toBeLessThanOrEqual(110 * KB);
});
