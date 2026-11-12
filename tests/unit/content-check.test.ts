import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { checkMdx, runContentCheck } from '../../src/lib/content-check.ts';
import { numbersIn } from '../../src/lib/numbers.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SITE = fileURLToPath(new URL('../fixtures/site', import.meta.url));
const ALLOWLIST = 'content/allowlist.yaml';

test('flags a number the bank does not contain, with its line', () => {
  expect(checkMdx('---\ntitle: X\n---\nfine 2.22\nbad 3.14\n', new Set(['2.22']), { file: 'a.mdx' }))
    .toEqual([{ file: 'a.mdx', line: 5, token: '3.14', excerpt: 'bad 3.14' }]);
});

test('1478 passes when the bank writes 1,478', () => {
  expect(checkMdx('1478 collectives\n', numbersIn('1,478 collectives'), { file: 'a.mdx' })).toEqual([]);
});

test('2.2 fails when the bank writes 2.20', () => {
  expect(checkMdx('sync 2.2 s\n', numbersIn('sync 2.20 s'), { file: 'a.mdx' }))
    .toEqual([{ file: 'a.mdx', line: 1, token: '2.2', excerpt: 'sync 2.2 s' }]);
});

test('checks title and summary but not date', () => {
  const source = (summary: string) =>
    [
      '---',
      'title: "1,478 collectives, then 25"',
      'date: 2026-11-08',
      'updated: 2026-11-08T09:30:00Z',
      `summary: "${summary}"`,
      '---',
      'Body.',
    ].join('\n');
  const allowed = new Set(['1478']);
  expect(checkMdx(source('1478 of them'), allowed, { file: 'a.mdx' }))
    .toEqual([{ file: 'a.mdx', line: 2, token: '25', excerpt: '1,478 collectives, then 25' }]);
  expect(checkMdx(source('then 64'), allowed, { file: 'a.mdx' })).toEqual([
    { file: 'a.mdx', line: 2, token: '25', excerpt: '1,478 collectives, then 25' },
    { file: 'a.mdx', line: 5, token: '64', excerpt: 'then 64' },
  ]);
});

test('skips import and export lines', () => {
  const source = 'import X from "./x2.astro";\nexport const layout = "a4";\n\nText.\n';
  expect(checkMdx(source, new Set(), { file: 'a.mdx' })).toEqual([]);
});

test('checks a hyphenated pair that is not a date', () => {
  expect(checkMdx('tiles of 1024-64 elements\n', new Set(['1024']), { file: 'a.mdx' }))
    .toEqual([{ file: 'a.mdx', line: 1, token: '64', excerpt: 'tiles of 1024-64 elements' }]);
});

test('checks import and export lines inside code fences', () => {
  const source = [
    'Text.',
    '```sh',
    'export NCCL_BUFFSIZE=67108864',
    '```',
    '',
    '~~~python',
    'import torch; BATCH = 4096',
    '~~~',
    '',
    'export const after = "a4";',
  ].join('\n');
  expect(checkMdx(source, new Set(), { file: 'a.mdx' })).toEqual([
    { file: 'a.mdx', line: 3, token: '67108864', excerpt: 'export NCCL_BUFFSIZE=67108864' },
    { file: 'a.mdx', line: 7, token: '4096', excerpt: 'import torch; BATCH = 4096' },
  ]);
});

test('a fence closes only on its own character, at least as long as it opened', () => {
  const source = ['````md', '```', 'export X=11', '~~~', '````', 'export const y = "a4";'].join('\n');
  expect(checkMdx(source, new Set(), { file: 'a.mdx' }))
    .toEqual([{ file: 'a.mdx', line: 3, token: '11', excerpt: 'export X=11' }]);
});

test('prose that starts with import or export is checked', () => {
  const source = 'export-time cost fell to 3.7 s.\nimporting took 12 s.\n';
  expect(checkMdx(source, new Set(), { file: 'a.mdx' })).toEqual([
    { file: 'a.mdx', line: 1, token: '3.7', excerpt: 'export-time cost fell to 3.7 s.' },
    { file: 'a.mdx', line: 2, token: '12', excerpt: 'importing took 12 s.' },
  ]);
});

test('checks numbers inside inline code', () => {
  expect(checkMdx('Set `BATCH=4096` and `--buckets 15`.\n', new Set(['15']), { file: 'a.mdx' }))
    .toEqual([{ file: 'a.mdx', line: 1, token: '4096', excerpt: 'Set `BATCH=4096` and `--buckets 15`.' }]);
});

