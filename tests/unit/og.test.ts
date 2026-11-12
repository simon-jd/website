import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { expect, test } from 'vitest';
import { cardPlate, renderCard } from '../../src/lib/og.ts';

const PLATES = ['crucible', 'kvsnap', 'exactsample', 'blockfp8'];
const plate = (id: string) => readFileSync(`src/plates/${id}.svg`, 'utf8');

/** The card's pixels as RGB, with a counter for those in a region that pass a test. */
async function pixels(png: Uint8Array) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return (pass: (r: number, g: number, b: number) => boolean, x0 = 0, x1 = info.width) => {
    let n = 0;
    for (let y = 0; y < info.height; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * info.width + x) * 3;
        if (pass(data[i], data[i + 1], data[i + 2])) n++;
      }
    return n;
  };
}

/** Within 24 of the day accent, #56614a, in every channel. */
const accent = (r: number, g: number, b: number) =>
  Math.abs(r - 0x56) <= 24 && Math.abs(g - 0x61) <= 24 && Math.abs(b - 0x4a) <= 24;
/** Darker than any token: an unstyled SVG shape fills black. */
const black = (r: number, g: number, b: number) => Math.max(r, g, b) < 40;

test('renderCard returns a 1200×630 PNG', async () => {
  const png = await renderCard({ title: '1,478 collectives, then 25', kicker: 'case study' });
  expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const v = new DataView(png.buffer, png.byteOffset);
  expect([v.getUint32(16), v.getUint32(20)]).toEqual([1200, 630]);
});

test.each(PLATES)('the %s plate stands alone for a card', (id) => {
  const source = plate(id);
  const { svg, labels } = cardPlate(source);
  expect(svg).not.toContain('var(');
  expect(svg).not.toMatch(/<text\b/);
  const refs = [...svg.matchAll(/url\(#([\w-]+)\)/g)].map((m) => m[1]);
  expect(refs.length).toBeGreaterThan(0);
  for (const ref of refs) expect(svg, ref).toContain(`id="${ref}"`);
  // Plate.astro styles the plates from outside: no fill, accent strokes 1.1 wide.
  expect(svg).toMatch(/^<svg\b[^>]*\bfill="none"/);
  expect(svg).toMatch(/^<svg\b[^>]*\bstroke="#56614a"/);
  expect(svg).toMatch(/^<svg\b[^>]*\bstroke-width="1\.1"/);
  expect(labels.map((l) => l.text)).toEqual([...source.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]));
});

test('a card draws its plate in accent line work, not black shapes', async () => {
  const png = await renderCard({ title: 'Crucible', kicker: 'case study', plateSvg: plate('crucible') });
  const count = await pixels(png);
  expect(count(black)).toBe(0);
  // The plate sits in the right-hand column.
  expect(count(accent, 700)).toBeGreaterThan(1500);
});

test('a card without a plate draws the sprig', async () => {
  const png = await renderCard({ title: 'Measure the stream, not the story', kicker: 'essay' });
  const count = await pixels(png);
  expect(count(black)).toBe(0);
  // The kicker's dot is accent too, so the sprig must add well beyond it.
  expect(count(accent)).toBeGreaterThan(400);
});
