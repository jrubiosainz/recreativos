// The film as a loudness score. Every sound in a film (an explosion, a line of dialogue, a snore
// two rows back) is a cue: a piecewise-linear level curve in dB, an optional wobble and a release
// slope. The same cues drive the sim (who can hear you), the reel renderer (what you hear) and
// the needle (how much noise you can get away with), so the three can never disagree.
import { TAU } from './util.js';

export const FLOOR = 34;        // room tone: air conditioning, projector hum
export const POST = 110;        // dB/s: a masker keeps hiding sounds for a moment after it stops
export const PRE = 0.06;        // s: ...and starts hiding them a moment before it arrives (people tap early)
export const NEAR = 0.6;        // m: nobody is closer than the next seat's ear
const MIN = -60;

export const dist = (ax, az, bx, bz) => Math.max(NEAR, Math.hypot(ax - bx, az - bz));
export const atten = (d) => 20 * Math.log10(Math.max(NEAR, d));
export const psum = (a, b) => (a === -Infinity ? b : b === -Infinity ? a : Math.max(a, b) + 10 * Math.log10(1 + Math.pow(10, -Math.abs(a - b) / 10)));

// ---- cue constructors (times in seconds, levels in dB at 1 m) ----
// pts: [[τ, dB], ...] relative to the cue start; after the last point the level falls at `rate` dB/s.
export function cue(t, pts, rate, extra = {}) { return { t, pts, rate, ...extra }; }
// a short impact: a tap shoe, a tick, a horn
export const hit = (t, L, o = {}) => cue(t, [[0, L - 24], [o.a ?? 0.004, L], [(o.a ?? 0.004) + (o.h ?? 0.04), L]], o.rate ?? 160, { k: 'hit', ...o });
// something big that rings out: an explosion, a thunderclap, an orchestra stab
export const boom = (t, L, o = {}) => cue(t, [[0, L - 30], [o.a ?? 0.02, L], [(o.a ?? 0.02) + (o.h ?? 0.2), L - (o.sag ?? 3)]], o.rate ?? 12, { k: 'boom', ...o });
// a sustained bed with fades: an engine, rain, a chorus
export function bed(t0, t1, L, o = {}) {
  const fi = o.fi ?? 0.4, fo = o.fo ?? 0.6, d = Math.max(t1 - t0, fi + 0.01);
  return cue(t0, [[0, L - 30], [fi, L], [d, L]], 30 / fo, { k: 'bed', ...o });
}
// a crescendo: from L0 to L1 over [t0, t1], then held for `h` and released
export function swell(t0, t1, L0, L1, o = {}) {
  const d = t1 - t0, h = o.h ?? 0;
  return cue(t0, [[0, L0 - 20], [Math.min(0.3, d / 4), L0], [d, L1], [d + h, L1 - (o.sag ?? 0)]], o.rate ?? 14, { k: 'swell', ...o });
}
// speech: flat while the line lasts (duration in seconds from the voice manifest)
export const line = (t, id, L, dur, o = {}) => cue(t, [[0, L - 18], [0.06, L], [Math.max(0.1, dur - 0.05), L]], 90, { k: 'line', id, dur, ...o });

// ---- evaluation ----
function curve(c, tau, rate) {
  const p = c.pts, n = p.length;
  if (tau >= p[n - 1][0]) return p[n - 1][1] - rate * (tau - p[n - 1][0]);
  let i = 0;
  while (i < n - 2 && tau >= p[i + 1][0]) i++;
  const [t0, l0] = p[i], [t1, l1] = p[i + 1];
  return t1 > t0 ? l0 + (l1 - l0) * (tau - t0) / (t1 - t0) : l1;
}
function wob(c, tau, L) {
  if (!c.lfo) return L;
  const { f, m, ph = 0, sq = 0 } = c.lfo, s = Math.sin(TAU * f * tau + ph);
  return L + m * (sq ? Math.sign(s) * Math.pow(Math.abs(s), 0.35) : s);
}
// what the audience hears from this cue at time t
export function levelAt(c, t) {
  const tau = t - c.t;
  if (tau < 0 || t > c.end) return -Infinity;
  const L = wob(c, tau, curve(c, tau, c.rate));
  return L < MIN ? -Infinity : L;
}
// how well this cue hides another sound at t: post-masking caps the release, pre-masking looks ahead
export function maskAt(c, t) {
  const f = (x) => {
    const tau = x - c.t;
    if (tau < 0 || x > c.mend) return -Infinity;
    const L = wob(c, tau, curve(c, tau, Math.min(c.rate, POST)));
    return L < MIN ? -Infinity : L;
  };
  return Math.max(f(t), Math.max(f(t + PRE / 3), f(t + PRE * 2 / 3), f(t + PRE)) - 3);
}

function finish(c) {
  const last = c.pts[c.pts.length - 1];
  const top = Math.max(...c.pts.map((p) => p[1])) + (c.lfo ? c.lfo.m : 0);
  c.end = c.t + last[0] + Math.max(0, top - MIN) / Math.max(1, c.rate);
  c.mend = c.t + last[0] + Math.max(0, top - MIN) / Math.max(1, Math.min(c.rate, POST));
  return c;
}

