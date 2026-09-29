// PERDÓN, PERDÓN sound: the one import the game uses. Voices and the loudspeaker are recorded
// (assets/audio); everything else is synthesised here from src/audio/kit.js: the station's air and
// its crowd, your steps, the doors and the train, the ticket and the validator, and the rumba: a
// nylon-string guitar (plucked strings, Karplus–Strong), palmas and a cajón.
import { E, gain, filt, pan, chain, hold, db, mtof, softclip } from './audio/core.js';
import { note, hit, burst, sweep, env, osc, noise } from './audio/kit.js';

const B = (k) => E.g.bus[k];
const R = () => Math.random();
const U = (a, b) => a + (b - a) * R();
const cl = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
const out = (bus, p = 0, v = 1) => { const c = E.ctx, g = gain(c, v); if (p) chain(g, pan(c, cl(p)), B(bus)); else g.connect(B(bus)); return g; };
export const BEAT = 60 / 141;

// ---- the loudspeaker: a tinny horn high on the tiles ----
let paIn = null;
function paPath() {
  if (paIn && paIn.context === E.ctx) return paIn;
  const c = E.ctx; paIn = gain(c, 1);
  chain(paIn, filt(c, 'highpass', 420, 0.8), filt(c, 'peaking', 2100, 1.1, 5), filt(c, 'lowpass', 3700, 0.9), softclip(c, 1.6), gain(c, 0.8), B('pa'));
  return paIn;
}
function chime(t = E.now, notes = [79, 76], gap = 0.42) {
  const d = paPath();
  notes.forEach((m, i) => note('chime', d, t + i * gap, m, 1.1, 0.55));
}

