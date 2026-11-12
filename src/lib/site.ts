// Site-wide constants and the synced profile, shared by the layout and the pages.
import profileJson from '../content/profile.json';
import { formatIssues, ProfileExportSchema, type ProfileExport } from './bank-export.ts';

export const SITE = {
  url: import.meta.env.SITE,
  title: 'Junrui Duan',
  description: 'Junrui Duan builds the systems under machine learning: kernels, serving, training loops.',
};

const parsed = ProfileExportSchema.safeParse(profileJson);
if (!parsed.success) throw new Error(`src/content/profile.json: ${formatIssues(parsed.error)}`);
export const profile: ProfileExport = parsed.data;

export const NAV = [
  { href: '/work/', label: 'work' },
  { href: '/writing/', label: 'writing' },
  { href: '/about/', label: 'about' },
];

/** `2026-11-08`, in UTC, the zone Astro parses frontmatter dates in. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** `2026-11`, the month shown beside a post. */
export function monthLabel(d: Date): string {
  return isoDate(d).slice(0, 7);
}
