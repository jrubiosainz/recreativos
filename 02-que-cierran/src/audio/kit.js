// Instrument kit: small, cheap voices built from oscillators and shared noise.
// note(inst, dest, t, midi, len, vel, pan) plays a pitched instrument;
// hit(kind, dest, t, vel, pan) plays percussion. Every node stops itself.
import { E, mtof, gain, filt, pan, chain } from './core.js';

export function input(dest, p = 0) {
  const c = E.ctx, g = gain(c, 1);
  if (p) chain(g, pan(c, p), dest); else g.connect(dest);
  return g;
}
export function osc(type, f, t, end, dest) {
  const o = E.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (dest) o.connect(dest);
  o.start(t); o.stop(end); return o;
}
export function noise(color, t, end, dest, rate = 1) {
  const s = E.ctx.createBufferSource(); s.buffer = E.nz[color] || E.nz.white; s.loop = true; s.playbackRate.value = rate;
  s.connect(dest); s.start(t, Math.random() * Math.max(0, s.buffer.duration - 0.05)); s.stop(end); return s;
}
// linear attack, exponential decay toward sustain, exponential release from t+len
export function env(dest, t, { pk = 0.3, a = 0.004, d = 0.3, sus = 0, len = 0.3, r = 0.08 } = {}) {
  const g = gain(E.ctx, 0), p = g.gain;
  p.setValueAtTime(0, t); p.linearRampToValueAtTime(pk, t + a);
  p.setTargetAtTime(pk * sus, t + a, Math.max(0.004, d / 3));
  const tr = t + Math.max(a + 0.002, len);
  p.setTargetAtTime(0, tr, Math.max(0.004, r / 3));
  g.connect(dest);
  return { g, end: tr + r * 2.2 + 0.02 };
}
// filtered noise burst, the workhorse of foley
export function burst(dest, t, { color = 'white', type = 'bandpass', f = 1500, q = 0.8, to = 0, pk = 0.2, a = 0.003, d = 0.1, sus = 0, len = 0.1, r = 0.05, rate = 1 } = {}) {
  const b = filt(E.ctx, type, f, q), e = env(dest, t, { pk, a, d, sus, len, r });
  if (to) b.frequency.exponentialRampToValueAtTime(to, t + Math.max(0.01, len));
  b.connect(e.g); noise(color, t, e.end, b, rate);
  return e;
}

// [ratio, gain, decay (≈ time to -26 dB), wave]
const ADD = {
  bell:    { p: [[1, 0.5, 1.4], [2, 0.2, 0.6], [3, 0.09, 0.32], [4.2, 0.07, 0.14]] },
  celesta: { p: [[1, 0.55, 1.0], [2, 0.1, 0.3], [4, 0.14, 0.1]] },
  glock:   { p: [[1, 0.45, 0.9], [2.76, 0.18, 0.28], [5.4, 0.1, 0.1]], a: 0.001 },
  mallet:  { p: [[1, 0.65, 0.42], [4, 0.2, 0.06], [10, 0.05, 0.02]] },
  vibes:   { p: [[1, 0.55, 2.2], [4, 0.09, 0.15]], trem: 5.4, damp: true },
  koto:    { p: [[1, 0.45, 1.1, 'triangle'], [2, 0.2, 0.5], [3, 0.11, 0.26], [5, 0.05, 0.1]], bend: 0.018, bendT: 0.06 },
  shami:   { p: [[1, 0.4, 0.45, 'sawtooth'], [2, 0.1, 0.2]], bend: -0.02, bendT: 0.025, lp: 2400 },
  chime:   { p: [[1, 0.5, 1.6], [2.4, 0.1, 0.5], [3, 0.09, 0.35], [6.1, 0.035, 0.12]] }
};

function additive(s, dest, t, f, len, v) {
  const c = E.ctx; let head = dest, end = t, trem = null;
  if (s.lp) { const lp = filt(c, 'lowpass', s.lp, 0.9); lp.connect(dest); head = lp; }
  if (s.trem) { trem = gain(c, 0.75); trem.connect(head); head = trem; }
  const nyq = Math.min(18000, c.sampleRate * 0.45);
  for (const [ratio, g, dec, type] of s.p) {
    if (f * ratio * (1 + Math.abs(s.bend || 0)) > nyq) continue;         // partials above hearing only alias
    const a = s.a || 0.002, e = gain(c, 0), P = e.gain;
    P.setValueAtTime(0, t); P.linearRampToValueAtTime(v * g, t + a); P.setTargetAtTime(0, t + a, dec / 3);
    let stop = t + a + dec * 1.7;
    if (s.damp && t + len < stop) { P.setTargetAtTime(0, t + len, 0.06); stop = t + len + 0.32; }
    e.connect(head);
    const o = osc(type || 'sine', f * ratio, t, stop, e);
    if (s.bend) { o.frequency.setValueAtTime(f * ratio * (1 + s.bend), t); o.frequency.exponentialRampToValueAtTime(f * ratio, t + s.bendT); }
    end = Math.max(end, stop);
  }
  if (trem) { const dg = gain(c, 0.25); dg.connect(trem.gain); osc('sine', s.trem, t, end, dg); }
  return end;
}

