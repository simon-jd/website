// The characters the built site draws with its own faces, for `npm run fonts:subset` and
// for the test that the committed subsets still cover every page. Run against a build.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node-html-parser';

/** Printable ASCII, kept whole so that ordinary edits never need a new subset. */
export const ASCII = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCodePoint(0x20 + i));

/** `"\2192 "` → `→`, for strings in CSS `content`. */
function cssUnescape(value: string): string {
  return value.replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_, hex: string | undefined, char: string | undefined) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : (char ?? ''),
  );
}

/** Every .html file under `dist`. */
function pages(dist: string): string[] {
  return readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => join(entry.parentPath, entry.name));
}

/**
 * Every character a built page can draw: its body text (SVG labels, code blocks and
 * <noscript> included, scripts and styles not) and the strings its CSS inserts with
 * `content`, plus printable ASCII. The <title> is drawn by the browser, not by the site's
 * faces, so the head is left out. Control characters are dropped.
 */
export function pageCharacters(dist = 'dist'): Set<string> {
  const chars = new Set(ASCII);
  const add = (text: string) => {
    for (const char of text) if (char.codePointAt(0)! >= 0x20) chars.add(char);
  };
  for (const file of pages(dist)) {
    const html = readFileSync(file, 'utf8');
    const root = parse(html);
    const css = root.querySelectorAll('style').map((style) => style.rawText);
    for (const link of root.querySelectorAll('link[rel="stylesheet"]'))
      css.push(readFileSync(join(dist, new URL(link.getAttribute('href')!, 'https://site.invalid/').pathname), 'utf8'));
    for (const sheet of css)
      for (const m of sheet.matchAll(/content\s*:\s*(["'])((?:\\.|(?!\1).)*)\1/g)) add(cssUnescape(m[2]));
    const body = root.querySelector('body');
    if (!body) continue;
    for (const node of body.querySelectorAll('script, style')) node.remove();
    add(body.text);
  }
  return chars;
}

/** The characters as one string, sorted by code point, as the manifest stores them. */
export function sortedCharacters(chars: Iterable<string>): string {
  return [...new Set(chars)].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!).join('');
}
