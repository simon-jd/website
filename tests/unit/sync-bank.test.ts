import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { stringify } from 'yaml';
import type { Allowlist, AllowlistProject } from '../../src/lib/allowlist.ts';
import { exportProject, serialize } from '../../src/lib/bank-export.ts';
import { syncBank } from '../../scripts/sync-bank.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/bank', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../../scripts/sync-bank.ts', import.meta.url));

let tmp = '';
let bankDir = '';
let siteDir = '';
let savedCI: string | undefined;

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', [
    '-C', cwd,
    '-c', 'user.name=Test', '-c', 'user.email=test@example.com',
    '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null',
    ...args,
  ], { stdio: 'pipe' });

const featured = (id: string, plate: 1 | 2 | 3 | 4): AllowlistProject => ({
  id,
  focus: id === 'delta' || id === 'epsilon' ? 'infra' : 'ml-infra',
  featured: true,
  plate,
  plate_caption: `i synthetic · ii plate ${plate}`,
  one_liner: `A synthetic one-liner for ${id}.`,
  stack: [],
  key_results: [
    { text: 'Synthetic result', from: id === 'alpha' ? 'alpha-kernels' : `${id}-main` },
    { text: 'Another synthetic result', from: id === 'alpha' ? 'alpha-tooling' : `${id}-main` },
  ],
  exclude_workstreams: [],
});

const plain = (id: string): AllowlistProject => ({
  id,
  focus: 'ml-infra',
  featured: false,
  one_liner: `A synthetic one-liner for ${id}.`,
  stack: [],
  key_results: [],
  exclude_workstreams: [],
});

function allowlist(extra: AllowlistProject[] = []): Allowlist {
  return {
    projects: [featured('alpha', 1), featured('gamma', 2), featured('delta', 3), featured('epsilon', 4), ...extra],
    home: {
      stats: {
        project: 'alpha',
        from: 'alpha-kernels',
        caption: 'Synthetic caption',
        items: [
          { value: '2.50 → 1.25 s', label: 'synthetic step' },
          { value: '1,024', label: 'synthetic runs' },
          { value: '3 of 4', label: 'synthetic variants' },
        ],
      },
    },
    work: [{ id: 'acme', line: 'Synthetic platform work.' }],
    check: { ignore: [] },
  };
}

function writeAllowlist(value: Allowlist) {
  mkdirSync(join(siteDir, 'content'), { recursive: true });
  writeFileSync(join(siteDir, 'content/allowlist.yaml'), stringify(value));
}

function siteFiles(dir = join(siteDir, 'src')): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name));
}

beforeEach(() => {
  savedCI = process.env.CI;
  delete process.env.CI;
  tmp = mkdtempSync(join(tmpdir(), 'sync-bank-test-'));
  const repo = join(tmp, 'bank');
  cpSync(FIXTURES, repo, { recursive: true });
  git(repo, 'init', '-q');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'Synthetic bank');
  bankDir = join(repo, 'data');
  siteDir = join(tmp, 'site');
  writeAllowlist(allowlist());
});

afterEach(() => {
  if (savedCI === undefined) delete process.env.CI;
  else process.env.CI = savedCI;
  rmSync(tmp, { recursive: true, force: true });
});

test('syncBank writes one export per allowlisted project and removes stale ones', () => {
  mkdirSync(join(siteDir, 'src/content/projects'), { recursive: true });
  writeFileSync(join(siteDir, 'src/content/projects/stale.json'), '{}\n');

  const { written, removed } = syncBank({ bankDir, siteDir });

  expect(written).toEqual([
    'src/content/projects/alpha.json',
    'src/content/projects/gamma.json',
    'src/content/projects/delta.json',
    'src/content/projects/epsilon.json',
    'src/content/work/acme.json',
    'src/content/profile.json',
  ]);
  expect(removed).toEqual(['src/content/projects/stale.json']);
  expect(existsSync(join(siteDir, 'src/content/projects/stale.json'))).toBe(false);
  const alpha = JSON.parse(readFileSync(join(FIXTURES, 'data/projects/alpha.json'), 'utf8'));
  expect(readFileSync(join(siteDir, 'src/content/projects/alpha.json'), 'utf8'))
    .toBe(serialize(exportProject(alpha, [])));
});

