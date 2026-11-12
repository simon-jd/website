// The frontmatter and body prose of the MDX entries under src/content, for dist tests
// that compare the build with its sources. The dist tests run against a production
// build, so an entry is published exactly when its frontmatter does not say `draft: true`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/** A file name Astro keeps unchanged as the id: lowercase letters and digits in hyphenated runs. */
const SLUG_FORM = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type Folder = 'case-studies' | 'writing' | 'focus' | 'pages';

export interface Entry {
  /**
   * The entry's id and URL slug, worked out as Astro's glob loader does: the frontmatter
   * `slug` when there is one, otherwise the file name without `.mdx`. Astro slugifies
   * file names, so the name is the id only when it is already in slug form; entries()
   * throws for any other name rather than hand the tests a slug the site does not use.
   */
  slug: string;
  file: string;
  data: Record<string, unknown>;
}

/** Every `.mdx` entry in `src/content/<folder>`, sorted by file name; none if the folder is missing. */
export function entries(folder: Folder): Entry[] {
  const dir = join('src/content', folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.mdx'))
    .sort()
    .map((name) => {
      const file = join(dir, name);
      const match = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (!match) throw new Error(`${file}: no frontmatter`);
      const data = (parse(match[1]) ?? {}) as Record<string, unknown>;
      if (data.slug) return { slug: String(data.slug), file, data };
      const stem = name.slice(0, -'.mdx'.length);
      if (!SLUG_FORM.test(stem))
        throw new Error(`${file}: Astro would slugify this file name; rename it in lowercase-hyphen form`);
      return { slug: stem, file, data };
    });
}

export function published(folder: Folder): Entry[] {
  return entries(folder).filter((entry) => entry.data.draft !== true);
}

/**
 * Lowercase letters and digits, one space between runs. Punctuation, Markdown markup and
 * the typographer's quotes and dashes all fall away, so a source text and its rendering
 * compare equal.
 */
export function words(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The words of an HTML or XML text: scripts, styles, tags and entities become spaces. */
export function textWords(markup: string): string {
  return words(
    markup
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&(?:#x[0-9a-f]+|#\d+|[a-z]+);/gi, ' '),
  );
}

/**
 * The prose of an MDX entry's body, one item per paragraph, as words(): without the
 * frontmatter, `import`/`export` lines, JSX tags, link targets and list numbers. Each
 * paragraph renders as one run of text, so its words appear in the page in this order.
 */
export function bodyParagraphs(file: string): string[] {
  const body = readFileSync(file, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
  return body
    .split(/\r?\n[ \t]*\r?\n/)
    .map((block) =>
      block
        .split(/\r?\n/)
        .filter((line) => !/^(?:import|export)\b/.test(line))
        .map((line) => line.replace(/^\s*\d+\.\s/, ' '))
        .join(' '),
    )
    .map((block) => words(block.replace(/<\/?[A-Za-z][^>]*>/g, ' ').replace(/\]\([^)]*\)/g, ' ')))
    .filter(Boolean);
}
