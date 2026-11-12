import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/dist/**/*.test.ts'],
    // Serves dist for the browser tests in layout.test.ts.
    globalSetup: ['tests/dist/setup.ts'],
  },
});