// ---- the nylon guitar: one plucked string, rendered twice per pitch (so repeats differ) and kept ----
const KS = new Map();
function ksBuf(m) {
  const c = E.ctx, key = m * 2 + (R() < 0.5 ? 1 : 0); let e = KS.get(key);
  if (e && e.c === c) return e;
  const sr = c.sampleRate, f = mtof(m), N = Math.max(2, Math.floor(sr / f - 0.5)), t60 = m < 50 ? 2.6 : m < 62 ? 1.9 : 1.35;
  const len = Math.floor(sr * Math.min(2.4, t60 * 0.9)), b = c.createBuffer(1, len, sr), d = b.getChannelData(0);
  // the excitation: a flesh-and-nail pluck (softened noise) with the comb of a pluck an eighth up the string
  const x = new Float32Array(N), P = Math.max(1, Math.round(N * 0.13));
  let lp = 0;
  for (let i = 0; i < N; i++) { lp += 0.42 * (R() * 2 - 1 - lp); x[i] = lp; }
  for (let i = 0; i < N && i < len; i++) d[i] = x[i] - 0.85 * (i >= P ? x[i - P] : 0);
  const g = Math.pow(10, -3 / (t60 * f));
  for (let i = N; i < len; i++) d[i] = g * 0.5 * (d[i - N] + d[i - N - 1 < 0 ? 0 : i - N - 1]);
  let pk = 1e-6; for (let i = 0; i < Math.min(len, N * 6); i++) pk = Math.max(pk, Math.abs(d[i]));
  for (let i = 0; i < len; i++) d[i] *= 0.8 / pk;
  e = { c, b, rate: (f * (N + 0.5)) / sr };
  KS.set(key, e);
  return e;
}
// the guitar's box: two body modes and the softness of nylon
function body(dest, v = 1) {
  const c = E.ctx, g = gain(c, v);
  chain(g, filt(c, 'peaking', 105, 1.3, 5), filt(c, 'peaking', 225, 1.5, 3), filt(c, 'lowpass', 5200, 0.7), dest);
  return g;
}
function pluck(dest, t, m, v, len = 1.6) {
  const c = E.ctx, k = ksBuf(m), s = c.createBufferSource(), g = gain(c, 0);
  s.buffer = k.b; s.playbackRate.value = k.rate;
  g.gain.setValueAtTime(v, t);
  const end = Math.min(t + k.b.duration / k.rate, t + len + 0.25);
  if (len < k.b.duration) g.gain.setTargetAtTime(0, t + len, 0.05);
  chain(s, g, dest); s.start(t); s.stop(end);
}
const CH = { Am: [45, 52, 57, 60, 64], G: [43, 47, 50, 55, 59, 67], F: [41, 48, 53, 57, 60, 65], E: [40, 47, 52, 56, 59, 64], Dm: [50, 57, 62, 65] };
// a stroke across the strings: down (low to high) or up (just the top four); `len` < 0.2 is a muted chop
function strum(dest, t, ch, { dir = 1, v = 0.7, gap = 0.012, len = 1.4 } = {}) {
  const ms = dir > 0 ? CH[ch] : CH[ch].slice(-4).reverse();
  ms.forEach((m, i) => pluck(dest, t + i * gap * U(0.75, 1.25), m, v * (dir > 0 ? 1 : 0.7) * U(0.85, 1.1), len));
}
// the golpe: fingers slapped on the top, the strings choked under the palm
function golpe(dest, t, v = 0.8) {
  burst(dest, t, { type: 'lowpass', f: 900, q: 0.7, pk: 0.32 * v, a: 0.001, d: 0.035, len: 0.03, r: 0.02 });
  sweep(dest, t, 190, 110, { pk: 0.28 * v, a: 0.001, d: 0.05, len: 0.06, r: 0.02 });
  burst(dest, t + 0.002, { f: 2600, q: 1.2, pk: 0.05 * v, a: 0.001, d: 0.02, len: 0.02, r: 0.01 });
}
// rasgueado: four fingers flicked out one after the other, a fan of strokes
function rasgueado(dest, t, ch, v = 0.8, len = 1.8) {
  for (let i = 0; i < 4; i++) strum(dest, t + i * 0.034, ch, { dir: 1, v: v * (0.7 + i * 0.1), gap: 0.006, len: i === 3 ? len : 0.3 });
}
function cajon(dest, t, kind, v = 1) {
  if (kind === 'bass') {
    sweep(dest, t, 112, 54, { pk: 0.5 * v, a: 0.002, d: 0.16, len: 0.18, r: 0.06 });
    burst(dest, t, { type: 'lowpass', f: 420, q: 0.7, pk: 0.16 * v, a: 0.001, d: 0.05, len: 0.05, r: 0.03 });
  } else {
    burst(dest, t, { f: 2300, q: 0.8, pk: 0.26 * v, a: 0.001, d: 0.06, len: 0.05, r: 0.04 });
    burst(dest, t + 0.003, { type: 'highpass', f: 4300, q: 0.6, pk: 0.1 * v, a: 0.001, d: 0.12, len: 0.1, r: 0.05 });
    sweep(dest, t, 330, 210, { pk: 0.14 * v, a: 0.001, d: 0.04, len: 0.05, r: 0.02 });
  }
}
// palmas: a few pairs of hands around you, never quite together
function palmas(dest, t, v = 1, n = 3, sordas = false) {
  for (let i = 0; i < n; i++) hit('clap', dest, t + U(-0.008, 0.012), v * U(0.7, 1), U(-0.7, 0.7), { f: sordas ? U(700, 950) : U(1350, 2000) });
}

// the rumba you dance: two bars of 4/4 at 141, Am–G–F–E, and the E to finish on (8 beats = the dance)
function rumba(t = E.now) {
  const c = E.ctx, m = out('music', 0, 1), gt = body(m, 0.9), pc = gain(c, 0.9); pc.connect(m);
  const e8 = BEAT / 2, GT = ['D', 'D', 'G', 'U', 'D', 'U', 'G', 'U'], chords = ['Am', 'G', 'F', 'E'];
  for (let i = 0; i < 16; i++) {
    const tt = t + i * e8 + (i & 1 ? 0.012 : 0), ch = chords[i >> 2], s = GT[i & 7];
    if (s === 'G') { golpe(gt, tt, 0.9); strum(gt, tt + 0.004, ch, { dir: 1, v: 0.18, gap: 0.004, len: 0.07 }); }
    else strum(gt, tt, ch, { dir: s === 'D' ? 1 : -1, v: (i & 7) === 0 ? 0.85 : s === 'D' ? 0.62 : 0.5, len: e8 * (s === 'U' ? 1.6 : 2.2) });
    const k = i & 7;
    if (k === 0 || k === 3 || k === 4) cajon(pc, tt, 'bass', k === 0 ? 1 : 0.75);
    if (k === 2 || k === 6) { cajon(pc, tt, 'slap', 1); palmas(pc, tt, 0.9, 4); }
    if (k === 3 || k === 7) palmas(pc, tt, 0.35, 2, true);
  }
  const tf = t + 16 * e8;
  rasgueado(gt, tf - 0.1, 'E', 0.95, 2.2); cajon(pc, tf, 'bass', 1.1); palmas(pc, tf, 1, 5);
  E.duck(t, 16 * e8 + 1.2);
  E.later(() => { m.disconnect(); }, (16 * e8 + 4) * 1000);
}
// the dance's lead-in: the second «perdón» gets a couple of claps from someone; the third, the guitar
function danceClaps(t = E.now) { const d = out('music', 0, 0.8); palmas(d, t, 0.8, 2); palmas(d, t + BEAT, 0.8, 3); }
function llamada(t = E.now) {
  const g = body(out('music', 0, 0.9), 0.9);
  golpe(g, t, 0.9); strum(g, t + BEAT * 0.5, 'F', { dir: 1, v: 0.6, len: 0.3 }); rasgueado(g, t + BEAT, 'E', 0.8, 1.1);
}

