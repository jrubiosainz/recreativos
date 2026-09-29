// Six trips across the station, one morning. Each trip is a route (route.js) and a crowd recipe:
// who comes toward you and how often (per metre you walk), who walks your way and how slowly, the
// train-arrival waves, the runners, and for the first trips a scripted handful that teaches.
import { mulberry32 } from './util.js';
import { OPEN } from './route.js';

// what each kind of person is like. dir: −1 comes toward you, +1 walks your way.
// see/go: time to collision when they notice you and when they commit to their step; rt: reaction in a dance
export const KIND = {
  polite: { dir: -1, v: [1.15, 1.38], see: [2.2, 2.6], go: [1.1, 1.4], rt: [0.3, 0.45], step: 0.3, habit: -1 },
  tourist: { dir: -1, v: [0.95, 1.1], see: [1.9, 2.2], go: [0.85, 1.0], rt: [0.4, 0.5], step: 0.36, habit: 1, bag: true },
  espejo: { dir: -1, v: [1.1, 1.28], see: [2.3, 2.7], go: [1.0, 1.2], rt: [0.28, 0.3], step: 0.3, habit: -1 },
  zombie: { dir: -1, v: [0.85, 1.05], phone: true, deaf: true },
  couple: { dir: -1, v: [1.0, 1.15], see: [2.2, 2.5], go: [1.2, 1.4], rt: [0.35, 0.45], step: 0.38, habit: -1, size: 2 },
  group: { dir: -1, v: [1.1, 1.25], size: 3, deaf: false },
  // your way
  slow: { dir: 1, v: [0.8, 1.08], askT: 0.35, step: 0.34 },
  granny: { dir: 1, v: [0.5, 0.6], askT: 1.15, step: 0.6, trolley: true },
  zombieCo: { dir: 1, v: [0.75, 0.95], phone: true, deaf: true },
  groupCo: { dir: 1, v: [0.92, 1.02], size: 3, askT: 0.5, step: 0.4 },
  stander: { dir: 1, v: [0, 0], askT: 0.4, step: 0.36 },
  runner: { dir: 1, v: [3.0, 3.4], step: 0.2 },
};

