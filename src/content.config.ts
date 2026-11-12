// The content collections. `projects` and `work` are the committed bank exports, held to
// the same strict schemas the sync writes them with; the MDX collections are written by
// hand. An entry's id is its file name without the extension, slugified.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { ProjectExportSchema, SLUG, WorkExportSchema } from './lib/bank-export.ts';
import { FrontmatterDate, POST_TYPES } from './lib/writing.ts';

const projects = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/projects' }),
  schema: ProjectExportSchema,
});

const work = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/work' }),
  schema: WorkExportSchema,
});

const caseStudies = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/case-studies' }),
  schema: z.object({
    dek: z.string().optional(),
    updated: FrontmatterDate.optional(),
    draft: z.boolean().default(false),
  }),
});

const writing = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    date: FrontmatterDate,
    updated: FrontmatterDate.optional(),
    type: z.enum(POST_TYPES),
    tags: z.array(z.string()),
    summary: z.string(),
    /** A bank project id: links the post to its case study and scopes the number check. */
    project: z.string().regex(SLUG).optional(),
    draft: z.boolean().default(false),
  }),
});

const focus = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/focus' }),
  schema: z.object({
    title: z.string(),
    kicker: z.string(),
    summary: z.string(),
    projects: z.array(z.string()),
    tags: z.array(z.string()),
    draft: z.boolean(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    draft: z.boolean(),
  }),
});

export const collections = { projects, work, caseStudies, writing, focus, pages };
