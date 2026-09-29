// The network's two faces, loaded through the FontFace API so the canvas can use them the moment
// they resolve (the station's posters and name plates are painted once and cached, so they must
// be here before the first frame). Anybody for everything printed or signposted, stretched and
// squeezed like transit lettering; Doto for anything a validator or a departures board prints.
const BASE = new URL('../assets/fonts/', import.meta.url);
const FACES = [
  ['Anybody', 'Anybody-sub.woff2', { weight: '100 900', stretch: '50% 150%' }],
  ['Doto', 'Doto-sub.woff2', { weight: '100 900' }],
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
