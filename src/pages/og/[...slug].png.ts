// The social cards (spec §6), drawn at build time: /og/default.png for every page without
// its own, /og/work/<id>.png for each published case study, with the project's plate, and
// /og/writing/<slug>.png for each published post, with its project's plate if it has one,
// otherwise the sprig. Drafts get no card, and /about/ uses the default one, so no card
// carries a draft's text.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { renderCard, type CardInput } from '../../lib/og.ts';
import { publishedPosts } from '../../lib/posts.ts';
import { FOCUS_LABEL, getProjects, type ProjectView } from '../../lib/projects.ts';
import { monthLabel, SITE } from '../../lib/site.ts';
import { isPublished } from '../../lib/writing.ts';

const plates = import.meta.glob<string>('../../plates/*.svg', { query: '?raw', import: 'default', eager: true });

/** The project's plate source, if the allowlist gives it one. */
function plateOf(project: ProjectView | undefined): string | undefined {
  if (project?.plate === undefined) return undefined;
  const source = plates[`../../plates/${project.id}.svg`];
  if (source === undefined) throw new Error(`og: no plate is drawn for "${project.id}" (src/plates/${project.id}.svg)`);
  return source;
}

export const getStaticPaths = (async () => {
  const PROD = import.meta.env.PROD;
  const [projects, caseStudies, posts] = await Promise.all([
    getProjects(),
    getCollection('caseStudies', (entry) => isPublished(entry.data, PROD)),
    publishedPosts(),
  ]);
  const byId = new Map(projects.map((p) => [p.id, p]));
  const card = (slug: string, props: CardInput) => ({ params: { slug }, props });
  return [
    // The home page's kicker over the name.
    card('default', { kicker: 'ml infrastructure / gpu systems', title: SITE.title }),
    ...caseStudies.map((entry) => {
      const project = byId.get(entry.id);
      if (!project)
        throw new Error(`src/content/case-studies/${entry.id}.mdx: "${entry.id}" is not in content/allowlist.yaml`);
      return card(`work/${entry.id}`, {
        kicker: `case study · ${FOCUS_LABEL[project.focus]}`,
        title: project.name,
        plateSvg: plateOf(project),
      });
    }),
    ...posts.map((post) =>
      card(`writing/${post.id}`, {
        kicker: `${post.data.type} · ${monthLabel(post.data.date)}`,
        title: post.data.title,
        plateSvg: plateOf(post.data.project === undefined ? undefined : byId.get(post.data.project)),
      }),
    ),
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute<CardInput> = async ({ props }) =>
  new Response(await renderCard(props), { headers: { 'Content-Type': 'image/png' } });