const C = (len) => ({ type: 'corridor', len });
export const LEVELS = [
  {
    id: 'transbordo', n: 1, clock: [8, 2, 20], dep: 52, par: 2, margin: 8, start: 4,
    segs: [C(62)],
    on: { rate: 0.14, from: 20, kinds: { polite: 1 } },
    co: { rate: 0.08, from: 36, kinds: { slow: 1 } },
    script: [
      { at: 6, kind: 'polite', lane: 'you', habit: -1 },
      { at: 12.5, kind: 'polite', lane: 'you', habit: 1 },
      { catch: 17, kind: 'slow', lane: 'you', v: 0.85 },
      { catch: 29, kind: 'slow', lane: 4, v: 0.85 }, { catch: 29.2, kind: 'slow', lane: 5, v: 0.9 },
      { at: 30.5, kind: 'polite', lane: 2 }, { at: 31.5, kind: 'polite', lane: 3 }, { at: 33, kind: 'polite', lane: 1 },
    ],
    intro: ['polite', 'slow', 'ask'],
  },
  {
    id: 'vestibulo', n: 2, clock: [8, 5, 10], dep: 64, par: 3, margin: 8, start: 4,
    segs: [C(18), { type: 'hall', len: 44 }, C(18)],
    on: { rate: 0.19, from: 14, kinds: { polite: 0.62, zombie: 0.22, espejo: 0.16 } },
    co: { rate: 0.17, from: 8, kinds: { slow: 0.6, zombieCo: 0.4 } },
    waves: [{ at: 38, n: 12, span: 9, kinds: { polite: 0.8, zombie: 0.2 } }],
    script: [{ at: 8, kind: 'zombie', lane: 'you' }, { catch: 14, kind: 'slow', lane: 'you', v: 0.9, stay: true }, { at: 22, kind: 'espejo', lane: 'you' }, { catch: 48, kind: 'zombieCo', lane: 'you', v: 0.82, stay: true }],
    intro: ['zombie', 'espejo', 'wave'],
  },
  {
    id: 'tornos', n: 3, clock: [8, 8, 40], dep: 66, par: 2, margin: 8, start: 4,
    segs: [
      { type: 'hall', len: 22, gates: { at: 19, lanes: ['out', 'out', 'in', 'in', 'out', 'in', 'in'] } },
      C(26), { type: 'narrow', len: 10 }, C(24),
    ],
    on: { rate: 0.21, from: 8, kinds: { polite: 0.55, tourist: 0.3, zombie: 0.15 } },
    co: { rate: 0.14, from: 6, kinds: { slow: 0.5, granny: 0.25, zombieCo: 0.25 } },
    script: [{ catch: 30, kind: 'granny', lane: 'you' }, { at: 38, kind: 'tourist', lane: 'you' }],
    intro: ['gate', 'granny', 'tourist'],
  },
  {
    id: 'escaleras', n: 4, clock: [8, 11, 5], dep: 70, par: 3, margin: 9, start: 4,
    segs: [C(16), { type: 'stairs', len: 14 }, C(18), { type: 'stairs', len: 12 }, C(18)],
    on: { rate: 0.2, from: 8, kinds: { polite: 0.5, couple: 0.25, zombie: 0.1, espejo: 0.15 } },
    co: { rate: 0.13, from: 6, kinds: { slow: 0.6, zombieCo: 0.2, groupCo: 0.2 } },
    script: [{ at: 9, kind: 'couple', lane: 'you' }, { catch: 34, kind: 'slow', lane: 'you', v: 0.85, stay: true }],
    intro: ['couple', 'stairs', 'groupCo'],
  },
  {
    id: 'anden', n: 5, clock: [8, 14, 30], dep: 76, par: 5, margin: 10, start: 4,
    segs: [{ type: 'platform', len: 88, every: [9, 8, 5] }],
    on: { rate: 0.22, from: 8, kinds: { polite: 0.45, group: 0.18, couple: 0.12, zombie: 0.15, espejo: 0.1 } },
    co: { rate: 0.14, from: 6, kinds: { slow: 0.45, groupCo: 0.25, stander: 0.3 } },
    runners: [18, 44, 68],
    script: [{ at: 10, kind: 'group', lane: 'you' }],
    intro: ['group', 'runner'],
  },
  {
    id: 'punta', n: 6, clock: [8, 17, 45], dep: 90, par: 7, margin: 9, start: 4,
    segs: [
      C(18), { type: 'hall', len: 20, gates: { at: 14, lanes: ['in', 'out', 'in', 'out', 'in', 'in', 'out'] } },
      C(14), { type: 'stairs', len: 12 }, { type: 'platform', len: 40, every: [6, 8, 5] },
    ],
    on: { rate: 0.25, from: 6, kinds: { polite: 0.42, tourist: 0.12, espejo: 0.1, zombie: 0.14, couple: 0.12, group: 0.1 } },
    co: { rate: 0.15, from: 6, kinds: { slow: 0.4, granny: 0.12, zombieCo: 0.18, groupCo: 0.15, stander: 0.15 } },
    waves: [{ at: 34, n: 13, span: 11 }, { at: 82, n: 11, span: 9 }],
    runners: [28, 72],
    script: [{ catch: 70, kind: 'slow', lane: 'you', v: 0.8, stay: true }],
    intro: [],
  },
];

const wpick = (rng, w) => {
  const e = Object.entries(w), tot = e.reduce((a, [, v]) => a + v, 0);
  let r = rng() * tot;
  for (const [k, v] of e) { r -= v; if (r <= 0) return k; }
  return e[e.length - 1][0];
};
const band = (lv, z) => {
  let z0 = 0;
  for (const s of lv.segs) { if (z < z0 + s.len) return s.open || OPEN[s.type]; z0 += s.len; }
  const s = lv.segs[lv.segs.length - 1]; return s.open || OPEN[s.type];
};
export const routeLen = (lv) => lv.segs.reduce((a, s) => a + s.len, 0);

// oncoming people crowd the left of the corridor (they keep to their right); your way, the right
export function laneWeights(b, dir) {
  const out = [];
  for (let l = b[0]; l <= b[1]; l++) { const r = b[1] === b[0] ? 0.5 : (l - b[0]) / (b[1] - b[0]); out.push([l, dir < 0 ? 1.7 - 1.3 * r : 0.4 + 1.3 * r]); }
  return out;
}
export function pickLane(rng, b, dir, size = 1) {
  const w = laneWeights([b[0], b[1] - (size - 1)], dir);
  const tot = w.reduce((a, [, v]) => a + v, 0);
  let r = rng() * tot;
  for (const [l, v] of w) { r -= v; if (r <= 0) return l; }
  return w[w.length - 1][0];
}

