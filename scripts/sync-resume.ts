// npm run sync:resume: copies the approved public résumé, the PDF that $RESUME_PDF (set
// in the gitignored .env.local) names, to public/resume.pdf, which the site serves as
// /resume.pdf. It refuses anything that is not a PDF under 2 MB and leaves the current
// copy alone when it does.
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The largest résumé the site serves, exclusive: 2 MB. */
export const MAX_BYTES = 2 * 1024 * 1024;

const MAGIC = '%PDF-';

export function syncResume(src: string, dest = 'public/resume.pdf'): void {
  let size: number;
  try {
    const stat = statSync(src);
    if (!stat.isFile()) throw new Error(`RESUME_PDF (${src}) is not a file`);
    size = stat.size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error(`RESUME_PDF (${src}) does not exist`);
    throw error;
  }
  if (size >= MAX_BYTES)
    throw new Error(`RESUME_PDF (${src}) is ${size} bytes; the public résumé must be smaller than 2 MB`);
  // The bytes that pass the checks are the bytes written.
  const pdf = readFileSync(src);
  if (pdf.subarray(0, MAGIC.length).toString('latin1') !== MAGIC)
    throw new Error(`RESUME_PDF (${src}) is not a PDF: it does not start with ${MAGIC}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, pdf);
}

function main(): void {
  try {
    const src = process.env.RESUME_PDF;
    if (!src) throw new Error("RESUME_PDF is not set; put the approved public résumé's path in .env.local");
    syncResume(src);
    console.log('copied the public résumé to public/resume.pdf');
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
