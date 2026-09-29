// Three faces, loaded through the FontFace API so the canvas can paint with them the moment they resolve.
// Fredoka is round and fat like fridge-magnet letters: the logo, the shouts, the buttons. Patrick Hand is a
// note scribbled in biro and stuck on the fridge: the level notes, the asides. Nunito does the talking.
const BASE = new URL('../assets/fonts/', import.meta.url);
const FACES = [
  ['Fredoka', 'Fredoka-var.woff2', { weight: '300 700' }],
  ['Nunito', 'Nunito-var.woff2', { weight: '400 900' }],
  ['Patrick Hand', 'PatrickHand.woff2', { weight: '400' }],
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
  logo: (px, w = 700) => `${w} ${px}px "Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif`,
  hand: (px) => `400 ${px}px "Patrick Hand", "Comic Sans MS", "Trebuchet MS", cursive`,
  body: (px, w = 700) => `${w} ${px}px "Nunito", system-ui, -apple-system, "Segoe UI", sans-serif`,
};
