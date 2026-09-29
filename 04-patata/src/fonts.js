// The album's four faces, loaded through the FontFace API so the canvas can use them the moment
// they resolve (CSS @font-face alone only loads a face once the DOM asks for it).
const BASE = new URL('../assets/fonts/', import.meta.url);
const FACES = [
  ['Titan One', 'TitanOne-sub.woff2', {}],
  ['Archivo', 'Archivo-sub.woff2', { weight: '100 900', stretch: '62% 125%' }],
  ['Kalam', 'Kalam-sub.woff2', { weight: '400' }],
  ['Kalam', 'Kalam-Bold-sub.woff2', { weight: '700' }],
  ['Permanent Marker', 'PermanentMarker-sub.woff2', {}],
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
