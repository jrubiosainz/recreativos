// Instrument kit: small, cheap voices built from oscillators and shared noise: the verbena band that
// plays on the hiccup's clock, the pool's splashes and the hippo's hiccups are all played with these.
// note(inst, dest, t, midi, len, vel, pan, opts) plays a pitched instrument;
// hit(kind, dest, t, vel, pan, opts) plays percussion. Every node stops itself.
import { E, mtof, gain, filt, pan, chain } from './core.js';

const rnd = () => (E.rnd ? E.rnd() : Math.random());

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
  s.connect(dest); s.start(t, rnd() * Math.max(0, s.buffer.duration - 0.05)); s.stop(end); return s;
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
// a sine that sweeps f0 → f1 under a short envelope: chirps, thumps, drips
export function sweep(dest, t, f0, f1, { pk = 0.3, a = 0.003, d = 0.1, len = 0.1, r = 0.03, type = 'sine', curve = 0.8 } = {}) {
  const e = env(dest, t, { pk, a, d, len, r }), o = osc(type, f0, t, e.end, e.g);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + Math.max(0.005, len * curve));
  return e;
}

// [ratio, gain, decay (≈ time to -26 dB), wave]
const ADD = {
  bell:    { p: [[1, 0.5, 1.4], [2, 0.2, 0.6], [3, 0.09, 0.32], [4.2, 0.07, 0.14]] },
  celesta: { p: [[1, 0.55, 1.0], [2, 0.1, 0.3], [4, 0.14, 0.1]] },
  glock:   { p: [[1, 0.45, 0.9], [2.76, 0.18, 0.28], [5.4, 0.1, 0.1]], a: 0.001 },
  mallet:  { p: [[1, 0.65, 0.42], [4, 0.2, 0.06], [10, 0.05, 0.02]] },
  vibes:   { p: [[1, 0.55, 2.2], [4, 0.09, 0.15]], trem: 5.4, damp: true },
  chime:   { p: [[1, 0.5, 1.6], [2.4, 0.1, 0.5], [3, 0.09, 0.35], [6.1, 0.035, 0.12]] },
  // a comb tine: bright strike, inharmonic shimmer, a long thin tail
  box:     { p: [[1, 0.5, 1.5], [2.02, 0.06, 0.5], [4.9, 0.12, 0.22], [9.7, 0.05, 0.06]], a: 0.001 },
  harp:    { p: [[1, 0.55, 1.7], [2, 0.26, 0.8], [3, 0.12, 0.45], [4, 0.06, 0.22], [5, 0.03, 0.12]], a: 0.004, damp: true },
};

function additive(s, dest, t, f, len, v) {
  const c = E.ctx; let head = dest, end = t, trem = null;
  if (s.lp) { const lp = filt(c, 'lowpass', s.lp, 0.9); lp.connect(dest); head = lp; }
  if (s.trem) { trem = gain(c, 0.75); trem.connect(head); head = trem; }
  const nyq = Math.min(18000, c.sampleRate * 0.45);
  for (const [ratio, g, dec, type] of s.p) {
    if (f * ratio > nyq) continue;                          // partials above hearing only alias
    const a = s.a || 0.002, e = gain(c, 0), P = e.gain, dk = dec * Math.min(1.6, Math.pow(440 / f, 0.25));
    P.setValueAtTime(0, t); P.linearRampToValueAtTime(v * g, t + a); P.setTargetAtTime(0, t + a, dk / 3);
    let stop = t + a + dk * 1.7;
    if (s.damp && t + len < stop) { P.setTargetAtTime(0, t + len, 0.07); stop = t + len + 0.36; }
    e.connect(head);
    osc(type || 'sine', f * ratio, t, stop, e);
    end = Math.max(end, stop);
  }
  if (trem) { const dg = gain(c, 0.25); dg.connect(trem.gain); osc('sine', s.trem, t, end, dg); }
  return end;
}