test('checks numbers inside component props', () => {
  const source = '<BarChart rows={[{ label: "x", value: 9.99, unit: "s" }]} />';
  expect(checkMdx(source, new Set(), { file: 'a.mdx' }))
    .toEqual([{ file: 'a.mdx', line: 1, token: '9.99', excerpt: source }]);
});

test('respects the ignore list', () => {
  expect(checkMdx('bad 3.14\n', new Set(), { file: 'a.mdx', ignore: new Set(['3.14']) })).toEqual([]);
});

test('ignore entries are compared in canonical form', () => {
  // `1,478` and `007` in check.ignore cover 1478 and 7 in the text, as the bank's forms do.
  const ignore = new Set(['1,478', '007']);
  expect(checkMdx('1478 collectives in 7 runs, 2.20 s\n', new Set(), { file: 'a.mdx', ignore }))
    .toEqual([{ file: 'a.mdx', line: 1, token: '2.20', excerpt: '1478 collectives in 7 runs, 2.20 s' }]);
});

test('runContentCheck checks allowlist text against the cited workstream', () => {
  expect(runContentCheck(SITE)).toContainEqual({
    file: ALLOWLIST,
    line: 16,
    token: '3.14',
    excerpt: 'Synthetic tooling 3.14 ms per call',
  });
});

test('runContentCheck checks each file against its own scope', () => {
  // The fixture's comments say why each of these fails and why its neighbours pass.
  expect(runContentCheck(SITE).map((f) => `${f.file}:${f.line} ${f.token}`)).toEqual([
    'src/content/case-studies/alpha.mdx:9 640',
    'src/content/writing/with-project.mdx:11 25',
    'src/content/focus/systems.mdx:10 32',
    'src/content/pages/about.mdx:7 77',
    `${ALLOWLIST}:16 3.14`,
    `${ALLOWLIST}:36 42`,
    `${ALLOWLIST}:42 7`,
  ]);
});

describe('on a copy of the fixture site', () => {
  let site = '';
  beforeEach(() => {
    site = mkdtempSync(join(tmpdir(), 'content-check-'));
    cpSync(SITE, site, { recursive: true });
  });
  afterEach(() => rmSync(site, { recursive: true, force: true }));

  test('missing MDX folders are not an error', () => {
    for (const dir of ['case-studies', 'writing', 'focus', 'pages'])
      rmSync(join(site, 'src/content', dir), { recursive: true });
    expect(runContentCheck(site).map((f) => f.file)).toEqual([ALLOWLIST, ALLOWLIST, ALLOWLIST]);
  });

  test('check.ignore in the allowlist is compared in canonical form', () => {
    // The fixture's case study has 640, which its project's export lacks.
    const file = join(site, ALLOWLIST);
    writeFileSync(file, readFileSync(file, 'utf8').replace('ignore: ["99"]', 'ignore: ["0,640"]'));
    expect(runContentCheck(site).map((f) => f.token)).not.toContain('640');
  });

  test('a case study without an export fails with its file', () => {
    const dir = join(site, 'src/content/case-studies');
    renameSync(join(dir, 'alpha.mdx'), join(dir, 'gamma.mdx'));
    expect(() => runContentCheck(site)).toThrow('src/content/case-studies/gamma.mdx: no export for project "gamma"');
  });

  test('a key result citing a workstream the export lacks fails with the project and the field', () => {
    const file = join(site, ALLOWLIST);
    writeFileSync(file, readFileSync(file, 'utf8').replace('from: ws-a\n  - id: beta', 'from: ws-gone\n  - id: beta'));
    expect(() => runContentCheck(site)).toThrow(
      `${ALLOWLIST}:17: alpha: key_results[1].from "ws-gone" is not a workstream in src/content/projects/alpha.json`,
    );
  });
});

test('the CLI exits 1 and prints file:line', () => {
  const r = spawnSync('node', ['scripts/check-content.ts', 'tests/fixtures/site'], { cwd: ROOT, encoding: 'utf8' });
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/case-studies\/alpha\.mdx:\d+/);
  expect(r.stdout).toContain('src/content/case-studies/alpha.mdx:9  640  "Beta\'s number does not belong here: 640 events/s."');
});
