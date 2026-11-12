// The two theme scripts run with fake browser globals, the way the page runs them:
// bare `document`, `localStorage` and `matchMedia`.
import { expect, test } from 'vitest';
import { THEME_INIT, THEME_TOGGLE } from '../../src/lib/theme.ts';

type FakeButton = {
  hidden: boolean;
  attributes: Map<string, string>;
  click: () => void;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  addEventListener: (type: string, listener: () => void) => void;
};

type FakeGlobals = {
  document: { documentElement: { dataset: Record<string, string> }; getElementById: (id: string) => FakeButton | null };
  localStorage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };
  matchMedia: (query: string) => { matches: boolean };
  button: FakeButton;
  stored: Map<string, string>;
};

const broken = () => {
  throw new Error('SecurityError: storage is blocked');
};

function fakes(opts: { stored?: string; systemDark?: boolean; storageThrows?: boolean } = {}): FakeGlobals {
  const stored = new Map<string, string>(opts.stored === undefined ? [] : [['theme', opts.stored]]);
  const listeners = new Map<string, () => void>();
  const button: FakeButton = {
    hidden: true,
    attributes: new Map(),
    click: () => listeners.get('click')?.(),
    setAttribute: (name, value) => void button.attributes.set(name, value),
    getAttribute: (name) => button.attributes.get(name) ?? null,
    addEventListener: (type, listener) => void listeners.set(type, listener),
  };
  return {
    document: {
      documentElement: { dataset: {} },
      getElementById: (id) => (id === 'theme-toggle' ? button : null),
    },
    localStorage: opts.storageThrows
      ? { getItem: broken, setItem: broken }
      : { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => void stored.set(key, value) },
    matchMedia: (query) => ({ matches: query === '(prefers-color-scheme: dark)' && opts.systemDark === true }),
    button,
    stored,
  };
}

const run = (code: string, g: FakeGlobals) =>
  new Function('document', 'localStorage', 'matchMedia', code)(g.document, g.localStorage, g.matchMedia);

const theme = (g: FakeGlobals) => g.document.documentElement.dataset.theme;

test('THEME_INIT applies a stored choice', () => {
  const g = fakes({ stored: 'dark' });
  run(THEME_INIT, g);
  expect(theme(g)).toBe('dark');
});

test('THEME_INIT ignores junk values', () => {
  const g = fakes({ stored: 'purple' });
  run(THEME_INIT, g);
  expect(theme(g)).toBeUndefined();
});

test('THEME_INIT survives storage that throws', () => {
  const g = fakes({ storageThrows: true });
  expect(() => run(THEME_INIT, g)).not.toThrow();
  expect(theme(g)).toBeUndefined();
});

test('THEME_TOGGLE flips system dark to light when storage throws', () => {
  const g = fakes({ systemDark: true, storageThrows: true });
  run(THEME_TOGGLE, g);
  expect(() => g.button.click()).not.toThrow();
  expect(theme(g)).toBe('light');
  expect(g.button.getAttribute('aria-pressed')).toBe('false');
});

test('THEME_TOGGLE flips a stored light choice to dark and stores it', () => {
  const g = fakes({ stored: 'light' });
  run(THEME_INIT, g);
  run(THEME_TOGGLE, g);
  g.button.click();
  expect(theme(g)).toBe('dark');
  expect(g.stored.get('theme')).toBe('dark');
  expect(g.button.getAttribute('aria-pressed')).toBe('true');
});

test('THEME_TOGGLE un-hides the button', () => {
  const g = fakes();
  run(THEME_TOGGLE, g);
  expect(g.button.hidden).toBe(false);
});

test('THEME_TOGGLE reports the effective theme before any click', () => {
  const dark = fakes({ systemDark: true });
  run(THEME_TOGGLE, dark);
  expect(dark.button.getAttribute('aria-pressed')).toBe('true');
  const light = fakes();
  run(THEME_TOGGLE, light);
  expect(light.button.getAttribute('aria-pressed')).toBe('false');
});

test('theme scripts stay under 1 KB', () => {
  expect(THEME_INIT.length + THEME_TOGGLE.length).toBeLessThan(1024);
});
