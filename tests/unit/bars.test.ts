import { expect, test } from 'vitest';
import { barRows } from '../../src/lib/bars.ts';

test('barRows scales from zero to the largest value', () => {
  const r = barRows([
    { label: 'per-tensor', value: 2.02, unit: 's' },
    { label: 'bucketed', value: 0.45, unit: 's', highlight: true },
  ]);
  expect(r.map((x) => x.pct)).toEqual([100, 22.3]);
  expect(r[1]).toEqual({ label: 'bucketed', value: 0.45, unit: 's', highlight: true, pct: 22.3, reading: '0.45 s' });
});

test('a number prints grouped like the rest of the site, every decimal kept', () => {
  const r = barRows([
    { label: 'baseline', value: 8800000, unit: 'B/op' },
    { label: 'bucketed', value: 0.45, unit: 's' },
    { label: 'unitless', value: 3, unit: '' },
  ]);
  expect(r.map((x) => x.reading)).toEqual(['8,800,000 B/op', '0.45 s', '3']);
});

test('a string prints exactly as written and scales by its number', () => {
  // As numbers, 2.0 would print as "2" and 1.40 as "1.4", forms the bank does not write.
  const r = barRows([
    { label: 'before', value: '2.0', unit: 's' },
    { label: 'after', value: '1.40', unit: 's', highlight: true },
    { label: 'mixed', value: 0.5, unit: 's' },
  ]);
  expect(r.map((x) => [x.pct, x.reading])).toEqual([
    [100, '2.0 s'],
    [70, '1.40 s'],
    [25, '0.5 s'],
  ]);
  expect(r[0].value).toBe('2.0');
});

test('barRows rejects empty, negative and non-finite input', () => {
  const row = (value: number) => ({ label: 'x', value, unit: 's' });
  expect(() => barRows([])).toThrow(/no rows/);
  expect(() => barRows([row(1), row(-1)])).toThrow(/"x".*-1/);
  expect(() => barRows([row(1), row(Number.NaN)])).toThrow(/"x".*NaN/);
  expect(() => barRows([row(1), row(Number.POSITIVE_INFINITY)])).toThrow(/"x".*Infinity/);
  // Nothing to scale against: every bar would be 0 / 0.
  expect(() => barRows([row(0), row(0)])).toThrow(/largest value is 0/);
  expect(() => barRows([{ label: 'x', value: '0.00', unit: 's' }])).toThrow(/largest value is 0/);
});

test.each(['', ' ', 'fast', '2 s', '1,478', '-1', '0x10', '1e3', '.5', 'Infinity'])(
  'barRows rejects the string value %j, naming the bar',
  (value) => {
    expect(() => barRows([{ label: 'per-tensor sync', value, unit: 's' }])).toThrow(
      `barRows: "per-tensor sync" has value ${JSON.stringify(value)}`,
    );
  },
);