function epiano(dest, t, f, len, v) {
  const c = E.ctx, { g, end } = env(dest, t, { pk: v * 0.36, a: 0.003, d: 1.8, sus: 0.05, len, r: 0.22 });
  const car = osc('sine', f, t, end, g), mod = osc('sine', f, t, end, null), mg = gain(c, 0);
  mod.connect(mg).connect(car.frequency);
  mg.gain.setValueAtTime(f * (0.8 + 1.6 * v), t); mg.gain.setTargetAtTime(f * 0.18, t, 0.22);
  const tine = env(dest, t, { pk: v * 0.05, a: 0.001, d: 0.06, len: 0.06, r: 0.03 }); osc('sine', f * 7, t, tine.end, tine.g);
  return end;
}
function brass(dest, t, f, len, v) {
  const c = E.ctx, lp = filt(c, 'lowpass', 420, 1.1), { g, end } = env(dest, t, { pk: v * 0.16, a: 0.035, d: 0.35, sus: 0.72, len, r: 0.2 });
  lp.connect(g);
  lp.frequency.setValueAtTime(420, t); lp.frequency.linearRampToValueAtTime(2400 + 1800 * v, t + 0.07); lp.frequency.setTargetAtTime(1400, t + 0.07, 0.25);
  for (const d of [-8, 0, 7]) osc('sawtooth', f, t, end, lp).detune.value = d;
  return end;
}
function square(dest, t, f, len, v) {
  const c = E.ctx, lp = filt(c, 'lowpass', 2300, 0.8), { g, end } = env(dest, t, { pk: v * 0.11, a: 0.004, d: 0.14, sus: 0.5, len, r: 0.05 });
  lp.connect(g); osc('square', f, t, end, lp);
  const sub = gain(c, 0.5); sub.connect(g); osc('triangle', f / 2, t, end, sub);
  return end;
}
function pad(dest, t, f, len, v) {
  const c = E.ctx, lp = filt(c, 'lowpass', 1150, 0.5), { g, end } = env(dest, t, { pk: v * 0.06, a: Math.min(0.45, len * 0.3), d: 1, sus: 0.85, len, r: 0.7 });
  lp.connect(g); for (const d of [-9, 8]) osc('sawtooth', f, t, end, lp).detune.value = d;
  return end;
}
function bass(dest, t, f, len, v) {
  const c = E.ctx, lp = filt(c, 'lowpass', 900, 0.9), { g, end } = env(dest, t, { pk: v * 0.3, a: 0.005, d: 0.4, sus: 0.5, len, r: 0.07 });
  lp.frequency.setTargetAtTime(480, t, 0.08); lp.connect(g);
  osc('triangle', f, t, end, lp); osc('sine', f, t, end, g);
  return end;
}
function flute(dest, t, f, len, v) {
  const c = E.ctx, { g, end } = env(dest, t, { pk: v * 0.15, a: 0.07, d: 0.5, sus: 0.8, len, r: 0.14 });
  const o = osc('sine', f, t, end, g), vib = gain(c, f * 0.011); vib.connect(o.frequency); osc('sine', 5.1, t + 0.12, end, vib);
  const bp = filt(c, 'bandpass', f * 2, 2.5), ng = gain(c, 0.3); chain(bp, ng, g); noise('pink', t, end, bp);
  return end;
}
const FN = { epiano, brass, square, pad, bass, flute };

export function note(inst, dest, t, m, len = 0.25, v = 0.8, p = 0) {
  if (!E.ctx) return t;
  const f = mtof(m), inp = input(dest, p);
  return ADD[inst] ? additive(ADD[inst], inp, t, f, len, v) : (FN[inst] || epiano)(inp, t, f, len, v);
}
export function chord(inst, dest, t, ms, len, v = 0.6, spread = 0.5) {
  ms.forEach((m, i) => note(inst, dest, t, m, len, v / Math.sqrt(ms.length), ms.length > 1 ? (i / (ms.length - 1) - 0.5) * spread : 0));
}

