// subset-font ships no types; this covers the one call scripts/subset-fonts.ts makes.
declare module 'subset-font' {
  interface Options {
    targetFormat?: 'sfnt' | 'woff' | 'woff2';
    preserveNameIds?: number[];
  }
  export default function subsetFont(font: Uint8Array, text: string, options?: Options): Promise<Buffer>;
}
