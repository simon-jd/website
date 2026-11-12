import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('home page is built as English HTML', () => {
  expect(readFileSync('dist/index.html', 'utf8')).toMatch(/<html lang="en"/);
});
