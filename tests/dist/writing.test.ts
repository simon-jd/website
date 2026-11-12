// The writing section and the feed as built: run after `npm run build`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { parse } from 'node-html-parser';
import { expect, test } from 'vitest';
import { isoDate, monthLabel } from '../../src/lib/site.ts';
import { readingMinutes, tagSlug, tagsInUse, typesInUse, type PostType } from '../../src/lib/writing.ts';
import { bodyParagraphs, entries, published, textWords, type Entry, type Folder } from './content.ts';

const DIST = 'dist';
const text = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * The published posts, typed as the writing helpers take them, in sortNewest's order:
 * newest first, and posts of the same date by id (the slug), ascending in code-unit order.
 */
const posts = published('writing')
  .map((entry) => ({
    ...entry,
    id: entry.slug,
    date: new Date(String(entry.data.date)),
    data: entry.data as { title: string; type: PostType; tags: string[]; summary: string; project?: string; updated?: string },
  }))
  .toSorted((a, b) => b.date.getTime() - a.date.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** Every file under dist/, as a path relative to it. */
const files = readdirSync(DIST, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => relative(DIST, join(d.parentPath, d.name)));

/** Undoes HTML and XML escaping. Twice, because rss.xml escapes post HTML that is already escaped. */
const unescape = (s: string) =>
  [1, 2].reduce(
    (t) =>
      t.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
        const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
        if (e[0] !== '#') return named[e.toLowerCase()];
        return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      }),
    s,
  );

/** The html, xml and txt files under dist/, unescaped. */
const texts = files
  .filter((f) => /\.(html|xml|txt)$/.test(f))
  .map((file) => ({ file, body: unescape(readFileSync(join(DIST, file), 'utf8')) }));

/**
 * How a draft would show up in dist: its URL path (under `prefix`), files at that path
 * (such as its page), the frontmatter text that only it carries and, with `body`, its
 * body's paragraphs. Every draft, whatever its folder, is also checked for a social
 * card: a file under og/ named after its slug, or a link to one. The bare slug and the
 * title count for posts alone: a case study's slug is a project id and a focus page's a
 * group id, which published pages show, and titles such as "About" or a group name
 * appear on published pages too. A page entry has no `prefix`: the header links /about/
 * on every page, so /about/ builds while about.mdx is a draft, without its bio and with
 * the default social card.
 */
const DRAFT_MARKERS: Record<Folder, { prefix?: string; keys: string[]; bare: boolean; body?: boolean }> = {
  writing: { prefix: 'writing/', keys: ['title', 'summary'], bare: true },
  'case-studies': { prefix: 'work/', keys: ['dek'], bare: false },
  focus: { prefix: 'focus/', keys: ['summary'], bare: false },
  pages: { keys: ['summary'], bare: false, body: true },
};

function pageOf(path: string) {
  return parse(readFileSync(join(DIST, path, 'index.html'), 'utf8'));
}

/** The entries of dist/<dir>, sorted; none if it is missing. */
function listing(dir: string): string[] {
  const abs = join(DIST, dir);
  return existsSync(abs) ? readdirSync(abs).sort() : [];
}

/** An item as XMLParser reads it with attributes kept. */
interface RssItem {
  title: string;
  link: string;
  guid: { '#text': string; '@_isPermaLink': string };
  description: string;
  pubDate: string;
  'content:encoded': string;
}

