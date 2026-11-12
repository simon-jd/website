import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { MAX_BYTES, syncResume } from '../../scripts/sync-resume.ts';

let tmp = '';

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'sync-resume-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

test('syncResume copies a real PDF and refuses anything else', () => {
  const pdf = join(tmp, 'resume.pdf');
  writeFileSync(pdf, '%PDF-1.7 synthetic body\n%%EOF\n');
  const dest = join(tmp, 'public', 'resume.pdf');
  syncResume(pdf, dest);
  expect(readFileSync(dest, 'utf8')).toBe('%PDF-1.7 synthetic body\n%%EOF\n');

  const text = join(tmp, 'hello.pdf');
  writeFileSync(text, 'hello');
  expect(() => syncResume(text, join(tmp, 'other.pdf'))).toThrow(/not a PDF/);

  expect(() => syncResume(join(tmp, 'missing.pdf'), join(tmp, 'other.pdf'))).toThrow(/RESUME_PDF/);
});

test('syncResume refuses a PDF of 2 MB or more and leaves the old copy alone', () => {
  const dest = join(tmp, 'resume.pdf');
  writeFileSync(dest, '%PDF-1.7 the old copy');
  const big = join(tmp, 'big.pdf');
  writeFileSync(big, Buffer.concat([Buffer.from('%PDF-1.7 '), Buffer.alloc(MAX_BYTES)]));
  expect(() => syncResume(big, dest)).toThrow(/2 MB/);
  expect(readFileSync(dest, 'utf8')).toBe('%PDF-1.7 the old copy');
});

test('syncResume refuses a directory', () => {
  expect(() => syncResume(tmp, join(tmp, 'other.pdf'))).toThrow(/RESUME_PDF.*not a file/);
});
