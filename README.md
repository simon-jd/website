# Junrui Duan

The personal site of Junrui Duan: ML infrastructure and GPU systems projects, case studies and writing. It is a static site built with Astro and ships no runtime framework.

Every number on the site comes from Junrui's résumé bank, a private record of Junrui's projects. `npm run sync:bank` exports them into committed JSON; it runs only on Junrui's machine, so builds and CI use the committed files.

## Publishing a post

1. Add an MDX file to `src/content/writing/`. Its file name, in lowercase-hyphen form, becomes the URL slug. The frontmatter needs `title`, `date`, `type` (`essay`, `note` or `field-note`), `tags` and `summary`. Add `project` with a bank project id to link the post to its case study, and `draft: true` to keep it out of the build.
2. Run `npm run verify`. If the post sets `project`, the content check fails on any number in it that is not in that project's bank export; fix the text rather than the check. A post without `project` is not checked. Case studies, focus pages, About and `content/allowlist.yaml` are always checked.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the dev server. |
| `npm run build` | Type-checks, runs `check:content`, and builds the site into `dist/`. |
| `npm run preview` | Serves `dist/` locally. |
| `npm test` | Runs the unit tests. |
| `npm run test:dist` | Runs the tests against the built site in `dist/`: pages, metadata, privacy, accessibility, the size budget, and layout in Chrome. Run `npm run build` first. |
| `npm run check:content` | Checks the numbers in case studies, focus pages, About, posts that set `project` and `content/allowlist.yaml` against the bank exports they draw on. |
| `npm run check:links` | Checks every link inside `dist/`, skipping external sites. |
| `npm run check:links:external` | Checks every link, external ones included. Run it by hand. |
| `npm run lighthouse` | Runs Lighthouse CI on mobile against `dist/` for the home page and, when the build has them, the first case study and the newest post, and asserts the scores and budgets in `lighthouserc.cjs`. |
| `npm run verify` | Runs `build`, `test`, `test:dist`, `check:links` and `lighthouse` in turn. CI runs this on every push and pull request. |
| `npm run sync:bank` | Exports the public project facts from the bank into `src/content/`. It runs only on Junrui's machine, never in CI. |
| `npm run sync:resume` | Copies the approved résumé PDF to `public/resume.pdf`. It runs only on Junrui's machine. |

The dist tests and Lighthouse drive the installed Google Chrome.
