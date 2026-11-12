import { getCollection } from 'astro:content';
import { expect, test, vi } from 'vitest';
import { publishedPosts } from '../../src/lib/posts.ts';

// Astro's virtual module does not exist outside Astro; the mock applies the filter it is given.
vi.mock('astro:content', () => ({ getCollection: vi.fn() }));

type Entry = { id: string; data: { date: Date; draft: boolean } };

/** A post as getCollection returns it; every value is synthetic. */
const entry = (id: string, date: string, draft = false): Entry => ({ id, data: { date: new Date(date), draft } });

const store = [
  entry('older', '2026-09-01'),
  entry('draft', '2026-11-01', true),
  entry('newer-b', '2026-10-01'),
  entry('newer-a', '2026-10-01'),
];

function mockStore(): void {
  vi.mocked(getCollection).mockImplementation((async (name: string, filter?: (entry: Entry) => unknown) => {
    expect(name).toBe('writing');
    return store.filter((e) => (filter ? filter(e) : true));
  }) as never);
}

test('publishedPosts leaves drafts out in production, newest first and same-day posts by id', async () => {
  mockStore();
  expect((await publishedPosts(true)).map((p) => p.id)).toEqual(['newer-a', 'newer-b', 'older']);
});

test('publishedPosts keeps drafts outside production', async () => {
  mockStore();
  expect((await publishedPosts(false)).map((p) => p.id)).toEqual(['draft', 'newer-a', 'newer-b', 'older']);
});
