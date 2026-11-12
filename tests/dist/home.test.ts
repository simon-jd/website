// The home page as built: run after `npm run build`.
import { readFileSync } from 'node:fs';
import { parse } from 'node-html-parser';
import { expect, test } from 'vitest';
import { loadAllowlist } from '../../src/lib/allowlist.ts';
import { published } from './content.ts';

const html = readFileSync('dist/index.html', 'utf8');
const root = parse(html);
/** From <main> on, so the header's résumé pill does not stand in for the hero's links. */
const main = html.slice(html.indexOf('<main'));

const text = (s: string) => s.replace(/\s+/g, ' ').trim();

test('the hero says who and what', () => {
  const h1 = root.querySelectorAll('h1');
  expect(h1).toHaveLength(1);
  expect(text(h1[0].text)).toBe('Junrui Duan builds the systems under machine learning: kernels, serving, training loops.');
});

test('résumé, GitHub, LinkedIn and email come before the first section heading', () => {
  const heading = main.indexOf('<h2');
  expect(heading).toBeGreaterThan(0);
  for (const target of ['href="/resume.pdf"', 'https://github.com/simon-jd', 'linkedin.com/in/postedism', 'mailto:']) {
    const at = main.indexOf(target);
    expect(at, target).toBeGreaterThanOrEqual(0);
    expect(at, target).toBeLessThan(heading);
  }
});

test('the stats match the allowlist', () => {
  const { stats } = loadAllowlist().home;
  expect(stats.items.length).toBeGreaterThan(0);
  expect(root.querySelectorAll('.stats .value').map((v) => text(v.text))).toEqual(stats.items.map((i) => i.value));
});

test('four featured cards appear in plate order', () => {
  expect(root.querySelectorAll('[data-project]').map((card) => card.getAttribute('data-project'))).toEqual([
    'crucible',
    'kvsnap',
    'exactsample',
    'blockfp8',
  ]);
});

test('the writing section appears only when a post is published', () => {
  const count = published('writing').length;
  const heading = root.querySelectorAll('h2').find((h) => text(h.text) === 'Writing');
  expect(heading !== undefined).toBe(count > 0);
  if (heading) expect(root.querySelectorAll('.writing-list li')).toHaveLength(Math.min(count, 5));
});
