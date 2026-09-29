// Audio core: one lazily-created context, a bus graph that models a real platform
// (clean close sounds, a bandpassed station PA with slap-back echo from the far
// speakers, a big hall tail) and decoded sample playback. Everything else in
// src/audio/ schedules nodes through the helpers exported here.

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

// A station loudspeaker: narrow band, a little cone breakup, then the same signal
// arriving again from the speakers further down the platform.
function speaker(G, dest, { hp = 380, lp = 3600, peak = 1800, pg = 5, drive = 2, level = 0.8, taps, fb = 0.22, hall = 0.5 }) {
  const c = G.ctx, input = gain(c, 1);
  const shaped = chain(input, filt(c, 'highpass', hp, 0.8), filt(c, 'lowpass', lp, 0.9), filt(c, 'peaking', peak, 1.1, pg), softclip(c, drive), gain(c, level));
  shaped.connect(dest);
  const echo = gain(c, 1); shaped.connect(echo); G.echoes.push(echo);
  taps.forEach(([dt, p, g], i) => {
    const d = c.createDelay(1); d.delayTime.value = dt;
    const tone = filt(c, 'lowpass', 2600 - i * 500, 0.6), out = gain(c, g);
    chain(echo, d, tone, out, pan(c, p), dest);
    if (i === taps.length - 1 && fb > 0) { const f = gain(c, fb); tone.connect(f).connect(d); }
  });
  const send = gain(c, hall); shaped.connect(send).connect(G.hallIn); G.hallSends.push([send, hall]);
  return input;
}

export class Graph {
  constructor(c) {
    this.ctx = c; this.echoes = []; this.hallSends = [];
    this.out = gain(c, 0.9);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -15; comp.knee.value = 12; comp.ratio.value = 3.2; comp.attack.value = 0.004; comp.release.value = 0.24;
    this.master = gain(c, 1);
    chain(this.master, comp, this.out, c.destination);
    this.room = c.createConvolver(); this.room.buffer = impulse(c, 0.5, 3.4, { pre: 0.003, dark: 0.3, seed: 3, early: [[0.011, 0.5], [0.023, 0.3]] });
    this.hall = c.createConvolver(); this.hall.buffer = impulse(c, 2.6, 2.1, { pre: 0.028, dark: 0.8, seed: 9, early: [[0.06, 0.25], [0.13, 0.18]] });
    this.roomIn = gain(c, 1); chain(this.roomIn, this.room, gain(c, 0.55), this.master);
    this.hallIn = gain(c, 1); this.hallRet = gain(c, 0.5); chain(this.hallIn, this.hall, this.hallRet, this.master);
    this.duckA = gain(c, 1); this.duckA.connect(this.master);   // music + ambience, dipped under speech
    this.duckM = gain(c, 1); this.duckM.connect(this.master);   // the departure melody, dipped less
    const lv = { music: 0.62, melody: 0.8, amb: 0.5, sfx: 0.9, ui: 0.55, voice: 1, pa: 0.95 };
    this.bus = {}; this.lv = lv;
    for (const k in lv) this.bus[k] = gain(c, lv[k]);
    this.bus.music.connect(this.duckA); this.bus.amb.connect(this.duckA);
    this.bus.sfx.connect(this.master); this.bus.ui.connect(this.master); this.bus.voice.connect(this.master);
    const sfxRoom = gain(c, 0.1); this.bus.sfx.connect(sfxRoom).connect(this.roomIn);
    const voiceRoom = gain(c, 0.12); this.bus.voice.connect(voiceRoom).connect(this.roomIn);
    this.paIn = speaker(this, this.master, { taps: [[0.105, -0.6, 0.34], [0.19, 0.55, 0.25], [0.31, -0.2, 0.17]], fb: 0.24, hall: 0.55 });
    this.bus.pa.connect(this.paIn);
    this.melIn = speaker(this, this.duckM, { hp: 170, lp: 6200, peak: 2600, pg: 3, drive: 1.25, level: 0.9, taps: [[0.12, -0.5, 0.26], [0.23, 0.5, 0.18]], fb: 0.18, hall: 0.42 });
    this.bus.melody.connect(this.melIn);
    this.ducks = [[this.duckA.gain, db(-8)], [this.duckM.gain, db(-4.5)]];
  }
  // per-station acoustics: open-air platforms slap, the terminal hall blooms
  space({ hall = 1, echo = 1 } = {}, t = this.ctx.currentTime) {
    for (const [s, v] of this.hallSends) glide(s.gain, v * hall, t, 0.2);
    for (const e of this.echoes) glide(e.gain, echo, t, 0.2);
    glide(this.hallRet.gain, 0.5 * Math.min(1.6, hall), t, 0.2);
  }
}

