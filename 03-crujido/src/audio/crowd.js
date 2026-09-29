// The audience: a full house laughing, gasping, sighing and clapping together. A handful of
// recorded reactions (assets/audio/fx/x_*) are scattered over the seats with seeded offsets,
// pitch and distance, and procedural hands, whistles and breath fill in the hundred people no
// single recording has. Same contract as world.js: dest already follows the cue's loudness curve.
import { gain, filt, pan, chain } from './core.js';
import { osc, noise, env, burst, hit } from './kit.js';
import { loop, peakOf } from './world.js';

const set = (p, n) => Array.from({ length: n }, (_, i) => p + (i + 1));
const LAUGH = set('x_laugh', 6), AWW = set('x_aww', 5), SCREAM = set('x_scream', 5), BRAVO = set('x_bravo', 4);
const lerp = (a, b, u) => a + (b - a) * u;

// a shuffled deck: every clip is dealt once before any repeats, and never twice in a row
function deck(x, ids) {
  let d = [], last = null;
  return () => {
    if (!d.length) {
      d = ids.slice();
      for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(x.rnd() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
      if (d.length > 1 && d[d.length - 1] === last) [d[0], d[d.length - 1]] = [d[d.length - 1], d[0]];
    }
    return (last = d.pop());
  };
}

// one recorded reaction from a seat somewhere in the room: far voices are quieter and darker
function seat(x, dest, id, t, { g = 1, rate = 1, p = 0, far = 0 } = {}) {
  const b = x.buf(id); if (!b || t >= x.t1) return;
  const c = x.ctx, s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
  chain(s, filt(c, 'lowpass', lerp(13000, 2600, far), 0.5), gain(c, g * lerp(1, 0.35, far)), pan(c, p), dest);
  s.start(t); s.stop(Math.min(x.t1, t + b.duration / rate) + 0.02);
}

// n reactions dealt over the room; when(u, i) turns a uniform draw into a start time
function crowd(x, dest, ids, n, when, { rate = [0.9, 1.1], g = [0.5, 1], far = [0, 1] } = {}) {
  const next = deck(x, ids), k = 1 / Math.sqrt(n);
  for (let i = 0; i < n; i++) {
    const t = when(x.rnd(), i), o = { rate: lerp(rate[0], rate[1], x.rnd()), p: x.rnd() * 1.8 - 0.9, far: lerp(far[0], far[1], x.rnd()), g: lerp(g[0], g[1], x.rnd()) * k };
    seat(x, dest, next(), t, o);
  }
}

// the rest of the house, blurred into breath: a few vowel formants of pink noise
function murmur(x, dest, g, formants) {
  const c = x.ctx;
  formants.forEach(([f, q, w], i) => {
    const b = filt(c, 'bandpass', f * lerp(0.95, 1.05, x.rnd()), q), gg = gain(c, g * w);
    chain(b, gg, pan(c, (i - 1) * 0.5), dest); noise('pink', x.t0, x.t1 + 0.05, b);
  });
}

// a two-finger whistle from the back rows: a rising "fweet!" that holds, wavers and drops
function whistle(x, dest, t, p) {
  const c = x.ctx, f0 = 2100 + x.rnd() * 700, f1 = f0 * (1.16 + x.rnd() * 0.1), len = 0.45 + x.rnd() * 0.4;
  if (t + len >= x.t1) return;
  const pn = pan(c, p); pn.connect(dest);
  const e = env(pn, t, { pk: 0.1, a: 0.03, d: len, sus: 0.8, len, r: 0.07 });
  const o = osc('sine', f0, t, e.end, e.g), F = o.frequency;
  F.exponentialRampToValueAtTime(f1, t + 0.09);
  F.linearRampToValueAtTime(f1 * 0.98, t + len - 0.04);
  F.exponentialRampToValueAtTime(f0 * 0.82, t + len + 0.12);
  chain(osc('sine', 5.5 + x.rnd() * 2, t, e.end), gain(c, f1 * 0.008), F);
  burst(pn, t, { color: 'white', f: f1, q: 5, pk: 0.025, a: 0.03, d: len, sus: 0.7, len, r: 0.07 });   // the breath around it
}

// ---------------------------------------------------------------- reactions
// relief after a scare: a burst everyone joins within a third of a second, then stragglers,
// embarrassed chuckles and a few people still giggling at their own scream
function laugh(cue, x) {
  const { dest, t0, len } = x, n = Math.round(Math.min(20, 8 + len * 4));
  crowd(x, dest, LAUGH, n, (u, i) => (i < n / 2 ? t0 + 0.04 + 0.3 * u * u : t0 + 0.2 + (len + 0.4) * Math.pow(u, 1.4)), { rate: [0.86, 1.12] });
  murmur(x, dest, 0.1, [[720, 3, 1], [1180, 3.5, 1], [2700, 1.6, 0.5]]);
}
// the kiss: a whole room melting at once, a round "aww" with a few late sighs
function aww(cue, x) {
  const { dest, t0 } = x, n = 12;
  crowd(x, dest, AWW, n, (u, i) => t0 + (i < 9 ? 0.35 * u : 0.3 + 0.6 * u), { rate: [0.95, 1.05] });
  murmur(x, dest, 0.08, [[620, 3, 1], [1000, 3, 1], [2500, 1.5, 0.4]]);
}
// the jump scare: screams inside 0.2 s (a reflex, not a decision), the room inhaling and jumping
// in its seats, a couple of seats creaking and somebody's popcorn going everywhere
function crowdscream(cue, x) {
  const { dest, t0 } = x, n = 14;
  crowd(x, dest, SCREAM, n, (u, i) => t0 + (i < 10 ? 0.02 + 0.16 * u * u : 0.18 + 0.5 * u), { rate: [0.9, 1.16] });
  burst(dest, t0, { color: 'pink', f: 1900, q: 0.6, pk: 0.3, a: 0.012, d: 0.25, len: 0.2, r: 0.18 });
  burst(dest, t0 + 0.05, { color: 'brown', type: 'lowpass', f: 240, q: 0.7, pk: 0.5, a: 0.004, d: 0.14, len: 0.1, r: 0.08 });
  for (let i = 0; i < 2; i++) burst(dest, t0 + 0.12 + x.rnd() * 0.3, { color: 'pink', f: 520 + x.rnd() * 200, to: 330, q: 7, pk: 0.12, a: 0.03, d: 0.2, len: 0.16, r: 0.06 });
  for (let i = 0; i < 12; i++) burst(dest, t0 + 0.25 + x.rnd() * 0.9, { f: 2400 + x.rnd() * 2600, q: 2, pk: 0.04 + 0.05 * x.rnd(), a: 0.0006, d: 0.012, len: 0.008, r: 0.01 });
}
// applause: a dense bed of hands, three pairs close to you that join one by one and slow down
// as it dies, and, for an ovation, more hands and a few whistles from the back
function applause(cue, x) {
  const { ctx: c, dest, t0, t1, len } = x, big = peakOf(cue) >= 78, tex = x.TEX.claps(c);
  const rates = big ? [0.93, 0.97, 1, 1.04, 1.09] : [0.95, 1, 1.06], k = 1 / Math.sqrt(rates.length);
  for (const r of rates) { const lp = filt(c, 'lowpass', 5200 + x.rnd() * 3000, 0.5); lp.connect(dest); loop(x, tex, lp, { rate: r, g: k }); }
  const end = Math.min(t1, cue.t + len + 24 / cue.rate);
  for (const [p, dt] of [[-0.55, 0.05], [0.35, 0.18], [0.8, 0.32]]) {
    const f = 1100 + x.rnd() * 700, per = 1 / (4.6 + x.rnd() * 1.2);
    for (let t = t0 + dt; t < end - 0.05;) {
      const late = Math.max(0, (t - (t0 + len)) / Math.max(0.3, end - t0 - len));
      hit('clap', dest, t, 0.55 * (1 - 0.6 * late), p, { f });
      t += per * (1 + 0.5 * late) * (0.92 + 0.16 * x.rnd());
    }
  }
  if (big) for (let i = 0; i < (len > 6 ? 3 : 2); i++) whistle(x, dest, t0 + 0.7 + x.rnd() * Math.max(0.5, len - 1.6), x.rnd() * 1.6 - 0.8);
}
// one shout of "¡Bravo!" over the ovation (a different voice each time), echoed from further back
function bravo(cue, x) {
  const { dest, t0 } = x, all = x.film.cues.filter((c) => c.k === 'bravo'), i = Math.max(0, all.indexOf(cue));
  seat(x, dest, BRAVO[i % 4], t0, { g: 1, rate: 0.98 + x.rnd() * 0.04, p: [-0.35, 0.45, -0.1, 0.25][i % 4], far: 0.1 });
  seat(x, dest, BRAVO[(i + 2) % 4], t0 + 0.2 + x.rnd() * 0.25, { g: 0.4, rate: 0.95 + x.rnd() * 0.08, p: x.rnd() * 1.6 - 0.8, far: 0.7 });
}

export const CROWD = { laugh, aww, crowdscream, applause, bravo };