// ---- you: rubber soles on tile, a quick shuffle to the side, collisions ----
function step(t = E.now, side = 1, v = 1) {
  const d = out('steps', side * 0.06, v);
  burst(d, t, { f: U(1500, 2100), q: 1.1, pk: 0.09, a: 0.001, d: 0.02, len: 0.018, r: 0.012 });
  sweep(d, t, 130, 70, { pk: 0.12, a: 0.002, d: 0.03, len: 0.035, r: 0.015 });
  burst(d, t + U(0.05, 0.07), { f: U(2400, 3000), q: 1.4, pk: 0.035, a: 0.001, d: 0.012, len: 0.01, r: 0.01 });
}
function sidestep(dir = 1, t = E.now) {
  const d = out('sfx', dir * 0.25, 1);
  burst(d, t, { color: 'pink', f: 1300, to: 2900, q: 0.9, pk: 0.07, a: 0.03, d: 0.06, sus: 0.3, len: 0.1, r: 0.05 });
  if (R() < 0.35) sweep(d, t + 0.05, 2100, 2600, { pk: 0.012, a: 0.005, d: 0.03, len: 0.05, r: 0.02 });
  step(t + 0.16, dir, 0.8);
}
function bump(bag = false, t = E.now) {
  const d = out('sfx', 0, 1);
  sweep(d, t, 140, 44, { pk: 0.5, a: 0.002, d: 0.1, len: 0.12, r: 0.05 });
  burst(d, t, { color: 'pink', type: 'lowpass', f: 1100, q: 0.6, pk: 0.22, a: 0.002, d: 0.08, len: 0.08, r: 0.05 });
  if (bag) { hit('wood', d, t + 0.02, 0.8); burst(d, t + 0.03, { f: 3000, q: 1.6, pk: 0.05, a: 0.001, d: 0.04, len: 0.04, r: 0.02 }); }
}
function brush(t = E.now) { burst(out('sfx', 0.1, 1), t, { color: 'pink', f: 1900, to: 1100, q: 0.9, pk: 0.07, a: 0.02, d: 0.08, len: 0.1, r: 0.05 }); }
function wall(t = E.now) { hit('wood', out('sfx', 0, 0.6), t, 0.45); }

