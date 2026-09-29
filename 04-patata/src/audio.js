// ¡PATATA! sound: the one import the game uses. Voices are recorded (assets/audio); everything
// else is synthesised here from src/audio/kit.js: the camera, the pigeons, each place's air and
// the album's music box.
import { E, gain, filt, pan, chain, hold, db } from './audio/core.js';
import { note, hit, burst, sweep, env, osc, noise } from './audio/kit.js';

const B = (k) => E.g.bus[k];
const out = (bus, p = 0, v = 1) => { const c = E.ctx, g = gain(c, v); if (p) chain(g, pan(c, Math.max(-1, Math.min(1, p))), B(bus)); else g.connect(B(bus)); return g; };
const R = () => Math.random();

// ---- the camera: a 90s point-and-shoot, plastic and motor ----
function shutter(t = E.now) {
  const d = out('sfx', 0, 1);
  // leaf shutter: two tiny clicks, open and close, then the mirrorless body's thunk
  burst(d, t, { f: 4200, q: 1.4, pk: 0.55, a: 0.0004, d: 0.008, len: 0.008, r: 0.006 });
  sweep(d, t, 900, 160, { pk: 0.3, a: 0.001, d: 0.02, len: 0.025, r: 0.02, type: 'triangle' });
  burst(d, t + 0.032, { f: 3000, q: 1.2, pk: 0.36, a: 0.0004, d: 0.01, len: 0.01, r: 0.008 });
  // the motor winds the film on: a small DC motor spinning up through a plastic gear train
  const t0 = t + 0.1, len = 0.5, c = E.ctx, m = gain(c, 0), bp = filt(c, 'bandpass', 1400, 2.2);
  chain(bp, m, d);
  m.gain.setValueAtTime(0, t0); m.gain.linearRampToValueAtTime(0.22, t0 + 0.04); m.gain.setValueAtTime(0.22, t0 + len - 0.06); m.gain.linearRampToValueAtTime(0, t0 + len);
  const saw = osc('sawtooth', 95, t0, t0 + len + 0.05, bp); saw.frequency.linearRampToValueAtTime(150, t0 + len * 0.5); saw.frequency.linearRampToValueAtTime(128, t0 + len);
  const teeth = gain(c, 0.12), am = osc('square', 62, t0, t0 + len + 0.05, teeth); am.frequency.linearRampToValueAtTime(96, t0 + len * 0.6);
  teeth.connect(m.gain);
  const nf = filt(c, 'bandpass', 2600, 1.6); chain(nf, gain(c, 0.35), m); noise('pink', t0, t0 + len + 0.05, nf);
  // the frame stops against its sprocket
  burst(d, t0 + len - 0.01, { f: 1800, q: 2, pk: 0.3, a: 0.0006, d: 0.015, len: 0.015, r: 0.01 });
  sweep(d, t0 + len - 0.01, 420, 140, { pk: 0.14, a: 0.001, d: 0.02, len: 0.03, r: 0.02 });
}
// flash: the xenon tube's pop, then the capacitor's rising whine while it recharges
function flash(t = E.now, recharge = 2.6) {
  const d = out('sfx', 0, 1);
  burst(d, t + 0.003, { color: 'white', type: 'highpass', f: 5200, q: 0.5, pk: 0.4, a: 0.0005, d: 0.03, len: 0.03, r: 0.03 });
  sweep(d, t + 0.003, 2400, 900, { pk: 0.08, a: 0.001, d: 0.02, len: 0.04, r: 0.03 });
  const c = E.ctx, t0 = t + 0.25, g = gain(c, 0), w = out('sfx', 0.1, 1);
  g.connect(w);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.028, t0 + 0.3); g.gain.setValueAtTime(0.03, t0 + recharge - 0.45); g.gain.linearRampToValueAtTime(0, t0 + recharge - 0.25);
  const o = osc('sine', 3200, t0, t0 + recharge, g); o.frequency.exponentialRampToValueAtTime(11500, t0 + recharge - 0.3);
  const o2 = osc('sine', 3200 * 1.004, t0, t0 + recharge, g); o2.frequency.exponentialRampToValueAtTime(11500 * 1.004, t0 + recharge - 0.3);
}
function ready(t = E.now) { const d = out('sfx', 0.1, 1); sweep(d, t, 2900, 2900, { pk: 0.05, a: 0.002, d: 0.03, len: 0.04, r: 0.02, type: 'square' }); }
function beep(t = E.now, hi = false) {
  const d = chain(out('sfx', 0, 1), filt(E.ctx, 'lowpass', 6000, 0.7));
  sweep(d, t, hi ? 3400 : 2800, hi ? 3400 : 2800, { pk: hi ? 0.07 : 0.06, a: 0.002, d: 0.05, len: hi ? 0.045 : 0.08, r: 0.02, type: 'square' });
}
function deny(t = E.now) { const d = out('ui', 0, 1); sweep(d, t, 220, 150, { pk: 0.22, a: 0.004, d: 0.08, len: 0.1, r: 0.05, type: 'triangle' }); hit('wood', d, t + 0.09, 0.5); }
// pressing the button half-way: the camera focuses (a soft chirp and a lens tick)
function focus(t = E.now) { const d = out('sfx', 0, 1); burst(d, t, { f: 2400, q: 3, pk: 0.08, a: 0.001, d: 0.02, len: 0.03, r: 0.01 }); sweep(d, t + 0.02, 1500, 2100, { pk: 0.025, a: 0.004, d: 0.05, len: 0.06, r: 0.02 }); }