test('syncBank refuses an uncommitted bank file', () => {
  const file = join(bankDir, 'projects/alpha.json');
  writeFileSync(file, readFileSync(file, 'utf8').replace('Synthetic kernels', 'Edited kernels'));
  expect(() => syncBank({ bankDir, siteDir })).toThrow(/projects\/alpha\.json.*not committed/);
  expect(siteFiles()).toEqual([]);
});

test('syncBank refuses an untracked bank file', () => {
  const gamma = readFileSync(join(bankDir, 'projects/gamma.json'), 'utf8');
  writeFileSync(join(bankDir, 'projects/zeta.json'), gamma.replaceAll('gamma', 'zeta'));
  writeAllowlist(allowlist([plain('zeta')]));
  expect(() => syncBank({ bankDir, siteDir })).toThrow(/projects\/zeta\.json.*not committed/);
  // git's own words come along: here, ls-files --error-unmatch on stderr.
  expect(() => syncBank({ bankDir, siteDir })).toThrow(/\n {2}git: error: pathspec 'projects\/zeta\.json' did not match/);
  expect(siteFiles()).toEqual([]);
});

test('syncBank names git\'s error when BANK_DIR is not in a repository', () => {
  const outside = join(tmp, 'outside');
  mkdirSync(outside);
  const saved = process.env.GIT_CEILING_DIRECTORIES;
  // Stops git from finding a repository above the temp folder.
  process.env.GIT_CEILING_DIRECTORIES = tmp;
  try {
    expect(() => syncBank({ bankDir: outside, siteDir })).toThrow(
      /^BANK_DIR \(.*outside\) is not inside a git repository\n {2}git: fatal: not a git repository/,
    );
  } finally {
    if (saved === undefined) delete process.env.GIT_CEILING_DIRECTORIES;
    else process.env.GIT_CEILING_DIRECTORIES = saved;
  }
});

test('syncBank leaves the bank\'s git index untouched', () => {
  // A new mtime with the same content: a plain `git status` refreshes the index entry and
  // rewrites .git/index; the bank is shared with other sessions, so the sync must not.
  const index = join(tmp, 'bank/.git/index');
  const file = join(bankDir, 'projects/alpha.json');
  const later = new Date(statSync(file).mtimeMs + 60_000);
  utimesSync(file, later, later);
  const before = { bytes: readFileSync(index), mtime: statSync(index).mtimeMs };
  syncBank({ bankDir, siteDir });
  expect(readFileSync(index).equals(before.bytes)).toBe(true);
  expect(statSync(index).mtimeMs).toBe(before.mtime);
});

test('syncBank never reads stories', () => {
  syncBank({ bankDir, siteDir });
  const outputs = siteFiles();
  expect(outputs.length).toBeGreaterThan(0);
  for (const f of outputs) expect(readFileSync(f, 'utf8')).not.toMatch(/SECRET-STORY|SECRET-CLARIFICATION/);

  rmSync(join(siteDir, 'src'), { recursive: true });
  writeAllowlist(allowlist([plain('../stories/secret')]));
  expect(() => syncBank({ bankDir, siteDir })).toThrow(/projects\.4\.id: must match/);
  expect(siteFiles()).toEqual([]);
});

test('syncBank lists the problems with the selection and writes nothing', () => {
  const a = allowlist();
  a.projects[0].key_results[0].from = 'renamed-ws';
  a.projects[0].stack = ['Kubernetes'];
  writeAllowlist(a);
  expect(() => syncBank({ bankDir, siteDir })).toThrow(
    /alpha: key_results\[0\]\.from "renamed-ws" is not an exported workstream\n.*alpha: stack "Kubernetes" is not in tech_stack/,
  );
  expect(siteFiles()).toEqual([]);
});

test('syncBank refuses to run in CI', () => {
  process.env.CI = 'true';
  expect(() => syncBank({ bankDir, siteDir })).toThrow(/only on Junrui's machine/);
});

test('the CLI prints the problems and exits 1', () => {
  const a = allowlist();
  a.projects[0].key_results[0].from = 'renamed-ws';
  writeAllowlist(a);
  const env: NodeJS.ProcessEnv = { ...process.env, BANK_DIR: bankDir };
  delete env.CI;
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: siteDir, env, encoding: 'utf8' });
  expect(r.status).toBe(1);
  expect(r.stderr).toMatch(/alpha: key_results\[0\]\.from "renamed-ws"/);
  expect(siteFiles()).toEqual([]);
});
