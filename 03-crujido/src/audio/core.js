// Audio core: one lazily-created context, a bus graph that models a cinema and decoded sample
// playback. Everything else in src/audio/ schedules nodes through the helpers exported here.

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

// The auditorium: the film comes out of the screen speakers into a short, heavily damped room
// (cinemas are built dead); people around you sit in the same room but closer; your own mouth
// is inside your head, dry and centred. Masked crunches are sent through a muffled path.
export class Graph {
  constructor(c) {
    this.ctx = c;
    this.out = gain(c, 0.9);
    // gentle glue, then a brickwall: the reel arrives already limited, so this only catches sums
    // (a scream next to you on top of the audience on top of an explosion)
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.25;
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
    this.master = gain(c, 1);
    chain(this.master, comp, lim, this.out, c.destination);
    this.room = c.createConvolver(); this.room.buffer = impulse(c, 0.9, 3.2, { pre: 0.012, dark: 0.7, seed: 5, early: [[0.021, 0.3], [0.037, 0.22], [0.052, 0.12]] });
    this.roomIn = gain(c, 1); chain(this.roomIn, this.room, gain(c, 0.6), this.master);
    const lv = { reel: 1, local: 0.9, ppl: 1, me: 1, music: 0.55, amb: 0.5, sfx: 0.8, ui: 0.5, voice: 1 };
    this.bus = {}; this.lv = lv;
    for (const k in lv) { this.bus[k] = gain(c, lv[k]); this.bus[k].connect(this.master); }
    const sends = { reel: 0.16, local: 0.3, ppl: 0.26, me: 0.04, sfx: 0.12, voice: 0.2 };
    for (const k in sends) this.bus[k].connect(gain(c, sends[k])).connect(this.roomIn);
    // what a hidden crunch sounds like to you: swallowed by the film, dull and small
    this.muffleIn = gain(c, 1);
    chain(this.muffleIn, filt(c, 'lowpass', 1200, 0.6), gain(c, 0.5), this.bus.me);
    this.ducks = [[this.bus.music.gain, db(-10)], [this.bus.amb.gain, db(-6)]];
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
    for (const [id, m] of Object.entries(man.voices?.[lang] || {})) add('line', id, m);
    for (const [id, m] of Object.entries(man.fx || {})) add('fx', id, m);
    let done = 0; const total = items.length || 1; onProgress?.(items.length ? 0 : 1);
    const work = async () => {
      while (items.length) {
        const it = items.shift();
        try {
          const r = await fetch(it.m.file); if (!r.ok) throw new Error(r.status + ' ' + it.m.file);
          this.samples.set(it.id, { kind: it.kind, m: it.m, buf: await decode(c, await r.arrayBuffer()) });
        } catch (e) { console.info('[CRUJIDO audio] skipped', it.id, e?.message || e); }
        onProgress?.(++done / total);
      }
    };
    await Promise.all([0, 1, 2, 3, 4, 5].map(work));
  },
  async switchLang(lang) {
    for (const [id, s] of [...this.samples]) if (s.kind === 'line') this.samples.delete(id);
    await this.loadManifest(this.man, lang);
  },
  meta(id) { const v = this.man?.voices; return v?.[this.lang]?.[id] || this.man?.fx?.[id] || null; },
  buf(id) { return this.samples.get(id)?.buf || null; },
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
    try { src.start(t); } catch { return null; }
    const dur = s.buf.duration / rate;
    if (o.duck) this.duck(t, dur);
    return { t0: t, dur, stop: (f = 0.06) => { try { const n = Math.max(t, this.now); hold(g.gain, n); g.gain.linearRampToValueAtTime(0, n + f); src.stop(n + f + 0.02); } catch { /* ended */ } } };
  },

  // Speech: film voices are baked into the reel; this is for people in the room. Captions need
  // the text even when muted, so the metadata is always returned.
  say(id, o = {}) {
    const m = this.meta(id); if (!m) return null;
    const r = { id, who: m.who, text: m.text, dur: m.dur || 1.2, h: null };
    r.h = this.play(id, { bus: 'ppl', gain: 1, ...o });
    if (r.h) r.dur = r.h.dur;
    return r;
  }
};