// ---- pigeons ----
function coo(p = 0, t = E.now) {
  const d = out('sfx', p, 0.9);
  for (const [o, len, f] of [[0, 0.16, 300], [0.22, 0.36, 355], [0.66, 0.3, 320]]) {
    const e = env(d, t + o, { pk: 0.16, a: 0.045, d: 0.2, sus: 0.75, len, r: 0.09 });
    const s = osc('sine', f * 0.9, t + o, e.end, e.g);
    s.frequency.linearRampToValueAtTime(f, t + o + len * 0.4); s.frequency.linearRampToValueAtTime(f * 0.86, t + o + len);
    const e2 = env(d, t + o, { pk: 0.04, a: 0.05, d: 0.2, sus: 0.6, len, r: 0.08 }); osc('triangle', f * 2.01, t + o, e2.end, e2.g);
    burst(d, t + o, { color: 'pink', f: f * 2.4, q: 3, pk: 0.025, a: 0.05, d: 0.2, sus: 0.6, len, r: 0.06 });
  }
}
// the flock clattering off: wing claps, loud at take-off, thinning as they wheel over the family
function flap(x0 = 0.2, x1 = 0.8, dur = 2.4, t = E.now) {
  const n = 64;
  for (let i = 0; i < n; i++) {
    const u = Math.pow(i / n, 1.7), tt = t + u * dur * 0.85 + R() * 0.04, x = x0 + (x1 - x0) * u, v = 0.12 + 0.88 * (1 - u);
    const d = out('sfx', (x - 0.5) * 1.5, 1);
    burst(d, tt, { color: 'pink', f: 650 + R() * 1000, q: 0.8, pk: 0.2 * v, a: 0.002, d: 0.03, len: 0.028, r: 0.03 });
    if (i < 10) burst(d, tt + 0.012, { color: 'white', type: 'highpass', f: 2500, q: 0.6, pk: 0.05 * v, a: 0.001, d: 0.015, len: 0.015, r: 0.01 });
  }
}