// ---- measured envelopes ----
export function envAt(a, hz, t) {
  const x = t * hz, i = Math.floor(x);
  if (i < 0 || i >= a.length) return -Infinity;
  const p = a[i], q = i + 1 < a.length ? a[i + 1] : -Infinity;
  if (q === -Infinity || p === -Infinity) return x - i < 0.5 ? p : q;
  return p + (q - p) * (x - i);
}
// the same pre-masking as maskAt, over a post-masked envelope
const envMask = (a, hz, t) => Math.max(envAt(a, hz, t), Math.max(envAt(a, hz, t + PRE / 3), envAt(a, hz, t + PRE * 2 / 3), envAt(a, hz, t + PRE)) - 3);
// envelopes travel as base64 bytes, half a dB a step (0 = silence)
export function packEnv(a) {
  const b = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) b[i] = a[i] === -Infinity ? 0 : Math.max(1, Math.min(255, Math.round(a[i] * 2)));
  let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unpackEnv(s) {
  const bin = atob(s), a = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) { const v = bin.charCodeAt(i); a[i] = v ? v / 2 : -Infinity; }
  return a;
}
export const unpackEnvs = (e) => e && { hz: e.hz, global: unpackEnv(e.global), local: Object.fromEntries(Object.entries(e.local || {}).map(([k, v]) => [k, unpackEnv(v)])) };

// A compiled film: global cues (the film itself, the whole audience reacting) and local ones
// (a snorer, a sneezer, a scared friend) that are loud near their seat and quieter further away.
// A local source falls silent while its owner is hushed (the snorer woke up, the fan is sulking).
export class Film {
  constructor(script, cast = []) {
    this.dur = script.dur;
    this.cues = script.cues.map(finish).sort((a, b) => a.t - b.t);
    this.global = this.cues.filter((c) => !c.src);
    this.local = this.cues.filter((c) => c.src);
    this.shots = script.shots || [];
    this.cc = (script.cc || []).slice().sort((a, b) => a.t - b.t);
    this.tele = script.tele || [];
    this.grid = script.grid || null;   // musical numbers: [{t0, t1, B}] beat grids
    this.seats = new Map(cast.map((p) => [p.id, p]));
    this.maxEnd = Math.max(...this.cues.map((c) => c.mend));
  }
  // The film as it actually sounds: loudness envelopes measured from the rendered reel (film dB,
  // env.hz samples a second: { hz, global, local: { src } }, see audio/reel.js envelopes). Once
  // heard, masking follows the real sound instead of the script's curves, so every gap between
  // two snores and every swell of the strings counts exactly as your ears count it.
  hear(env) {
    if (!env) { this.env = null; return this; }
    const step = POST / env.hz, post = (a) => { const o = new Float32Array(a.length); let p = -Infinity; for (let i = 0; i < a.length; i++) o[i] = p = Math.max(a[i], p - step); return o; };
    this.env = { hz: env.hz, g: env.global, gm: post(env.global), l: Object.entries(env.local || {}).map(([src, a]) => [src, post(a)]) };
    return this;
  }
  // loudness of the film everywhere in the room (no local sources)
  F(t) {
    if (this.env) return psum(envMask(this.env.gm, this.env.hz, t), FLOOR);
    let s = -Infinity;
    for (const c of this.global) { if (c.t > t + PRE) break; if (t <= c.mend) s = psum(s, maskAt(c, t)); }
    return psum(s, FLOOR);
  }
  // loudness as played (no masking extensions), for meters and the reel test
  played(t) {
    if (this.env) return psum(envAt(this.env.g, this.env.hz, t), FLOOR);
    let s = -Infinity;
    for (const c of this.global) { if (c.t > t) break; if (t <= c.end) s = psum(s, levelAt(c, t)); }
    return psum(s, FLOOR);
  }
  // masking level at a seat: the film plus every local source, attenuated by distance
  maskAtSeat(t, x, z, Fg = this.F(t)) {
    let s = Fg;
    if (this.env) {
      for (const [src, a] of this.env.l) {
        const who = this.seats.get(src);
        if (!who || who.hush?.(t)) continue;
        s = psum(s, envMask(a, this.env.hz, t) - atten(dist(who.x, who.z, x, z)));
      }
      return s;
    }
    for (const c of this.local) {
      if (c.t > t + PRE) break;
      if (t > c.mend) continue;
      const who = this.seats.get(c.src);
      if (!who || who.hush?.(t)) continue;
      s = psum(s, maskAt(c, t) - atten(dist(who.x, who.z, x, z)));
    }
    return s;
  }
  captionsAt(t) { return this.cc.filter((c) => t >= c.t && t < c.t + c.dur); }
  shotAt(t) {
    let s = this.shots[0] || null;
    for (const x of this.shots) { if (x.t <= t) s = x; else break; }
    return s;
  }
  cuesAt(t, kind) { return this.cues.filter((c) => (!kind || c.k === kind) && t >= c.t && t <= c.end); }
  // loudness curve for the share card and tests
  sample(hz = 10, fn = (t) => this.played(t)) {
    const n = Math.ceil(this.dur * hz), out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = fn(i / hz);
    return out;
  }
}
