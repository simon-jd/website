// In-memory allowlists and exports for unit tests. Every value is synthetic; only the
// project ids and workstream ids mirror the real bank so the shapes stay familiar.
import type { Allowlist, AllowlistProject } from '../../src/lib/allowlist.ts';
import type { ProjectExport, WorkExport, WorkstreamExport } from '../../src/lib/bank-export.ts';

/** The workstream, tracks and tech stack that `makeExport` gives each id used by `valid()`. */
const DEFAULTS: Record<string, { ws: string; tracks: string[]; tech: string[] }> = {
  crucible: {
    ws: 'separate-gpu-grpo',
    tracks: ['ml_infra/training_systems', 'ml_infra/comm_networking'],
    tech: ['PyTorch', 'PyTorch FSDP2', 'vLLM', 'NCCL'],
  },
  kvsnap: { ws: 'kv-connector-restore', tracks: ['ml_infra/inference_engine'], tech: ['vLLM', 'Triton', 'SQLite'] },
  exactsample: { ws: 'exact-sampling-kernels', tracks: ['ml_infra/gpu_kernels'], tech: ['CUDA', 'C++', 'vLLM'] },
  blockfp8: { ws: 'fp8-gemm-kernel', tracks: ['ml_infra/gpu_kernels'], tech: ['CUDA', 'CUTLASS CuTe', 'vLLM'] },
  adpulse: { ws: 'streaming-measurement', tracks: ['de'], tech: ['Apache Kafka', 'Apache Flink'] },
};

export function makeWorkstream(id: string, overrides: Partial<WorkstreamExport> = {}): WorkstreamExport {
  return {
    id,
    title: `Synthetic workstream ${id}`,
    period: '2026',
    tracks: ['ml_infra/gpu_kernels'],
    tech_stack: ['CUDA'],
    summary: `Synthetic summary of ${id}: 1.5 → 0.5 s on a made-up device.`,
    bullets: [`Synthetic bullet of ${id}: 3 of 4 runs.`],
    ...overrides,
  };
}

/** An export that fits `valid()` for its ids; other ids get one generic ML workstream. */
export function makeExport(id: string, overrides: Partial<ProjectExport> = {}): ProjectExport {
  const d = DEFAULTS[id];
  const workstream = d
    ? makeWorkstream(d.ws, { tracks: [...d.tracks], tech_stack: [...d.tech] })
    : makeWorkstream(`${id}-main`);
  return {
    id,
    title: `${id} — Synthetic Test Project`,
    date: '2026',
    repo: `https://github.com/simon-jd/${id}`,
    workstreams: [workstream],
    ...overrides,
  };
}

function featured(id: string, plate: 1 | 2 | 3 | 4, stack: string[]): AllowlistProject {
  const from = DEFAULTS[id].ws;
  return {
    id,
    focus: 'ml-infra',
    featured: true,
    plate,
    plate_caption: `i synthetic · ii plate ${plate}`,
    one_liner: `A synthetic one-liner for ${id}.`,
    stack,
    key_results: [
      { text: 'Synthetic result 1.5 → 0.5 s', from },
      { text: 'Synthetic result 3 of 4 runs', from },
    ],
    exclude_workstreams: [],
  };
}

/** A fresh allowlist that passes `validateSelection` against `exportsFor` and `workFor`. */
export function valid(): Allowlist {
  return {
    projects: [
      featured('crucible', 1, ['FSDP2', 'vLLM', 'NCCL']),
      featured('kvsnap', 2, ['vLLM', 'Triton', 'SQLite']),
      featured('exactsample', 3, ['CUDA', 'vLLM']),
      featured('blockfp8', 4, ['CuTe', 'CUDA', 'vLLM']),
      {
        id: 'adpulse',
        focus: 'infra',
        featured: false,
        one_liner: 'A synthetic streaming pipeline.',
        stack: ['Kafka', 'Flink'],
        key_results: [],
        exclude_workstreams: [],
      },
    ],
    home: {
      stats: {
        project: 'crucible',
        from: 'separate-gpu-grpo',
        caption: 'Synthetic caption · one run',
        items: [
          { value: '1.5 → 0.5 s', label: 'synthetic step' },
          { value: '3 of 4', label: 'synthetic runs' },
          { value: '2 → 1', label: 'synthetic count' },
        ],
      },
    },
    work: [{ id: 'acme', line: 'Synthetic platform work.' }],
    check: { ignore: [] },
  };
}

export function exportsFor(a: Allowlist): Map<string, ProjectExport> {
  return new Map(a.projects.map((p) => [p.id, makeExport(p.id)]));
}

export function workFor(a: Allowlist): Map<string, WorkExport> {
  return new Map(
    a.work.map((w) => [
      w.id,
      {
        id: w.id,
        organization: 'Acme Synthetic Labs',
        title: 'Software Engineer Intern',
        date: 'May 2026 – Sep 2026',
      },
    ]),
  );
}