// ---- paper, envelope, marker, stickers ----
function tap(t = E.now) { const d = out('ui', 0, 1); hit('rim', d, t, 0.28); burst(d, t, { f: 3200, q: 1, pk: 0.04, a: 0.001, d: 0.01, len: 0.01, r: 0.01 }); }
function swish(t, f0, f1, len, pk, p = 0) { const d = out('ui', p, 1); burst(d, t, { color: 'pink', f: f0, to: f1, q: 0.9, pk, a: len * 0.35, d: len * 0.4, sus: 0.4, len: len * 0.6, r: len * 0.3 }); }
const flip = (t = E.now) => { swish(t, 700, 2800, 0.32, 0.16, 0.2); burst(out('ui', 0.3, 1), t + 0.3, { color: 'pink', type: 'lowpass', f: 900, q: 0.7, pk: 0.08, a: 0.002, d: 0.04, len: 0.04, r: 0.03 }); };
const slide = (t = E.now) => swish(t, 1200, 2200, 0.26, 0.1);
function tear(t = E.now) {
  const d = out('ui', 0, 1);
  for (let i = 0; i < 9; i++) burst(d, t + i * 0.035 + R() * 0.01, { color: 'white', f: 1800 + R() * 2400, q: 1.4, pk: 0.09, a: 0.001, d: 0.02, len: 0.025, r: 0.015 });
  swish(t + 0.05, 900, 3200, 0.35, 0.08);
}
function squeak(t = E.now, len = 0.5) {
  const c = E.ctx, d = out('ui', 0, 1), bp = filt(c, 'bandpass', 2100, 7), e = env(d, t, { pk: 0.06, a: 0.03, d: 0.1, sus: 0.8, len, r: 0.06 });
  bp.connect(e.g); noise('white', t, e.end, bp);
  const lfo = gain(c, 380); lfo.connect(bp.frequency); osc('sine', 9 + R() * 4, t, e.end, lfo);
}
function sticker(t = E.now) { const d = out('ui', 0, 1); burst(d, t, { color: 'pink', type: 'lowpass', f: 1400, q: 0.6, pk: 0.22, a: 0.001, d: 0.05, len: 0.05, r: 0.04 }); sweep(d, t, 300, 90, { pk: 0.18, a: 0.001, d: 0.05, len: 0.06, r: 0.04 }); }

