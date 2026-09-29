// Audio core: one lazily-created context and a mixing graph for a Spanish flat. Every sound in GATO CON TOSTADA
// is synthesised: the fridge, the clock, the tap, the paradox humming under the cat, the cat itself (meows,
// purrs, a hiss), the butter, the breakages, the dog, the box. src/audio.js schedules nodes through the
// helpers here.

export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
export const db = x => Math.pow(10, x / 20);
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

export function gain(c, v = 1) { const g = c.createGain(); g.gain.value = v; return g; }
export function filt(c, type, f, q = 0.707, g = 0) {
  const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (g) b.gain.value = g; return b;
}
export function pan(c, p = 0) {
  if (!c.createStereoPanner) return gain(c, 1);
  const s = c.createStereoPanner(); s.pan.value = clamp(p, -1, 1); return s;
}
export function chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }
export function hold(p, t) {
  if (p.cancelAndHoldAtTime) { try { p.cancelAndHoldAtTime(t); return; } catch { /* fall through */ } }
  const v = p.value; p.cancelScheduledValues(t); p.setValueAtTime(v, t);
}
export function glide(p, v, t, tau = 0.03) { hold(p, t); p.setTargetAtTime(v, t, tau); }

export function softclip(c, drive = 2) {
  const ws = c.createWaveShaper(), n = 1024, k = Math.tanh(drive), cv = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; cv[i] = Math.tanh(x * drive) / k; }
  ws.curve = cv; ws.oversample = '2x'; return ws;
}

function lcg(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 * 2 - 1; }

// Loopable noise: the tail is crossfaded into the head, then trimmed, so a looping
// source never clicks at the seam (matters for brown noise, which drifts).
export function noiseBuf(c, sec = 2, color = 'white', seed = 1) {
  const sr = c.sampleRate, n = Math.floor(sec * sr), f = Math.min(n >> 3, 4096), raw = new Float32Array(n), rnd = lcg(seed);
  let b0 = 0, b1 = 0, b2 = 0, br = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd();
    if (color === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; raw[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22; }
    else if (color === 'brown') { br = (br + 0.02 * w) / 1.02; raw[i] = br * 3.2; }
    else raw[i] = w * 0.9;
  }
  const out = c.createBuffer(1, n - f, sr), d = out.getChannelData(0);
  for (let i = 0; i < n - f; i++) d[i] = raw[i];
  for (let i = 0; i < f; i++) { const k = i / f; d[i] = raw[i] * k + raw[n - f + i] * (1 - k); }
  return out;
}

export function impulse(c, sec = 1.6, decay = 2.4, { pre = 0.01, dark = 0.5, seed = 7, early = [] } = {}) {
  const sr = c.sampleRate, n = Math.floor(sec * sr), b = c.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch), rnd = lcg(seed + ch * 101); let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, w = rnd();
      if (t < pre) { d[i] = 0; continue; }
      const x = (t - pre) / (sec - pre), a = 1 - dark * 0.92 * Math.min(1, x * 1.6);
      lp += a * (w - lp);
      d[i] = lp * Math.pow(1 - x, decay);
    }
    for (const [et, eg] of early) { const i = Math.floor((et + ch * 0.007) * sr); if (i < n) d[i] += eg * (ch ? 0.8 : 1); }
  }
  return b;
}

// The air in a flat: tiles, a fridge door, a hard floor. A small bright room with a short tail, so a cup
// breaking or a cat landing in a box comes back a few milliseconds later off the kitchen wall. Outside, on
// the terrace at night, the room is left almost dry (roomSend).
export class Graph {
  constructor(c) {
    this.ctx = c;
    this.out = gain(c, 0.9);
    // gentle glue, then a brickwall that only catches sums (a vase, a bark and a yowl at once)
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
    this.master = gain(c, 1);
    chain(this.master, comp, lim, this.out, c.destination);
    this.roomIn = gain(c, 1);
    const hp = filt(c, 'highpass', 180, 0.6); this.roomIn.connect(hp);
    const room = c.createConvolver();
    room.buffer = impulse(c, 0.9, 3, { pre: 0.006, dark: 0.3, seed: 41, early: [[0.009, 0.32], [0.017, 0.24], [0.027, 0.16], [0.041, 0.1]] });
    this.roomOut = gain(c, 0.45);
    chain(hp, room, this.roomOut, this.master);
    const lv = { amb: 0.7, hum: 0.8, cat: 0.9, sfx: 0.9, dog: 0.85, ui: 0.5 };
    this.bus = {}; this.lv = lv;
    for (const k in lv) { this.bus[k] = gain(c, lv[k]); this.bus[k].connect(this.master); }
    const sends = { amb: 0.06, hum: 0.1, cat: 0.28, sfx: 0.32, dog: 0.3 };
    for (const k in sends) this.bus[k].connect(gain(c, sends[k])).connect(this.roomIn);
    this.ducks = [[this.bus.amb.gain, db(-6)], [this.bus.hum.gain, db(-4)]];
  }
  // indoors the tiles answer back; out on the terrace, hardly anything does
  roomSend(v) { glide(this.roomOut.gain, v, this.ctx.currentTime, 0.2); }
}

export const E = {
  ctx: null, g: null, nz: null, offline: false, muted: false, master: 0.9,
  duckEnd: 0, _primed: false,
  clock: null,                                   // offline renders drive time by hand

  init() {
    if (this.ctx) return this.ctx;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try { this.attach(new AC({ latencyHint: 'interactive' })); } catch { return null; }
    return this.ctx;
  },
  attach(c, offline = false) {
    this.ctx = c; this.offline = offline; this.g = new Graph(c); this.duckEnd = 0;
    this.nz = { white: noiseBuf(c, 2, 'white', 11), pink: noiseBuf(c, 3, 'pink', 23), brown: noiseBuf(c, 4, 'brown', 37) };
    this.g.out.gain.value = this.muted ? 0 : this.master;
  },
  async unlock() {
    const c = this.init(); if (!c) return false;
    if (c.state !== 'running') { try { await c.resume(); } catch { /* retry on next gesture */ } }
    if (!this._primed && c.state === 'running') {
      this._primed = true;
      try { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, c.sampleRate); s.connect(c.destination); s.start(0); } catch { /* ignore */ }
    }
    return c.state === 'running';
  },
  get unlocked() { return !!this.ctx && (this.offline || this.ctx.state === 'running'); },
  get live() { return this.unlocked && !this.muted; },
  get now() { return this.clock ?? (this.ctx ? this.ctx.currentTime : 0); },
  // node cleanup; skipped offline, where a timer firing mid-render would cut sounds short
  later(fn, ms) { if (!this.offline) setTimeout(fn, ms); },
  setMuted(m) { this.muted = !!m; if (this.g) glide(this.g.out.gain, this.muted ? 0 : this.master, this.ctx.currentTime, 0.03); },
  suspend() { if (this.ctx && !this.offline && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); },
  resume() { if (this.ctx && !this.offline && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); },

  duck(t, dur) {
    const end = t + dur; if (!this.g || end <= this.duckEnd) return;
    this.duckEnd = end;
    for (const [p, v] of this.g.ducks) { hold(p, t); p.linearRampToValueAtTime(v, t + 0.08); p.setValueAtTime(v, end); p.linearRampToValueAtTime(1, end + 0.45); }
  },
};
