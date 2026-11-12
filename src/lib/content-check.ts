// The content check behind `npm run check:content`: every number the site shows must
// appear, in canonical form, in the bank export that the text draws on. The scope of
// each text is fixed by where it lives (runContentCheck). The check reads only the
// committed exports, so it works the same locally and in CI.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'astro/zod';
import { isNode, isScalar, LineCounter, parseDocument, visit } from 'yaml';
import { loadAllowlist, type Allowlist } from './allowlist.ts';
import {
  formatIssues,
  ProfileExportSchema,
  ProjectExportSchema,
  WorkExportSchema,
  type ProjectExport,
  type WorkExport,
  type WorkstreamExport,
} from './bank-export.ts';
import { canonical, extractNumbers, numbersIn } from './numbers.ts';

export type Finding = { file: string; line: number; token: string; excerpt: string };

const CONTENT = 'src/content';
const ALLOWLIST = 'content/allowlist.yaml';
/** Frontmatter keys whose values are not checked. */
const UNCHECKED_KEYS = new Set(['date', 'updated']);
/** An MDX `import` or `export` line: the keyword, then whitespace, so `export-time` is prose. */
const ESM = /^(?:import|export)\s/;
/** A code fence's opening or closing line: up to three spaces, then three or more ` or ~. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Findings for the tokens of `text` that are neither in `allowed` (canonical tokens,
 * as numbersIn gives them) nor in `ignore`. Line `i` of `text` is reported as line
 * `opts.line + i`; a token is reported once per line.
 */
export function checkText(
  text: string,
  allowed: Set<string>,
  opts: { file: string; line?: number; ignore?: Set<string> },
): Finding[] {
  const { file, line = 1 } = opts;
  const ignore = new Set([...(opts.ignore ?? [])].map(canonical));
  const findings: Finding[] = [];
  text.split(/\r?\n/).forEach((content, i) => {
    const reported = new Set<string>();
    for (const token of extractNumbers(content)) {
      if (allowed.has(token) || ignore.has(token) || reported.has(token)) continue;
      reported.add(token);
      findings.push({ file, line: line + i, token, excerpt: content.trim() });
    }
  });
  return findings;
}

/** The source split into lines, plus the frontmatter between the `---` fences, if any. */
function splitMdx(source: string): { lines: string[]; frontmatter?: string; bodyStart: number } {
  const lines = source.split(/\r?\n/);
  const end = lines[0].trimEnd() === '---' ? lines.findIndex((l, i) => i > 0 && l.trimEnd() === '---') : -1;
  if (end === -1) return { lines, bodyStart: 0 };
  return { lines, frontmatter: lines.slice(1, end).join('\n'), bodyStart: end + 1 };
}

function parseFrontmatter(frontmatter: string, file: string) {
  const lineCounter = new LineCounter();
  const doc = parseDocument(frontmatter, { lineCounter });
  if (doc.errors.length > 0) throw new Error(`${file}: the frontmatter is not valid YAML: ${doc.errors[0].message}`);
  return { doc, lineCounter };
}

/** The frontmatter as plain data; `{}` when there is none. */
function frontmatterData(source: string, file: string): Record<string, unknown> {
  const { frontmatter } = splitMdx(source);
  if (frontmatter === undefined) return {};
  const data: unknown = parseFrontmatter(frontmatter, file).doc.toJS();
  return data !== null && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
}

/**
 * The body lines that are MDX `import` or `export` statements: those outside ``` and
 * ~~~ fences. Inside a fence such a line is code, such as `export NCCL_BUFFSIZE=…`. A
 * fence closes on a line of its own character, at least as long as the opening run,
 * with nothing after it but spaces; an unclosed fence runs to the end, as in Markdown.
 */
function esmLines(lines: string[], from: number): Set<number> {
  const esm = new Set<number>();
  let fence: string | undefined;
  for (let i = from; i < lines.length; i++) {
    const run = lines[i].match(FENCE)?.[1];
    if (fence === undefined) {
      if (run !== undefined) fence = run;
      else if (ESM.test(lines[i])) esm.add(i);
    } else if (run !== undefined && run[0] === fence[0] && run.length >= fence.length && lines[i].trim() === run) {
      fence = undefined;
    }
  }
  return esm;
}

