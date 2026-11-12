import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { stringify } from 'yaml';
import { loadAllowlist, validateSelection } from '../../src/lib/allowlist.ts';
import { exportsFor, makeExport, makeWorkstream, valid, workFor } from './helpers.ts';

const projects = exportsFor(valid());
const work = workFor(valid());

test('the helpers build a valid selection', () => {
  expect(validateSelection(valid(), projects, work)).toEqual([]);
});

describe('projects', () => {
  test('ids are unique', () => {
    const a = valid();
    a.projects.push({ ...a.projects[4] });
    expect(validateSelection(a, projects, work)).toEqual(['adpulse: id is listed more than once']);
  });

  test('ids match the id pattern', () => {
    const a = valid();
    a.projects[4].id = 'Ad_Pulse';
    expect(validateSelection(a, projects, work)).toContain('Ad_Pulse: id does not match ^[a-z0-9][a-z0-9-]*$');
  });

  test('every allowlisted project has an export', () => {
    const p = new Map(projects);
    p.delete('kvsnap');
    expect(validateSelection(valid(), p, work)).toEqual(['kvsnap: no export']);
  });
});

describe('featured projects', () => {
  test('exactly four projects are featured', () => {
    const a = valid();
    a.projects[3].featured = false;
    delete a.projects[3].plate;
    expect(validateSelection(a, projects, work)).toEqual(['allowlist: 3 projects are featured; exactly 4 must be']);
  });

  test('each plate is used once', () => {
    const a = valid();
    a.projects[1].plate = 1;
    expect(validateSelection(a, projects, work)).toEqual(['kvsnap: plate 1 is also used by crucible']);
  });

  test('a featured project has a plate', () => {
    const a = valid();
    delete a.projects[0].plate;
    expect(validateSelection(a, projects, work)).toEqual(['crucible: a featured project needs a plate']);
  });

  test('a project that is not featured has no plate', () => {
    const a = valid();
    a.projects[4].plate = 2;
    expect(validateSelection(a, projects, work)).toEqual(['adpulse: only featured projects take a plate']);
  });

  test('a featured project has a plate_caption', () => {
    const a = valid();
    delete a.projects[0].plate_caption;
    expect(validateSelection(a, projects, work)).toEqual(['crucible: a featured project needs a plate_caption']);
  });
});

describe('key results', () => {
  const result = (from: string) => ({ text: 'Synthetic result', from });

  test('a featured project has 2 to 4 key results', () => {
    const a = valid();
    a.projects[0].key_results = [result('separate-gpu-grpo')];
    expect(validateSelection(a, projects, work)).toEqual(['crucible: a featured project needs 2–4 key results, not 1']);
    a.projects[0].key_results = Array.from({ length: 5 }, () => result('separate-gpu-grpo'));
    expect(validateSelection(a, projects, work)).toEqual(['crucible: a featured project needs 2–4 key results, not 5']);
  });

  test('any other project has at most 4 key results', () => {
    const a = valid();
    a.projects[4].key_results = Array.from({ length: 4 }, () => result('streaming-measurement'));
    expect(validateSelection(a, projects, work)).toEqual([]);
    a.projects[4].key_results.push(result('streaming-measurement'));
    expect(validateSelection(a, projects, work)).toEqual(['adpulse: a project takes at most 4 key results, not 5']);
  });

  test('a key result must cite an exported workstream', () => {
    const a = valid();
    a.projects[0].key_results[0].from = 'renamed-ws';
    expect(validateSelection(a, projects, work))
      .toContain('crucible: key_results[0].from "renamed-ws" is not an exported workstream');
  });

  test('home.stats.from must name an exported workstream', () => {
    const a = valid();
    a.home.stats.from = 'renamed-ws';
    expect(validateSelection(a, projects, work))
      .toEqual(['crucible: home.stats.from "renamed-ws" is not an exported workstream']);
  });
});

test('stack items match tech_stack entries by whole word', () => {
  const a = valid();
  const p = new Map(projects);
  p.set('crucible', makeExport('crucible', {
    workstreams: [makeWorkstream('separate-gpu-grpo', { tech_stack: ['PyTorch FSDP2'] })],
  }));
  a.projects[0].stack = ['FSDP2', 'pytorch fsdp2'];
  expect(validateSelection(a, p, work)).toEqual([]);
  a.projects[0].stack = ['Kubernetes', 'Torch', 'FSDP'];
  expect(validateSelection(a, p, work)).toEqual([
    'crucible: stack "Kubernetes" is not in tech_stack',
    'crucible: stack "Torch" is not in tech_stack',
    'crucible: stack "FSDP" is not in tech_stack',
  ]);
});

test('the focus group shares a top-level track with an exported workstream', () => {
  const a = valid();
  a.projects[0].focus = 'infra';
  a.projects[4].focus = 'ml-infra';
  expect(validateSelection(a, projects, work)).toEqual([
    'crucible: focus "infra" shares no top-level track with an exported workstream',
    'adpulse: focus "ml-infra" shares no top-level track with an exported workstream',
  ]);
});

describe('work and home stats', () => {
  test('every work entry has an export', () => {
    const a = valid();
    a.work.push({ id: 'nowhere', line: 'Synthetic line.' });
    expect(validateSelection(a, projects, work)).toEqual(['nowhere: no work export']);
  });

  test('home.stats.project is allowlisted', () => {
    const a = valid();
    a.home.stats.project = 'remex';
    expect(validateSelection(a, projects, work)).toEqual(['remex: home.stats.project is not allowlisted']);
  });

  test('home.stats has exactly 3 items', () => {
    const a = valid();
    a.home.stats.items.pop();
    expect(validateSelection(a, projects, work)).toEqual(['crucible: home.stats.items has 2 entries; exactly 3 are needed']);
  });
});

describe('loadAllowlist', () => {
  let dir = '';
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'allowlist-test-'));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test('reads a valid file and fills in the optional lists', () => {
    const file = join(dir, 'valid.yaml');
    const a = valid();
    const trimmed = a.projects.map(({ exclude_workstreams: _omitted, ...p }) => p);
    delete (trimmed[4] as { key_results?: unknown }).key_results;
    writeFileSync(file, stringify({ ...a, projects: trimmed }));
    expect(loadAllowlist(file)).toEqual(valid());
  });

  test('loadAllowlist names the YAML path of a bad field', () => {
    const badFile = join(dir, 'bad.yaml');
    writeFileSync(badFile, stringify(valid()).replace('focus: ml-infra', 'focus: gpu'));
    expect(() => loadAllowlist(badFile)).toThrow(/projects\.0\.focus/);
  });
});
