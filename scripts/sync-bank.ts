// npm run sync:bank: exports the public facts of the allowlisted projects from the
// résumé bank ($BANK_DIR) into src/content/. It runs only on Junrui's machine; CI and
// builds use the committed exports. It reads only projects/<id>.json for allowlisted
// ids, work/ml_infra/<id>.json for allowlisted work ids and profile.json, and only
// when git shows each file tracked and unmodified.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllowlist, validateSelection } from '../src/lib/allowlist.ts';
import {
  exportProfile,
  exportProject,
  exportWork,
  serialize,
  type ProjectExport,
  type WorkExport,
} from '../src/lib/bank-export.ts';

const PROJECTS_OUT = 'src/content/projects';
const WORK_OUT = 'src/content/work';
const PROFILE_OUT = 'src/content/profile.json';

/**
 * Runs git in `cwd`. `--no-optional-locks` keeps every call read-only: without it,
 * `git status` refreshes the index and writes the bank's .git/index, which other
 * sessions share.
 */
function git(cwd: string, args: string[]): string {
  return execFileSync('git', ['--no-optional-locks', '-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** What a failed git call printed on stderr (or, without any, its error message), each line as `  git: …`. */
function gitSaid(error: unknown): string {
  const { stderr, message } = error as { stderr?: string | Buffer; message?: string };
  const said = (typeof stderr === 'string' ? stderr : (stderr?.toString('utf8') ?? '')).trim() || String(message ?? error);
  return said
    .split(/\r?\n/)
    .map((line) => `  git: ${line}`)
    .join('\n');
}

function refuseCI(): void {
  const ci = process.env.CI;
  if (ci && ci !== 'false' && ci !== '0')
    throw new Error("sync:bank runs only on Junrui's machine; CI builds from the committed exports in src/content");
}

/** Throws unless `relPath` (relative to `bankDir`) is tracked by git and has no uncommitted changes. */
export function assertCommitted(bankDir: string, relPath: string): void {
  try {
    git(bankDir, ['ls-files', '--error-unmatch', '--', relPath]);
  } catch (error) {
    throw new Error(`${relPath} is not committed in the bank: git does not track it\n${gitSaid(error)}`);
  }
  if (git(bankDir, ['status', '--porcelain', '--', relPath]).trim() !== '')
    throw new Error(`${relPath} is not committed in the bank: it has uncommitted changes`);
}

function staleExports(siteDir: string, dir: string, keep: Set<string>): string[] {
  const abs = join(siteDir, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((f) => f.endsWith('.json') && !keep.has(f.slice(0, -'.json'.length)))
    .sort()
    .map((f) => `${dir}/${f}`);
}

export function syncBank(opts: { bankDir: string; siteDir: string }): { written: string[]; removed: string[] } {
  refuseCI();
  const { bankDir, siteDir } = opts;
  try {
    git(bankDir, ['rev-parse', '--show-toplevel']);
  } catch (error) {
    throw new Error(`BANK_DIR (${bankDir}) is not inside a git repository\n${gitSaid(error)}`);
  }

  // The allowlist schema checks every id against ID_PATTERN before any path is built.
  const allowlist = loadAllowlist(join(siteDir, 'content/allowlist.yaml'));
  const readBank = (relPath: string): unknown => {
    assertCommitted(bankDir, relPath);
    try {
      return JSON.parse(readFileSync(join(bankDir, relPath), 'utf8'));
    } catch (error) {
      throw new Error(`${relPath}: ${(error as Error).message}`);
    }
  };
  const sameId = (relPath: string, expected: string, actual: string) => {
    if (actual !== expected) throw new Error(`${expected}: ${relPath} has id "${actual}"`);
  };

  const projects = new Map<string, ProjectExport>();
  for (const p of allowlist.projects) {
    const relPath = `projects/${p.id}.json`;
    const exp = exportProject(readBank(relPath), p.exclude_workstreams);
    sameId(relPath, p.id, exp.id);
    projects.set(p.id, exp);
  }
  const work = new Map<string, WorkExport>();
  for (const w of allowlist.work) {
    const relPath = `work/ml_infra/${w.id}.json`;
    const exp = exportWork(readBank(relPath));
    sameId(relPath, w.id, exp.id);
    work.set(w.id, exp);
  }
  const profile = exportProfile(readBank('profile.json'));

  const problems = validateSelection(allowlist, projects, work);
  if (problems.length > 0)
    throw new Error(`The allowlist does not fit the bank:\n${problems.map((p) => `  ${p}`).join('\n')}`);

  const written: string[] = [];
  const write = (relPath: string, value: unknown) => {
    const abs = join(siteDir, relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, serialize(value));
    written.push(relPath);
  };
  for (const [id, exp] of projects) write(`${PROJECTS_OUT}/${id}.json`, exp);
  for (const [id, exp] of work) write(`${WORK_OUT}/${id}.json`, exp);
  write(PROFILE_OUT, profile);

  const removed = [
    ...staleExports(siteDir, PROJECTS_OUT, new Set(projects.keys())),
    ...staleExports(siteDir, WORK_OUT, new Set(work.keys())),
  ];
  for (const relPath of removed) rmSync(join(siteDir, relPath));
  return { written, removed };
}

function main(): void {
  try {
    refuseCI();
    const bankDir = process.env.BANK_DIR;
    if (!bankDir) throw new Error('BANK_DIR is not set; put it in .env.local');
    const { written, removed } = syncBank({ bankDir, siteDir: process.cwd() });
    console.log(`written (${written.length}):`);
    for (const f of written) console.log(`  ${f}`);
    console.log(`removed (${removed.length}):`);
    for (const f of removed) console.log(`  ${f}`);
    console.log('Review what becomes public with `git diff src/content` before committing.');
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
