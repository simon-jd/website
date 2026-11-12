// npm run check:content [site dir]: prints every number on the site that is missing from
// the bank export it draws on, as `file:line  token  "excerpt"`, and exits 1 if there is
// any. It runs inside `npm run build`. When it fails, fix the text, never the check.
import { runContentCheck } from '../src/lib/content-check.ts';

const siteDir = process.argv[2] ?? process.cwd();

try {
  const findings = runContentCheck(siteDir);
  for (const f of findings) console.log(`${f.file}:${f.line}  ${f.token}  "${f.excerpt}"`);
  if (findings.length > 0) {
    console.error(`check:content: ${findings.length} number(s) not found in the bank export they draw on`);
    process.exitCode = 1;
  } else {
    console.log('check:content: every number is in the bank export it draws on');
  }
} catch (error) {
  console.error(`check:content: ${(error as Error).message}`);
  process.exitCode = 1;
}
