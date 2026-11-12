// The home page's GPU timeline, generated at build time from a fixed seed so the SVG is
// static and identical on every build. Ported from the approved mockup (ac-combined.html
// lines 398–448): same seeds, lanes, divider and sync widths; the wide variant's steps
// are shorter (see below). The fills are in Timeline.astro's CSS, keyed on the class
// names b-roll, b-learn, b-cpu, b-tick, b-blk, lane and div.

/** Tommy Ettinger's mulberry32: a small, fast PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Lanes = { learner: number; rollout: number; nccl: number; cpu?: number };

type StepOptions = {
  /** Scales the rollout, grading and learner lengths. */
  k?: number;
  /** Bar height. */
  h?: number;
  /** Space after each step's sync. */
  gap?: number;
  /** Width of each step's weight sync. */
  sync: number;
  /** Per-tensor sync as many thin ticks; otherwise three bucket blocks. */
  ticks: boolean;
  tickStep?: number;
  tickW?: number;
};

const f = (n: number) => n.toFixed(1);

function box(cls: string, x: number, y: number, w: number, h: number, rx: number): string {
  const corner = rx ? ` rx="${rx}"` : '';
  return `<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(Math.max(0.8, w))}" height="${f(h)}"${corner}/>`;
}

function text(x: number, y: number, size: number, label: string, anchor?: 'end'): string {
  const end = anchor ? ` text-anchor="${anchor}"` : '';
  return `<text x="${f(x)}" y="${f(y)}" font-size="${size}"${end}>${label}</text>`;
}

function line(cls: string, x1: number, x2: number, y1: number, y2: number): string {
  return `<line class="${cls}" x1="${f(x1)}" x2="${f(x2)}" y1="${f(y1)}" y2="${f(y2)}"/>`;
}

/** Training steps from x0 until the next one would pass x1: rollout, grading, learner update, weight sync. */
function steps(r: () => number, x0: number, x1: number, Y: Lanes, o: StepOptions): string {
  const k = o.k ?? 1;
  const h = o.h ?? 16;
  const gap = o.gap ?? 6;
  const out: string[] = [];
  let x = x0;
  for (;;) {
    const roll = (52 + r() * 22) * k;
    const grade = (10 + r() * 8) * k;
    const learn = (60 + r() * 20) * k;
    if (x + roll + grade + learn + o.sync > x1) break;
    out.push(box('b-roll', x + 0.5, Y.rollout - h / 2 + 0.5, roll - 1, h - 1, 2));
    if (Y.cpu) out.push(box('b-cpu', x + roll, Y.cpu - h / 2 + 3, grade, h - 6, 1.5));
    out.push(box('b-learn', x + roll + grade + 0.5, Y.learner - h / 2 + 0.5, learn - 1, h - 1, 2));
    const s0 = x + roll + grade + learn;
    if (o.ticks) {
      const step = o.tickStep ?? 2.6;
      const tw = o.tickW ?? 1;
      for (let t = s0; t < s0 + o.sync - tw; t += step) out.push(box('b-tick', t, Y.nccl - h / 2, tw, h, 0));
    } else {
      const n = 3;
      const gp = 2 * k + 0.6;
      const w = (o.sync - gp * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        out.push(box('b-blk', s0 + i * (w + gp) + 0.5, Y.nccl - h / 2 + 0.5, w - 1, h - 1, 1.5));
      }
    }
    x = s0 + o.sync + gap;
  }
  return out.join('');
}

/** The SVG viewBox and inner markup of one variant: `wide` for desktop, `narrow` for phones. */
export function timeline(variant: 'wide' | 'narrow'): { viewBox: string; body: string } {
  if (variant === 'wide') {
    const r = mulberry32(7);
    const W = 1088;
    // 13.5 units render at 12px or more from a 1000px container, where this variant starts.
    const size = 13.5;
    const Y = { learner: 62, rollout: 102, nccl: 142, cpu: 180 };
    const mid = 619;
    const lanes: [string, number][] = [
      ['learner · gpu0', Y.learner],
      ['rollout · gpu1', Y.rollout],
      ['nccl · weight sync', Y.nccl],
      ['grader · cpu', Y.cpu],
    ];
    const body = [
      ...lanes.map(([label, y]) => line('lane', 150, W, y, y) + text(0, y + 4, size, label)),
      line('div', mid, mid, 12, 194),
      text(150, 26, size, 'per-tensor sync'),
      text(mid + 12, 26, size, 'bucketed sync'),
      text(W, 26, size, 'illustration · not to scale', 'end'),
      '<g>',
      // The mockup drew full-length steps (k 1), which leaves two steps in each half for
      // almost every seed. At 0.8 the bucketed half fits three against two, as the spec
      // describes, for every seed tried; that is not guaranteed for all seeds, so the
      // timeline test checks that the bucketed half fits more steps in both variants.
      steps(r, 150, mid - 12, Y, { k: 0.8, sync: 66, ticks: true }),
      steps(r, mid + 12, W, Y, { k: 0.8, sync: 14, ticks: false }),
      '</g>',
    ].join('');
    return { viewBox: `0 0 ${W} 200`, body };
  }
  const r = mulberry32(9);
  const W = 335;
  // 15 units render at 12px or more down to a 280px container (a 320px screen).
  const size = 15;
  const Y = { learner: 46, rollout: 76, nccl: 106 };
  const mid = 168;
  const body = [
    ...[Y.learner, Y.rollout, Y.nccl].map((y) => line('lane', 0, W, y, y)),
    line('div', mid, mid, 8, 124),
    text(0, 20, size, 'per-tensor'),
    text(mid + 8, 20, size, 'bucketed'),
    '<g>',
    steps(r, 0, mid - 8, Y, { k: 0.42, sync: 28, ticks: true, tickStep: 2, tickW: 0.9, h: 12, gap: 4 }),
    steps(r, mid + 8, W, Y, { k: 0.42, sync: 6, ticks: false, h: 12, gap: 4 }),
    '</g>',
  ].join('');
  return { viewBox: `0 0 ${W} 132`, body };
}