export function hit(kind, dest, t, v = 1, p = 0) {
  if (!E.ctx) return;
  const c = E.ctx, inp = input(dest, p);
  if (kind === 'don') {                       // taiko: falling skin pitch + slap
    const { g, end } = env(inp, t, { pk: v * 0.85, a: 0.003, d: 0.9, len: 1, r: 0.3 });
    osc('sine', 118, t, end, g).frequency.exponentialRampToValueAtTime(58, t + 0.28);
    const o2 = gain(c, 0.35); o2.connect(g); osc('sine', 192, t, end, o2).frequency.exponentialRampToValueAtTime(96, t + 0.2);
    burst(inp, t, { type: 'lowpass', f: 900, pk: v * 0.3, d: 0.08, len: 0.08 });
  } else if (kind === 'ka') {                 // taiko rim
    const e = env(inp, t, { pk: v * 0.22, a: 0.001, d: 0.05, len: 0.05, r: 0.02 }); osc('triangle', 1250, t, e.end, e.g);
    burst(inp, t, { f: 3100, q: 1.4, pk: v * 0.2, d: 0.04, len: 0.04 });
  } else if (kind === 'kick') {
    const { g, end } = env(inp, t, { pk: v * 0.7, a: 0.002, d: 0.26, len: 0.26, r: 0.05 });
    osc('sine', 150, t, end, g).frequency.exponentialRampToValueAtTime(46, t + 0.16);
  } else if (kind === 'snare') {              // brushed
    burst(inp, t, { f: 1900, q: 0.7, pk: v * 0.22, a: 0.004, d: 0.18, len: 0.18 });
    const e = env(inp, t, { pk: v * 0.12, a: 0.001, d: 0.06, len: 0.06 }); osc('triangle', 190, t, e.end, e.g);
  } else if (kind === 'hat') {
    burst(inp, t, { type: 'highpass', f: 7200, q: 0.7, pk: v * 0.1, a: 0.001, d: 0.035, len: 0.035, r: 0.02 });
  } else if (kind === 'shaker') {
    burst(inp, t, { f: 6200, q: 1.2, pk: v * 0.09, a: 0.014, d: 0.07, len: 0.06, r: 0.03 });
  } else if (kind === 'rim' || kind === 'wood') {
    const f = kind === 'rim' ? 1700 : 1020, e = env(inp, t, { pk: v * 0.2, a: 0.001, d: kind === 'rim' ? 0.03 : 0.07, len: 0.07, r: 0.02 });
    osc('sine', f, t, e.end, e.g); const e2 = env(inp, t, { pk: v * 0.07, a: 0.001, d: 0.02, len: 0.02 }); osc('triangle', f * 2.7, t, e2.end, e2.g);
  } else if (kind === 'ki') {                 // 拍子木: two hardwood clappers, a dry crack with a pitched ring
    burst(inp, t, { f: 3000, q: 0.9, pk: v * 0.3, a: 0.0005, d: 0.018, len: 0.018, r: 0.01 });
    for (const [f, g, d] of [[2350, 0.24, 0.16], [3720, 0.11, 0.09], [5900, 0.06, 0.05]]) {
      const e = env(inp, t, { pk: v * g, a: 0.0005, d, len: d, r: 0.03 }); osc('sine', f, t, e.end, e.g);
    }
  } else if (kind === 'tick') {               // clock escapement
    burst(inp, t, { type: 'highpass', f: 4200, pk: v * 0.14, a: 0.0005, d: 0.012, len: 0.012, r: 0.006 });
    const e = env(inp, t, { pk: v * 0.06, a: 0.0005, d: 0.01, len: 0.01 }); osc('sine', 3100, t, e.end, e.g);
  } else if (kind === 'timp') {
    const { g, end } = env(inp, t, { pk: v * 0.55, a: 0.004, d: 1.3, len: 1.3, r: 0.3 });
    osc('sine', 98, t, end, g).frequency.exponentialRampToValueAtTime(93, t + 0.4);
    burst(inp, t, { type: 'lowpass', f: 320, pk: v * 0.25, d: 0.1, len: 0.1 });
  } else if (kind === 'crash') {
    burst(inp, t, { type: 'highpass', f: 4600, q: 0.6, pk: v * 0.12, a: 0.002, d: 1.8, len: 1.8, r: 0.4 });
  } else if (kind === 'swell') {              // reverse-cymbal lift into a downbeat
    const t0 = Math.max(E.now, t - 0.9), g = gain(c, 0), P = g.gain, b = filt(c, 'highpass', 3000, 0.6);
    P.setValueAtTime(0, t0); P.linearRampToValueAtTime(v * 0.1, t); P.linearRampToValueAtTime(0, t + 0.03);
    b.frequency.setValueAtTime(3000, t0); b.frequency.exponentialRampToValueAtTime(7000, t);
    chain(b, g, inp); noise('white', t0, t + 0.06, b);
  }
}

// temple bell (bonsho): low hum, inharmonic strike partials, slow beating
export function bonsho(dest, t, f = 98, v = 0.5, p = 0) {
  if (!E.ctx) return;
  const inp = input(dest, p);
  for (const [r, g, d, det] of [[0.5, 0.5, 7, 0], [1, 0.55, 5.5, 0], [1, 0.3, 5.5, 1.6], [2.02, 0.22, 3.2, 0], [2.76, 0.16, 2.2, 0], [5.1, 0.06, 0.8, 0]]) {
    const e = env(inp, t, { pk: v * g, a: 0.006, d, len: d, r: 0.5 }); osc('sine', f * r + det, t, e.end, e.g);
  }
  burst(inp, t, { type: 'lowpass', f: 700, pk: v * 0.12, d: 0.12, len: 0.12 });
}
