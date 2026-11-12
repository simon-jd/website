// Page metadata, the social cards, the sitemap and robots.txt as built: run after `npm run build`.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { parse, type HTMLElement } from 'node-html-parser';
import { expect, test } from 'vitest';
import { entries, published, type Folder } from './content.ts';

const DIST = 'dist';
/** The site the build was made for: astro.config.mjs reads SITE_URL and falls back to this. */
const SITE_URL = process.env.SITE_URL ?? 'https://junruiduan.pages.dev';
const ORIGIN = new URL(SITE_URL).origin;

/** Every file under dist/, as a path relative to it. */
const files = readdirSync(DIST, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => relative(DIST, join(d.parentPath, d.name)));

/** `work/crucible/index.html` → `/work/crucible/`; any other HTML file keeps its name. */
const urlPath = (file: string) => `/${file.replace(/(^|\/)index\.html$/, '$1')}`;

const pages = files
  .filter((f) => f.endsWith('.html'))
  .map((file) => {
    const head = parse(readFileSync(join(DIST, file), 'utf8')).querySelector('head');
    if (!head) throw new Error(`dist/${file} has no <head>`);
    return { file, path: urlPath(file), head };
  });

const caseStudies = new Set(published('case-studies').map((e) => e.slug));
const posts = new Set(published('writing').map((e) => e.slug));

/** The card a page points to: its own for a case study or a post, the default card otherwise. */
function cardFor(path: string): string {
  const [, section, slug, rest] = path.split('/');
  if (rest === '' && section === 'work' && caseStudies.has(slug)) return `/og/work/${slug}.png`;
  if (rest === '' && section === 'writing' && posts.has(slug)) return `/og/writing/${slug}.png`;
  return '/og/default.png';
}

const meta = (head: HTMLElement, key: string) =>
  head.querySelector(`meta[property="${key}"], meta[name="${key}"]`)?.getAttribute('content');

/** The PNG's width and height, read from its IHDR chunk; undefined if it is not a PNG. */
function pngSize(file: string): [number, number] | undefined {
  const png = readFileSync(join(DIST, file));
  if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return undefined;
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

test('every page has an og:image that exists in dist', () => {
  expect(pages.length).toBeGreaterThan(0);
  for (const { file, path, head } of pages) {
    const image = new URL(meta(head, 'og:image') ?? '', 'invalid:/');
    expect(image.origin, file).toBe(ORIGIN);
    expect(image.pathname, file).toBe(cardFor(path));
    expect(pngSize(image.pathname.slice(1)), file).toEqual([1200, 630]);
  }
});

test('every page has a canonical URL on the site origin', () => {
  for (const { file, path, head } of pages) {
    const canonical = head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
    expect(canonical.startsWith(`${ORIGIN}/`), `${file}: ${canonical}`).toBe(true);
    if (file.endsWith('index.html')) expect(canonical, file).toBe(`${ORIGIN}${path}`);
    expect(meta(head, 'og:url'), file).toBe(canonical);
  }
});

test('every page carries its title, description, card and feed tags', () => {
  for (const { file, path, head } of pages) {
    const title = head.querySelector('title')?.text.trim();
    const description = meta(head, 'description');
    expect(title, file).toBeTruthy();
    expect(description, file).toBeTruthy();
    expect(meta(head, 'og:title'), file).toBe(title);
    expect(meta(head, 'og:description'), file).toBe(description);
    expect(meta(head, 'og:type'), file).toBe(cardFor(path) === '/og/default.png' ? 'website' : 'article');
    expect(meta(head, 'twitter:card'), file).toBe('summary_large_image');
    expect(head.querySelector('link[rel="alternate"][type="application/rss+xml"]')?.getAttribute('href'), file).toBe(
      '/rss.xml',
    );
    const themes = head
      .querySelectorAll('meta[name="theme-color"]')
      .map((m) => [m.getAttribute('media'), m.getAttribute('content')]);
    expect(themes, file).toEqual([
      ['(prefers-color-scheme: light)', '#f4f2ed'],
      ['(prefers-color-scheme: dark)', '#232824'],
    ]);
  }
});

test('/og/ holds the default card and one card per published case study and post', () => {
  const cards = files.filter((f) => f.startsWith('og/')).toSorted();
  const expected = [
    'og/default.png',
    ...[...caseStudies].map((slug) => `og/work/${slug}.png`),
    ...[...posts].map((slug) => `og/writing/${slug}.png`),
  ];
  expect(cards).toEqual(expected.toSorted());
  for (const card of cards) expect(pngSize(card), card).toEqual([1200, 630]);
});

test('the sitemap lists the main pages and no drafts or cards', () => {
  const xml = new XMLParser({ isArray: (name) => name === 'sitemap' || name === 'url' });
  const index = xml.parse(readFileSync(join(DIST, 'sitemap-index.xml'), 'utf8'));
  const sitemaps: string[] = index.sitemapindex.sitemap.map((s: { loc: string }) => s.loc);
  expect(sitemaps.length).toBeGreaterThan(0);
  const urls = sitemaps.flatMap((loc) => {
    expect(new URL(loc).origin, loc).toBe(ORIGIN);
    const urlset = xml.parse(readFileSync(join(DIST, new URL(loc).pathname), 'utf8')).urlset;
    return (urlset.url ?? []).map((u: { loc: string }) => u.loc);
  });
  const paths = urls.map((u: string) => {
    expect(new URL(u).origin, u).toBe(ORIGIN);
    return new URL(u).pathname;
  });
  for (const main of ['/', '/work/', '/writing/', '/about/']) expect(paths).toContain(main);
  expect(paths.filter((p: string) => p.startsWith('/og/') || p === '/404/')).toEqual([]);
  const sections: [Folder, string][] = [
    ['writing', 'writing'],
    ['case-studies', 'work'],
    ['focus', 'focus'],
  ];
  for (const [folder, section] of sections)
    for (const draft of entries(folder).filter((e) => e.data.draft === true))
      expect(paths, draft.file).not.toContain(`/${section}/${draft.slug}/`);
  // Every page is listed, and nothing else.
  expect(paths.toSorted()).toEqual(pages.filter((p) => p.file.endsWith('index.html')).map((p) => p.path).toSorted());
});

test('robots.txt allows everything and points to the sitemap on the site origin', () => {
  const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
  expect(robots).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap-index.xml\n`);
});