// a grand piano, roughly: stretched partials, two strings beating on the fundamental, a felt
// hammer, and a damper that closes when the key comes up
function piano(dest, t, f, len, v, o = {}) {
  const c = E.ctx, B = 0.00035, nyq = Math.min(16000, c.sampleRate * 0.45), bright = 0.5 + 0.7 * v;
  const out = gain(c, 1), lp = filt(c, 'lowpass', Math.min(nyq, f * (4 + 10 * v) + 900), 0.5);
  chain(out, lp, dest);
  let end = t;
  const sus = Math.max(0.12, len), dk0 = Math.min(6, 2.6 * Math.pow(261 / f, 0.55));
  for (let n = 1; n <= 9; n++) {
    const fn = f * n * Math.sqrt(1 + B * n * n); if (fn > nyq) break;
    const g = v * 0.3 * Math.pow(n, -1.15) * (n === 1 ? 1 : bright), dk = dk0 / (1 + 0.45 * (n - 1));
    const e = gain(c, 0), P = e.gain;
    P.setValueAtTime(0, t); P.linearRampToValueAtTime(g, t + 0.003); P.setTargetAtTime(g * 0.5, t + 0.003, 0.08); P.setTargetAtTime(0, t + 0.08, dk / 3);
    let stop = t + dk * 1.8;
    if (!o.pedal && t + sus < stop) { P.setTargetAtTime(0, t + sus, 0.09); stop = t + sus + 0.45; }
    e.connect(out); osc('sine', fn, t, stop, e);
    if (n === 1) { const e2 = gain(c, 0); e2.gain.setValueAtTime(0, t); e2.gain.linearRampToValueAtTime(g * 0.5, t + 0.004); e2.gain.setTargetAtTime(0, t + 0.004, dk / 3); if (!o.pedal && t + sus < stop) e2.gain.setTargetAtTime(0, t + sus, 0.09); e2.connect(out); osc('sine', fn * 1.0009, t, stop, e2); }
    end = Math.max(end, stop);
  }
  burst(out, t, { type: 'lowpass', f: 1800 + 2400 * v, q: 0.6, pk: 0.05 * v, a: 0.001, d: 0.02, len: 0.02, r: 0.01 });   // hammer felt
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
// a brass section: players lip up into the note (scoop), the bell flares open (the blat), the
// sound speaks through the horn's formant; loud brass is bright, soft brass is round
function brass(dest, t, f, len, v, o = {}) {
  const c = E.ctx, dark = !!o.dark, { g, end } = env(dest, t, { pk: v * 0.15, a: o.a ?? 0.03, d: 0.25, sus: 0.86, len, r: o.r ?? 0.18 });
  const lp = filt(c, 'lowpass', 280, 0.9), bell = filt(c, 'peaking', dark ? 750 : 1300, 1.3); bell.gain.value = 6;
  chain(lp, bell, g);
  const top = Math.min(11000, (dark ? 1400 : 2800) + (dark ? 2400 : 6500) * v * v), open = 0.04 + 0.035 * (1 - v);
  lp.frequency.setValueAtTime(260, t); lp.frequency.linearRampToValueAtTime(top * 1.2, t + open); lp.frequency.setTargetAtTime(top * 0.8, t + open, 0.14);
  const vg = gain(c, 0); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * (o.vib ? 0.007 : 0.0025), t + Math.max(0.05, Math.min(0.6, len)));
  osc('sine', 5.1 + rnd() * 0.6, t, end, vg);
  for (const d of o.solo ? [0] : [-9, -2, 6]) {
    const s = osc('sawtooth', f, t, end, lp);
    s.detune.setValueAtTime(d - 30 - 20 * rnd(), t); s.detune.linearRampToValueAtTime(d, t + 0.04 + 0.02 * rnd());
    vg.connect(s.frequency);
    if (o.fall) s.frequency.setTargetAtTime(f * 0.7, t + len - 0.05, 0.12);
  }
  burst(g, t, { f: Math.min(5000, f * 5), q: 1.3, pk: 0.045 * v, a: 0.003, d: 0.04, len: 0.03, r: 0.02 });   // lip buzz
  return end;
}
function horn(dest, t, f, len, v) {                    // french horn: round, covered, slow to speak
  const c = E.ctx, lp = filt(c, 'lowpass', 700 + 500 * v, 0.7), { g, end } = env(dest, t, { pk: v * 0.2, a: 0.07, d: 0.5, sus: 0.8, len, r: 0.3 });
  lp.connect(g);
  for (const d of [-5, 5]) osc('sawtooth', f, t, end, lp).detune.value = d;
  const tri = gain(c, 0.6); tri.connect(g); osc('triangle', f, t, end, tri);
  return end;
}
// bowed strings: a section of players, each a little out of tune and with a vibrato of their own
// that arrives after the bow, through the box's resonances; trem: the horror tremolo
function strings(dest, t, f, len, v, o = {}) {
  const c = E.ctx, a = o.a ?? 0.28, r = o.r ?? 0.55, { g, end } = env(dest, t, { pk: v * 0.07, a, d: 1, sus: 0.9, len, r });
  const hp = filt(c, 'highpass', Math.min(170, f * 0.7), 0.7), b1 = filt(c, 'peaking', 290, 1.4), b2 = filt(c, 'peaking', 1150, 2), b3 = filt(c, 'peaking', 2900, 1.5);
  b1.gain.value = 4; b2.gain.value = -3; b3.gain.value = 3.5;
  const lp = filt(c, 'lowpass', 2400 + 3400 * v + (o.bright || 0), 0.5);
  chain(hp, b1, b2, b3, lp);
  if (o.trem) { const tg = gain(c, 0.7), am = gain(c, 0.3); chain(lp, tg, g); am.connect(tg.gain); osc('triangle', o.trem, t, end, am); }
  else lp.connect(g);
  const n = o.voices || 5, arrive = Math.max(0.06, Math.min(0.55, a + 0.25));
  for (let i = 0; i < n; i++) {
    const s = osc('sawtooth', f, t, end, hp);
    s.detune.value = (i - (n - 1) / 2) * (o.spread || 7) + (rnd() - 0.5) * 6;
    const vg = gain(c, 0); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * (o.vib ?? 0.0038) * (0.7 + 0.6 * rnd()), t + arrive);
    osc('sine', 4.7 + rnd() * 1.4, t, end, vg); vg.connect(s.frequency);
    if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + len);
  }
  burst(g, t, { f: 2600, q: 0.6, pk: 0.035 * v, a: Math.max(0.01, a * 0.4), d: 0.12, len: Math.max(0.02, a * 0.6), r: 0.08 });   // rosin on the bow
  return end;
}
function pizz(dest, t, f, len, v) {
  const c = E.ctx, lp = filt(c, 'lowpass', 2400, 1.4), { g, end } = env(dest, t, { pk: v * 0.3, a: 0.002, d: 0.28, len: 0.3, r: 0.06 });
  lp.frequency.setValueAtTime(2400 + 1600 * v, t); lp.frequency.exponentialRampToValueAtTime(320, t + 0.16);
  lp.connect(g); osc('sawtooth', f, t, end, lp); osc('triangle', f, t, end, g);
  return end;
}
function upright(dest, t, f, len, v) {                 // walking bass: a thumb on a fat string
  const c = E.ctx, lp = filt(c, 'lowpass', 1100, 1.2), { g, end } = env(dest, t, { pk: v * 0.42, a: 0.004, d: 0.5, sus: 0.25, len, r: 0.08 });
  lp.frequency.setValueAtTime(1100, t); lp.frequency.exponentialRampToValueAtTime(380, t + 0.12);
  lp.connect(g); osc('triangle', f, t, end, lp); osc('sine', f, t, end, g);
  burst(g, t, { type: 'lowpass', f: 600, pk: 0.12 * v, a: 0.001, d: 0.02, len: 0.02 });
  return end;
}
function choir(dest, t, f, len, v) {                   // "aah": a section of voices through three vowel formants
  const c = E.ctx, { g, end } = env(dest, t, { pk: v * 0.1, a: 0.35, d: 1, sus: 0.9, len, r: 0.8 });
  const src = gain(c, 1);
  for (const [F, Q, G] of [[760, 6, 1], [1150, 8, 0.55], [2800, 10, 0.25]]) chain(src, filt(c, 'bandpass', F, Q), gain(c, G * 2.2), g);
  for (const d of [-11, -4, 3, 10]) {
    const s = osc('sawtooth', f, t, end, src); s.detune.value = d + (rnd() - 0.5) * 5;
    const vg = gain(c, 0); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.0045, t + 0.5); osc('sine', 4.5 + rnd() * 1.2, t, end, vg); vg.connect(s.frequency);
  }
  const br = filt(c, 'bandpass', 1400, 0.8), bg = gain(c, 0.05); chain(br, bg, g); noise('pink', t, end, br);   // breath
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
// a person whistling: nearly a pure tone, a lazy scoop into each note, breath around it
function whistle(dest, t, f, len, v) {
  const c = E.ctx, { g, end } = env(dest, t, { pk: v * 0.2, a: 0.03, d: 0.3, sus: 0.85, len, r: 0.06 });
  const o = osc('sine', f * 0.94, t, end, g); o.frequency.setTargetAtTime(f, t, 0.025);
  const vib = gain(c, f * 0.009); vib.connect(o.frequency); osc('sine', 5.6, t + 0.1, end, vib);
  const bp = filt(c, 'bandpass', f, 6), ng = gain(c, 0.12); chain(bp, ng, g); noise('white', t, end, bp);
  return end;
}
const FN = { piano, epiano, brass, horn, strings, pizz, upright, choir, pad, bass, flute, whistle };

