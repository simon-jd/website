// The published posts, for every page that lists, links or renders them: the one place
// the writing collection's draft gate lives. It sits apart from writing.ts because
// Astro's virtual module astro:content exists only inside Astro, and the dist tests
// import writing.ts on their own.
import { getCollection, type CollectionEntry } from 'astro:content';
import { isPublished, sortNewest } from './writing.ts';

export type Post = CollectionEntry<'writing'>;

/**
 * The posts the build shows, newest first in sortNewest's order. Drafts are left out of
 * production builds; `prod` defaults to the build's mode, as isPublished expects.
 */
export async function publishedPosts(prod: boolean = import.meta.env.PROD): Promise<Post[]> {
  return sortNewest(await getCollection('writing', (post) => isPublished(post.data, prod)));
}
