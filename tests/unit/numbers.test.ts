import { expect, test } from 'vitest';
import { canonical, extractNumbers, numbersIn } from '../../src/lib/numbers.ts';

test.each([['1,478', '1478'], ['0.48', '0.48'], ['007', '7'], ['2.20', '2.20'], ['0', '0']])(
  'canonical(%s) is %s', (a, b) => expect(canonical(a)).toBe(b));

test.each([
  ['2.22 → 0.48 s', ['2.22', '0.48']],
  ['vLLM 0.10.2 and torch 2.8.0', []],
  ['released 2026-11-08, written in 2026', []],
  ['from 2026-11 to 1999-12-31', []],
  // Only real dates go: a pair of numbers joined by a hyphen is still two numbers.
  ['tiles of 1024-64 elements', ['1024', '64']],
  ['2026-13 is no month and 2026-11-32 no day', ['13', '32']],
  ['2,000 requests', ['2000']],
  ['2048 tokens', ['2048']],
  ['code at https://github.com/simon-jd/blockfp8 and [case study](/work/blockfp8/)', []],
  ['1.63× faster, +3.13 pp, 1% idle', ['1.63', '3.13', '1']],
  ['Qwen2.5-0.5B on an A10', ['2.5', '0.5', '10']],
  ['seeds 17/18/19', ['17', '18', '19']],
  ['v2 of the API', []],
  // Years are bare four-digit integers from 1990 to 2035 without a comma.
  ['1989 and 2036, but 1990 and 2035, and 2,026', ['1989', '2036', '2026']],
  // href and src values go, the text around them stays.
  ['<img src="./fig-3.svg" alt="7 bars"> <a href="/work/x2/">2.5×</a> <Plate src={plate4} />', ['7', '2.5']],
  // A URL ends at a quote or an angle bracket, so a number written after the markup is still checked.
  ['<Note url="https://example.com/a1">9.99 s</Note>', ['9.99']],
])('extractNumbers(%j)', (text, expected) => expect(extractNumbers(text)).toEqual(expected));

test('numbersIn reads every string inside a value, nested ones too', () => {
  expect(numbersIn({ title: 'A10 run', items: [{ text: '1,478 → 25' }, 'v2 2.20'], count: 7 })).toEqual(
    new Set(['10', '1478', '25', '2.20']),
  );
});