// ---- the air of each place: looping beds plus things that happen now and then ----
const U = (a, b) => a + (b - a) * R();
// a sound from somewhere in the place: panned into the ambience's own fader (so leaving fades it)
const A = (p = 0) => { const c = E.ctx, g = gain(c, 1); chain(g, pan(c, Math.max(-1, Math.min(1, p))), Amb.master || B('amb')); return g; };
function far(dest, f = 1600, v = 0.5, room = 0.5) {
  const c = E.ctx, lp = filt(c, 'lowpass', f, 0.6), g = gain(c, v);
  chain(lp, g, dest); if (room) g.connect(gain(c, room)).connect(Amb.wet || E.g.roomIn);
  return lp;
}
const EVT = {
  bell(t, d) { const f = far(d, 2600, 0.5, 0.8), n = 3 + (R() * 3 | 0); for (let i = 0; i < n; i++) { note('bell', f, t + i * 1.7, 55, 3, 0.55); note('bell', f, t + i * 1.7 + 0.85, 50, 3, 0.4); } return U(14, 22) + n * 1.7; },
  bird(t, d) {
    const n = 3 + (R() * 4 | 0), f0 = U(2800, 4600), dir = R() < 0.5 ? 1.25 : 0.8, o = A(U(-0.8, 0.8)), g = gain(E.ctx, 1); g.connect(o);
    for (let i = 0; i < n; i++) sweep(g, t + i * U(0.07, 0.12), f0 * (1 + 0.05 * i), f0 * dir, { pk: 0.035, a: 0.004, d: 0.03, len: 0.045, r: 0.02 });
  },
  cicada(t, d) {
    const c = E.ctx, len = U(3, 7), o = A(U(-0.7, 0.7)), bp = filt(c, 'bandpass', U(4800, 5800), 5);
    const e = env(o, t, { pk: 0.1, a: 0.8, d: 0.5, sus: 1, len, r: 0.7 }); const am = gain(c, 0); chain(bp, am, e.g);
    const lfo = gain(c, 0.5); lfo.connect(am.gain); osc('square', U(36, 48), t, e.end, lfo); am.gain.value = 0.5;
    noise('white', t, e.end, bp);
    return len + U(1.2, 3.5);
  },
  swift(t, d) { const o = A(U(-0.9, 0.9)); for (let i = 0; i < 9; i++) sweep(o, t + i * 0.035, 6800, 8200, { pk: 0.018, a: 0.002, d: 0.02, len: 0.025, r: 0.01, type: 'triangle' }); },
  wave(t, d) {
    const len = U(5.5, 7.5), o = A(U(-0.3, 0.3));
    burst(o, t, { color: 'brown', type: 'lowpass', f: 320, to: 1100, q: 0.5, pk: 0.5, a: len * 0.42, d: len * 0.3, sus: 0.3, len: len * 0.55, r: len * 0.35 });
    burst(o, t + len * 0.4, { color: 'pink', type: 'highpass', f: 1800, q: 0.5, pk: 0.07, a: 0.35, d: len * 0.3, sus: 0.3, len: len * 0.4, r: len * 0.3 });
    return U(4.2, 6.2);
  },
  gull(t, d) {
    const f = far(A(U(-0.8, 0.8)), 5000, 0.7, 0.3), n = 2 + (R() * 3 | 0), p = U(1300, 1650);
    for (let i = 0; i < n; i++) {
      const t0 = t + i * 0.32, e = env(f, t0, { pk: 0.07, a: 0.02, d: 0.1, sus: 0.6, len: 0.2, r: 0.06 }), bp = filt(E.ctx, 'bandpass', 2000, 1.5);
      bp.connect(e.g); const s = osc('sawtooth', p * 1.1, t0, e.end, bp); s.frequency.exponentialRampToValueAtTime(p * 0.72, t0 + 0.24);
    }
  },
  tick(t, d) { hit('tick', d, t, 0.22, 0.4); return 1; },
  crackle(t, d) { const o = A(U(-0.3, 0.1)); burst(o, t, { color: 'white', type: 'highpass', f: U(1500, 3500), q: 0.7, pk: U(0.02, 0.09), a: 0.0005, d: 0.006, len: 0.006, r: 0.006 }); return R() < 0.2 ? U(0.02, 0.08) : U(0.15, 0.9); },
  petardo(t, d) {
    const n = R() < 0.3 ? 4 + (R() * 5 | 0) : 1, o = A(U(-0.6, 0.6));
    for (let i = 0; i < n; i++) {
      const tt = t + i * U(0.09, 0.18), f = far(o, 3200, 0.9, 1.2);
      burst(f, tt, { color: 'white', type: 'lowpass', f: 2800, q: 0.5, pk: 0.35, a: 0.0005, d: 0.05, len: 0.05, r: 0.04 });
      sweep(f, tt, 140, 45, { pk: 0.25, a: 0.001, d: 0.08, len: 0.1, r: 0.06 });
      burst(f, tt + 0.23, { color: 'pink', type: 'lowpass', f: 1400, q: 0.5, pk: 0.06, a: 0.002, d: 0.08, len: 0.08, r: 0.06 });
    }
    return U(8, 15);
  },
};
// the village band, a few streets away: an eight-bar pasodoble in A minor (original), oom-pah
const PASO = {
  mel: [69, 72, 76, 76, 74, 72, 71, 69, 68, 71, 74, 74, 72, 71, 69, 68, 69, 72, 76, 81, 79, 77, 76, 74, 72, 71, 69, 68, 69, 0, 64, 69],
  root: [45, 45, 40, 40, 45, 38, 40, 45], stab: { 45: [57, 60, 64], 40: [56, 59, 62], 38: [57, 62, 65] },
};
EVT.band = (t, d) => {
  const f = far(d, 1500, 0.42, 0.9), e8 = 0.25;
  PASO.mel.forEach((m, i) => { if (m) note('brass', f, t + i * e8, m, e8 * 0.9, 0.55, 0, { solo: false }); });
  PASO.root.forEach((r, b) => {
    const t0 = t + b * 1;
    note('bass', f, t0, r, 0.22, 0.8); note('bass', f, t0 + 0.5, r + 7, 0.22, 0.7);
    for (const k of [0.25, 0.75]) for (const m of PASO.stab[r]) note('horn', f, t0 + k, m, 0.16, 0.35);
    hit('kick', f, t0, 0.5); hit('kick', f, t0 + 0.5, 0.4); hit('hat', f, t0 + 0.25, 0.3); hit('hat', f, t0 + 0.75, 0.3);
  });
  hit('crash', f, t + 7.5, 0.35);
  return 8 + U(5, 11);
};
// a neighbour's television is playing a carol (original tune), on Christmas Eve
EVT.carol = (t, d) => {
  const f = far(d, 2200, 0.35, 0.6), q = 0.42;
  [[74, 1], [76, 1], [78, 1], [81, 2], [78, 1], [79, 1], [78, 1], [76, 1], [74, 3], [71, 1], [74, 1], [76, 1], [78, 2], [76, 1], [74, 3]]
    .reduce((u, [m, n]) => { note('celesta', f, t + u * q, m, n * q * 0.9, 0.4); return u + n; }, 0);
  return U(22, 34);
};
const PLACES = {
  church: { beds: [['pink', 'bandpass', 480, 0.7, 0.05], ['white', 'highpass', 7000, 0.5, 0.004]], ev: [['bell', 2, 6], ['bird', 2.5, 6]] },
  patio: { beds: [['pink', 'lowpass', 650, 0.5, 0.018]], ev: [['cicada', 0.2, 1.5], ['cicada', 1.5, 3], ['swift', 6, 12]] },
  sea: { beds: [['pink', 'highpass', 2600, 0.4, 0.008]], ev: [['wave', 0, 0.5], ['gull', 3, 8]] },
  home: { beds: [['brown', 'lowpass', 180, 0.5, 0.06]], ev: [['tick', 0.3, 0.3], ['crackle', 0.2, 0.8], ['carol', 4, 9]] },
  garden: { beds: [['pink', 'lowpass', 900, 0.5, 0.022]], ev: [['bird', 1, 3], ['bird', 2, 4.5], ['bell', 14, 26]] },
  fiesta: { beds: [['pink', 'bandpass', 430, 0.7, 0.065], ['pink', 'bandpass', 1300, 1.2, 0.012]], ev: [['band', 0.5, 2], ['petardo', 5, 10]] },
};
const Amb = {
  kind: null, srcs: [], iv: 0, next: [], master: null, wet: null,
  start(kind) {
    this.stop(0.4);
    const c = E.ctx, P = PLACES[kind]; if (!c || !P) return;
    const t = E.now, m = gain(c, 0); m.connect(B('amb')); m.gain.setValueAtTime(0, t); m.gain.linearRampToValueAtTime(1, t + 1.5);
    const w = gain(c, 1); w.connect(E.g.roomIn);
    this.kind = kind; this.master = m; this.wet = w; this.srcs = [];
    for (const [color, type, f, q, v] of P.beds) {
      const s = c.createBufferSource(); s.buffer = E.nz[color]; s.loop = true;
      chain(s, filt(c, type, f, q), gain(c, v), m); s.start(t, R() * s.buffer.duration * 0.9); this.srcs.push(s);
    }
    this.next = P.ev.map(([k, a, b]) => ({ k, a, b, at: t + U(a, b) }));
    this.iv = setInterval(() => this.tick(), 150); this.tick();
  },
  tick() {
    const c = E.ctx; if (!c || c.state !== 'running' || !this.master) return;
    const t = E.now;
    for (const n of this.next) while (n.at < t + 0.35) { const at = Math.max(t + 0.02, n.at), d = EVT[n.k](at, this.master); n.at = at + (d || U(n.a, n.b)); }
  },
  stop(f = 0.6) {
    clearInterval(this.iv); this.iv = 0;
    const m = this.master, w = this.wet, s = this.srcs; this.master = null; this.wet = null; this.srcs = []; this.kind = null;
    if (!m || !E.ctx) return;
    const t = E.now; for (const x of [m, w]) { hold(x.gain, t); x.gain.linearRampToValueAtTime(0, t + f); }
    E.later(() => { for (const x of s) try { x.stop(); } catch { /* done */ } m.disconnect(); w.disconnect(); }, f * 1000 + 1500);
  },
};

