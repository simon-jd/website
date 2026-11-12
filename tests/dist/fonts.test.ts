// The committed font subsets against the build: run after `npm run build`. A failure here
// means the pages now draw a character the subsets were not cut for, or the files and the
// manifest no longer match; `npm run fonts:subset` rewrites both.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { FACES, FONT_DIR, MANIFEST, type Manifest } from '../../scripts/subset-fonts.ts';
import { pageCharacters } from '../../src/lib/font-charset.ts';

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const codePoint = (char: string) => `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')} ${char}`;

test('the subsets cover every character the pages draw (else run npm run fonts:subset)', () => {
  const cut = new Set(manifest.characters);
  const missing = [...pageCharacters('dist')].filter((char) => !cut.has(char)).map(codePoint);
  expect(missing).toEqual([]);
});

test('the manifest records the four committed files as they are', () => {
  expect(Object.keys(manifest.faces).sort()).toEqual(Object.keys(FACES).sort());
  for (const [name, face] of Object.entries(manifest.faces))
    expect(sha256(join(FONT_DIR, `${name}.woff2`)), name).toBe(face.sha256);
});

test('each family ships with its SIL Open Font License', () => {
  for (const family of ['cormorant-garamond', 'inter', 'jetbrains-mono']) {
    const license = join(FONT_DIR, `OFL-${family}.txt`);
    expect(existsSync(license), license).toBe(true);
    expect(readFileSync(license, 'utf8')).toContain('SIL Open Font License, Version 1.1');
  }
});