/**
 * Checks every frontmatter string value except `date` and `updated`, and every body
 * line except MDX `import` and `export` statements outside code fences. Lines are
 * 1-based lines of the file; a frontmatter value that spans lines is reported at its
 * first line.
 */
export function checkMdx(source: string, allowed: Set<string>, opts: { file: string; ignore?: Set<string> }): Finding[] {
  const { file, ignore } = opts;
  const { lines, frontmatter, bodyStart } = splitMdx(source);
  const findings: Finding[] = [];

  if (frontmatter !== undefined) {
    const { doc, lineCounter } = parseFrontmatter(frontmatter, file);
    visit(doc, {
      Pair(_, pair, path) {
        // path is [document, root map] for a top-level key.
        if (path.length === 2 && isScalar(pair.key) && UNCHECKED_KEYS.has(String(pair.key.value))) return visit.SKIP;
      },
      Scalar(key, node) {
        if (key === 'key' || typeof node.value !== 'string' || !node.range) return;
        // +1 for the opening fence.
        const line = lineCounter.linePos(node.range[0]).line + 1;
        findings.push(...checkText(node.value.replace(/\s*\n\s*/g, ' '), allowed, { file, line, ignore }));
      },
    });
  }

  const esm = esmLines(lines, bodyStart);
  for (let i = bodyStart; i < lines.length; i++)
    if (!esm.has(i)) findings.push(...checkText(lines[i], allowed, { file, line: i + 1, ignore }));
  return findings;
}

function readExport<T>(siteDir: string, relPath: string, schema: z.ZodType<T>): T {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(siteDir, relPath), 'utf8'));
  } catch (error) {
    throw new Error(`${relPath}: ${(error as Error).message}`);
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(`${relPath}: ${formatIssues(result.error).replaceAll('\n', `\n${relPath}: `)}`);
  return result.data;
}

/** The names of the files in `dir` (relative to `siteDir`) that end in `ext`, sorted; none if `dir` is missing. */
function filesIn(siteDir: string, dir: string, ext: string): string[] {
  const abs = join(siteDir, dir);
  return existsSync(abs) ? readdirSync(abs).filter((f) => f.endsWith(ext)).sort() : [];
}

/** The exports in `dir`, keyed by file name without `.json`. */
function exportsIn<T>(siteDir: string, dir: string, schema: z.ZodType<T>): Map<string, T> {
  return new Map(
    filesIn(siteDir, dir, '.json').map((f) => [f.slice(0, -'.json'.length), readExport(siteDir, `${dir}/${f}`, schema)]),
  );
}

type YamlPath = (string | number)[];

