import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { exportProfile, exportProject, exportWork, serialize } from '../../src/lib/bank-export.ts';

const fixture = (path: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/bank/data/${path}`, import.meta.url), 'utf8'));
const alpha = fixture('projects/alpha.json');
const beta = fixture('projects/beta.json');
const acme = fixture('work/ml_infra/acme.json');
const profile = fixture('profile.json');

test('exportProject keeps only the public fields', () => {
  const out = exportProject(alpha, []);
  expect(Object.keys(out)).toEqual(['id', 'title', 'date', 'repo', 'workstreams']);
  for (const w of out.workstreams)
    expect(Object.keys(w)).toEqual(['id', 'title', 'period', 'tracks', 'tech_stack', 'summary', 'bullets']);
  expect(serialize(out)).not.toMatch(/SECRET-CLARIFICATION|user_clarifications|user_reported/);
});

test('exportProject drops excluded workstreams', () => {
  expect(exportProject(alpha, [alpha.workstreams[1].id]).workstreams).toHaveLength(1);
});

test('exportProject rejects an unknown excluded workstream', () => {
  expect(() => exportProject(alpha, ['nope'])).toThrow(/alpha.*nope/);
});

test('exportProject rejects a repo outside simon-jd', () => {
  expect(() => exportProject(beta, [])).toThrow(/simon-jd/);
});

test('exportProfile drops phone, sponsorship, skills, gpa and coursework', () => {
  const p = exportProfile(profile);
  expect(Object.keys(p)).toEqual(['name', 'email', 'linkedin', 'github', 'location', 'education']);
  expect(Object.keys(p.education[0])).toEqual(['school', 'location', 'degree', 'date']);
  expect(serialize(p)).not.toMatch(/phone|sponsorship|skills_bank|gpa|coursework/);
});

test('exportWork keeps organization, title and date, and drops the summary and bullets', () => {
  const w = exportWork(acme);
  expect(Object.keys(w)).toEqual(['id', 'organization', 'title', 'date']);
  expect(serialize(w)).not.toMatch(/lease lock|synthetic bullet|SECRET-CLARIFICATION/);
});
