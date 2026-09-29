// Your own mouth and hands: every noise the sim charges you for, synthesised live so no two
// crunches are alike. A crunch is a cloud of brittle grains (bandpassed noise ticks) over a jaw
// thump; snacks differ in how many grains, how bright, how long and what rings. The level L is
// the sim's dB at 1 m, mapped exactly as the reel maps the film, so a 62 dB crunch sits against
// a 94 dB explosion the way the sim says it does. You hear yourself from inside your own head:
// a crunch someone heard comes out dry and crisp, one the film swallowed comes out muffled.
import { E, db, gain, filt, chain } from './core.js';
import { env, burst, sweep, osc } from './kit.js';
import { amp } from './reel.js';

const R = () => Math.random();
// one brittle grain: a noise tick through a narrow band
const grain = (dest, t, f, pk, len = 0.006, q = 1.4) => burst(dest, t, { f, q, pk, a: 0.0005, d: len, len: len * 0.7, r: len * 0.6 });

// per snack: grains [count, spread s], their band, a jaw thump (Hz), a crack, a squeak or a ring (ice)
const SN = {
  palomitas: { n: [5, 0.07], f: [1100, 2600], q: 1.2, thump: 170, squeak: 1500 },
  nachos: { n: [9, 0.11], f: [1800, 5200], q: 1.5, thump: 150, crack: 0.9 },
  patatas: { n: [14, 0.09], f: [2600, 7200], q: 1.6, thump: 160, crack: 1 },
  kikos: { n: [6, 0.1], f: [700, 2300], q: 1.1, thump: 110, crack: 0.6 },
  hielo: { n: [7, 0.12], f: [1500, 4200], q: 1.3, thump: 130, crack: 1.2, ring: [2900, 4300] },
};
// measured loudness of each voice at gain 1 above the reel's UNIT (tools/audio_test.mjs me)
export const CAL = { palomitas: 3.9, nachos: 7.1, patatas: 9, kikos: 3.6, hielo: 7.9, caramelo: 6.7, rustle: 1.4, cough: 14.2 };

// one bite (i = 0) or chew (i > 0) of a mouthful n long, softened by `soak` dB of saliva
function crunch(dest, t, s, { i = 0, n = 4, soak = 0 }) {
  const P = SN[s], wear = i / Math.max(1, n - 1), soft = Math.min(1, soak / 10);
  const count = Math.max(2, Math.round(P.n[0] * (1 - 0.45 * wear) * (1 - 0.5 * soft)) + (i ? 0 : 2));
  const top = P.f[1] * (1 - 0.3 * wear) * (1 - 0.35 * soft), spread = P.n[1] * (i ? 1 : 0.8);
  burst(dest, t, { color: 'brown', type: 'lowpass', f: P.thump * 2.2, q: 0.8, pk: 0.5, a: 0.002, d: 0.04, len: 0.03, r: 0.03 });   // the jaw
  if (P.crack && !soft) burst(dest, t + 0.003, { type: 'highpass', f: 1800, q: 0.7, pk: 0.35 * P.crack * (1 - 0.5 * wear), a: 0.0004, d: 0.004, len: 0.003, r: 0.004 });
  for (let k = 0; k < count; k++) {
    const u = Math.pow(R(), 1.6), f = P.f[0] + (top - P.f[0]) * R();
    grain(dest, t + 0.004 + u * spread, f, (0.35 + 0.5 * R()) * (1 - 0.6 * u), 0.004 + 0.008 * R(), P.q);
  }
  if (P.squeak && !soft) sweep(dest, t + 0.01, P.squeak * (1 + 0.3 * R()), P.squeak * 0.8, { pk: 0.05, a: 0.004, d: 0.03, len: 0.03 });   // popcorn squeaks like foam
  if (P.ring && !i) for (const f of P.ring) sweep(dest, t + 0.004, f * (0.95 + 0.1 * R()), f * 0.99, { pk: 0.07, a: 0.0006, d: 0.08, len: 0.07, r: 0.05 });
  burst(dest, t + 0.02, { color: 'pink', f: 700, q: 0.8, pk: 0.12 * (1 - wear), a: 0.01, d: 0.05, len: 0.05 * (1 + soft), r: 0.04 });   // the mouthful moving
}
// cellophane: three squeezes of a fist of tiny crackles
function wrap(dest, t) {
  for (let s = 0; s < 3; s++) {
    const t0 = t + s * 0.085 + R() * 0.02;
    for (let k = 0; k < 10; k++) burst(dest, t0 + R() * 0.07, { type: 'highpass', f: 2600 + R() * 3600, q: 0.9, pk: 0.12 + 0.2 * R(), a: 0.0004, d: 0.004, len: 0.003, r: 0.004 });
    burst(dest, t0, { f: 4800, q: 0.7, pk: 0.05, a: 0.01, d: 0.05, len: 0.05, r: 0.03 });
  }
}
// a hand in a crisp packet (or a paper cup, a cardboard tray: quieter, duller)
function rustle(dest, t, bag = true) {
  const n = bag ? 16 : 6, span = bag ? 0.32 : 0.2;
  for (let k = 0; k < n; k++) burst(dest, t + R() * span, { type: bag ? 'highpass' : 'bandpass', f: (bag ? 2200 : 1400) + R() * 3000, q: 0.8, pk: (bag ? 0.16 : 0.07) * (0.4 + R()), a: 0.001, d: 0.012, len: 0.01, r: 0.01 });
  burst(dest, t, { color: 'pink', f: bag ? 3200 : 1800, q: 0.5, pk: bag ? 0.06 : 0.03, a: 0.04, d: span, len: span * 0.8, r: 0.06 });
}

