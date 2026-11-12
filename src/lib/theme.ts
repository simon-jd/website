// The site's only first-party JavaScript. Base inlines both strings verbatim.
// They use the bare globals `document`, `localStorage` and `matchMedia` (the unit
// tests pass fakes for exactly those), and every storage access sits in try/catch,
// because storage throws in private modes or when the visitor blocks it.

/**
 * Inlined in <head> before any stylesheet: applies a stored `light` or `dark` choice
 * as `data-theme` on <html> before first paint. Without one, CSS follows the system.
 */
export const THEME_INIT = `try{const t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}`;

/**
 * Inlined at the end of <body>: shows #theme-toggle (rendered `hidden`, so visitors
 * without JS never see a dead button), keeps its aria-pressed equal to "dark is on",
 * and on click switches to the opposite of the effective theme and stores the choice.
 */
export const THEME_TOGGLE = `(()=>{const b=document.getElementById('theme-toggle');if(!b)return;const r=document.documentElement;const dark=()=>r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;const sync=()=>b.setAttribute('aria-pressed',String(dark()));b.hidden=false;sync();b.addEventListener('click',()=>{const t=dark()?'light':'dark';r.dataset.theme=t;try{localStorage.setItem('theme',t)}catch{}sync()})})()`;
