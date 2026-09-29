// The inks of a Spanish block of flats, and of the fruit shop's scale that weighs it all: glazed
// sage tiles, pink terrazo, varnished wood, brass, the orange pilot of a stair light, the scale's
// grey-green LCD, its cream plastic and its thermal label with the green band. Everything drawn in
// the building goes through fog() (the far end of a corridor sinks into its own shade) and, when
// the stair light runs out, through the dark.
import { mix, clamp, rgba, TAU } from '../util.js';
export { TAU, rgba, mix };

export const PAL = {
  // the building
  tile: '#8a9b63', tileDk: '#6f7f4e', tileLt: '#a7b681', grout: '#5d6a43',
  paint: '#e7dfca', paintDk: '#d6ccb2', ceil: '#efe9d9', ceilDk: '#ddd5c1',
  terr: '#c9a898', terrDk: '#b08f80', chips: ['#8b584a', '#5c4037', '#eadcce', '#a87c68', '#3e3430', '#d8c0ae', '#f3ece2', '#9a6b5b'],
  step: '#d8cdbd', stepDk: '#b9ab98', nose: '#8f806e', rail: '#5a3520', railLt: '#7d4c2e',
  wood: '#6a3a22', woodDk: '#4a2615', woodLt: '#8b5634', woodHi: '#a8704a',
  brass: '#b88f3a', brassDk: '#86661f', brassLt: '#e0c47c',
  steel: '#b9bec0', steelDk: '#7e8487', steelLt: '#dfe3e4',
  pilot: '#ff8a24', pilotHot: '#ffd29a', lamp: '#fff4d8',
  mat: '#8e6a3f', matDk: '#6b4c29',
  parq: '#b98557', parqDk: '#9c6b41', kitchen: '#e9eee6', kitchenDk: '#cdd6cc',
  // outside
  sky: '#bcd6e6', skyLo: '#e8eee9', stucco: '#e2cfa8', stuccoDk: '#cdb68c', stone: '#b8ad99', stoneDk: '#9b907c',
  pave: '#b9b6ad', paveDk: '#a19e95', asph: '#55585b', asphLt: '#6b6e70', curb: '#c9c5bb', shutter: '#5f7d5a',
  // the scale and its label
  lcd: '#b7c0a1', lcdDk: '#9aa587', seg: '#1f251d', bezel: '#ece6d6', bezelDk: '#c8c0ab',
  label: '#f5f2ea', ink: '#1c1d1a', inkSoft: '#55574f', brand: '#2f6b3f', brandLt: '#3f8a52', orange: '#e8762a', red: '#c8372d',
  // you
  skin: '#e7b28d', skinDk: '#c98c69', skinLt: '#f3cfb3', knuckle: '#f5dcc8', press: '#d4665c', numb: '#9b5d86', nail: '#f2d3c4',
  sleeve: '#2e4a3a', sleeveDk: '#20352a', sleeveLt: '#3f604c',
  // the dark, and the haze a corridor sinks into
  night: '#0d1016', shade: '#3b3a33',
};

// the bags: most are the supermarket's (white, green band, «GRACIAS»), some are their own thing
export const BAGS = {
  white: { body: '#f3f2ec', dk: '#d9d9d0', band: '#2f7d45', band2: '#e8762a', handle: '#eeede6' },
  mesh: { body: '#d9442f', dk: '#a83322', band: null, handle: '#d9442f' },
  cold: { body: '#b9c7d3', dk: '#8fa0b0', band: '#2d5f9a', handle: '#2d5f9a' },
  wrap: { body: 'rgba(220,235,245,0.55)', dk: 'rgba(160,190,210,0.6)', band: null, handle: '#dfe8ee' },
  paper: { body: '#f6f4ef', dk: '#d8d3c8', band: '#7aa6c9', handle: '#e9ecef' },
  gift: { body: '#8c1f2a', dk: '#65131c', band: '#d8b14a', handle: '#d8b14a' },
};

