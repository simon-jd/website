// content/allowlist.yaml decides which bank projects the site shows, in what order,
// and with which one-liner, stack and key results. `validateSelection` ties every
// choice back to the exported bank facts.
import { readFileSync } from 'node:fs';
import { z } from 'astro/zod';
import { parse } from 'yaml';
import { formatIssues, SLUG, type ProjectExport, type WorkExport } from './bank-export.ts';

export type Focus = 'ml-infra' | 'infra';

/** Top-level tracks (the part before `/`) that belong to each focus group. */
export const FOCUS_TRACKS: Record<Focus, string[]> = {
  'ml-infra': ['ml_infra', 'mle'],
  infra: ['infra', 'sre', 'de', 'sde', 'fde'],
};

/** Allowlist ids double as bank file names, so they must be slugs. */
const ID_PATTERN = SLUG;

const id = () => z.string().regex(ID_PATTERN, `must match ${ID_PATTERN.source}`);
const text = () => z.string().min(1);

const KeyResultSchema = z.strictObject({ text: text(), from: text() });

const AllowlistProjectSchema = z.strictObject({
  id: id(),
  name: text().optional(),
  focus: z.enum(['ml-infra', 'infra']),
  featured: z.boolean(),
  plate: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  plate_caption: text().optional(),
  one_liner: text(),
  stack: z.array(text()),
  key_results: z.array(KeyResultSchema).default([]),
  exclude_workstreams: z.array(text()).default([]),
});

export const AllowlistSchema = z.strictObject({
  projects: z.array(AllowlistProjectSchema),
  home: z.strictObject({
    stats: z.strictObject({
      project: text(),
      from: text(),
      caption: text(),
      items: z.array(z.strictObject({ value: text(), label: text() })),
    }),
  }),
  work: z.array(z.strictObject({ id: id(), line: text() })),
  check: z.strictObject({ ignore: z.array(z.string()) }),
});

export type KeyResult = z.infer<typeof KeyResultSchema>;
export type AllowlistProject = z.infer<typeof AllowlistProjectSchema>;
export type Allowlist = z.infer<typeof AllowlistSchema>;

export function loadAllowlist(file = 'content/allowlist.yaml'): Allowlist {
  let data: unknown;
  try {
    data = parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${file}: ${(error as Error).message}`);
  }
  const result = AllowlistSchema.safeParse(data);
  if (!result.success) throw new Error(`${file}: ${formatIssues(result.error).replaceAll('\n', `\n${file}: `)}`);
  return result.data;
}

/** True when `item` is the whole entry or a whole word (or run of words) inside it, ignoring case. */
function inEntry(item: string, entry: string): boolean {
  const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(entry);
}

/**
 * Checks the allowlist against the exports. Each problem starts with the id it
 * concerns: a project id, a work id, or `allowlist` for the featured count. An empty
 * array means the selection is valid.
 */
export function validateSelection(
  a: Allowlist,
  projects: Map<string, ProjectExport>,
  work: Map<string, WorkExport>,
): string[] {
  const problems: string[] = [];
  const listed = new Set<string>();
  const plates = new Map<number, string>();
  let featured = 0;

  for (const p of a.projects) {
    const problem = (message: string) => problems.push(`${p.id}: ${message}`);

    if (listed.has(p.id)) problem('id is listed more than once');
    listed.add(p.id);
    if (!ID_PATTERN.test(p.id)) problem(`id does not match ${ID_PATTERN.source}`);

    const results = p.key_results.length;
    if (p.featured) {
      featured++;
      if (p.plate === undefined) problem('a featured project needs a plate');
      else if (plates.has(p.plate)) problem(`plate ${p.plate} is also used by ${plates.get(p.plate)}`);
      else plates.set(p.plate, p.id);
      if (!p.plate_caption) problem('a featured project needs a plate_caption');
      if (results < 2 || results > 4) problem(`a featured project needs 2–4 key results, not ${results}`);
    } else {
      if (p.plate !== undefined) problem('only featured projects take a plate');
      if (results > 4) problem(`a project takes at most 4 key results, not ${results}`);
    }

    const exp = projects.get(p.id);
    if (!exp) {
      problem('no export');
      continue;
    }
    const workstreams = new Set(exp.workstreams.map((w) => w.id));
    p.key_results.forEach((k, i) => {
      if (!workstreams.has(k.from)) problem(`key_results[${i}].from "${k.from}" is not an exported workstream`);
    });
    const tech = exp.workstreams.flatMap((w) => w.tech_stack);
    for (const item of p.stack)
      if (!tech.some((entry) => inEntry(item, entry))) problem(`stack "${item}" is not in tech_stack`);
    const tracks = new Set(exp.workstreams.flatMap((w) => w.tracks.map((t) => t.split('/')[0])));
    if (!FOCUS_TRACKS[p.focus].some((t) => tracks.has(t)))
      problem(`focus "${p.focus}" shares no top-level track with an exported workstream`);
  }

  if (featured !== 4) problems.push(`allowlist: ${featured} projects are featured; exactly 4 must be`);

  const stats = a.home.stats;
  if (!listed.has(stats.project)) {
    problems.push(`${stats.project}: home.stats.project is not allowlisted`);
  } else {
    const exp = projects.get(stats.project);
    if (exp && !exp.workstreams.some((w) => w.id === stats.from))
      problems.push(`${stats.project}: home.stats.from "${stats.from}" is not an exported workstream`);
  }
  if (stats.items.length !== 3)
    problems.push(`${stats.project}: home.stats.items has ${stats.items.length} entries; exactly 3 are needed`);

  for (const w of a.work) if (!work.has(w.id)) problems.push(`${w.id}: no work export`);

  return problems;
}
