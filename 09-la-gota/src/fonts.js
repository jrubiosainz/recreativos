// Three faces, loaded through the FontFace API so the canvas can paint with them the moment they resolve.
// Darumadrop One has chunky, roughed-up letters, as if written with a fingertip on a steamed-up window:
// the title, the shouts, the level names, the result. Shantell Sans is a kid's handwriting grown up:
// the names on the tags, the rules, the buttons, everything that talks. Doto is the bus's machines:
// the LED sign over the aisle and the validator's stamp on the back of the ticket.
const BASE = new URL('../assets/fonts/', import.meta.url);
const FACES = [
  ['Darumadrop One', 'DarumadropOne.woff2', { weight: '400' }],
  ['Shantell Sans', 'ShantellSans-var.woff2', { weight: '300 800' }],
  ['Doto', 'Doto-var.woff2', { weight: '100 900' }],
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
  wipe: (px) => `400 ${px}px "Darumadrop One", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif`,
  hand: (px, w = 650) => `${w} ${px}px "Shantell Sans", "Comic Sans MS", "Trebuchet MS", sans-serif`,
  led: (px, w = 900) => `${w} ${px}px "Doto", "Courier New", monospace`,
};
