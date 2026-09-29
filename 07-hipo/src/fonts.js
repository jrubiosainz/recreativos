// The poster's two faces, loaded through the FontFace API so the canvas can paint with them the
// moment they resolve (the «¡HIP!» pops, the signs and the share card are drawn, not typed).
// Gluten, instanced at 850, is the lettering: the title, the level names, every shout. Kanit
// 600/700 is the small print on the poster, and its extra-bold italic is what the lifeguard yells.
const BASE = new URL('../assets/fonts/', import.meta.url);
const FACES = [
  ['Gluten', 'Gluten-850-sub.woff2', { weight: '850' }],
  ['Kanit', 'Kanit-600-sub.woff2', { weight: '600' }],
  ['Kanit', 'Kanit-700-sub.woff2', { weight: '700' }],
  ['Kanit', 'Kanit-800i-sub.woff2', { weight: '800', style: 'italic' }],
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
  letter: (px) => `850 ${px}px Gluten, "Arial Rounded MT Bold", system-ui, sans-serif`,
  body: (px, w = 600) => `${w} ${px}px Kanit, system-ui, sans-serif`,
  shout: (px) => `italic 800 ${px}px Kanit, system-ui, sans-serif`,
};