// ---- the train ----
function warn(t = E.now) {
  // three falling notes from the loudspeaker, then the doors' own beeping
  chime(t, [83, 80, 76], 0.27);
  const d = chain(out('sfx', -0.2, 1), filt(E.ctx, 'lowpass', 5200, 0.7));
  for (let i = 0; i < 5; i++) sweep(d, t + 1.05 + i * 0.3, 2350, 2350, { pk: 0.045, a: 0.004, d: 0.1, len: 0.15, r: 0.02, type: 'square' });
}
function doors(t = E.now) {
  const d = out('sfx', -0.3, 1);
  burst(d, t, { color: 'white', type: 'highpass', f: 2600, q: 0.5, pk: 0.09, a: 0.02, d: 0.35, sus: 0.4, len: 0.45, r: 0.12 });
  sweep(d, t + 0.58, 96, 38, { pk: 0.45, a: 0.002, d: 0.16, len: 0.18, r: 0.06 });
  burst(d, t + 0.58, { type: 'lowpass', f: 520, q: 0.7, pk: 0.2, a: 0.001, d: 0.05, len: 0.05, r: 0.03 });
  burst(d, t + 0.61, { f: 1800, q: 2, pk: 0.05, a: 0.001, d: 0.015, len: 0.012, r: 0.01 });
}
function depart(t = E.now, quiet = false) {
  const c = E.ctx, v = quiet ? 0.55 : 1, d = out('sfx', -0.35, v), L = 5.5;
  // the traction motors: a rising whine with the gear steps of an inverter
  const mg = gain(c, 0), lp = filt(c, 'lowpass', 2200, 0.8); chain(lp, mg, d);
  mg.gain.setValueAtTime(0, t); mg.gain.linearRampToValueAtTime(0.05, t + 0.5); mg.gain.setValueAtTime(0.05, t + 2.6); mg.gain.linearRampToValueAtTime(0, t + L);
  for (const [k, w] of [[1, 'sawtooth'], [1.5, 'sine'], [2.01, 'sine']]) {
    const o = osc(w, 210 * k, t, t + L + 0.1, lp), F = o.frequency;
    F.linearRampToValueAtTime(610 * k, t + 1.5); F.setValueAtTime(420 * k, t + 1.52); F.linearRampToValueAtTime(760 * k, t + 3.1); F.setValueAtTime(560 * k, t + 3.12); F.linearRampToValueAtTime(880 * k, t + L);
  }
  // the weight of it: a rumble that swells and goes away up the tunnel
  const rl = filt(c, 'lowpass', 110, 0.7), rg = gain(c, 0); chain(rl, rg, d);
  rl.frequency.setValueAtTime(110, t); rl.frequency.linearRampToValueAtTime(340, t + 2.5); rl.frequency.linearRampToValueAtTime(160, t + L);
  rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(0.42, t + 1.2); rg.gain.linearRampToValueAtTime(0, t + L);
  noise('brown', t, t + L + 0.1, rl);
  // the wheels over the rail joints, closer together as it gathers speed
  for (let u = 0.55, gap = 0.62; u < L - 0.6; u += gap, gap = Math.max(0.13, gap * 0.84)) {
    const a = (1 - u / L) * 0.3;
    sweep(d, t + u, 80, 42, { pk: a, a: 0.002, d: 0.05, len: 0.05, r: 0.03 });
    sweep(d, t + u + 0.085, 76, 40, { pk: a * 0.8, a: 0.002, d: 0.05, len: 0.05, r: 0.03 });
  }
  burst(d, t + 1.2, { color: 'pink', type: 'highpass', f: 900, q: 0.5, pk: 0.05, a: 1.2, d: 1.4, sus: 0.3, len: 2.2, r: 1.2 });
}