// ---- the album's music box: an original waltz in F, eight bars, wound up and a bit uneven ----
const WALTZ = {
  mel: [[72, 2], [69, 1], [77, 2], [76, 1], [74, 1], [72, 1], [70, 1], [69, 3], [67, 2], [69, 1], [70, 1], [74, 1], [72, 1], [69, 1], [67, 1], [64, 1], [65, 3]],
  bass: [[53, 60, 65], [53, 60, 64], [46, 62, 65], [53, 60, 65], [48, 64, 67], [46, 62, 65], [48, 64, 70], [53, 60, 65]],
};
const Music = {
  iv: 0, at: 0, bar: 0, g: null, on: false,
  box() {
    if (this.on || !E.ctx) return;
    const c = E.ctx; this.on = true; this.g = gain(c, 0); this.g.connect(B('music'));
    const t = E.now; this.g.gain.setValueAtTime(0, t); this.g.gain.linearRampToValueAtTime(0.9, t + 0.6);
    this.room = gain(c, 0.5); this.g.connect(this.room); this.room.connect(E.g.roomIn);
    this.at = t + 0.15; this.bar = 0; this.iv = setInterval(() => this.tick(), 120); this.tick();
  },
  tick() {
    if (!this.on || !E.ctx || E.ctx.state !== 'running') return;
    const beat = 0.6;
    while (this.at < E.now + 0.5) {
      const t = this.at, b = this.bar % 8, [lo, m1, m2] = WALTZ.bass[b];
      note('box', this.g, t, lo, beat * 1.8, 0.4, -0.2); note('box', this.g, t + beat, m1, beat, 0.22, 0.2); note('box', this.g, t + 2 * beat, m2, beat, 0.22, 0.25);
      let u = 0;
      for (const [m, n] of WALTZ.mel) { if (Math.floor(u / 3) === b) note('box', this.g, t + (u % 3) * beat + R() * 0.012, m, n * beat, 0.5, 0.1); u += n; }
      this.at += 3 * beat * (1 + (this.bar % 8 === 7 ? 0.08 : 0)); this.bar++;
      if (this.bar % 16 === 0) this.at += beat * 2;
    }
  },
  stop(f = 0.8) {
    if (!this.on) return; this.on = false; clearInterval(this.iv);
    const g = this.g, r = this.room, t = E.now; hold(g.gain, t); g.gain.linearRampToValueAtTime(0, t + f);
    E.later(() => { g.disconnect(); r.disconnect(); }, f * 1000 + 3000);
  },
  // results: the good photo gets a little fanfare; the spoiled one a trombone that gives up
  win(t = E.now) {
    const d = out('music', 0, 1);
    [[65, 0], [69, 0.12], [72, 0.24], [77, 0.36]].forEach(([m, o]) => note('box', d, t + o, m, 0.5, 0.5));
    for (const m of [77, 81, 84]) note('glock', d, t + 0.52, m, 1.2, 0.3);
    note('box', d, t + 0.52, 53, 1.4, 0.4);
  },
  fail(t = E.now) {
    const d = out('music', 0, 1);
    [[67, 0, 0.32], [66, 0.36, 0.32], [65, 0.72, 0.32], [64, 1.08, 0.9]].forEach(([m, o, l]) => note('brass', d, t + o, m, l, 0.5, 0, { solo: true, dark: true, vib: o > 1 }));
  },
};

