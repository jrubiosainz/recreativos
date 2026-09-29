// Foley and stingers for the platform: the pusher's glove, the doors, the PA
// chimes, the conductor's whistle, the departure board. Pure synthesis, so it
// works before (or without) any sample has loaded.
import { E, gain, filt } from './core.js';
import { note, hit, env, osc, burst, input } from './kit.js';
import { SONGS, nm } from './melody.js';

const bus = k => E.g.bus[k];
const T = (d = 0) => E.now + 0.004 + d;
const thump = (d, t, f0, f1, pk, len) => { const e = env(d, t, { pk, a: 0.002, d: len, len, r: 0.04 }); osc('sine', f0, t, e.end, e.g).frequency.exponentialRampToValueAtTime(f1, t + len * 0.8); };
const chirp = (d, t, f0, f1, pk, len, a = 0.004) => { const e = env(d, t, { pk, a, d: len, sus: 0.6, len, r: 0.02 }); osc('sine', f0, t, e.end, e.g).frequency.exponentialRampToValueAtTime(f1, t + len); };

export const Sfx = {
  scale: [74, 76, 78, 81, 83, 86, 88],
  // perfect pushes climb the notes of this station's own melody
  setStation(id) {
    const s = SONGS[id]; if (!s) return;
    const ms = new Set();
    for (const tok of s.mel.trim().split(/\s+/)) { const n = tok.split(':')[0]; if (n !== 'r') n.split('+').forEach(x => ms.add(nm(x))); }
    this.scale = [...ms].sort((a, b) => a - b);
  },

  push(q, combo = 1, p = 0) {
    if (!E.live) return;
    const d = input(bus('sfx'), p), t = T(), k = { perfect: 1, start: 0.9, good: 0.78, weak: 0.5 }[q] ?? 0.6;
    thump(d, t, 100, 52, 0.7 * k, 0.13);                                   // glove into a padded coat
    burst(d, t, { f: 1150, q: 0.9, pk: 0.22 * k, a: 0.002, d: 0.06, len: 0.06 });
    if (q === 'perfect') {
      const sc = this.scale, i = Math.max(0, combo - 1), m = sc[i % sc.length] + 12 * Math.min(1, Math.floor(i / sc.length));
      note('bell', bus('sfx'), t + 0.008, m, 0.3, 0.42 + Math.min(0.2, i * 0.03), p * 0.5);
      if (combo >= 3) note('glock', bus('sfx'), t + 0.05, m + 12, 0.25, 0.14, -p);
    } else if (q === 'good') note('mallet', bus('sfx'), t + 0.008, this.scale[0], 0.12, 0.26, p);
  },
  bump(p = 0) {                                                            // pushed him while he was coming at you
    if (!E.live) return;
    const d = input(bus('sfx'), p), t = T(), e = env(d, t, { pk: 0.28, a: 0.003, d: 0.38, len: 0.36, r: 0.06 });
    const o = osc('sine', 215, t, e.end, e.g), w = gain(E.ctx, 45); w.connect(o.frequency); osc('sine', 13, t, e.end, w);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.35);
    thump(d, t, 82, 45, 0.6, 0.12);
  },
  whiff(p = 0) { if (E.live) burst(input(bus('sfx'), p), T(), { f: 2600, to: 900, q: 1.1, pk: 0.13, a: 0.02, d: 0.12, len: 0.12, r: 0.04 }); },
  beckon(p = 0) {
    if (!E.live) return;
    const d = input(bus('sfx'), p), t = T();
    burst(d, t, { type: 'highpass', f: 2800, to: 5200, pk: 0.1, a: 0.01, d: 0.07, len: 0.07 });
    note('mallet', d, t + 0.03, 91, 0.1, 0.16);
  },
  // the turn tick: scheduled ahead on the audio clock so it lands on the turn itself;
  // pitch rises with his energy, so you can hear him getting closer to the door line
  tick(at, e = 0, p = 0) {
    if (!E.live) return null;
    const d = input(bus('sfx'), p), f = 820 * Math.pow(2, Math.min(1.2, e * 1.2));
    const g = env(d, at, { pk: 0.16, a: 0.001, d: 0.045, len: 0.045, r: 0.02 }), o = osc('sine', f, at, g.end, g.g);
    const g2 = env(d, at, { pk: 0.05, a: 0.0005, d: 0.012, len: 0.012 }), o2 = osc('triangle', f * 2.7, at, g2.end, g2.g);
    return { at, cancel() { if (E.now < at - 0.004) { try { o.stop(); o2.stop(); } catch { /* already done */ } } } };
  },
  squeak(e = 0.5, p = 0) {                                                 // coat leather against the crowd
    if (!E.live) return;
    const d = input(bus('sfx'), p), t = T(), g = env(d, t, { pk: 0.04 + 0.06 * e, a: 0.01, d: 0.12, len: 0.1, r: 0.03 });
    const o = osc('sine', 640, t, g.end, g.g), w = gain(E.ctx, 25); w.connect(o.frequency); osc('sine', 38, t, g.end, w);
    o.frequency.exponentialRampToValueAtTime(980 + 300 * e, t + 0.09);
  },
  board(big = false, p = 0) {                                              // squish in, pop, the car exhales
    if (!E.live) return;
    const d = input(bus('sfx'), p), t = T(), k = big ? 0.7 : 1;
    thump(d, t, 420 * k, 130 * k, 0.5, 0.2);
    burst(d, t, { type: 'lowpass', f: 1400, to: 300, pk: 0.3, a: 0.004, d: 0.18, len: 0.18 });
    chirp(d, t + 0.05, 1500 / k, 2300 / k, 0.15, 0.05, 0.001);
    burst(d, t + 0.06, { type: 'highpass', f: 1300, pk: 0.07, a: 0.03, d: 0.3, len: 0.3, r: 0.1 });
  },
  token(fill = 1) { if (E.live) note('glock', bus('ui'), T(), 84 + Math.min(12, Math.round(fill * 5)), 0.1, 0.22); },
  incident(kind) {
    if (!E.live) return;
    const d = bus('sfx'), t = T();
    if (kind === 'cake') { burst(d, t, { type: 'lowpass', f: 1800, to: 200, pk: 0.45, a: 0.002, d: 0.25, len: 0.25 }); thump(d, t, 300, 70, 0.4, 0.2); }
    note('brass', d, t + 0.05, 43, 0.5, 0.7); note('brass', d, t + 0.05, 49, 0.5, 0.5); hit('timp', d, t + 0.05, 0.8);
  },
  giveup(p = 0) { if (E.live) chirp(input(bus('sfx'), p), T(), 520, 240, 0.1, 0.45, 0.02); },
  steps(dur = 1.2, p0 = -0.9, p1 = 0) {                                    // a latecomer sprinting down the platform
    if (!E.live) return;
    const n = Math.max(2, Math.round(dur * 7.5)), t = T();
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      burst(input(bus('sfx'), p0 + (p1 - p0) * k), t + (i * dur) / n + (i % 2) * 0.012, { type: 'lowpass', f: 900 + (i % 2) * 220, pk: 0.08 + 0.1 * k, a: 0.002, d: 0.04, len: 0.04 });
    }
  },
  slam(p = 0) {                                                            // face meets closed door
    if (!E.live) return;
    const d = input(bus('sfx'), p), t = T();
    thump(d, t, 180, 95, 0.6, 0.2);
    burst(d, t, { f: 2600, q: 2, pk: 0.13, a: 0.002, d: 0.25, len: 0.25 });
    burst(d, t, { type: 'lowpass', f: 700, pk: 0.3, a: 0.002, d: 0.1, len: 0.1 });
  },

  // ---- the station
  paChime(up = true) {                                                     // four-tone call to attention, through the PA
    if (!E.live) return 0;
    const t = T(), ns = up ? [79, 83, 86, 91] : [91, 86, 83, 79];
    ns.forEach((m, i) => note('chime', bus('pa'), t + i * 0.27, m, i === 3 ? 0.9 : 0.3, 0.55));
    return 1.25;
  },
  doorChime(n = 1, p = 0.05) {                                             // the car's own door speaker
    if (!E.live) return;
    const d = input(bus('sfx'), p), hp = filt(E.ctx, 'highpass', 500, 0.7), t = T(); hp.connect(d);
    for (let i = 0; i < n; i++) { note('chime', hp, t + i * 0.62, 88, 0.25, 0.3); note('chime', hp, t + i * 0.62 + 0.24, 84, 0.35, 0.3); }
  },
  doorSlide(open = true, dur = 0.55, p = 0.05) {
    if (!E.live) return;
    const d = input(bus('sfx'), p), t = T();
    burst(d, t, { f: open ? 480 : 900, to: open ? 950 : 460, q: 1.3, pk: 0.13, a: 0.05, d: dur, sus: 0.7, len: dur, r: 0.08 });
    burst(d, t, { color: 'brown', type: 'lowpass', f: 220, pk: 0.45, a: 0.06, d: dur, sus: 0.8, len: dur, r: 0.1 });
    burst(d, t, { type: 'highpass', f: 3500, pk: 0.05, a: 0.005, d: 0.2, len: 0.12, r: 0.1 });
  },
  doorThunk(p = 0.05) {
    if (!E.live) return;
    const d = input(bus('sfx'), p), t = T();
    thump(d, t, 92, 48, 0.55, 0.18);
    burst(d, t, { f: 420, q: 1, pk: 0.2, a: 0.003, d: 0.12, len: 0.1 });
    hit('rim', d, t + 0.015, 0.4);
  },
  stall(p = 0.05) {                                                        // the doors meet a body and give
    if (!E.live) return;
    const d = input(bus('sfx'), p), t = T();
    thump(d, t, 125, 70, 0.45, 0.15);
    this.squeak(0.8, p);
    burst(d, t + 0.05, { type: 'highpass', f: 2200, pk: 0.08, a: 0.01, d: 0.3, len: 0.25, r: 0.1 });
  },
  reopen(p = 0.05) { this.doorSlide(true, 0.35, p); },
  airBrake(k = 1) {
    if (!E.live) return;
    const d = input(bus('sfx'), 0.15), t = T();
    burst(d, t, { type: 'highpass', f: 1600, q: 0.5, pk: 0.16 * k, a: 0.01, d: 1.1, len: 0.9, r: 0.3 });
    burst(d, t, { color: 'pink', f: 600, q: 0.7, pk: 0.1 * k, a: 0.01, d: 0.5, len: 0.4 });
    thump(d, t + 0.02, 70, 40, 0.3 * k, 0.2);
  },
  whistle(len = 0.6) {                                                     // conductor's pea whistle: breathy, warbling
    if (!E.live) return;
    const c = E.ctx, d = input(bus('sfx'), -0.35), t = T();
    const g = env(d, t, { pk: 0.1, a: 0.02, d: 0.3, sus: 0.85, len, r: 0.06 }), o = osc('sine', 2950, t, g.end, g.g);
    const w = gain(c, 170), lp = filt(c, 'lowpass', 90); lp.connect(w); w.connect(o.frequency); osc('square', 27, t, g.end, lp);
    burst(d, t, { f: 3000, q: 1.5, pk: 0.035, a: 0.02, d: len, sus: 0.8, len, r: 0.06 });
  },

  // ---- paper and UI
  flap(n = 6, gap = 0.035) {                                               // split-flap departure board
    if (!E.live) return;
    const t = T();
    for (let i = 0; i < n; i++) burst(bus('ui'), t + i * gap * (0.8 + Math.random() * 0.4), { f: 2600 + Math.random() * 900, q: 1.5, pk: 0.12, a: 0.0008, d: 0.018, len: 0.018, r: 0.01 });
  },
  stamp() {                                                                // eki stamp: press, rock, lift
    if (!E.live) return;
    const d = bus('ui'), t = T();
    thump(d, t, 140, 60, 0.7, 0.12);
    burst(d, t, { type: 'lowpass', f: 1200, pk: 0.25, a: 0.002, d: 0.08, len: 0.08 });
    burst(d, t + 0.11, { f: 3200, q: 0.8, pk: 0.06, a: 0.01, d: 0.1, len: 0.08 });
  },
  star(i = 0) { if (E.live) { const t = T(); note('bell', bus('ui'), t, [84, 88, 91][i % 3], 0.5, 0.4); note('glock', bus('ui'), t + 0.03, [96, 100, 103][i % 3], 0.4, 0.14); } },
  ui(kind = 'click') {
    if (!E.live) return;
    const d = bus('ui'), t = T();
    if (kind === 'hover') note('mallet', d, t, 96, 0.05, 0.08);
    else if (kind === 'back') chirp(d, t, 700, 420, 0.1, 0.1);
    else if (kind === 'toggle') { hit('rim', d, t, 0.5); note('mallet', d, t + 0.02, 88, 0.08, 0.14); }
    else if (kind === 'go') { note('chime', d, t, 84, 0.2, 0.3); note('chime', d, t + 0.12, 91, 0.4, 0.3); }
    else { this.flap(2, 0.03); note('mallet', d, t + 0.01, 91, 0.06, 0.14); }
  }
};
