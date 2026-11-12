// SVG art that both the pages and the social cards draw, kept here so the two cannot
// drift apart. Colors are written as token references; the cards swap in day values.

/**
 * The hatch patterns that the plates, bars and timeline fill with, as `url(#hatch-accent)`
 * and `url(#hatch-mark)`. Base defines them once per page.
 */
export const HATCH_PATTERNS =
  '<pattern id="hatch-accent" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
  '<line x1="0" y1="0" x2="0" y2="5" stroke-width="0.8" style="stroke: var(--accent)"></line>' +
  '</pattern>' +
  '<pattern id="hatch-mark" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
  '<line x1="0" y1="0" x2="0" y2="4" stroke-width="0.75" style="stroke: var(--mark)"></line>' +
  '</pattern>';

/** The sprig divider under an article's dek (mockup lines 105, 350–356), stroked and unfilled. */
export const SPRIG = {
  viewBox: '0 0 160 40',
  body:
    '<path d="M8 20 C50 17, 110 23, 150 20"></path>' +
    '<path d="M40 19 C46 8, 58 6, 64 10 C58 16, 48 19, 40 19 Z"></path>' +
    '<path d="M68 21 C74 32, 86 34, 92 30 C86 24, 76 21, 68 21 Z"></path>' +
    '<path d="M98 20 C104 9, 116 7, 122 11 C116 17, 106 20, 98 20 Z"></path>' +
    '<circle cx="151" cy="20" r="2.4"></circle>',
};
