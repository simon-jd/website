// The pages Lighthouse CI measures (lighthouserc.cjs), read from the build in dist/: the
// home page, then the first case study by id and the newest post, each only when the
// build has one. Drafts are never built, so a seed set to `draft: true` drops out and
// the next published entry takes its place.
const { existsSync, readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

/** `/work/<id>/` for each case study built under dist/work, sorted by id. */
function caseStudies(dist) {
  const dir = join(dist, 'work');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'index.html')))
    .map((d) => d.name)
    .sort()
    .map((id) => `/work/${id}/`);
}

/** The newest post's path: the first item of dist/rss.xml, which lists the posts newest first. */
function newestPost(dist) {
  const feed = join(dist, 'rss.xml');
  if (!existsSync(feed)) return undefined;
  const link = readFileSync(feed, 'utf8').match(/<item\b[^>]*>[\s\S]*?<link>([^<]+)<\/link>/)?.[1];
  if (link === undefined) return undefined;
  const path = new URL(link.trim()).pathname;
  if (!existsSync(join(dist, path, 'index.html')))
    throw new Error(`lighthouse-urls: the feed's newest post ${path} has no page in ${dist}`);
  return path;
}

/** The paths to measure, home page first. Throws when `dist` holds no build. */
function lighthouseUrls(dist) {
  if (!existsSync(join(dist, 'index.html')))
    throw new Error(`lighthouse-urls: ${join(dist, 'index.html')} is missing; run npm run build first`);
  const post = newestPost(dist);
  return ['/', ...caseStudies(dist).slice(0, 1), ...(post === undefined ? [] : [post])];
}

module.exports = { lighthouseUrls };
