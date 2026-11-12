import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';

const { lighthouseUrls } = createRequire(import.meta.url)('../../scripts/lighthouse-urls.cjs') as {
  lighthouseUrls: (dist: string) => string[];
};

let dist = '';
beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'lighthouse-urls-'));
});
afterEach(() => rmSync(dist, { recursive: true, force: true }));

/** Writes `body` to dist/<path>, making its folders. */
function put(path: string, body = '<!doctype html>'): void {
  mkdirSync(dirname(join(dist, path)), { recursive: true });
  writeFileSync(join(dist, path), body);
}

/** A feed whose items link to `slugs`, in that order (the feed lists posts newest first). */
const feed = (slugs: string[]) =>
  `<?xml version="1.0"?><rss><channel><title>t</title><link>https://example.dev/</link>${slugs
    .map((s) => `<item><title>${s}</title><link>https://example.dev/writing/${s}/</link></item>`)
    .join('')}</channel></rss>`;

test('the home page, the first case study by id and the newest post', () => {
  put('index.html');
  put('work/index.html');
  put('work/zeta/index.html');
  put('work/alpha/index.html');
  put('writing/newest/index.html');
  put('writing/older/index.html');
  put('rss.xml', feed(['newest', 'older']));
  expect(lighthouseUrls(dist)).toEqual(['/', '/work/alpha/', '/writing/newest/']);
});

test('only the home page when nothing else is published', () => {
  put('index.html');
  put('work/index.html');
  put('rss.xml', feed([]));
  expect(lighthouseUrls(dist)).toEqual(['/']);
});

test('a post without a case study, and a case study without a post', () => {
  put('index.html');
  put('writing/only/index.html');
  put('rss.xml', feed(['only']));
  expect(lighthouseUrls(dist)).toEqual(['/', '/writing/only/']);
  rmSync(join(dist, 'rss.xml'));
  put('work/beta/index.html');
  expect(lighthouseUrls(dist)).toEqual(['/', '/work/beta/']);
});

test('fails without a build, and when the feed names a post that has no page', () => {
  expect(() => lighthouseUrls(dist)).toThrow(/index\.html is missing; run npm run build first/);
  put('index.html');
  put('rss.xml', feed(['gone']));
  expect(() => lighthouseUrls(dist)).toThrow(/newest post \/writing\/gone\/ has no page/);
});
