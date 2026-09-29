// The scoreboard's three faces, loaded through the FontFace API so the canvas can paint with them the
// moment they resolve. Doto is the LED matrix itself: every number, the clock, the shouts on the big
// screen. Big Shoulders Display is the stadium signage (level names, the title). Barlow Semi Condensed
// is the small print: rules, buttons, the result card.
const BASE = new URL('../assets/fonts/', import.meta.url);
const FACES = [
  ['Doto', 'Doto-var.woff2', { weight: '100 900' }],
  ['Big Shoulders Display', 'BigShoulders-var.woff2', { weight: '100 900' }],
  ['Barlow Semi Condensed', 'BarlowSC-500.woff2', { weight: '500' }],
  ['Barlow Semi Condensed', 'BarlowSC-700.woff2', { weight: '700' }],
];
let once = null;
export function loadFonts() {
  if (once) return once;
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return (once = Promise.resolve([]));
  once = Promise.allSettled(FACES.map(async ([fam, file, d]) => {
    const f = new FontFace(fam, `url(${new URL(file, BASE)}) format('woff2')`, { display: 'swap', ...d });
    await f.load();
    document.fonts.add(f);
    return fam;
  }));
  return once;
}
export const F = {
  led: (px, w = 900) => `${w} ${px}px Doto, "Courier New", monospace`,
  sign: (px, w = 900) => `${w} ${px}px "Big Shoulders Display", Impact, "Arial Narrow", sans-serif`,
  body: (px, w = 700) => `${w} ${px}px "Barlow Semi Condensed", "Arial Narrow", system-ui, sans-serif`,
};
