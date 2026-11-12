// The structural accessibility rules, page by page: run after `npm run build`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { expect, test } from 'vitest';

const pages = readdirSync('dist', { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
  .map((entry) => join(entry.parentPath, entry.name))
  .sort();

test('the build has pages to check', () => {
  expect(pages.length).toBeGreaterThan(0);
});

test.each(pages)('%s', (file) => {
  const root = parse(readFileSync(file, 'utf8'));

  expect(root.querySelector('html')?.getAttribute('lang'), 'lang').toBe('en');
  expect(root.querySelectorAll('h1'), 'one h1').toHaveLength(1);

  // In document order, each heading is at most one level below the one before it, and
  // the first is the h1.
  const levels = root.querySelectorAll('h1, h2, h3, h4, h5, h6').map((h) => Number(h.tagName[1]));
  levels.forEach((level, i) => {
    expect(level, `heading ${i + 1} of ${levels.join(',')}`).toBeLessThanOrEqual((levels[i - 1] ?? 0) + 1);
  });

  for (const img of root.querySelectorAll('img')) {
    expect(img.hasAttribute('alt'), `alt on ${img.toString().slice(0, 120)}`).toBe(true);
  }
  for (const svg of root.querySelectorAll('svg[role="img"]')) {
    expect(svg.getAttribute('aria-label')?.trim(), `aria-label on ${svg.toString().slice(0, 120)}`).toBeTruthy();
  }

  const first = root.querySelector('a');
  expect(first?.getAttribute('href'), 'first link').toBe('#main');
  expect(first?.classList.contains('skip'), 'first link is the skip link').toBe(true);
  expect(root.querySelector('main#main'), '<main id="main">').not.toBeNull();
});
