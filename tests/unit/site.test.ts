import { afterEach, expect, test } from 'vitest';
import { isoDate, monthLabel, profile } from '../../src/lib/site.ts';

const TZ = process.env.TZ;
afterEach(() => {
  if (TZ === undefined) delete process.env.TZ;
  else process.env.TZ = TZ;
});

test('monthLabel and isoDate read the date in UTC', () => {
  // A frontmatter date such as 2026-11-01 parses to UTC midnight, which is still
  // October in Seattle; the labels must not move it back a day.
  process.env.TZ = 'America/Los_Angeles';
  const d = new Date('2026-11-01');
  expect(monthLabel(d)).toBe('2026-11');
  expect(isoDate(d)).toBe('2026-11-01');
});

test('profile is the parsed bank export', () => {
  expect(profile.name).toBe('Junrui Duan');
  expect(profile.github).toMatch(/^https:\/\/github\.com\//);
});
