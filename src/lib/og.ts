// Social cards (spec §6): 1200×630 PNGs made at build time. satori lays the card out and
// turns its text into paths; resvg rasterizes the result. Cards use the day palette from
// tokens.css and two of the site's faces, read from Fontsource's .woff files.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import satori, { type Font } from 'satori';
import { HATCH_PATTERNS, SPRIG } from './art.ts';
import { SITE } from './site.ts';
import { day } from './tokens.ts';

/** A type rather than an interface, so a route can pass it as its props. */
export type CardInput = {
  title: string;
  kicker: string;
  /** A plate's source, as in src/plates/; the sprig is drawn without one. */
  plateSvg?: string;
};

export interface CardPlate {
  /** The plate as a standalone SVG: hatch patterns defined, styled by attributes, in day colors, without text. */
  svg: string;
  /** The viewBox size. */
  width: number;
  height: number;
  /**
   * The plate's text, anchored at its middle on the baseline, in viewBox units from the
   * top left. resvg cannot read the site's fonts, so satori draws the text over the image.
   */
  labels: { x: number; y: number; text: string }[];
}

const WIDTH = 1200;
const HEIGHT = 630;
const PAD_X = 72;
const PAD_Y = 64;
/** The plate frame keeps Plate.astro's 16 : 10.5, with the drawing 86% of its width. */
const FRAME_WIDTH = 440;
const FRAME_HEIGHT = Math.round((FRAME_WIDTH * 10.5) / 16);
const PLATE_WIDTH = Math.round(FRAME_WIDTH * 0.86);
const GAP = 56;
/** Plate.astro sets the plate's text at 15px in viewBox units. */
const LABEL_SIZE = 15;
/** Where Cormorant Garamond's baseline falls in a line box one em tall, in em. */
const BASELINE = 0.8;

const DISPLAY = 'Cormorant Garamond';
const MONO = 'JetBrains Mono';

const require = createRequire(import.meta.url);
let fonts: Font[] | undefined;
/** Read on first use and kept, so a build reads each face once. */
function loadFonts(): Font[] {
  const file = (path: string) => readFileSync(require.resolve(path));
  fonts ??= [
    {
      name: DISPLAY,
      data: file('@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff'),
      weight: 500,
      style: 'normal',
    },
    {
      name: MONO,
      data: file('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff'),
      weight: 400,
      style: 'normal',
    },
  ];
  return fonts;
}

/**
 * A standalone SVG of line art, styled as Plate.astro and Sprig.astro style theirs from
 * outside (no fill, accent strokes 1.1 wide), with each `var(--token)` replaced by the
 * token's day value.
 */
