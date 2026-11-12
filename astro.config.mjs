// @ts-check
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { SHIKI_THEMES } from './src/lib/shiki-themes.ts';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://junruiduan.pages.dev',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'always' },
  // MDX inherits this through extendMarkdownConfig, and Astro 7's default Sätteri
  // processor passes `themes` to Shiki for both .md and .mdx.
  markdown: { shikiConfig: { themes: SHIKI_THEMES } },
  // The sitemap lists pages only: never the 404 page or the social cards under /og/.
  integrations: [mdx(), sitemap({ filter: (page) => !/^\/(?:404|og)\//.test(new URL(page).pathname) })],
  vite: { server: { watch: { ignored: ['**/legacy/**', '**/.superpowers/**'] } } },
});