/** Allowlist text against its scope: the project's export, the cited workstream or the work export. */
function checkAllowlist(
  siteDir: string,
  a: Allowlist,
  projects: Map<string, ProjectExport>,
  work: Map<string, WorkExport>,
  ignore: Set<string>,
): Finding[] {
  const lineCounter = new LineCounter();
  const doc = parseDocument(readFileSync(join(siteDir, ALLOWLIST), 'utf8'), { lineCounter });
  const lineOf = (path: YamlPath): number => {
    const node = doc.getIn(path, true);
    return isNode(node) && node.range ? lineCounter.linePos(node.range[0]).line : 0;
  };
  const fail = (path: YamlPath, message: string): never => {
    throw new Error(`${ALLOWLIST}:${lineOf(path)}: ${message}`);
  };
  const projectExport = (id: string, path: YamlPath): ProjectExport =>
    projects.get(id) ?? fail(path, `${id}: no export in ${CONTENT}/projects`);
  const workstream = (exp: ProjectExport, from: string, path: YamlPath, field: string): WorkstreamExport =>
    exp.workstreams.find((w) => w.id === from) ??
    fail(path, `${exp.id}: ${field} "${from}" is not a workstream in ${CONTENT}/projects/${exp.id}.json`);

  const findings: Finding[] = [];
  const check = (text: string, allowed: Set<string>, path: YamlPath) =>
    findings.push(...checkText(text, allowed, { file: ALLOWLIST, line: lineOf(path), ignore }));

  a.projects.forEach((p, i) => {
    const at = (...rest: YamlPath): YamlPath => ['projects', i, ...rest];
    const exp = projectExport(p.id, at('id'));
    const inProject = numbersIn(exp);
    // `name` is shown like the one-liner, so it gets the same scope.
    if (p.name !== undefined) check(p.name, inProject, at('name'));
    if (p.plate_caption !== undefined) check(p.plate_caption, inProject, at('plate_caption'));
    check(p.one_liner, inProject, at('one_liner'));
    p.stack.forEach((item, j) => check(item, inProject, at('stack', j)));
    p.key_results.forEach((k, j) => {
      const ws = workstream(exp, k.from, at('key_results', j, 'from'), `key_results[${j}].from`);
      check(k.text, numbersIn(ws), at('key_results', j, 'text'));
    });
  });

  const stats = a.home.stats;
  const at = (...rest: YamlPath): YamlPath => ['home', 'stats', ...rest];
  const statsExport = projectExport(stats.project, at('project'));
  check(stats.caption, numbersIn(statsExport), at('caption'));
  const inWorkstream = numbersIn(workstream(statsExport, stats.from, at('from'), 'home.stats.from'));
  stats.items.forEach((item, j) => {
    check(item.value, inWorkstream, at('items', j, 'value'));
    check(item.label, inWorkstream, at('items', j, 'label'));
  });

  a.work.forEach((w, i) => {
    const exp = work.get(w.id) ?? fail(['work', i, 'id'], `${w.id}: no export in ${CONTENT}/work`);
    check(w.line, numbersIn(exp), ['work', i, 'line']);
  });

  return findings.sort((x, y) => x.line - y.line);
}

/**
 * Checks the site at `siteDir`. MDX folders may be missing. Findings come in this
 * order: case studies, writing, focus, pages (each by file name), then the allowlist
 * by line. Throws, naming the file, when a text cites a project or workstream that
 * has no export, or when an export or frontmatter cannot be read.
 */
export function runContentCheck(siteDir: string): Finding[] {
  const allowlist = loadAllowlist(join(siteDir, ALLOWLIST));
  const ignore = new Set(allowlist.check.ignore);
  const projects = exportsIn(siteDir, `${CONTENT}/projects`, ProjectExportSchema);
  const work = exportsIn(siteDir, `${CONTENT}/work`, WorkExportSchema);
  const profile = readExport(siteDir, `${CONTENT}/profile.json`, ProfileExportSchema);

  const projectExport = (id: string, file: string): ProjectExport => {
    const exp = projects.get(id);
    if (!exp) throw new Error(`${file}: no export for project "${id}" in ${CONTENT}/projects`);
    return exp;
  };

  const findings: Finding[] = [];
  /** Checks each MDX file in `dir` against the numbers `scope` allows; `undefined` leaves the file unchecked. */
  const checkFolder = (
    dir: string,
    scope: (file: string, id: string, data: Record<string, unknown>) => Set<string> | undefined,
  ) => {
    for (const name of filesIn(siteDir, `${CONTENT}/${dir}`, '.mdx')) {
      const file = `${CONTENT}/${dir}/${name}`;
      const source = readFileSync(join(siteDir, file), 'utf8');
      const allowed = scope(file, name.slice(0, -'.mdx'.length), frontmatterData(source, file));
      if (allowed) findings.push(...checkMdx(source, allowed, { file, ignore }));
    }
  };

  checkFolder('case-studies', (file, id) => numbersIn(projectExport(id, file)));
  checkFolder('writing', (file, _id, { project }) => {
    if (project === undefined) return undefined;
    if (typeof project !== 'string') throw new Error(`${file}: project must be a project id`);
    return numbersIn(projectExport(project, file));
  });
  checkFolder('focus', (file, _id, { projects: ids = [] }) => {
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string'))
      throw new Error(`${file}: projects must be a list of project ids`);
    return numbersIn(ids.map((id) => projectExport(id, file)));
  });
  // about.mdx is the only page today; any other page gets the same, widest scope rather than none.
  const everything = numbersIn([...projects.values(), ...work.values(), profile]);
  checkFolder('pages', () => everything);

  findings.push(...checkAllowlist(siteDir, allowlist, projects, work, ignore));
  return findings;
}
