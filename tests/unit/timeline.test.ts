import { expect, test } from 'vitest';
import { mulberry32, timeline } from '../../src/lib/timeline.ts';

const VARIANTS = ['wide', 'narrow'] as const;
/** The divider between the per-tensor and the bucketed half, and the viewBox width. */
const MID = { wide: 619, narrow: 168 };
const WIDTH = { wide: 1088, narrow: 335 };

type Rect = { cls: string; x: number; width: number };

/** The rects of a generated body, optionally only those of one class. */
function rects(body: string, cls?: string): Rect[] {
  return [...body.matchAll(/<rect\b([^>]*)>/g)]
    .map(([, attrs]) => {
      const attr = (name: string) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
      return { cls: attr('class') ?? '', x: Number(attr('x')), width: Number(attr('width')) };
    })
    .filter((r) => cls === undefined || r.cls === cls);
}

test('mulberry32 matches the mockup generator', () => {
  // First values of the mockup's rng() (ac-combined.html line 398) for seeds 7 and 9.
  const seven = mulberry32(7);
  expect([seven(), seven(), seven()]).toEqual([0.011704753153026104, 0.06195825757458806, 0.97690763277933]);
  const nine = mulberry32(9);
  expect([nine(), nine(), nine()]).toEqual([0.19872891809791327, 0.8512107962742448, 0.1417661067098379]);
});

test('timeline output is deterministic', () => {
  expect(timeline('wide')).toEqual(timeline('wide'));
  expect(timeline('narrow')).toEqual(timeline('narrow'));
});

test('the per-tensor half has only ticks and the bucketed half only blocks', () => {
  for (const v of VARIANTS) {
    const { body } = timeline(v);
    const ticks = rects(body, 'b-tick');
    const blocks = rects(body, 'b-blk');
    expect(ticks.length).toBeGreaterThan(0);
    expect(blocks.length).toBeGreaterThan(0);
    for (const t of ticks) expect(t.x).toBeLessThan(MID[v]);
    for (const b of blocks) expect(b.x).toBeGreaterThan(MID[v]);
  }
});

test('the bucketed half fits more training steps', () => {
  for (const v of VARIANTS) {
    const learn = rects(timeline(v).body, 'b-learn');
    const perTensor = learn.filter((r) => r.x < MID[v]).length;
    const bucketed = learn.filter((r) => r.x > MID[v]).length;
    expect(perTensor).toBeGreaterThan(0);
    expect(bucketed).toBeGreaterThan(perTensor);
  }
});

test('no mark leaves the viewBox', () => {
  expect(timeline('wide').viewBox).toBe('0 0 1088 200');
  expect(timeline('narrow').viewBox).toBe('0 0 335 132');
  for (const v of VARIANTS) {
    const all = rects(timeline(v).body);
    expect(all.length).toBeGreaterThan(0);
    for (const r of all) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(WIDTH[v]);
    }
  }
});

test('labels are 13.5 units wide and 15 narrow', () => {
  const size = { wide: '13.5', narrow: '15' };
  for (const v of VARIANTS) {
    const texts = [...timeline(v).body.matchAll(/<text\b[^>]*>/g)].map(([tag]) => tag);
    expect(texts.length).toBeGreaterThan(0);
    for (const tag of texts) expect(tag).toContain(`font-size="${size[v]}"`);
  }
});
