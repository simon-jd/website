// The components MDX bodies use without importing them. Pages pass these to
// `<Content components={MDX_COMPONENTS} />`, so MDX files need no `import` lines.
import BarChart from './BarChart.astro';
import Figure from './Figure.astro';
import Sidenote from './Sidenote.astro';
import Stats from './Stats.astro';

export const MDX_COMPONENTS = { BarChart, Stats, Sidenote, Figure };
