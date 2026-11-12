// The work index and the case studies as built: run after `npm run build`. The checks
// read the published case studies from the content, so they hold for whichever seeds are
// published. A check that needs something no page has is skipped, saying why in its name.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse, type HTMLElement } from 'node-html-parser';
import { expect, test } from 'vitest';
import { loadAllowlist } from '../../src/lib/allowlist.ts';
import { published } from './content.ts';

const allowlist = loadAllowlist();
const studies = published('case-studies');
const caseStudies = new Set(studies.map((entry) => entry.slug));
const NO_STUDY = 'no case study is published';

const GROUPS = [
  { focus: 'ml-infra', label: 'ML infrastructure & GPU systems' },
  { focus: 'infra', label: 'Infrastructure, data & backend' },
];

const text = (s: string) => s.replace(/\s+/g, ' ').trim();
const exportOf = (id: string) => JSON.parse(readFileSync(`src/content/projects/${id}.json`, 'utf8'));
const projectOf = (id: string) => {
  const project = allowlist.projects.find((p) => p.id === id);
  if (!project) throw new Error(`src/content/case-studies/${id}.mdx: "${id}" is not allowlisted`);
  return project;
};
/** The test's name, with the reason when it is skipped, so a skip never reads as a pass. */
const named = (name: string, skip: boolean, reason: string) => (skip ? `${name} (skipped: ${reason})` : name);

const parsed = new Map<string, HTMLElement>();
/** dist/<path>index.html, parsed on first use, so a missing page fails only the tests that read it. */
function page(path: string): HTMLElement {
  let root = parsed.get(path);
  if (!root) {
    root = parse(readFileSync(`dist/${path}index.html`, 'utf8'));
    parsed.set(path, root);
  }
  return root;
}