// ---- the station's air: beds that loop, and things that happen now and then ----
const A = (p = 0) => { const c = E.ctx, g = gain(c, 1); chain(g, pan(c, cl(p)), Amb.master || B('amb')); return g; };
function far(dest, f = 1600, v = 0.5, room = 0.6) {
  const c = E.ctx, lp = filt(c, 'lowpass', f, 0.6), g = gain(c, v);
  chain(lp, g, dest); if (room) g.connect(gain(c, room)).connect(E.g.roomIn);
  return lp;
}
const EVT = {
  // other people's heels on the tiles, as many as there are people about
  heels(t) {
    const f = far(A(U(-0.9, 0.9)), U(3500, 7000), U(0.25, 0.7), 0.8);
    burst(f, t, { f: U(1700, 3200), q: 1.4, pk: 0.05, a: 0.001, d: 0.014, len: 0.012, r: 0.01 });
    if (R() < 0.5) sweep(f, t, 150, 80, { pk: 0.05, a: 0.002, d: 0.03, len: 0.03, r: 0.01 });
    return U(0.06, 0.4) / (0.25 + Amb.dens);
  },
  // a train on another line, behind the wall
  train(t) {
    const c = E.ctx, len = U(6.5, 8.5), o = A(U(-0.6, 0.6)), lp = filt(c, 'lowpass', 80, 0.7), g = gain(c, 0);
    chain(lp, g, o);
    lp.frequency.setValueAtTime(80, t); lp.frequency.linearRampToValueAtTime(420, t + len * 0.5); lp.frequency.linearRampToValueAtTime(90, t + len);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + len * 0.5); g.gain.linearRampToValueAtTime(0, t + len);
    noise('brown', t, t + len + 0.1, lp);
    for (let u = len * 0.25; u < len * 0.75; u += U(0.34, 0.4)) { const f = far(o, 400, 0.7, 0.5); sweep(f, t + u, 72, 40, { pk: 0.22, a: 0.002, d: 0.05, len: 0.05, r: 0.03 }); }
    return len + U(18, 40);
  },
  // the loudspeaker of another platform, too far to make out
  chime(t) { const f = far(A(U(-0.8, 0.8)), 1800, 0.3, 1.4); note('chime', f, t, 79, 1, 0.5); note('chime', f, t + 0.42, 76, 1.2, 0.5); return U(40, 75); },
  // a trolley's wheels, a dropped coin, a laugh: small things far down the corridor
  clack(t) { const f = far(A(U(-0.8, 0.8)), 2600, 0.4, 1); hit('wood', f, t, U(0.3, 0.6)); if (R() < 0.5) hit('rim', f, t + U(0.08, 0.2), 0.3); return U(6, 16); },
};
const Amb = {
  srcs: [], iv: 0, next: [], master: null, wet: null, dens: 0.4, mur: null,
  start() {
    this.stop(0.3);
    const c = E.ctx; if (!c) return;
    const t = E.now, m = gain(c, 0); m.connect(B('amb')); m.gain.setValueAtTime(0, t); m.gain.linearRampToValueAtTime(1, t + 1.2);
    this.master = m; this.srcs = [];
    const bed = (color, type, f, q, v) => {
      const s = c.createBufferSource(), g = gain(c, v); s.buffer = E.nz[color]; s.loop = true;
      chain(s, filt(c, type, f, q), g, m); s.start(t, R() * s.buffer.duration * 0.9); this.srcs.push(s); return g;
    };
    bed('brown', 'lowpass', 150, 0.6, 0.1);                                   // ventilation
    bed('white', 'highpass', 6500, 0.5, 0.003);                               // the fans' hiss
    this.mur = bed('pink', 'bandpass', 480, 0.8, 0.02);                       // the crowd's murmur
    const m2 = bed('pink', 'bandpass', 1150, 1.4, 0.006);
    this.mur2 = m2;
    this.density(this.dens, 0);
    this.next = [['heels', 0, 0.2], ['train', 6, 20], ['chime', 12, 30], ['clack', 3, 9]].map(([k, a, b]) => ({ k, at: t + U(a, b) }));
    this.iv = setInterval(() => this.tick(), 120); this.tick();
  },
  density(d, f = 1.5) {
    this.dens = cl(d, 0, 1);
    if (!this.mur || !E.ctx) return;
    const t = E.now;
    glideTo(this.mur.gain, 0.012 + 0.05 * this.dens, t, f); glideTo(this.mur2.gain, 0.003 + 0.014 * this.dens, t, f);
  },
  tick() {
    const c = E.ctx; if (!c || c.state !== 'running' || !this.master) return;
    const t = E.now;
    for (const n of this.next) while (n.at < t + 0.3) { const at = Math.max(t + 0.02, n.at); n.at = at + EVT[n.k](at); }
  },
  stop(f = 0.6) {
    clearInterval(this.iv); this.iv = 0;
    const m = this.master, s = this.srcs; this.master = null; this.srcs = []; this.mur = null;
    if (!m || !E.ctx) return;
    const t = E.now; hold(m.gain, t); m.gain.linearRampToValueAtTime(0, t + f);
    E.later(() => { for (const x of s) try { x.stop(); } catch { /* done */ } m.disconnect(); }, f * 1000 + 2500);
  },
};
function glideTo(p, v, t, f) { hold(p, t); p.linearRampToValueAtTime(v, t + Math.max(0.02, f)); }

