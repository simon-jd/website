// The focus pages, About and the 404 page as built: run after `npm run build`. A check
// of the focus pages is skipped, saying why in its name, when none is published.
import { readdirSync, readFileSync } from 'node:fs';
import { parse, type HTMLElement } from 'node-html-parser';
import { expect, test } from 'vitest';
import { loadAllowlist } from '../../src/lib/allowlist.ts';
import { profile } from '../../src/lib/site.ts';
import { relatedForFocus, sortNewest } from '../../src/lib/writing.ts';
import { bodyParagraphs, published, textWords } from './content.ts';

const allowlist = loadAllowlist();
const text = (s: string) => s.replace(/\s+/g, ' ').trim();

const parsed = new Map<string, HTMLElement>();
/** The <main> of dist/<file>, parsed on first use, so a missing page fails only the tests that read it. */
function main(file: string): HTMLElement {
  let root = parsed.get(file);
  if (!root) {
    root = parse(readFileSync(`dist/${file}`, 'utf8'));
    parsed.set(file, root);
  }
  const element = root.querySelector('main');
  if (!element) throw new Error(`dist/${file} has no <main>`);
  return element;
}

/** The section of `root` whose h2 reads `heading`. */
const section = (root: HTMLElement, heading: string) =>
  root.querySelectorAll('section').find((s) => text(s.querySelector('h2')?.text ?? '') === heading);

/** True when every paragraph of the MDX file's body is on the page, word for word. */
function showsBody(root: HTMLElement, file: string): boolean {
  const shown = ` ${textWords(root.toString())} `;
  const paragraphs = bodyParagraphs(file);
  return paragraphs.length > 0 && paragraphs.every((p) => shown.includes(` ${p} `));
}

interface FocusData {
  title: string;
  kicker: string;
  projects: string[];
  tags: string[];
}

const focusPages = published('focus').map((entry) => ({ ...entry, data: entry.data as unknown as FocusData }));
const noFocus = focusPages.length === 0;
/** The test's name, with the reason when it is skipped, so a skip never reads as a pass. */
const focusTest = (name: string) => (noFocus ? `${name} (skipped: no focus page is published)` : name);

test('About lists the three internships exactly as exported', () => {
  const experience = section(main('about/index.html'), 'Experience');
  expect(experience, 'an "Experience" section').toBeDefined();
  const exported = readdirSync('src/content/work')
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(`src/content/work/${f}`, 'utf8')));
  expect(exported.map((w) => w.id).toSorted()).toEqual(allowlist.work.map((w) => w.id).toSorted());
  // Allowlist order, newest first: SpectraCell, then the Wuhan University institute, then Yunwei.
  const items = experience!.querySelectorAll('[data-work]');
  expect(items.map((item) => item.getAttribute('data-work'))).toEqual(['spectracell', 'whu-ai-ra', 'yunwei']);
  items.forEach((item, i) => {
    const { id, line } = allowlist.work[i];
    const work = exported.find((w) => w.id === id);
    expect(text(item.querySelector('.org')?.text ?? ''), id).toBe(work.organization);
    expect(text(item.querySelector('.role')?.text ?? ''), id).toBe(work.title);
    expect(text(item.querySelector('.when')?.text ?? ''), id).toBe(work.date);
    expect(text(item.querySelector('.line')?.text ?? ''), id).toBe(line);
  });
});

test('About shows the bio, education, contact and the colophon', () => {
  const root = main('about/index.html');
  const about = published('pages').find((entry) => entry.slug === 'about');
  if (about) expect(showsBody(root, about.file), 'the bio').toBe(true);
  const education = section(root, 'Education');
  expect(education, 'an "Education" section').toBeDefined();
  const shown = text(education!.text);
  for (const { degree, school, date } of profile.education) {
    expect(shown).toContain(degree);
    expect(shown).toContain(school);
    // The bank writes ranges the LaTeX way, with `--`.
    expect(shown).toContain(date.replaceAll(' -- ', ' – '));
  }
  for (const href of ['/resume.pdf', `mailto:${profile.email}`, profile.github, profile.linkedin])
    expect(root.querySelector(`a[href="${href}"]`), href).not.toBeNull();
  expect(section(root, 'Colophon'), 'a "Colophon" section').toBeDefined();
});

test.skipIf(noFocus)(focusTest('About links every published focus page'), () => {
  const root = main('about/index.html');
  for (const { slug } of focusPages) expect(root.querySelector(`a[href="/focus/${slug}/"]`), slug).not.toBeNull();
});

test.skipIf(noFocus)(focusTest('focus pages list their curated projects in order'), () => {
  for (const { slug, file, data } of focusPages) {
    const root = main(`focus/${slug}/index.html`);
    expect(text(root.querySelector('.kicker')?.text ?? ''), slug).toBe(data.kicker);
    expect(text(root.querySelector('h1')?.text ?? ''), slug).toBe(data.title);
    expect(showsBody(root, file), `${slug}: the pitch`).toBe(true);
    expect(root.querySelectorAll('[data-project]').map((card) => card.getAttribute('data-project')), slug).toEqual(
      data.projects,
    );
  }
});

test.skipIf(noFocus)(focusTest('focus-page cards carry no plates'), () => {
  for (const { slug } of focusPages)
    expect(main(`focus/${slug}/index.html`).querySelectorAll('figure.plate'), slug).toHaveLength(0);
});

test('the home page and /work/ keep the featured plates', () => {
  const featured = allowlist.projects.filter((p) => p.featured).map((p) => p.id);
  expect(main('index.html').querySelectorAll('figure.plate')).toHaveLength(4);
  const work = main('work/index.html');
  expect(work.querySelectorAll('figure.plate')).toHaveLength(featured.length);
  for (const id of featured) expect(work.querySelector(`[data-project="${id}"] figure.plate`), id).not.toBeNull();
});

test.skipIf(noFocus)(focusTest('a focus page shows related writing only when a published post matches it'), () => {
  const posts = sortNewest(
    published('writing').map((entry) => ({
      id: entry.slug,
      data: { ...(entry.data as { tags: string[]; project?: string }), date: new Date(String(entry.data.date)) },
    })),
  );
  for (const { slug, data } of focusPages) {
    const root = main(`focus/${slug}/index.html`);
    const related = relatedForFocus(posts, data).map((post) => `/writing/${post.id}/`);
    const block = section(root, 'Related writing');
    expect(block !== undefined, slug).toBe(related.length > 0);
    if (block) expect(block.querySelectorAll('.writing-list li a').map((a) => a.getAttribute('href')), slug).toEqual(related);
  }
});

test('the 404 page exists and links home', () => {
  const root = main('404.html');
  expect(text(root.querySelector('h1')?.text ?? '')).toBe('Page not found');
  for (const href of ['/', '/work/', '/writing/']) expect(root.querySelector(`a[href="${href}"]`), href).not.toBeNull();
});
