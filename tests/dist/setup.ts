// Vitest globalSetup for the dist tests: serves the built site with Astro's preview
// server on port 4329 while they run, and hands its URL to the tests as `previewUrl`.
import { fileURLToPath } from 'node:url';
import { preview } from 'astro';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    previewUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const server = await preview({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    logLevel: 'error',
    server: { port: 4329 },
  });
  // The bound port: Vite moves to the next free one if 4329 is taken.
  project.provide('previewUrl', `http://localhost:${server.port}`);
  return () => server.stop();
}
