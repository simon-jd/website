import { expect, test } from 'vitest';
import {
  absoluteUrls,
  FrontmatterDate,
  isPublished,
  latest,
  postsWithTag,
  readingMinutes,
  relatedForFocus,
  sortNewest,
  tagSlug,
  tagsInUse,
  typesInUse,
  type PostType,
} from '../../src/lib/writing.ts';

const post = (id: string, date: string) => ({ id, data: { date: new Date(date) } });

/** A post as the writing helpers see it; every value is synthetic. */
const entry = (
  id: string,
  data: { type?: PostType; tags?: string[]; project?: string; draft?: boolean } = {},
) => ({ id, data: { type: 'essay' as PostType, tags: [] as string[], ...data } });

const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');

test('isPublished hides drafts only in production', () => {
  expect(isPublished({ draft: true }, true)).toBe(false);
  expect(isPublished({ draft: true }, false)).toBe(true);
  expect(isPublished({ draft: false }, true)).toBe(true);
  expect(isPublished({}, true)).toBe(true);
});

test('sortNewest puts the latest date first and leaves its input alone', () => {
  const posts = [post('a', '2026-09-06'), post('b', '2026-11-01'), post('c', '2026-10-12')];
  expect(sortNewest(posts).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  expect(posts.map((p) => p.id)).toEqual(['a', 'b', 'c']);
});

test('sortNewest orders posts of the same date by id, whatever order they arrive in', () => {
  // getCollection returns entries in store order, which the glob loader fills concurrently.
  const posts = [post('c', '2026-09-06'), post('z', '2026-11-01'), post('a', '2026-09-06'), post('b', '2026-09-06')];
  expect(sortNewest(posts).map((p) => p.id)).toEqual(['z', 'a', 'b', 'c']);
  expect(sortNewest(posts.toReversed()).map((p) => p.id)).toEqual(['z', 'a', 'b', 'c']);
});

test('latest takes the first n', () => {
  expect(latest([1, 2, 3, 4, 5, 6], 5)).toEqual([1, 2, 3, 4, 5]);
  expect(latest([1, 2], 5)).toEqual([1, 2]);
});

test('a frontmatter date must be given: a blank one fails instead of becoming 1970-01-01', () => {
  expect(FrontmatterDate.parse('2026-09-06')).toEqual(new Date('2026-09-06'));
  expect(FrontmatterDate.parse(new Date('2026-09-06'))).toEqual(new Date('2026-09-06'));
  // `date:` with nothing after it is YAML null, which z.coerce.date() alone turns into the epoch.
  expect(FrontmatterDate.safeParse(null).success).toBe(false);
  expect(FrontmatterDate.safeParse('').success).toBe(false);
  expect(FrontmatterDate.safeParse('soon').success).toBe(false);
  // An optional date may be left out, but not left blank.
  expect(FrontmatterDate.optional().safeParse(undefined).success).toBe(true);
  expect(FrontmatterDate.optional().safeParse(null).success).toBe(false);
});

test('reading time is words over 230, at least one minute', () => {
  expect(readingMinutes(words(460))).toBe(2);
  expect(readingMinutes(words(10))).toBe(1);
  expect(readingMinutes('')).toBe(1);
  // 344 words round down to 1 minute and 345 round up to 2, so each body below would read
  // 2 minutes if its frontmatter, import and export lines or JSX tags were counted.
  expect(readingMinutes(words(345))).toBe(2);
  const frontmatter = ['---', 'title: "One two three four five six"', 'tags: [a, b, c]', '---'].join('\n');
  expect(readingMinutes(`${frontmatter}\n${words(344)}`)).toBe(1);
  const esm = ["import Chart from '../components/Chart.astro';", 'export const meta = { a: 1, b: 2, c: 3 };'].join('\n');
  expect(readingMinutes(`${esm}\n\n${words(344)}`)).toBe(1);
  const jsx = [
    '<Sidenote>',
    words(172),
    '</Sidenote>',
    '<BarChart',
    '  label="one two three four five six"',
    "  rows={[{ label: 'a b c', value: 1, unit: 's' }]}",
    '/>',
    `<Figure caption="one two three four">${words(172)}</Figure>`,
  ].join('\n');
  expect(readingMinutes(jsx)).toBe(1);
});

test('tagSlug lowercases and hyphenates', () => {
  expect(tagSlug('ML Systems / GPUs')).toBe('ml-systems-gpus');
  expect(tagSlug('  --C++ & CUDA--  ')).toBe('c-cuda');
  expect(tagSlug('ml-systems')).toBe('ml-systems');
});

test('typesInUse lists each type a post uses once, in the order essay, note, field note', () => {
  const posts = [entry('a', { type: 'field-note' }), entry('b', { type: 'essay' }), entry('c', { type: 'field-note' })];
  expect(typesInUse(posts)).toEqual(['essay', 'field-note']);
  expect(typesInUse([])).toEqual([]);
});

test('tagsInUse counts posts per tag slug, keeps the first spelling and sorts by slug', () => {
  const posts = [
    entry('a', { tags: ['ML Systems', 'gpu'] }),
    entry('b', { tags: ['ml-systems', 'ML systems'] }),
    entry('c', { tags: ['Distributed Systems'] }),
  ];
  expect(tagsInUse(posts)).toEqual([
    { tag: 'Distributed Systems', slug: 'distributed-systems', count: 1 },
    { tag: 'gpu', slug: 'gpu', count: 1 },
    // Post b spells the tag twice but counts once.
    { tag: 'ML Systems', slug: 'ml-systems', count: 2 },
  ]);
});

test('tagsInUse refuses a tag with no letters or digits, which could have no page', () => {
  expect(() => tagsInUse([entry('odd', { tags: ['++'] })])).toThrow(/odd: tag "\+\+"/);
});

test('postsWithTag matches by slug and keeps the order', () => {
  const posts = [entry('a', { tags: ['GPU'] }), entry('b', { tags: ['infra'] }), entry('c', { tags: ['gpu', 'infra'] })];
  expect(postsWithTag(posts, 'gpu').map((p) => p.id)).toEqual(['a', 'c']);
  expect(postsWithTag(posts, 'nothing')).toEqual([]);
});

test('relatedForFocus matches by project or by tag', () => {
  const posts = [
    entry('by-project', { project: 'velaserve', tags: ['go'] }),
    entry('by-tag', { tags: ['ML Systems'] }),
    entry('unrelated', { project: 'remex', tags: ['databases'] }),
  ];
  const focus = { projects: ['crucible', 'velaserve'], tags: ['ml-systems', 'gpu'] };
  expect(relatedForFocus(posts, focus).map((p) => p.id)).toEqual(['by-project', 'by-tag']);
});

test('relatedForFocus keeps the order it is given', () => {
  // The draft gate is publishedPosts' (posts.test.ts), so the focus page passes its result.
  const posts = [entry('second', { project: 'crucible' }), entry('first', { tags: ['gpu'] })];
  const focus = { projects: ['crucible'], tags: ['gpu'] };
  expect(relatedForFocus(posts, focus).map((p) => p.id)).toEqual(['second', 'first']);
  expect(relatedForFocus(posts.toReversed(), focus).map((p) => p.id)).toEqual(['first', 'second']);
});

test('absoluteUrls makes root-relative href and src values absolute and leaves the rest', () => {
  const site = 'https://junruiduan.pages.dev';
  const html = [
    '<a href="/work/crucible/">case study</a>',
    "<img src='/_astro/chart.png' alt=''>",
    '<a href="https://github.com/simon-jd/velaserve">repo</a>',
    '<a href="//example.com/x">protocol-relative</a>',
    '<a href="#note">note</a>',
    '<p>a path in text: /writing/</p>',
  ].join('');
  expect(absoluteUrls(html, site)).toBe(
    [
      '<a href="https://junruiduan.pages.dev/work/crucible/">case study</a>',
      "<img src='https://junruiduan.pages.dev/_astro/chart.png' alt=''>",
      '<a href="https://github.com/simon-jd/velaserve">repo</a>',
      '<a href="//example.com/x">protocol-relative</a>',
      '<a href="#note">note</a>',
      '<p>a path in text: /writing/</p>',
    ].join(''),
  );
});
