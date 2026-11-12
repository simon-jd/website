import { expect, test, vi } from 'vitest';
import { assembleProjects, displayName, projectHref } from '../../src/lib/projects.ts';
import { exportsFor, valid, workFor } from './helpers.ts';

// Astro's virtual module does not exist outside Astro; getProjects is covered by the dist tests.
vi.mock('astro:content', () => ({ getCollection: vi.fn() }));

test('assembleProjects keeps allowlist order and links case studies', () => {
  const a = valid();
  a.projects.reverse();
  const views = assembleProjects(a, exportsFor(a), workFor(a), new Set(['crucible']));
  expect(views.map((v) => v.id)).toEqual(['adpulse', 'blockfp8', 'exactsample', 'kvsnap', 'crucible']);

  const byId = new Map(views.map((v) => [v.id, v]));
  expect(byId.get('crucible')).toEqual({
    id: 'crucible',
    name: 'crucible',
    oneLiner: 'A synthetic one-liner for crucible.',
    repo: 'https://github.com/simon-jd/crucible',
    period: '2026',
    href: '/work/crucible/',
    focus: 'ml-infra',
    featured: true,
    plate: 1,
    plateCaption: 'i synthetic · ii plate 1',
    stack: ['FSDP2', 'vLLM', 'NCCL'],
    keyResults: [
      { text: 'Synthetic result 1.5 → 0.5 s', from: 'separate-gpu-grpo' },
      { text: 'Synthetic result 3 of 4 runs', from: 'separate-gpu-grpo' },
    ],
    caseStudy: true,
  });
  expect(byId.get('kvsnap')).toMatchObject({ href: 'https://github.com/simon-jd/kvsnap', caseStudy: false });
  expect(byId.get('adpulse')).toMatchObject({ featured: false, focus: 'infra', keyResults: [] });
  expect(byId.get('adpulse')).not.toHaveProperty('plate');
});

test('assembleProjects fails on a missing export', () => {
  const a = valid();
  const exports = exportsFor(a);
  exports.delete('kvsnap');
  expect(() => assembleProjects(a, exports, workFor(a), new Set())).toThrow(/kvsnap: no export/);
});

test('assembleProjects fails on bank drift', () => {
  const a = valid();
  a.projects[0].key_results[0].from = 'gone';
  expect(() => assembleProjects(a, exportsFor(a), workFor(a), new Set())).toThrow(
    /crucible: key_results\[0\]\.from "gone"/,
  );
});

test('assembleProjects lists every problem at once', () => {
  const a = valid();
  a.projects[0].key_results[0].from = 'gone';
  a.projects[1].stack.push('Kubernetes');
  const exports = exportsFor(a);
  exports.delete('exactsample');
  let message = '';
  try {
    assembleProjects(a, exports, workFor(a), new Set());
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toMatch(/crucible: key_results\[0\]\.from "gone"/);
  expect(message).toMatch(/kvsnap: stack "Kubernetes" is not in tech_stack/);
  expect(message).toMatch(/exactsample: no export/);
});

test('displayName takes the text before the em dash', () => {
  expect(displayName('Crucible — GPU and ML Infrastructure: …')).toBe('Crucible');
  expect(displayName('No dash here')).toBe('No dash here');
  expect(displayName('Crucible — x', 'Crucible lab')).toBe('Crucible lab');
});

test('projectHref prefers the case study over the repo', () => {
  expect(projectHref('remex', 'https://github.com/simon-jd/remex', false)).toBe('https://github.com/simon-jd/remex');
  expect(projectHref('remex', 'https://github.com/simon-jd/remex', true)).toBe('/work/remex/');
});
