// Nothing private reaches the build, and no page loads code from another site: run
// after `npm run build`. Every file is checked, binaries included, as raw bytes.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { expect, test } from 'vitest';

const files = readdirSync('dist', { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name))
  .sort();
/** Latin-1 maps each byte to one character, so a binary file reads without loss. */
const contents = files.map((file) => ({ file, text: readFileSync(file, 'latin1') }));
const pages = contents.filter(({ file }) => file.endsWith('.html'));

/** Private bank fields and folders, and local paths and settings. */
const FORBIDDEN = ['user_clarifications', 'data/stories', '/Users/', '.env'];
/**
 * The old GitHub handle, by the SHA-256 of its lowercase form, so that this public repo
 * does not name it. GitHub handles ignore case, and a link or mention of one is a run of
 * letters and digits of its own, so each file's runs are hashed and compared.
 */
const OLD_HANDLE_SHA256 = '6d2ec8121c7ef24980216f6e17ed0f8a98b50eed2a0cd28c01a035346e53040b';
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const PHONE = /\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/;

test('the build has files and pages to check', () => {
  expect(files.length).toBeGreaterThan(0);
  expect(pages.length).toBeGreaterThan(0);
});

test.each(FORBIDDEN)('no file contains %s', (needle) => {
  expect(contents.filter(({ text }) => text.includes(needle)).map(({ file }) => file)).toEqual([]);
});

test('no file names the old GitHub handle', () => {
  const hits = contents.flatMap(({ file, text }) => {
    const runs = new Set(text.toLowerCase().match(/[a-z0-9]+/g));
    return [...runs].some((run) => sha256(run) === OLD_HANDLE_SHA256) ? [file] : [];
  });
  expect(hits).toEqual([]);
});

test('no file contains a phone number', () => {
  const hits = contents.flatMap(({ file, text }) => {
    const match = text.match(PHONE);
    return match ? [`${file}: ${match[0]}`] : [];
  });
  expect(hits).toEqual([]);
});

test('no page loads a script from another site or embeds an iframe', () => {
  for (const { file, text } of pages) {
    const root = parse(text);
    // The canonical URL gives the page's own origin, so an absolute link back to the
    // site itself is not mistaken for another site.
    const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute('href');
    const page = new URL(canonical ?? 'https://site.invalid/');
    for (const script of root.querySelectorAll('script[src]')) {
      const src = script.getAttribute('src')!;
      expect(new URL(src, page).origin, `${file}: <script src="${src}">`).toBe(page.origin);
    }
    expect(root.querySelectorAll('iframe'), file).toHaveLength(0);
  }
});