// The crowd for one play: `on` (toward you, by the point of your walk where you should meet them),
// `co` (your way, placed at the start so that you catch up with them where planned), `runners`.
export function populate(lv, seed) {
  const rng = mulberry32(seed ^ 0x5e11a), L = routeLen(lv), on = [], co = [], runners = [];
  const params = (kind, o = {}) => {
    const K = KIND[kind], r = (a) => (a ? a[0] + (a[1] - a[0]) * rng() : 0);
    return { kind, v: o.v ?? r(K.v), see: r(K.see), go: r(K.go), rt: r(K.rt), habit: o.habit ?? (K.habit != null ? (rng() < 0.81 ? K.habit : -K.habit) : 0), look: (rng() * 1e9) | 0 };
  };
  for (const s of lv.script || []) {
    if (s.at != null) on.push({ meet: s.at, lane: s.lane, ...params(s.kind, s), script: true, stay: !!s.stay });
    else co.push({ catch: s.catch, lane: s.lane, ...params(s.kind, s), script: true, stay: !!s.stay });
  }
  const end = L - 3;
  if (lv.on) for (let z = lv.on.from; z < end;) {
    const kind = wpick(rng, lv.on.kinds);
    on.push({ meet: z, lane: 'flow', ...params(kind) });
    z += (0.45 + rng() * 1.1) / lv.on.rate;
  }
  for (const w of lv.waves || []) {
    for (let i = 0; i < w.n; i++) on.push({ meet: w.at + (i / w.n) * w.span + rng() * 0.6, lane: 'flow', wave: true, ...params(wpick(rng, w.kinds || lv.on.kinds)) });
  }
  if (lv.co) for (let z = lv.co.from; z < end - 6;) {
    const kind = wpick(rng, lv.co.kinds);
    co.push({ catch: z, lane: 'flow', ...params(kind) });
    z += (0.5 + rng()) / lv.co.rate;
  }
  for (const at of lv.runners || []) runners.push({ at, ...params('runner') });
  on.sort((a, b) => a.meet - b.meet);
  // your way: where they stand at the start so that you reach them at `catch`. Only on a platform do people
  // stand still waiting, and never in the mouth of a row of turnstiles
  const segAt = (z) => { let z0 = 0; for (const s of lv.segs) { if (z < z0 + s.len) return { s, z0 }; z0 += s.len; } return { s: lv.segs[lv.segs.length - 1], z0: z0 - lv.segs[lv.segs.length - 1].len }; };
  for (const c of co) {
    if (c.kind === 'stander') {
      const { s, z0 } = segAt(c.catch);
      if (s.type !== 'platform' && s.type !== 'hall') Object.assign(c, params('slow'), { catch: c.catch, lane: c.lane });
      else if (s.gates && Math.abs(c.catch - (z0 + s.gates.at)) < 3.5) c.catch = z0 + s.gates.at + 3.5 + rng() * 2;
    }
    c.z0 = Math.max(3.2, c.catch * (1 - c.v / 1.5));
    if (c.lane === 'flow') c.lane = pickLane(rng, band(lv, c.z0), 1, KIND[c.kind].size || 1);
    else if (c.lane === 'you') c.lane = lv.start;
  }
  // nobody starts on top of anybody else
  co.sort((a, b) => a.z0 - b.z0);
  const placed = [];
  const co2 = co.filter((c) => {
    const size = KIND[c.kind].size || 1, b = band(lv, c.z0);
    for (let tries = 0; tries < 6; tries++) {
      const clash = placed.some((p) => Math.abs(p.z0 - c.z0) < 1.6 && p.lane < c.lane + size && c.lane < p.lane + p.size);
      if (!clash && c.lane >= b[0] && c.lane + size - 1 <= b[1]) { placed.push({ z0: c.z0, lane: c.lane, size }); return true; }
      if (c.script) { c.z0 += 1.7; continue; }
      c.lane = pickLane(rng, b, 1, size);
    }
    return false;
  });
  return { on, co: co2, runners, rng: mulberry32(seed ^ 0xbeef) };
}