// ---- the busker two corridors away: a slow rumba, arpeggiated, while you look at your ticket ----
const BUSK = ['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E', 'Dm', 'Am', 'F', 'E'];
const Busker = {
  on: false, iv: 0, at: 0, bar: 0, g: null,
  start() {
    if (this.on || !E.ctx) return;
    const c = E.ctx; this.on = true;
    this.g = gain(c, 0); const f = filt(c, 'lowpass', 2600, 0.6), w = gain(c, 0.9);
    chain(this.g, f, B('music')); chain(f, w, E.g.roomIn);
    const t = E.now; this.g.gain.setValueAtTime(0, t); this.g.gain.linearRampToValueAtTime(0.5, t + 1.5);
    this.gt = body(this.g, 1);
    this.at = t + 0.3; this.bar = 0; this.iv = setInterval(() => this.tick(), 120); this.tick();
  },
  tick() {
    if (!this.on || !E.ctx || E.ctx.state !== 'running') return;
    const beat = 60 / 92, e8 = beat / 2;
    while (this.at < E.now + 0.6) {
      const t = this.at, ch = BUSK[this.bar % BUSK.length], ms = CH[ch], hi = ms.slice(-3);
      // thumb on the bass, fingers up and down the top strings; the E at the end of a round gets a flourish
      const last = this.bar % 4 === 3;
      pluck(this.gt, t, ms[0], 0.55, beat * 3.5);
      const seq = [hi[0], hi[1], hi[2], hi[1], ms[1], hi[1], hi[2], hi[1]];
      seq.forEach((m, i) => { if (i) pluck(this.gt, t + i * e8 + U(-0.01, 0.012), m, 0.28 + (i === 4 ? 0.06 : 0), e8 * 2.4); });
      if (last && this.bar % 12 === 11) rasgueado(this.gt, t + 6 * e8, 'E', 0.5, 1.4);
      this.at += 4 * beat * (last ? 1.06 : 1); this.bar++;
      if (this.bar % 12 === 0) this.at += beat * 2;
    }
  },
  stop(f = 1) {
    if (!this.on) return; this.on = false; clearInterval(this.iv);
    const g = this.g, t = E.now; hold(g.gain, t); g.gain.linearRampToValueAtTime(0, t + f);
    E.later(() => g.disconnect(), f * 1000 + 3000);
  },
};
// results: the train caught ends on a flamenco cadence; the one you watched leave, on a guitar that gives up
function win(t = E.now) {
  const g = body(out('music', 0, 1), 1), pc = out('music', 0, 0.8);
  strum(g, t, 'F', { v: 0.6, len: 0.3 }); golpe(g, t + BEAT * 0.5, 0.8); rasgueado(g, t + BEAT, 'E', 0.9, 2.4);
  cajon(pc, t + BEAT, 'bass', 1); palmas(pc, t + BEAT, 0.9, 4);
}
function fail(t = E.now) {
  const g = body(out('music', 0, 1), 1);
  [[64, 0], [60, 0.34], [57, 0.68], [56, 1.08], [52, 1.5], [40, 1.9]].forEach(([m, o]) => pluck(g, t + o, m, 0.45, o > 1.8 ? 2 : 0.8));
}

// ---- the ticket and the validator ----
function tap(t = E.now) { const d = out('ui', 0, 1); burst(d, t, { f: 2600, q: 1.2, pk: 0.09, a: 0.0008, d: 0.01, len: 0.008, r: 0.01 }); sweep(d, t, 700, 300, { pk: 0.06, a: 0.001, d: 0.015, len: 0.015, r: 0.01 }); }
function slide(t = E.now, up = true) { burst(out('ui', 0, 1), t, { color: 'pink', f: up ? 900 : 2600, to: up ? 2600 : 900, q: 0.9, pk: 0.1, a: 0.06, d: 0.1, sus: 0.4, len: 0.16, r: 0.08 }); }
function print(t = E.now, n = 6) {
  const d = chain(out('ui', 0, 1), filt(E.ctx, 'bandpass', 1900, 1.1));
  for (let i = 0; i < n; i++) sweep(d, t + i * 0.052, 1500, 1500, { pk: 0.07, a: 0.002, d: 0.02, len: 0.03, r: 0.006, type: 'square' });
}
function validate(t = E.now) {
  slide(t, true);
  const c = E.ctx, d = out('ui', 0, 1), bp = filt(c, 'bandpass', 900, 1.5), g = gain(c, 0);
  chain(bp, g, d); g.gain.setValueAtTime(0, t + 0.15); g.gain.linearRampToValueAtTime(0.18, t + 0.2); g.gain.setValueAtTime(0.18, t + 0.5); g.gain.linearRampToValueAtTime(0, t + 0.56);
  const o = osc('sawtooth', 120, t + 0.15, t + 0.6, bp); o.frequency.linearRampToValueAtTime(180, t + 0.5);
  print(t + 0.24, 5);
  stamp(t + 0.58, 0.7);
  beep(t + 0.72, true);
}
function stamp(t = E.now, v = 1) {
  const d = out('ui', 0, v);
  burst(d, t, { f: 2500, q: 1.4, pk: 0.14, a: 0.0006, d: 0.008, len: 0.006, r: 0.006 });
  sweep(d, t + 0.004, 170, 60, { pk: 0.4, a: 0.001, d: 0.07, len: 0.08, r: 0.04 });
  burst(d, t + 0.01, { f: 1200, q: 0.9, pk: 0.08, a: 0.001, d: 0.03, len: 0.03, r: 0.02 });
}
function punch(t = E.now) { const d = out('ui', 0, 1); burst(d, t, { f: 3200, q: 1.5, pk: 0.13, a: 0.0005, d: 0.006, len: 0.005, r: 0.005 }); sweep(d, t, 420, 130, { pk: 0.2, a: 0.001, d: 0.03, len: 0.03, r: 0.02 }); }
function beep(t = E.now, ok = true) {
  const d = chain(out('ui', 0, 1), filt(E.ctx, 'lowpass', 5000, 0.7));
  if (ok) { sweep(d, t, 1760, 1760, { pk: 0.05, a: 0.003, d: 0.05, len: 0.07, r: 0.02, type: 'square' }); sweep(d, t + 0.09, 2350, 2350, { pk: 0.05, a: 0.003, d: 0.05, len: 0.09, r: 0.02, type: 'square' }); }
  else for (const o of [0, 0.16]) sweep(d, t + o, 330, 330, { pk: 0.07, a: 0.004, d: 0.1, len: 0.12, r: 0.03, type: 'square' });
}
// the last seconds on the board: a soft tick each second
function tick(t = E.now, hi = false) { hit('tick', out('ui', 0, 0.8), t, hi ? 0.6 : 0.4, 0, { f: hi ? 2900 : 2300 }); }