export const Me = {
  // a noise the sim charged: L dB, heard or swallowed by the film
  noise(kind, L, { snack, heard, i, n, soak, delay = 0 } = {}) {
    if (!E.live) return;
    const c = E.ctx, t = E.now + delay, key = kind === 'wrap' ? 'caramelo' : kind === 'rustle' ? 'rustle' : kind === 'cough' ? 'cough' : snack;
    const out = gain(c, amp(L) * db(-(CAL[key] ?? 0)));
    out.connect(heard ? E.g.bus.me : E.g.muffleIn);
    if (kind === 'cough') { const k = 1 + Math.floor(Math.random() * 3); return E.play('x_cough' + k, { dest: out }); }
    if (kind === 'wrap') wrap(out, t);
    else if (kind === 'rustle') rustle(out, t, true);
    else crunch(out, t, snack, { i, n, soak });
    E.later(() => out.disconnect(), 1500 + delay * 1000);
  },
  // quiet feedback that costs nothing: reaching in, swallowing, a gulp gone wrong
  fetch(snack) {
    if (!E.live || snack === 'patatas') return;
    const out = gain(E.ctx, 0.08); out.connect(E.g.muffleIn); rustle(out, E.now, snack === 'caramelo');
  },
  swallow() {
    if (!E.live) return;
    const out = gain(E.ctx, 0.25); out.connect(E.g.bus.me);
    sweep(out, E.now, 320, 140, { pk: 0.25, a: 0.006, d: 0.05, len: 0.05, r: 0.03 });
  },
  bolt(n) {
    if (!E.live) return;
    const out = gain(E.ctx, 0.3 + 0.2 * n); out.connect(E.g.bus.me);
    burst(out, E.now, { color: 'pink', type: 'lowpass', f: 900, q: 1.5, pk: 0.4, a: 0.004, d: 0.05, len: 0.04, r: 0.03 });
    sweep(out, E.now + 0.01, 420 + 90 * n, 260, { pk: 0.12, a: 0.004, d: 0.04, len: 0.04 });
  },
  // offline calibration: every voice at gain 1 (tools/audio_test.html 'me')
  _voices: { crunch, wrap, rustle, SN },
};
export { crunch, wrap, rustle };
