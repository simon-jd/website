// /robots.txt: allows every crawler everywhere and points to the sitemap, on the site URL
// that astro.config.mjs sets, so a change of domain is made in one place.
import type { APIRoute } from 'astro';
import { SITE } from '../lib/site.ts';

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap-index.xml', SITE.url).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