// ---- the one object the game talks to ----
// one-shots only make sense with a running, unmuted context; a synth bug must never stop the game
function safe(o) {
  const w = {};
  for (const [k, fn] of Object.entries(o)) w[k] = (...a) => { if (!E.live) return; try { fn(...a); } catch (e) { console.info('[PERDÓN audio]', k, e?.message || e); } };
  return w;
}
const hash = (n) => { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; return (x % 1000) / 1000; };
export const Audio = {
  E,
  init: () => E.init(),
  unlock: () => E.unlock(),
  get live() { return E.live; },
  get muted() { return E.muted; },
  setMuted(m) { E.setMuted(m); },
  suspend() { E.suspend(); },
  resume() { E.resume(); },
  load: (man, lang, onP) => E.loadManifest(man, lang, onP),
  switchLang: (l) => E.switchLang(l),
  // a line from a scene cue: you are dry and close; a stranger is where they stand, a little older or
  // younger than the take (the same four voices serve the whole crowd)
  voice(c, delay = 0) {
    if (!E.live) return null;
    let id, o;
    if (c.you) { id = 'you_' + c.key; o = { bus: 'me', gain: 1, delay }; }
    else {
      id = c.key === 'granny' ? 'granny' : `${c.fem ? 'f' : 'm'}${c.vi || 0}_${c.key}`;
      const dz = Math.max(0, (c.dz || 0) - 1.2), k = 1 / (1 + dz / 5);
      o = { bus: 'ppl', gain: 0.95 * k, delay, pan: cl((c.dx || 0) / 3.2, -0.8, 0.8), rate: (c.old && c.key !== 'granny' ? 0.92 : 1) * (0.96 + 0.08 * hash(c.id ?? 1)), lp: dz > 3 ? 7000 - dz * 350 : 0 };
    }
    return E.play(id, o);
  },
  // the loudspeaker: its two notes, then the words
  pa(key, delay = 0) {
    if (!E.live) return null;
    const t = E.now + delay; chime(t);
    const h = E.play('pa_' + key, { dest: paPath(), delay: delay + 1.05, duck: true });
    return h ? { dur: h.dur + 1.05 } : null;
  },
  you: safe({ step, sidestep, bump, brush, wall }),
  dance: safe({ claps: danceClaps, llamada, rumba }),
  train: safe({ warn, doors, depart }),
  ui: safe({ tap, slide, print, validate, stamp, punch, beep, tick }),
  amb: { start: () => Amb.start(), stop: (f) => Amb.stop(f), density: (d) => Amb.density(d), get on() { return !!Amb.master; } },
  music: { busker: (on) => (on ? Busker.start() : Busker.stop()), win: (t) => E.live && win(t), fail: (t) => E.live && fail(t) },
  can: () => E.live,
};
