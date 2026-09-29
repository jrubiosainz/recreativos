// The six stadiums. A ring is written as its sections, clockwise from the centre of the near stand:
//   F fan · k kids · O old · U ultras · E empty seats · s stairs (1-col gap) · G gap (tunnel, press box,
//   camera deck) · V the palco (VIPs) · A away fans · K the kiss-cam couple · Z asleep · B bocadillo
// `n` columns each; `:f` overrides the fill (share of seats taken). Every level is short and ends on the
// referee's whistle; the goal is laps of ONE wave (a rescue keeps its count).
import { K } from './sim.js';

const L = { F: K.fan, k: K.kid, O: K.old, U: K.ultra, E: K.empty, s: K.gap, G: K.gap, V: K.vip, A: K.away, K: K.kiss, Z: K.sleep, B: K.bocata };

export const LEVELS = [
  {
    id: 'amistoso', n: 1, name: { es: 'EL AMISTOSO', en: 'THE FRIENDLY' }, rows: 6, time: 45, goal: 1, feat: 'clockwise',
    capacity: 3000, min: [80, 90], weather: 'sun', teach: ['aim', 'air', 'sweep', 'still'],
    ring: 'F24 s1 F24 s1 F24 s1 F24 s1 F24 s1 F24 s1 F24 s1 F24 s1',
    cam: 12,
  },
  {
    id: 'lluvia', n: 2, name: { es: 'LLUVIA', en: 'RAIN' }, rows: 7, time: 60, goal: 2, feat: 'wake',
    capacity: 18000, min: [75, 90], weather: 'rain', teach: ['sleep', 'rescue', 'tired'],
    ring: 'F30 s1 F14 Z8 F10 s1 F30 s1 F20 E6 F10 s1 F18 Z8 F12 s1 F30 s1 F16 Z8 F8 s1 F12',
    cam: 15,
  },
  {
    id: 'palco', n: 3, name: { es: 'EL PALCO', en: 'THE DIRECTORS’ BOX' }, rows: 8, time: 60, goal: 2, feat: 'palco',
    capacity: 35000, min: [70, 90], weather: 'sun', teach: ['vip', 'gap'],
    ring: 'F20 V12 F20 s1 F30 s1 F34 s1 F30 G12 F30 s1 F34 s1 F30 s1 F14',
    cam: 5,
  },
  {
    id: 'visitante', n: 4, name: { es: 'LA VISITANTE', en: 'AWAY END' }, rows: 8, time: 65, goal: 2, feat: 'jump',
    capacity: 42000, min: [70, 90], weather: 'dusk', teach: ['away', 'kiss', 'two'],
    ring: 'F22 K1 F13 s1 F36 s1 F20 B4 F12 s1 G2 A34 G2 s1 F36 s1 F36 s1 F36 s1 F22 V8 F12',
    cam: 20,
  },
  {
    id: 'derbi', n: 5, name: { es: 'EL DERBI', en: 'THE DERBY' }, rows: 9, time: 90, goal: 3, feat: 'nocut',
    capacity: 60000, min: [65, 90], weather: 'night', teach: ['replay', 'ultras', 'cut'],
    ring: 'F30 V10 F30 s1 F20 O16 F10 G10 U44 G10 F30 s1 F34 s1 F30 G10 F16 Z8 F20 s1 F20',
    cam: 8, replays: [[30, 4], [62, 4]],
  },
  {
    id: 'final', n: 6, name: { es: 'LA FINAL', en: 'THE FINAL' }, rows: 10, time: 115, goal: 4, feat: 'kiss',
    capacity: 80000, min: [60, 90], weather: 'night', heal: 34, teach: ['alive'],
    ring: 'F26 V14 F26 s1 F30 K1 F14 s1 F24 G12 U40 G12 F30 s1 F30 B4 F10 s1 F24 G2 A40 G2 F24 s1 F20 Z8 F14 s1 F12',
    cam: 6, replays: [[40, 4], [80, 4]],
  },
];

export function parse(level) {
  const kinds = [], fills = [], secs = [];
  for (const tok of level.ring.trim().split(/\s+/)) {
    const m = /^([A-Za-z])(\d+)(?::([\d.]+))?$/.exec(tok);
    if (!m) throw new Error(`bad ring token ${tok} in ${level.id}`);
    const k = L[m[1]], n = +m[2];
    if (k == null) throw new Error(`bad kind ${m[1]} in ${level.id}`);
    secs.push({ k, ch: m[1], i0: kinds.length, n });
    for (let j = 0; j < n; j++) { kinds.push(k); fills.push(m[3] != null ? +m[3] : -1); }
  }
  const C = kinds.length, kind = new Uint8Array(C), fill = new Float32Array(C);
  // seats taken: the kind's default, a little uneven, never above full
  let h = 0x2545f491 ^ C;
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) ^ (h + 0x6d2b79f5)) >>> 0) / 4294967296;
  const DEF = { [K.fan]: 0.92, [K.kid]: 0.86, [K.old]: 0.9, [K.ultra]: 1, [K.empty]: 0.14, [K.gap]: 0, [K.vip]: 0.7, [K.away]: 1, [K.kiss]: 0.9, [K.sleep]: 0.9, [K.bocata]: 0.9 };
  for (let i = 0; i < C; i++) {
    kind[i] = kinds[i];
    const base = fills[i] >= 0 ? fills[i] : DEF[kinds[i]];
    fill[i] = base >= 0.99 || base === 0 ? base : Math.min(1, base * (0.94 + rnd() * 0.12));
  }
  return { C, kind, fill, secs };
}

for (const lv of LEVELS) { const r = parse(lv); lv.C = r.C; lv.scale = lv.capacity / (r.C * lv.rows * 0.9); }
