// npm run fonts:subset: cuts the site's four faces to the characters its built pages draw
// (src/lib/font-charset.ts) and writes them, with a manifest, to src/assets/fonts/. The
// sources are Fontsource's latin files, so a subset never covers more than they did. Rerun
// it, then rebuild, when the dist font test reports a character the subsets lack.
//
// Fewer glyphs is fewer bytes before the first paint: on Lighthouse's simulated phone
// connection the relief image shares the link with the fonts, and each KB of font costs
// the largest paint about 7 ms.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import { pageCharacters, sortedCharacters } from '../src/lib/font-charset.ts';

export const FONT_DIR = 'src/assets/fonts';
export const MANIFEST = join(FONT_DIR, 'subset.json');

/** Each face's file name in FONT_DIR, and its Fontsource source. */
export const FACES = {
  'cormorant-garamond-500-normal': '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2',
  'cormorant-garamond-400-italic': '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2',
  'inter-400-normal': '@fontsource/inter/files/inter-latin-400-normal.woff2',
  'jetbrains-mono-400-normal': '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2',
} as const;

/** Copyright, license description and license URL, which the SIL OFL asks copies to carry. */
const OFL_NAME_IDS = [0, 13, 14];

export interface Manifest {
  note: string;
  characters: string;
  faces: Record<string, { source: string; sha256: string }>;
}

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

async function main(): Promise<void> {
  const require = createRequire(import.meta.url);
  const characters = sortedCharacters(pageCharacters('dist'));
  const manifest: Manifest = {
    note: 'Written by `npm run fonts:subset` from the built pages; do not edit by hand.',
    characters,
    faces: {},
  };
  mkdirSync(FONT_DIR, { recursive: true });
  for (const [name, source] of Object.entries(FACES)) {
    const path = require.resolve(source);
    const pkg = source.split('/files/')[0];
    const { version } = JSON.parse(readFileSync(join(dirname(path), '..', 'package.json'), 'utf8')) as {
      version: string;
    };
    const subset = await subsetFont(readFileSync(path), characters, {
      targetFormat: 'woff2',
      preserveNameIds: OFL_NAME_IDS,
    });
    writeFileSync(join(FONT_DIR, `${name}.woff2`), subset);
    manifest.faces[name] = { source: `${pkg}@${version} ${source.split('/files/')[1]}`, sha256: sha256(subset) };
    console.log(`${name}.woff2: ${readFileSync(path).length} → ${subset.length} bytes`);
  }
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${[...characters].length} characters → ${MANIFEST}`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
