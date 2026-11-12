// The relief's encoded images, in one place so the backgrounds Relief.astro sets and the
// phone preloads in Base's <head> always name the same files.
import { getImage } from 'astro:assets';
import day from '../assets/relief/relief-day.webp';
import night from '../assets/relief/relief-night.webp';

/**
 * The relief for `theme` at `width` as `format`, by URL. AVIF is encoded at quality 40,
 * below sharp's 50: the relief is faded and masked, so the loss does not show, and it
 * is the largest paint on phones.
 */
export async function reliefImage(
  theme: 'day' | 'night',
  width: 750 | 1440,
  format: 'avif' | 'webp',
): Promise<string> {
  const src = theme === 'day' ? day : night;
  const image = await getImage(format === 'avif' ? { src, width, format, quality: 40 } : { src, width, format });
  return image.src;
}