function decode(c, ab) {
  return new Promise((res, rej) => { const p = c.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
}

export const E = {
  ctx: null, g: null, nz: null, offline: false, muted: false, master: 0.9,
  samples: new Map(), man: null, lang: 'es', duckEnd: 0, _primed: false,
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

  async loadManifest(man, lang = 'es', onProgress) {
    this.man = man; this.lang = lang;
    const c = this.init(); if (!c || !man) { onProgress?.(1); return; }
    const items = [], add = (kind, id, m) => { if (m?.file && !this.samples.has(id)) items.push({ id, kind, m }); };
    for (const [id, m] of Object.entries(man.voices?.ja || {})) add('ja', id, m);
    for (const [id, m] of Object.entries(man.voices?.[lang] || {})) add('line', id, m);
    for (const [id, m] of Object.entries(man.fx || {})) add('fx', id, m);
    let done = 0; const total = items.length || 1; onProgress?.(items.length ? 0 : 1);
    const work = async () => {
      while (items.length) {
        const it = items.shift();
        try {
          const r = await fetch(it.m.file); if (!r.ok) throw new Error(r.status + ' ' + it.m.file);
          this.samples.set(it.id, { kind: it.kind, m: it.m, buf: await decode(c, await r.arrayBuffer()) });
        } catch (e) { console.info('[QUE CIERRAN audio] skipped', it.id, e?.message || e); }
        onProgress?.(++done / total);
      }
    };
    await Promise.all([0, 1, 2, 3, 4, 5].map(work));
  },
  async switchLang(lang) {
    for (const [id, s] of [...this.samples]) if (s.kind === 'line') this.samples.delete(id);
    await this.loadManifest(this.man, lang);
  },
  meta(id) { const v = this.man?.voices; return v?.ja?.[id] || v?.[this.lang]?.[id] || this.man?.fx?.[id] || null; },
  has(id) { return this.samples.has(id); },

  duck(t, dur) {
    const end = t + dur; if (!this.g || end <= this.duckEnd) return;
    this.duckEnd = end;
    for (const [p, v] of this.g.ducks) { hold(p, t); p.linearRampToValueAtTime(v, t + 0.08); p.setValueAtTime(v, end); p.linearRampToValueAtTime(1, end + 0.45); }
  },

  play(id, o = {}) {
    if (!this.live) return null;
    const s = this.samples.get(id); if (!s) return null;
    const c = this.ctx, t = this.now + (o.delay || 0), rate = o.rate || 1;
    const src = c.createBufferSource(); src.buffer = s.buf; src.playbackRate.value = rate;
    const g = gain(c, o.gain ?? 1); let head = src;
    if (o.lp) head = chain(head, filt(c, 'lowpass', o.lp, 0.7));
    if (o.hp) head = chain(head, filt(c, 'highpass', o.hp, 0.7));
    head.connect(g);
    const dest = o.dest || this.g.bus[o.bus || 'sfx'];
    if (o.pan) chain(g, pan(c, o.pan), dest); else g.connect(dest);
    if (o.room) chain(g, gain(c, o.room), this.g.roomIn);
    if (o.hall) chain(g, gain(c, o.hall), this.g.hallIn);
    try { src.start(t); } catch { return null; }
    const dur = s.buf.duration / rate;
    if (o.duck) this.duck(t, dur);
    return { t0: t, dur, stop: (f = 0.06) => { try { const n = Math.max(t, this.now); hold(g.gain, n); g.gain.linearRampToValueAtTime(0, n + f); src.stop(n + f + 0.02); } catch { /* ended */ } } };
  },

  // Speech, routed by who is talking: the announcer through the platform PA, the
  // pusher (you) dry and centred, passengers from the doorway. Captions need the
  // text even when muted, so the metadata is always returned.
  say(id, o = {}) {
    const m = this.meta(id); if (!m) return null;
    const who = m.who || 'crowd', r = { id, who, text: m.text, sub: m.sub, dur: m.dur || 1.5, h: null };
    const route = who === 'ann' ? { bus: 'pa', gain: 1 }
      : who === 'me' ? { bus: 'voice', gain: 1.05, room: 0.05 }
      : who === 'crowd' ? { bus: 'voice', gain: 0.72, pan: o.pan ?? -0.25, room: 0.3 }
      : { bus: 'voice', gain: 0.95, pan: o.pan ?? 0.1, room: 0.16 };
    r.h = this.play(id, { ...route, ...o, duck: true });
    if (r.h) r.dur = r.h.dur;
    return r;
  }
};
