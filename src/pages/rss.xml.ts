// /rss.xml (spec §5): every published post, newest first, with its full body as HTML.
// The Container API renders each MDX body with the same components the article page
// passes, and its root-relative links are made absolute for feed readers.
import { getContainerRenderer } from '@astrojs/mdx/container-renderer';
import rss from '@astrojs/rss';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { render } from 'astro:content';
import { MDX_COMPONENTS } from '../components/mdx.ts';
import { publishedPosts } from '../lib/posts.ts';
import { SITE } from '../lib/site.ts';
import { absoluteUrls } from '../lib/writing.ts';

export async function GET() {
  const posts = await publishedPosts();
  const container = await AstroContainer.create({ renderers: await loadRenderers([getContainerRenderer()]) });
  const items = await Promise.all(
    posts.map(async (post) => {
      const { Content } = await render(post);
      const html = await container.renderToString(Content, { props: { components: MDX_COMPONENTS } });
      return {
        title: post.data.title,
        pubDate: post.data.date,
        description: post.data.summary,
        link: `/writing/${post.id}/`,
        content: absoluteUrls(html, SITE.url),
      };
    }),
  );
  return rss({
    title: 'Junrui Duan — writing',
    description: 'Essays, notes and field notes by Junrui Duan on the systems under machine learning.',
    site: SITE.url,
    items,
  });
}
