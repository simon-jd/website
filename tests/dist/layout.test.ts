// The built pages in a real browser, served by tests/dist/setup.ts: no horizontal scroll
// at phone to desktop widths, the site without JS, and the theme toggle with it.
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest';

/**
 * Every page in dist/, as the path it is served at: `work/x/index.html` → `/work/x/`,
 * `404.html` → `/404.html`. Taken from the build, so it covers whichever case studies,
 * posts, tag, type and focus pages are published.
 */
const ROUTES = readdirSync('dist', { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile() && d.name.endsWith('.html'))
  .map((d) => `/${relative('dist', join(d.parentPath, d.name)).replace(/(^|\/)index\.html$/, '$1')}`)
  .sort();
const WIDTHS = [320, 375, 768, 1280];
const base = inject('previewUrl');

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome' });
});

afterAll(async () => {
  await browser?.close();
});

/** Loads `route` and waits for its web fonts, which can change how wide text sets. */
async function load(page: Page, route: string): Promise<void> {
  const response = await page.goto(new URL(route, base).href);
  expect(response?.status(), route).toBe(200);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test('the build has pages to check', () => {
  expect(ROUTES).toContain('/');
});

describe.each(WIDTHS)('at %ipx', (width) => {
  test.each(ROUTES)('%s does not scroll sideways', async (route) => {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    try {
      const page = await context.newPage();
      await load(page, route);
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    } finally {
      await context.close();
    }
  });
});

test('without JS the nav links show and the theme toggle stays hidden', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  try {
    const page = await context.newPage();
    await load(page, '/');
    const links = page.locator('nav[aria-label="Main"] a');
    expect(await links.count()).toBeGreaterThan(0);
    for (const link of await links.all()) expect(await link.isVisible(), await link.innerText()).toBe(true);
    expect(await page.locator('#theme-toggle').isHidden()).toBe(true);
  } finally {
    await context.close();
  }
});

test('with JS the toggle sets data-theme and switches the hero relief to the night file', async () => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    await load(page, '/');
    const relief = () => page.locator('.relief.hero').evaluate((el) => getComputedStyle(el).backgroundImage);
    const before = await relief();
    expect(before).toContain('relief-day');
    expect(before).not.toContain('relief-night');

    await page.locator('#theme-toggle').click();
    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');
    const after = await relief();
    expect(after).toContain('relief-night');
    expect(after).not.toContain('relief-day');
  } finally {
    await context.close();
  }
});

test.each(['light', 'dark'] as const)('the current nav link is underlined, not only recolored (%s)', async (colorScheme) => {
  const context = await browser.newContext({ colorScheme, viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    let checked = 0;
    for (const route of ROUTES) {
      await load(page, route);
      const marked = await page.locator('nav[aria-label="Main"] a[aria-current]').evaluateAll((links) =>
        links.map((a) => {
          const style = getComputedStyle(a);
          return { href: a.getAttribute('href'), line: style.textDecorationLine, mark: style.textDecorationColor, ink: style.color };
        }),
      );
      for (const { href, line, mark, ink } of marked) {
        expect(line, `${route} ${href}`).toContain('underline');
        // In the text's own color, where the other nav links' underline is transparent.
        expect(mark, `${route} ${href}`).toBe(ink);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});
