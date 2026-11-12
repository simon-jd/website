// The public subset of the résumé bank. Each export is built field by field from a
// parsed bank file, so nothing the bank adds later (user_clarifications, notes,
// phone numbers) can reach the site by accident.
import { z } from 'astro/zod';

/** Ids of bank files, workstreams and allowlist entries; never `/` or `.`, so they are safe in paths. */
export const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const REPO_PREFIX = 'https://github.com/simon-jd/';

const slug = () => z.string().regex(SLUG, `must match ${SLUG.source}`);
const text = () => z.string().min(1);
const repoUrl = () => z.string().startsWith(REPO_PREFIX, `must start with ${REPO_PREFIX}`);

const workstreamFields = {
  id: slug(),
  title: text(),
  period: text(),
  tracks: z.array(z.string()),
  tech_stack: z.array(z.string()),
  summary: text(),
  bullets: z.array(z.string()),
};

// Output schemas: strict, so a committed export with any extra field fails the build.
export const WorkstreamExportSchema = z.strictObject(workstreamFields);

export const ProjectExportSchema = z.strictObject({
  id: slug(),
  title: text(),
  date: text(),
  repo: repoUrl(),
  workstreams: z.array(WorkstreamExportSchema).min(1),
});

// No summary: the bank's work summaries are notes for the résumé generator (they say
// "the user load-tested…"), and the site shows only each entry's allowlist line.
export const WorkExportSchema = z.strictObject({
  id: slug(),
  organization: text(),
  title: text(),
  date: text(),
});

export const ProfileExportSchema = z.strictObject({
  name: text(),
  email: text(),
  linkedin: text(),
  github: text(),
  location: text(),
  education: z.array(
    z.strictObject({ school: text(), location: text(), degree: text(), date: text() }),
  ),
});

export type WorkstreamExport = z.infer<typeof WorkstreamExportSchema>;
export type ProjectExport = z.infer<typeof ProjectExportSchema>;
export type WorkExport = z.infer<typeof WorkExportSchema>;
export type ProfileExport = z.infer<typeof ProfileExportSchema>;

// Input schemas: they accept any other keys in a bank file and strip them.
const BankProject = z.object({
  id: slug(),
  header: z.object({
    title: text(),
    date: text(),
    repository: z.object({ github_url: repoUrl() }),
  }),
  workstreams: z.array(z.object(workstreamFields)).min(1),
});

const BankWork = z.object({
  id: slug(),
  header: z.object({ organization: text(), title: text(), date: text() }),
});

const BankProfile = z.object({
  name: text(),
  email: text(),
  linkedin: text(),
  github: text(),
  location: text(),
  education: z.array(z.object({ school: text(), location: text(), degree: text(), date: text() })),
});

/** One line per issue, each naming the field's path, such as `header.repository.github_url: …`. */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.length ? issue.path.join('.') : '(top level)'}: ${issue.message}`)
    .join('\n');
}

function parseBank<T extends z.ZodType>(schema: T, raw: unknown, fallbackLabel: string): z.output<T> {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const id = (raw as { id?: unknown } | null)?.id;
  const label = typeof id === 'string' && id ? id : fallbackLabel;
  throw new Error(`${label}: ${formatIssues(result.error).replaceAll('\n', `\n${label}: `)}`);
}

export function exportProject(raw: unknown, excludeWorkstreams: string[]): ProjectExport {
  const p = parseBank(BankProject, raw, 'project');
  const known = new Set(p.workstreams.map((w) => w.id));
  for (const id of excludeWorkstreams)
    if (!known.has(id))
      throw new Error(`${p.id}: exclude_workstreams names "${id}", which is not a workstream in the bank file`);
  return {
    id: p.id,
    title: p.header.title,
    date: p.header.date,
    repo: p.header.repository.github_url,
    workstreams: p.workstreams
      .filter((w) => !excludeWorkstreams.includes(w.id))
      .map((w) => ({
        id: w.id,
        title: w.title,
        period: w.period,
        tracks: [...w.tracks],
        tech_stack: [...w.tech_stack],
        summary: w.summary,
        bullets: [...w.bullets],
      })),
  };
}

export function exportWork(raw: unknown): WorkExport {
  const w = parseBank(BankWork, raw, 'work');
  return {
    id: w.id,
    organization: w.header.organization,
    title: w.header.title,
    date: w.header.date,
  };
}

export function exportProfile(raw: unknown): ProfileExport {
  const p = parseBank(BankProfile, raw, 'profile');
  return {
    name: p.name,
    email: p.email,
    linkedin: p.linkedin,
    github: p.github,
    location: p.location,
    education: p.education.map((e) => ({
      school: e.school,
      location: e.location,
      degree: e.degree,
      date: e.date,
    })),
  };
}

/** Pretty JSON with a trailing newline; key order is the order the export functions build. */
export function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}