// ---- the one object the game talks to ----
// one-shots only make sense with a running, unmuted context; a synth bug must never stop the game
function safe(o) {
  const w = {};
  for (const [k, fn] of Object.entries(o)) w[k] = (...a) => { if (!E.live) return; try { fn(...a); } catch (e) { console.info('[PATATA audio]', k, e?.message || e); } };
  return w;
}
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
  // voices: people in the photo from where they stand; you from behind the camera
  say(id, { x = 0.5, you = false, delay = 0, offset = 0, gain: v = 1 } = {}) {
    if (!E.ctx) return E.meta(id) ? { id, text: E.meta(id).text, dur: E.meta(id).dur || 1.2, h: null } : null;
    return E.say(id, you ? { bus: 'me', gain: v * 1.05, delay, offset } : { pan: (x - 0.5) * 1.1, gain: v, delay, offset, room: 0.12 });
  },
  cam: safe({ shutter, flash, ready, beep, deny, focus }),
  birds: safe({ coo, flap }),
  ui: safe({ tap, flip, slide, tear, squeak, sticker }),
  amb: { start: (k) => Amb.start(k), stop: (f) => Amb.stop(f), get kind() { return Amb.kind; } },
  music: { box: () => Music.box(), stop: (f) => Music.stop(f), win: () => E.live && Music.win(), fail: () => E.live && Music.fail() },
  // everything but ambience and music is played only when the context runs; these guard for it
  can: () => E.live,
};
