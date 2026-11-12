// Lighthouse CI (npm run lighthouse): three mobile runs against dist/ for the home page
// and, when the build has them, the first case study and the newest post. The pages come
// from the build (scripts/lighthouse-urls.cjs), so drafting or renaming a seed never
// points Lighthouse at a page that does not exist.
const { join } = require('node:path');
const { lighthouseUrls } = require('./scripts/lighthouse-urls.cjs');

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: lighthouseUrls(join(__dirname, 'dist')),
      numberOfRuns: 3,
      settings: { formFactor: 'mobile' },
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: '.*',
          assertions: {
            'categories:performance': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
            'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
            'categories:best-practices': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
            'categories:seo': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
            'largest-contentful-paint': ['error', { maxNumericValue: 1500, aggregationMethod: 'median' }],
            'cumulative-layout-shift': ['error', { maxNumericValue: 0.049, aggregationMethod: 'pessimistic' }],
            'resource-summary:script:size': ['error', { maxNumericValue: 5120 }],
            'resource-summary:image:size': ['error', { maxNumericValue: 61440 }],
            'resource-summary:total:size': ['error', { maxNumericValue: 204800 }],
          },
        },
        {
          matchingUrlPattern: '^https?://[^/]+/$',
          assertions: {
            'resource-summary:font:size': ['error', { maxNumericValue: 112640 }],
          },
        },
        {
          matchingUrlPattern: '^https?://[^/]+/(work|writing)/.+',
          assertions: {
            'resource-summary:font:size': ['error', { maxNumericValue: 122880 }],
          },
        },
      ],
    },
  },
};
