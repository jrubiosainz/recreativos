// Where everybody stands in the photo. Coordinates are fractions of the print: x across its width,
// y down its height. d is the head's diameter as a fraction of the print's width.
// Landscape prints (3:2) are for wide screens; portrait prints (2:3) for phones held upright.
import { EVENTS } from './levels.js';

export const ASPECT = { h: 3 / 2, v: 2 / 3 };

// head centre height above the ground, in head diameters, and head size
function stature(id, ev, variant = {}) {
  const year = ev.date[0];
  const kind = variant.kind;
  if (id === 'lucia') {
    if (kind === 'teen') return { st: 3.3, hs: 0.97 };
    const age = year - 1987;
    return { st: 2.3 + 0.1 * (age - 5), hs: 0.9 + 0.01 * (age - 9) };
  }
  if (id === 'kiko') return { st: 2.45 + 0.1 * (year - 2000), hs: 0.88 };
  const T = { papa: 3.7, paco: 3.6, toni: 3.7, raul: 3.62, mama: 3.45, mari: 3.5, encarna: 3.42, abuela: 3.05, abuelo: 3.3, you: 3.6 };
  return { st: T[id] || 3.5, hs: id === 'abuela' ? 0.97 : 1 };
}

const cache = new Map();

export function layout(ev, mode) {
  const key = ev.id + mode;
  if (cache.has(key)) return cache.get(key);
  const A = ASPECT[mode], rows = ev.rows[mode], k = rows.length - 1;
  const rowScale = (r) => Math.pow(0.93, k - r);
  const widest = Math.max(...rows.map((row, r) => row.length * rowScale(r)));
  const yF = mode === 'h' ? 0.66 : 0.72;
  const rise = mode === 'h' ? 0.72 : 1.02;
  let dw = Math.min(mode === 'h' ? 0.125 : 0.2, 0.93 / (widest * 1.42));
  // keep the back row's heads well inside the frame
  const top = (dw) => yF - (k * rise + 0.62) * dw * A;
  while (top(dw) < 0.12) dw *= 0.97;
  const dh = dw * A;
  const out = {};
  const groundF = yF + 3.55 * dh;
  rows.forEach((row, r) => {
    const s = rowScale(r), sp = 1.42 * dw * s, n = row.length;
    const ground = groundF - (k - r) * rise * dh - (k - r) * 3.55 * dh * (1 - s);
    const stagger = rows.length > 1 && rows.every((q) => q.length === n) ? (r % 2 ? 0.22 : -0.22) * sp : 0;
    row.forEach((id, i) => {
      const { st, hs } = stature(id, ev, (ev.variant || {})[id]);
      out[id] = { id, row: r, s, x: 0.5 + (i - (n - 1) / 2) * sp + stagger, y: ground - st * dh * s, d: dw * s * hs, st, G: st / hs, z: r * 100 + (i % 2 ? 1 : 0) + 10 };
    });
  });
  // babies and dogs are carried: held against the chest, a little to one side
  for (const [id, by] of Object.entries(ev.held || {})) {
    const h = out[by], side = h.x > 0.5 ? -1 : 1;
    const dog = id === 'bolita', tod = ((ev.variant || {})[id] || {}).kind === 'toddler';
    const [ox, oy] = dog ? [0.62, 0.95] : tod ? [0.64, 1.02] : [0.5, 1.32];
    out[id] = {
      id, row: h.row, s: h.s, held: by, side,
      x: h.x + side * h.d * ox, y: h.y + h.d * A * oy, d: h.d * (dog ? 0.8 : 0.66),
      st: 0, z: h.z + 50,
    };
  }
  cache.set(key, out);
  return out;
}

export const allLayouts = () => EVENTS.flatMap((ev) => ['h', 'v'].map((m) => layout(ev, m)));
