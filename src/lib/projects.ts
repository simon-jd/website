// The projects as the pages show them: the allowlist's choices joined with the bank
// exports. assembleProjects is pure, so the unit tests can feed it synthetic inputs;
// getProjects feeds it the real collections.
import { getCollection } from 'astro:content';
import { loadAllowlist, validateSelection, type Allowlist, type Focus, type KeyResult } from './allowlist.ts';
import type { ProjectExport, WorkExport } from './bank-export.ts';
import { isPublished } from './writing.ts';

export interface ProjectView {
  id: string;
  name: string;
  oneLiner: string;
  repo: string;
  /** The export's `date`. */
  period: string;
  /** The case study when there is one, otherwise the repo. */
  href: string;
  focus: Focus;
  featured: boolean;
  plate?: 1 | 2 | 3 | 4;
  plateCaption?: string;
  stack: string[];
  keyResults: KeyResult[];
  caseStudy: boolean;
}

/** Each focus group's heading, as spec §5 names it. */
export const FOCUS_LABEL: Record<Focus, string> = {
  'ml-infra': 'ML infrastructure & GPU systems',
  infra: 'Infrastructure, data & backend',
};

/** The order of the groups on /work/. */
export const FOCUS_ORDER: readonly Focus[] = ['ml-infra', 'infra'];

const NAME_SEPARATOR = ' — ';

/** The allowlist's `name` if given, otherwise the bank title up to its first ` — `. */
export function displayName(title: string, override?: string): string {
  return override ?? title.split(NAME_SEPARATOR)[0];
}

export function projectHref(id: string, repo: string, caseStudy: boolean): string {
  return caseStudy ? `/work/${id}/` : repo;
}

/**
 * One view per allowlisted project, in allowlist order. Throws, listing every problem
 * at once, when the allowlist no longer matches the exports (validateSelection).
 */
export function assembleProjects(
  a: Allowlist,
  exports: Map<string, ProjectExport>,
  work: Map<string, WorkExport>,
  caseStudies: Set<string>,
): ProjectView[] {
  const problems = validateSelection(a, exports, work);
  if (problems.length > 0)
    throw new Error(`The allowlist does not match the bank export:\n${problems.map((p) => `  ${p}`).join('\n')}`);

  return a.projects.map((p) => {
    const exp = exports.get(p.id);
    if (!exp) throw new Error(`${p.id}: no export`);
    const caseStudy = caseStudies.has(p.id);
    return {
      id: p.id,
      name: displayName(exp.title, p.name),
      oneLiner: p.one_liner,
      repo: exp.repo,
      period: exp.date,
      href: projectHref(p.id, exp.repo, caseStudy),
      focus: p.focus,
      featured: p.featured,
      ...(p.plate !== undefined && { plate: p.plate }),
      ...(p.plate_caption !== undefined && { plateCaption: p.plate_caption }),
      stack: [...p.stack],
      keyResults: p.key_results.map((k) => ({ ...k })),
      caseStudy,
    };
  });
}

/** Every allowlisted project, from the collections and content/allowlist.yaml. */
export async function getProjects(): Promise<ProjectView[]> {
  const [projects, work, caseStudies] = await Promise.all([
    getCollection('projects'),
    getCollection('work'),
    getCollection('caseStudies', (entry) => isPublished(entry.data, import.meta.env.PROD)),
  ]);
  return assembleProjects(
    loadAllowlist(),
    new Map(projects.map((entry) => [entry.id, entry.data])),
    new Map(work.map((entry) => [entry.id, entry.data])),
    new Set(caseStudies.map((entry) => entry.id)),
  );
}
