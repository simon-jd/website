// The Shiki themes for code panels (spec §6: "themed to the tokens for day and night").
// Each is the panel background with ink text, muted comments and accent keywords and
// storage, the day and night values of tokens.css, as in mockup lines 122–124.
// Operators, `=` and `*` among them, stay in the text color, as in the mockup's sketch.
// Shiki writes the day colors inline and the night ones as --shiki-dark variables, which
// global.css switches on in the dark theme.
import type { ShikiConfig } from 'astro';

type Theme = NonNullable<ShikiConfig['themes']>[string];
type Palette = { background: string; text: string; comment: string; keyword: string };

function paperTheme(name: string, type: 'light' | 'dark', c: Palette) {
  return {
    name,
    type,
    bg: c.background,
    fg: c.text,
    colors: { 'editor.background': c.background, 'editor.foreground': c.text },
    tokenColors: [
      { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: c.comment } },
      { scope: ['keyword', 'storage'], settings: { foreground: c.keyword } },
      { scope: ['keyword.operator'], settings: { foreground: c.text } },
    ],
  } satisfies Theme;
}

export const SHIKI_THEMES = {
  light: paperTheme('paper-day', 'light', {
    background: '#ece9e1',
    text: '#2f352e',
    comment: '#5d6258',
    keyword: '#56614a',
  }),
  dark: paperTheme('paper-night', 'dark', {
    background: '#2a302b',
    text: '#e9e6dc',
    comment: '#a7ab9f',
    keyword: '#b9c6a5',
  }),
};
