// Helpers for the MDX collections and the writing section: which entries are published,
// post order, reading time, post types and tags, and the feed's URLs.
import { z } from 'astro/zod';

const DATE_ERROR = 'expected a date such as 2026-09-06';

/**
 * A frontmatter date, as a string or a YAML date. A bare z.coerce.date() turns a blank
 * value (YAML null) into 1970-01-01; this fails it instead.
 */
export const FrontmatterDate = z
  .union([z.string(), z.date()], { error: DATE_ERROR })
  .pipe(z.coerce.date({ error: DATE_ERROR }));

export const POST_TYPES = ['essay', 'note', 'field-note'] as const;
export type PostType = (typeof POST_TYPES)[number];

/** Each post type's plural, for filter links and headings. */
export const TYPE_LABEL: Record<PostType, string> = { essay: 'essays', note: 'notes', 'field-note': 'field notes' };

const WORDS_PER_MINUTE = 230;

/** Drafts are left out of production builds; `astro dev` shows them. Callers pass `import.meta.env.PROD`. */
export function isPublished(data: { draft?: boolean }, prod: boolean): boolean {
  return !(prod && data.draft === true);
}

/**
 * Newest first, as a new array; posts of the same date by id, ascending (code-unit
 * order). getCollection's order is the store's, which the glob loader fills
 * concurrently, so without the id the order of same-day posts could change between builds.
 */
export function sortNewest<T extends { id: string; data: { date: Date } }>(posts: T[]): T[] {
  return posts.toSorted(
    (a, b) => b.data.date.getTime() - a.data.date.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

export function latest<T>(posts: T[], n: number): T[] {
  return posts.slice(0, n);
}

/**
 * Minutes to read an MDX source at 230 words a minute, rounded, and at least 1. The
 * frontmatter, `import` and `export` lines and JSX tags are not counted; the text
 * inside components is.
 */
export function readingMinutes(body: string): number {
  const prose = body
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .replace(/^(?:import|export)\b.*$/gm, '')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ');
  const words = prose.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** `ML Systems / GPUs` → `ml-systems-gpus`, the tag's URL segment under /writing/tag/. */
export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The types the posts use, each once, in POST_TYPES order. */
export function typesInUse(posts: { data: { type: PostType } }[]): PostType[] {
  const used = new Set(posts.map((post) => post.data.type));
  return POST_TYPES.filter((type) => used.has(type));
}

export interface TagUse {
  /** The first spelling seen. */
  tag: string;
  slug: string;
  /** How many posts carry the tag. */
  count: number;
}

/**
 * Each tag the posts use, once per slug, sorted by slug. Throws, naming the post, for a
 * tag with no letters or digits, whose slug would be empty and so could have no page.
 */
export function tagsInUse(posts: { id: string; data: { tags: string[] } }[]): TagUse[] {
  const bySlug = new Map<string, TagUse>();
  for (const post of posts) {
    const seen = new Set<string>();
    for (const tag of post.data.tags) {
      const slug = tagSlug(tag);
      if (slug === '') throw new Error(`${post.id}: tag "${tag}" has no letters or digits, so it can have no page`);
      if (seen.has(slug)) continue;
      seen.add(slug);
      const use = bySlug.get(slug);
      if (use) use.count += 1;
      else bySlug.set(slug, { tag, slug, count: 1 });
    }
  }
  return [...bySlug.values()].sort((a, b) => (a.slug < b.slug ? -1 : 1));
}

/** The posts with a tag whose slug is `slug`, in their order. */
export function postsWithTag<T extends { data: { tags: string[] } }>(posts: T[], slug: string): T[] {
  return posts.filter((post) => post.data.tags.some((tag) => tagSlug(tag) === slug));
}

/**
 * The posts that name one of the focus's projects or share one of its tags (compared by
 * slug), in their order. Pass publishedPosts() (posts.ts), which has left the drafts out.
 */
export function relatedForFocus<T extends { data: { tags: string[]; project?: string } }>(
  posts: T[],
  focus: { projects: string[]; tags: string[] },
): T[] {
  const projects = new Set(focus.projects);
  const tags = new Set(focus.tags.map(tagSlug));
  return posts.filter(
    ({ data }) =>
      (data.project !== undefined && projects.has(data.project)) || data.tags.some((tag) => tags.has(tagSlug(tag))),
  );
}

/**
 * `html` with each root-relative `href` and `src` value made absolute against `site`, for
 * feed readers, which have no base URL to resolve them by. Protocol-relative (`//`) and
 * other URLs are left alone.
 */
export function absoluteUrls(html: string, site: string | URL): string {
  return html.replace(
    /(\s(?:href|src)=)(["'])(\/(?!\/)[^"']*)\2/g,
    (_, attr: string, quote: string, path: string) => `${attr}${quote}${new URL(path, site).href}${quote}`,
  );
}
