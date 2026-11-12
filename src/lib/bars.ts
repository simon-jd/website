// Rows for BarChart.astro: single-series bars drawn to scale from zero, where the
// largest value fills the track.

/**
 * A bar. A number prints grouped like the rest of the site (`1,478`), every decimal
 * kept. A string prints exactly as written and scales by its number, for a value whose
 * bank form ends in zeros (`2.0`, `1.40`) that a number would drop; it must be a plain
 * decimal, digits with an optional fraction.
 */
export type BarInput = { label: string; value: number | string; unit: string; highlight?: boolean };
/** `pct` is the bar's length; `reading` is the value and unit as the chart prints them. */
export type BarRow = BarInput & { pct: number; reading: string };

const PLAIN_DECIMAL = /^\d+(?:\.\d+)?$/;

/** The number a row is drawn to; throws, naming the bar, for anything that cannot be drawn. */
function magnitude(row: BarInput): number {
  if (typeof row.value === 'string') {
    if (!PLAIN_DECIMAL.test(row.value))
      throw new Error(
        `barRows: "${row.label}" has value ${JSON.stringify(row.value)}; a string value must be a plain decimal such as "2.0"`,
      );
    return Number(row.value);
  }
  if (!Number.isFinite(row.value) || row.value < 0)
    throw new Error(`barRows: "${row.label}" has value ${row.value}; values must be finite and not negative`);
  return row.value;
}

/** `2.02 s`, `1,478 collectives`, `2.0 s`: the value as `magnitude` describes it, then the unit. */
function readingOf(row: BarInput): string {
  const value =
    typeof row.value === 'string' ? row.value : row.value.toLocaleString('en-US', { maximumFractionDigits: 20 });
  return `${value} ${row.unit}`.trim();
}

/** Each row with `pct` = value / largest value × 100, rounded to one decimal, and its `reading`. */
export function barRows(rows: BarInput[]): BarRow[] {
  if (rows.length === 0) throw new Error('barRows: no rows to chart');
  const values = rows.map(magnitude);
  const max = Math.max(...values);
  if (max === 0) throw new Error('barRows: the largest value is 0, so there is nothing to scale against');
  return rows.map((row, i) => ({ ...row, pct: Math.round((values[i] / max) * 1000) / 10, reading: readingOf(row) }));
}
