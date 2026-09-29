// The five faces of the cinema, loaded through the FontFace API so the canvas can use them the
// moment they resolve (CSS @font-face alone only loads a face once the DOM asks for it).
const BASE = new URL('../assets/fonts/', import.meta.url);
const FACES = [
  ['Limelight', 'Limelight-sub.woff2', {}],
  ['Shrikhand', 'Shrikhand-sub.woff2', {}],
  ['Oswald', 'Oswald-sub.woff2', { weight: '200 700' }],
  ['Caveat Brush', 'CaveatBrush-sub.woff2', {}],
  ['Atkinson', 'Atkinson-sub.woff2', { weight: '400' }],
  ['Atkinson', 'Atkinson-Bold-sub.woff2', { weight: '700' }],
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