export function note(inst, dest, t, m, len = 0.25, v = 0.8, p = 0, o) {
  if (!E.ctx) return t;
  const f = mtof(m), inp = input(dest, p);
  return ADD[inst] ? additive(ADD[inst], inp, t, f, len, v) : (FN[inst] || epiano)(inp, t, f, len, v, o || {});
}
export function chord(inst, dest, t, ms, len, v = 0.6, spread = 0.5, o) {
  ms.forEach((m, i) => note(inst, dest, t, m, len, v / Math.sqrt(ms.length), ms.length > 1 ? (i / (ms.length - 1) - 0.5) * spread : 0, o));
}

// percussion. o.f: pitch for timp/tom; o.len: ring time for cymbals
export function hit(kind, dest, t, v = 1, p = 0, o = {}) {
  if (!E.ctx) return;
  const c = E.ctx, inp = input(dest, p);
  if (kind === 'kick') {
    const { g, end } = env(inp, t, { pk: v * 0.7, a: 0.002, d: 0.26, len: 0.26, r: 0.05 });
    osc('sine', 150, t, end, g).frequency.exponentialRampToValueAtTime(46, t + 0.16);
  } else if (kind === 'snare') {
    burst(inp, t, { f: 1900, q: 0.7, pk: v * 0.26, a: 0.002, d: 0.16, len: 0.16 });
    const e = env(inp, t, { pk: v * 0.16, a: 0.001, d: 0.06, len: 0.06 }); osc('triangle', 190, t, e.end, e.g);
  } else if (kind === 'brush') {              // a brush swept across the snare: soft attack, long hiss
    burst(inp, t, { f: 3200, q: 0.5, to: 2200, pk: v * 0.1, a: 0.03, d: 0.16, len: 0.14, r: 0.06 });
  } else if (kind === 'hat') {
    burst(inp, t, { type: 'highpass', f: 7200, q: 0.7, pk: v * 0.1, a: 0.001, d: 0.035, len: 0.035, r: 0.02 });
  } else if (kind === 'ride') {               // ride cymbal: a ping over a wash of inharmonic shimmer
    const len = o.len ?? 0.9, bp = filt(c, 'highpass', 5200, 0.5), e = env(inp, t, { pk: v * 0.07, a: 0.001, d: len, len, r: 0.2 });
    bp.connect(e.g); noise('white', t, e.end, bp);
    for (const [f, g] of [[3120, 0.05], [4410, 0.035], [5870, 0.025]]) { const e2 = env(inp, t, { pk: v * g, a: 0.001, d: len * 0.6, len: len * 0.6, r: 0.1 }); osc('square', f, t, e2.end, e2.g); }
  } else if (kind === 'crash') {
    const len = o.len ?? 1.8;
    burst(inp, t, { type: 'highpass', f: 4200, q: 0.6, pk: v * 0.16, a: 0.002, d: len, len, r: 0.4 });
    burst(inp, t, { f: 2600, q: 0.9, pk: v * 0.06, a: 0.002, d: len * 0.5, len: len * 0.5, r: 0.2 });
  } else if (kind === 'shaker') {
    burst(inp, t, { f: 6200, q: 1.2, pk: v * 0.09, a: 0.014, d: 0.07, len: 0.06, r: 0.03 });
  } else if (kind === 'rim' || kind === 'wood') {
    const f = kind === 'rim' ? 1700 : 1020, e = env(inp, t, { pk: v * 0.2, a: 0.001, d: kind === 'rim' ? 0.03 : 0.07, len: 0.07, r: 0.02 });
    osc('sine', f, t, e.end, e.g); const e2 = env(inp, t, { pk: v * 0.07, a: 0.001, d: 0.02, len: 0.02 }); osc('triangle', f * 2.7, t, e2.end, e2.g);
  } else if (kind === 'tick') {               // clock escapement
    burst(inp, t, { type: 'highpass', f: 4200, pk: v * 0.2, a: 0.0005, d: 0.012, len: 0.012, r: 0.006 });
    const e = env(inp, t, { pk: v * 0.1, a: 0.0005, d: 0.014, len: 0.014 }); osc('sine', o.f || 3100, t, e.end, e.g);
    const e3 = env(inp, t, { pk: v * 0.08, a: 0.0005, d: 0.03, len: 0.03 }); osc('sine', (o.f || 3100) * 0.37, t, e3.end, e3.g);
  } else if (kind === 'timp') {
    const f = o.f || 98, len = o.len ?? 1.3, { g, end } = env(inp, t, { pk: v * 0.6, a: 0.004, d: len, len, r: 0.3 });
    osc('sine', f * 1.02, t, end, g).frequency.exponentialRampToValueAtTime(f, t + 0.3);
    const g2 = gain(c, 0.3); g2.connect(g); osc('sine', f * 1.5, t, end, g2);
    burst(inp, t, { type: 'lowpass', f: 380, pk: v * 0.28, d: 0.1, len: 0.1 });
  } else if (kind === 'tom') {
    const f = o.f || 120, { g, end } = env(inp, t, { pk: v * 0.5, a: 0.002, d: 0.3, len: 0.3, r: 0.08 });
    osc('sine', f * 1.4, t, end, g).frequency.exponentialRampToValueAtTime(f, t + 0.12);
    burst(inp, t, { type: 'lowpass', f: 1200, pk: v * 0.12, d: 0.04, len: 0.04 });
  } else if (kind === 'clap') {               // one pair of hands: two or three flams of a bright slap
    const f = o.f || 1400;
    for (let i = 0; i < 3; i++) burst(inp, t + i * 0.006 * (0.6 + rnd()), { f: f * (0.85 + rnd() * 0.3), q: 1.1, pk: v * (i === 2 ? 0.3 : 0.16), a: 0.0006, d: i === 2 ? 0.05 : 0.008, len: i === 2 ? 0.04 : 0.006, r: 0.02 });
  } else if (kind === 'swell') {              // reverse-cymbal lift into a downbeat
    const len = o.len ?? 0.9, t0 = Math.max(0, t - len), g = gain(c, 0), P = g.gain, b = filt(c, 'highpass', 3000, 0.6);
    P.setValueAtTime(0, t0); P.linearRampToValueAtTime(v * 0.12, t); P.linearRampToValueAtTime(0, t + 0.03);
    b.frequency.setValueAtTime(2400, t0); b.frequency.exponentialRampToValueAtTime(7000, t);
    chain(b, g, inp); noise('white', t0, t + 0.06, b);
  } else if (kind === 'gong') {
    for (const [r, g, d] of [[1, 0.4, 4], [1.47, 0.25, 3], [2.09, 0.18, 2.2], [2.56, 0.12, 1.6], [3.9, 0.06, 0.9]]) { const e = env(inp, t, { pk: v * g, a: 0.02, d, len: d, r: 0.5 }); osc('sine', (o.f || 70) * r, t, e.end, e.g); }
    burst(inp, t, { type: 'lowpass', f: 500, pk: v * 0.2, d: 0.2, len: 0.2 });
  }
}