test('rss.xml is valid and lists exactly the published posts', () => {
  const xml = readFileSync(join(DIST, 'rss.xml'), 'utf8');
  const feed = new XMLParser({ ignoreAttributes: false, isArray: (name) => name === 'item', parseTagValue: false }).parse(
    xml,
  );
  // XMLParser does not validate, so check the RSS 2.0 structure that feed readers rely on.
  expect(feed['?xml']?.['@_version']).toBe('1.0');
  expect(feed.rss?.['@_version']).toBe('2.0');
  const channel = feed.rss.channel;
  expect(channel, 'channel').toBeDefined();
  expect(channel.title).toBe('Junrui Duan — writing');
  expect(channel.description?.trim()).toBeTruthy();
  expect(new URL(channel.link).pathname).toBe('/');
  const items: RssItem[] = channel.item ?? [];
  expect(items).toHaveLength(posts.length);
  if (items.length > 0) expect(feed.rss['@_xmlns:content']).toBe('http://purl.org/rss/1.0/modules/content/');
  expect(items.map((item) => new URL(item.link).pathname)).toEqual(posts.map((p) => `/writing/${p.slug}/`));
  items.forEach((item, i) => {
    const { data } = posts[i];
    expect(item.title).toBe(data.title);
    expect(item.guid['#text'], data.title).toBe(item.link);
    expect(item.guid['@_isPermaLink'], data.title).toBe('true');
    expect(item.description).toBe(data.summary);
    expect(new Date(item.pubDate).getTime()).toBe(posts[i].date.getTime());
    const content = item['content:encoded'];
    expect(content?.trim(), data.title).toBeTruthy();
    // Rendered with the MDX components, so no component tag is left in the HTML, and with
    // absolute URLs, because feed readers have no base to resolve root-relative ones.
    expect(content, data.title).toContain('<p>');
    expect(content, data.title).not.toMatch(/<\/?[A-Z]/);
    expect(content, data.title).not.toMatch(/\s(?:href|src)=["']\/(?!\/)/);
  });
});

test('drafts appear nowhere in dist', () => {
  const folders = Object.keys(DRAFT_MARKERS) as Folder[];
  const drafts = folders.flatMap((folder) =>
    entries(folder)
      .filter((entry) => entry.data.draft === true)
      .map((entry): [Folder, Entry] => [folder, entry]),
  );
  // Padded with spaces, so a paragraph matches only on whole words.
  const builtWords = texts.map(({ file: built, body }) => ({ built, words: ` ${textWords(body)} ` }));
  for (const [folder, { slug, file, data }] of drafts) {
    const { prefix, keys, bare, body: checkBody } = DRAFT_MARKERS[folder];
    const needles = keys.map((k) => data[k]).filter((v) => typeof v === 'string');
    if (prefix !== undefined) needles.push(`/${prefix}${slug}/`);
    if (bare) needles.push(slug);
    for (const { file: built, body } of texts)
      for (const needle of needles) expect(body.includes(needle), `${file}: "${needle}" in dist/${built}`).toBe(false);
    if (prefix !== undefined) {
      const path = bare ? (f: string) => f.includes(slug) : (f: string) => new RegExp(`(^|/)${prefix}${slug}(/|\\.|$)`).test(f);
      expect(files.filter(path), file).toEqual([]);
    }
    const stem = (f: string) => basename(f).replace(/\.[^.]*$/, '');
    expect(files.filter((f) => f.startsWith('og/') && stem(f) === slug), `${file}: a social card`).toEqual([]);
    const cardRoute = new RegExp(`/og/(?:[^/\\s"'<>]+/)*${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.png`);
    for (const { file: built, body } of texts)
      expect(cardRoute.test(body), `${file}: a link to its social card in dist/${built}`).toBe(false);
    if (checkBody) {
      for (const paragraph of bodyParagraphs(file))
        for (const { built, words } of builtWords)
          expect(words.includes(` ${paragraph} `), `${file}: "${paragraph.slice(0, 60)}…" in dist/${built}`).toBe(false);
    }
  }
});

test('tag and type pages exist only for tags and types in use', () => {
  expect(listing('writing/tag')).toEqual(tagsInUse(posts).map((t) => t.slug).toSorted());
  expect(listing('writing/type')).toEqual(typesInUse(posts).toSorted());
  for (const dir of [...listing('writing/tag').map((t) => `tag/${t}`), ...listing('writing/type').map((t) => `type/${t}`)])
    expect(existsSync(join(DIST, 'writing', dir, 'index.html')), dir).toBe(true);
});

test('/writing/ lists the published posts newest first, with the type filters and the RSS link', () => {
  const root = pageOf('writing/');
  const main = root.querySelector('main')!;
  expect(main.querySelector('a[href="/rss.xml"]')).not.toBeNull();
  if (posts.length === 0) {
    expect(text(main.text)).toContain('Posts are on the way. Follow along by RSS.');
    return;
  }
  expect(main.querySelectorAll('.writing-list li a').map((a) => a.getAttribute('href'))).toEqual(
    posts.map((p) => `/writing/${p.slug}/`),
  );
  const filters = main.querySelectorAll('nav a[href^="/writing/type/"]').map((a) => a.getAttribute('href'));
  expect(filters).toEqual(typesInUse(posts).map((t) => `/writing/type/${t}/`));
});

test('an article shows its kicker, dek, tags, related project and updated date', () => {
  const caseStudies = new Set(published('case-studies').map((entry) => entry.slug));
  for (const { slug, file, date, data } of posts) {
    const main = pageOf(`writing/${slug}/`).querySelector('main')!;
    const minutes = readingMinutes(readFileSync(file, 'utf8'));
    expect(text(main.querySelector('.kicker')?.text ?? ''), slug).toBe(`${data.type} · ${monthLabel(date)} · ${minutes} min`);
    expect(text(main.querySelector('h1')?.text ?? ''), slug).toBe(data.title);
    expect(text(main.querySelector('.dek')?.text ?? ''), slug).toBe(data.summary);
    const tags = main.querySelectorAll('.post-foot a[href^="/writing/tag/"]').map((a) => a.getAttribute('href'));
    expect(tags, slug).toEqual(data.tags.map((t) => `/writing/tag/${tagSlug(t)}/`));
    const project = main.querySelector('.post-foot .project a');
    if (data.project === undefined) expect(project, slug).toBeNull();
    else {
      const repo = JSON.parse(readFileSync(`src/content/projects/${data.project}.json`, 'utf8')).repo;
      expect(project?.getAttribute('href'), slug).toBe(caseStudies.has(data.project) ? `/work/${data.project}/` : repo);
    }
    const updated = main.querySelector('.post-foot time');
    expect(updated?.getAttribute('datetime'), slug).toBe(
      data.updated === undefined ? undefined : isoDate(new Date(String(data.updated))),
    );
  }
});