export const FACE = '"Sofia Sans Extra Condensed", "Arial Narrow", system-ui, sans-serif';
export const TEXT = '"Sofia Sans Condensed", "Arial Narrow", system-ui, sans-serif';
export const LCD = '"DSEG7 Classic", ui-monospace, monospace';

const fogC = new Map();
// a colour at depth k (0 near, 1 lost) in a room whose far end sinks into `to`
export function fog(c, k, to = PAL.shade) {
  if (k <= 0.02) return c;
  const q = Math.round(clamp(k) * 24), key = c + to + q;
  let v = fogC.get(key);
  if (v === undefined) fogC.set(key, (v = mix(c, to, q / 24)));
  return v;
}
const mixC = new Map();
export function tone(a, b, t) {
  const q = Math.round(clamp(t) * 32), key = a + b + q;
  let v = mixC.get(key);
  if (v === undefined) mixC.set(key, (v = mix(a, b, q / 32)));
  return v;
}
export const darker = (c, a = 0.18) => tone(c, '#16120e', a);
export const lighter = (c, a = 0.18) => tone(c, '#ffffff', a);

export const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, Math.abs(rx) + 1e-5, Math.abs(ry) + 1e-5, rot, 0, TAU); };
export function rrect(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export function poly(g, pts, close = true) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  if (close) g.closePath();
}

// offscreen pictures, painted once
export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

// seven segments, as the scale's LCD draws them (the unlit ones faintly there): for the canvas
// readouts, so they never depend on a font having loaded
const SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '', E: 'adefg', L: 'def', o: 'cdeg', r: 'eg', P: 'abefg', H: 'bcefg', A: 'abcefg', n: 'ceg' };
export function seg7(g, str, x, y, h, on, off, { slant = 0.1, wgt = 0.14, gap = 0.26 } = {}) {
  const w = h * 0.52, t = h * wgt, sp = w + h * gap;
  let cx = x;
  const bar = (x0, y0, x1, y1) => {
    const hor = Math.abs(y1 - y0) < 1e-6, k = t / 2;
    g.beginPath();
    if (hor) { g.moveTo(x0 + k, y0); g.lineTo(x0 + k * 2, y0 - k); g.lineTo(x1 - k * 2, y1 - k); g.lineTo(x1 - k, y1); g.lineTo(x1 - k * 2, y1 + k); g.lineTo(x0 + k * 2, y0 + k); }
    else { g.moveTo(x0, y0 + k); g.lineTo(x0 + k, y0 + k * 2); g.lineTo(x1 + k, y1 - k * 2); g.lineTo(x1, y1 - k); g.lineTo(x1 - k, y1 - k * 2); g.lineTo(x0 - k, y0 + k * 2); }
    g.closePath();
  };
  const sk = (yy) => (yy - y) * -slant;   // italic lean, like the real ones
  for (const ch of String(str)) {
    if (ch === '.' || ch === ',') {
      g.fillStyle = on; g.beginPath(); g.arc(cx - sp + w + t * 1.25 + sk(y + h), y + h - t * 0.45, t * 0.62, 0, TAU); g.fill();
      continue;
    }
    const s = SEGS[ch] ?? '';
    const P = { a: [cx, y, cx + w, y], b: [cx + w, y, cx + w, y + h / 2], c: [cx + w, y + h / 2, cx + w, y + h], d: [cx, y + h, cx + w, y + h], e: [cx, y + h / 2, cx, y + h], f: [cx, y, cx, y + h / 2], g: [cx, y + h / 2, cx + w, y + h / 2] };
    for (const k of 'abcdefg') {
      const [x0, y0, x1, y1] = P[k];
      const lit = s.includes(k);
      if (!lit && !off) continue;
      g.fillStyle = lit ? on : off;
      bar(x0 + sk(y0), y0, x1 + sk(y1), y1);
      g.fill();
    }
    cx += sp;
  }
  return cx - x;
}
export const seg7w = (n, h, gap = 0.26) => n * (h * 0.52 + h * gap);