function lineArt(viewBox: string, body: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="var(--accent)" ` +
    `stroke-width="1.1">${body}</svg>`;
  return svg.replace(/var\(--([a-z-]+)\)/g, (_, name: string) => day(name));
}

const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const PLATE = /^\s*<svg\b[^>]*\bviewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>\s*$/;
const TEXT = /<text\b([^>]*)>([^<]*)<\/text>/g;

/**
 * A plate ready to embed as an image. On the site a plate takes its fill, stroke and
 * hatching from the page (Plate.astro's styles and Base's patterns); an image has no
 * page around it, so they are written into the SVG, and its text is handed back to be
 * drawn by satori.
 */
export function cardPlate(source: string): CardPlate {
  const match = source.match(PLATE);
  if (!match) throw new Error('cardPlate: a plate must be a single <svg> element with a viewBox');
  const [, viewBox, body] = match;
  const [minX, minY, width, height] = viewBox.trim().split(/[\s,]+/).map(Number);
  const labels = [...body.matchAll(TEXT)].map(([element, attrs, text]) => {
    const [x, y] = ['x', 'y'].map((name) => Number(attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]));
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`cardPlate: ${element} needs numeric x and y`);
    return { x: x - minX, y: y - minY, text };
  });
  const svg = lineArt(viewBox, `<defs>${HATCH_PATTERNS}</defs>${body.replace(TEXT, '')}`);
  return { svg, width, height, labels };
}

/** An element as satori reads it, without JSX. */
interface Node {
  type: string;
  props: { style?: Record<string, string | number>; children?: Child | Child[]; [attr: string]: unknown };
}
type Child = Node | string;

function el(type: string, style: Node['props']['style'], children?: Child | Child[], attrs = {}): Node {
  return { type, props: { ...attrs, style, children } };
}

/**
 * About how many lines `title` takes at `size` in `width`: wrapped greedily at spaces and
 * after hyphens, as satori breaks, a piece longer than a line split across lines, and
 * each character guessed at 0.42em, a little over Cormorant Garamond's average.
 */
function lineCount(title: string, size: number, width: number): number {
  const perLine = Math.max(1, Math.floor(width / (0.42 * size)));
  let lines = 0;
  let used = perLine;
  for (const word of title.split(/\s+/).filter(Boolean))
    word.split(/(?<=-)/).forEach(({ length }, i) => {
      const space = i === 0 ? 1 : 0;
      if (used + space + length <= perLine) used += space + length;
      else {
        lines += Math.ceil(length / perLine);
        used = length % perLine || perLine;
      }
    });
  return lines;
}

/** The largest title size that keeps `title` to three lines in `width`. */
function titleSize(title: string, width: number): number {
  return [104, 92, 80, 68, 58].find((size) => lineCount(title, size, width) <= 3) ?? 50;
}

/** The plate in its frame, as Plate.astro draws it, with its labels set over the image. */
function plateFrame(source: string): Node {
  const plate = cardPlate(source);
  const scale = PLATE_WIDTH / plate.width;
  const height = Math.round(plate.height * scale);
  const size = LABEL_SIZE * scale;
  const labels = plate.labels.map(({ x, y, text }) =>
    el(
      'div',
      {
        display: 'flex',
        justifyContent: 'center',
        position: 'absolute',
        left: x * scale - 60,
        top: y * scale - BASELINE * size,
        width: 120,
        fontSize: size,
        lineHeight: 1,
        color: day('accent'),
      },
      text,
    ),
  );
  return el(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      flexShrink: 0,
      border: `1px solid ${day('line')}`,
      borderRadius: 6,
      backgroundColor: day('bg'),
    },
    el('div', { display: 'flex', position: 'relative', width: PLATE_WIDTH, height, marginTop: 12 }, [
      el('img', { width: PLATE_WIDTH, height }, undefined, { src: dataUri(plate.svg), width: PLATE_WIDTH, height }),
      ...labels,
    ]),
  );
}

function sprig(): Node {
  const src = dataUri(lineArt(SPRIG.viewBox, SPRIG.body));
  return el('img', { marginTop: 36 }, undefined, { src, width: 240, height: 60 });
}

/**
 * A 1200×630 social card: the kicker, the title, and the plate beside them or the sprig
 * under them. Cards are signed with the site's name, except the one whose title is it.
 */
export async function renderCard({ title, kicker, plateSvg }: CardInput): Promise<Uint8Array<ArrayBuffer>> {
  const titleWidth = plateSvg === undefined ? 960 : WIDTH - 2 * PAD_X - FRAME_WIDTH - GAP;
  const size = titleSize(title, titleWidth);
  const heading = el(
    'div',
    { display: 'flex', flexDirection: 'column', flexGrow: 1 },
    [
      el(
        'div',
        { maxWidth: titleWidth, fontSize: size, lineHeight: 1.04, letterSpacing: '-0.015em', textWrap: 'balance' },
        title,
      ),
      ...(plateSvg === undefined ? [sprig()] : []),
    ],
  );
  const card = el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      width: WIDTH,
      height: HEIGHT,
      padding: `${PAD_Y}px ${PAD_X}px`,
      backgroundColor: day('bg'),
      color: day('ink'),
      fontFamily: DISPLAY,
    },
    [
      el('div', { display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: 24, color: day('muted') }, [
        el('div', { width: 12, height: 12, marginRight: 16, borderRadius: 6, backgroundColor: day('accent') }),
        kicker,
      ]),
      el('div', { display: 'flex', flexGrow: 1, alignItems: 'center', gap: GAP }, [
        heading,
        ...(plateSvg === undefined ? [] : [plateFrame(plateSvg)]),
      ]),
      ...(title === SITE.title
        ? []
        : [
            el(
              'div',
              {
                display: 'flex',
                paddingTop: 20,
                borderTop: `1px solid ${day('line')}`,
                fontFamily: MONO,
                fontSize: 22,
                color: day('muted'),
              },
              SITE.title,
            ),
          ]),
    ],
  );
  const svg = await satori(card, { width: WIDTH, height: HEIGHT, fonts: loadFonts() });
  const png = new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
  return new Uint8Array(png);
}