/** Every HTML page in dist/, parsed, with its path relative to dist/. */
const builtPages = readdirSync('dist', { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile() && d.name.endsWith('.html'))
  .map((d) => relative('dist', join(d.parentPath, d.name)))
  .sort()
  .map((file) => ({ file, root: parse(readFileSync(join('dist', file), 'utf8')) }));

test('the build has pages to check', () => {
  expect(builtPages.map((p) => p.file)).toContain('work/index.html');
});

test('/work/ lists all allowlisted projects in two groups', () => {
  const root = page('work/');
  const sections = root.querySelectorAll('main section[data-focus]');
  expect(sections.map((s) => [s.getAttribute('data-focus'), text(s.querySelector('h2')?.text ?? '')])).toEqual(
    GROUPS.map((g) => [g.focus, g.label]),
  );
  expect(root.querySelectorAll('[data-project]')).toHaveLength(allowlist.projects.length);
  // Allowlist order is display order, so each group lists its projects in that order.
  for (const section of sections) {
    const focus = section.getAttribute('data-focus');
    expect(section.querySelectorAll('[data-project]').map((card) => card.getAttribute('data-project'))).toEqual(
      allowlist.projects.filter((p) => p.focus === focus).map((p) => p.id),
    );
  }
});

test('cards link to a case study only when one is published', () => {
  const root = page('work/');
  expect(allowlist.projects.length).toBeGreaterThan(0);
  for (const { id } of allowlist.projects) {
    const a = root.querySelector(`[data-project="${id}"] h3 a`);
    expect(a, id).not.toBeNull();
    const internal = caseStudies.has(id);
    expect(a!.getAttribute('href'), id).toBe(internal ? `/work/${id}/` : exportOf(id).repo);
    // Off-site links are marked ↗ on screen and named as GitHub links for screen readers.
    expect(a!.text.includes('↗'), id).toBe(!internal);
    expect(a!.querySelector('.visually-hidden') !== null, id).toBe(!internal);
  }
});

test.skipIf(studies.length === 0)(
  named('each case study shows the facts box from the bank', studies.length === 0, NO_STUDY),
  () => {
    for (const { slug } of studies) {
      const project = projectOf(slug);
      const exp = exportOf(slug);
      const facts = page(`work/${slug}/`).querySelector('.facts');
      expect(facts, slug).not.toBeNull();
      expect(facts!.querySelector(`a[href="${exp.repo}"]`), slug).not.toBeNull();
      expect(facts!.querySelectorAll('.results li').map((li) => text(li.text)), slug).toEqual(
        project.key_results.map((k) => k.text),
      );
      const shown = text(facts!.text);
      for (const item of [exp.date, ...project.stack]) expect(shown, slug).toContain(item);
    }
  },
);

test.skipIf(studies.length === 0)(
  named('the case-study head names the group, the project and the dek', studies.length === 0, NO_STUDY),
  () => {
    for (const { slug, data } of studies) {
      const root = page(`work/${slug}/`);
      const project = projectOf(slug);
      const label = GROUPS.find((g) => g.focus === project.focus)!.label;
      expect(text(root.querySelector('main .kicker')?.text ?? ''), slug).toBe(`case study · ${label}`);
      const h1 = root.querySelectorAll('h1');
      expect(h1, slug).toHaveLength(1);
      // The allowlist's name, otherwise the bank title up to its first " — " (displayName).
      expect(text(h1[0].text), slug).toBe(project.name ?? exportOf(slug).title.split(' — ')[0]);
      // Without a dek in the frontmatter, the one-liner stands in for it.
      expect(text(root.querySelector('main .dek')?.text ?? ''), slug).toBe(data.dek ?? project.one_liner);
    }
  },
);

test.skipIf(studies.length === 0)(
  named('the one-liner is on each case study exactly once, as the dek or beside one', studies.length === 0, NO_STUDY),
  () => {
    for (const { slug } of studies) {
      const main = text(page(`work/${slug}/`).querySelector('main')?.text ?? '');
      expect(main.split(projectOf(slug).one_liner).length - 1, slug).toBe(1);
    }
  },
);

test.skipIf(studies.length === 0)(
  named('related writing appears only when a published post names the project', studies.length === 0, NO_STUDY),
  () => {
    for (const { slug } of studies) {
      const posts = published('writing').filter((post) => post.data.project === slug);
      const root = page(`work/${slug}/`);
      const heading = root.querySelectorAll('h2').find((h) => text(h.text) === 'Related writing');
      expect(heading !== undefined, slug).toBe(posts.length > 0);
      if (heading) expect(root.querySelectorAll('.related li'), slug).toHaveLength(posts.length);
    }
  },
);

const notes = builtPages.flatMap(({ file, root }) => root.querySelectorAll('.sidenote').map((note) => ({ file, note })));
test.skipIf(notes.length === 0)(
  named('sidenote numbers come from CSS, not the source', notes.length === 0, 'no built page has a sidenote'),
  () => {
    for (const { file, note } of notes) expect(text(note.text), file).not.toMatch(/^\d/);
  },
);

const prosePages = builtPages.filter(({ root }) => root.querySelector('.prose') !== null);
test.skipIf(prosePages.length === 0)(
  named('prose list spacing stays out of component lists', prosePages.length === 0, 'no built page has prose'),
  () => {
    // A bare `.prose li + li` also matches the items of Stats, FactsBox and WritingList.
    for (const { file, root } of prosePages) {
      const css = root
        .querySelectorAll('style')
        .map((s) => s.rawText)
        .join('\n');
      expect(css, file).toContain('.prose');
      expect(css, file).not.toMatch(/\.prose\s+li\s*\+\s*li\b/);
    }
  },
);

const codeBlocks = builtPages.flatMap(({ file, root }) => root.querySelectorAll('pre.astro-code').map((pre) => ({ file, pre })));
test.skipIf(codeBlocks.length === 0)(
  named('code blocks carry both Shiki themes', codeBlocks.length === 0, 'no built page has a code block'),
  () => {
    for (const { file, pre } of codeBlocks) {
      const style = pre.getAttribute('style') ?? '';
      // The paper themes' backgrounds: --panel by day and by night.
      expect(style, file).toContain('background-color:#ece9e1');
      expect(style, file).toContain('--shiki-dark:');
      expect(style, file).toContain('--shiki-dark-bg:#2a302b');
    }
  },
);
