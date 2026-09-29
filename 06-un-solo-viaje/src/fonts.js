// The scale's faces, loaded through the FontFace API so the canvas can use them the moment they
// resolve (stickers, pops and the stamp are painted once and cached, so they must be here first).
// Each file is instanced to the weights the game prints and nothing more: Sofia Sans Extra Condensed
// 800 for everything printed big, Sofia Sans Condensed 500–700 (and its italic 700, for the shouts)
// for the small print, DSEG7 Classic for whatever an LCD shows.
const BASE = new URL('../assets/fonts/', import.meta.url);
const FACES = [
  ['Sofia Sans Extra Condensed', 'SofiaSansExtraCondensed-sub.woff2', { weight: '800' }],
  ['Sofia Sans Condensed', 'SofiaSansCondensed-sub.woff2', { weight: '500 700' }],
  ['Sofia Sans Condensed', 'SofiaSansCondensed-Italic-sub.woff2', { weight: '700', style: 'italic' }],
  ['DSEG7 Classic', 'DSEG7Classic-Bold-sub.woff2', { weight: '700' }],
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
