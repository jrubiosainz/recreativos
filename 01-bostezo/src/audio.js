// BOSTEZO audio engine — dependency-free WebAudio ES module.
// Everything is intentionally procedural and soft-mixed for a cozy office-comedy feel.

const TAU = Math.PI * 2;
const EPS = 1e-5;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const db = d => Math.pow(10, d / 20);
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const emptyEnvelope = new Float32Array(0);

function safeWindowAudioContext() {
  const w = typeof window !== 'undefined' ? window : globalThis;
  return w.AudioContext || w.webkitAudioContext || null;
}

function createGain(ctx, value = 1) {
  const n = ctx.createGain();
  n.gain.value = value;
  return n;
}

function setParam(param, value, time, ramp = 0.01) {
  value = Number.isFinite(value) ? value : 0;
  try {
    param.cancelScheduledValues(time);
    param.setValueAtTime(Math.max(EPS, param.value || EPS), time);
    if (ramp <= 0) param.setValueAtTime(value, time);
    else param.linearRampToValueAtTime(value, time + ramp);
  } catch {
    param.value = value;
  }
}

function setParamExp(param, value, time, ramp = 0.01) {
  value = Math.max(EPS, Number.isFinite(value) ? value : EPS);
  try {
    param.cancelScheduledValues(time);
    param.setValueAtTime(Math.max(EPS, param.value || EPS), time);
    if (ramp <= 0) param.setValueAtTime(value, time);
    else param.exponentialRampToValueAtTime(value, time + ramp);
  } catch {
    param.value = value;
  }
}

function choose(arr) { return arr[(Math.random() * arr.length) | 0]; }

function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

function panStereo(ctx, pan = 0) {
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    return p;
  }
  const p = ctx.createPanner();
  p.panningModel = 'equalpower';
  p.setPosition(clamp(pan, -1, 1), 0, 1 - Math.abs(clamp(pan, -1, 1)));
  return p;
}

function makeNoiseBuffer(ctx, seconds = 2, color = 'white') {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let y = 0;
  for (let i = 0; i < len; i++) {
    const x = Math.random() * 2 - 1;
    if (color === 'brown') {
      y = (y + 0.02 * x) / 1.02;
      d[i] = y * 3.5;
    } else if (color === 'pink') {
      y = 0.98 * y + 0.02 * x;
      d[i] = y + 0.35 * x;
    } else d[i] = x;
  }
  return buf;
}

function makeImpulse(ctx, seconds = 0.62, decay = 2.9) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const early = i < ctx.sampleRate * 0.035 ? 1.7 : 1;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * early * 0.33;
    }
  }
  return buf;
}

function computeEnvelope(buffer) {
  if (!buffer) return emptyEnvelope;
  const sr = buffer.sampleRate;
  const hop = Math.max(1, Math.floor(sr / 60));
  const frames = Math.max(1, Math.ceil(buffer.length / hop));
  const env = new Float32Array(frames);
  let max = EPS;
  const channels = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) channels.push(buffer.getChannelData(ch));
  for (let f = 0; f < frames; f++) {
    const a = f * hop, b = Math.min(buffer.length, a + hop);
    let sum = 0, n = 0;
    for (let i = a; i < b; i++) {
      let v = 0;
      for (let ch = 0; ch < channels.length; ch++) v += channels[ch][i] || 0;
      v /= channels.length || 1;
      sum += v * v; n++;
    }
    const rms = Math.sqrt(sum / Math.max(1, n));
    env[f] = rms; max = Math.max(max, rms);
  }
  const inv = 1 / max;
  for (let i = 0; i < env.length; i++) env[i] = clamp(Math.pow(env[i] * inv, 0.7));
  return env;
}

function decodeArrayBuffer(ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    const copy = arrayBuffer.slice ? arrayBuffer.slice(0) : arrayBuffer;
    const p = ctx.decodeAudioData(copy, resolve, reject);
    if (p && typeof p.then === 'function') p.then(resolve, reject);
  });
}

class EngineGraph {
  constructor(ctx) {
    this.ctx = ctx;
    this.noise = makeNoiseBuffer(ctx, 2, 'white');
    this.pinkNoise = makeNoiseBuffer(ctx, 2, 'pink');
    this.brownNoise = makeNoiseBuffer(ctx, 2, 'brown');

    this.master = createGain(ctx, 0.88);
    this.music = createGain(ctx, 0.76);
    this.musicPre = createGain(ctx, 1);
    this.musicDuck = createGain(ctx, 1);
    this.sfx = createGain(ctx, 0.86);
    this.voice = createGain(ctx, 0.94);
    this.yawn = createGain(ctx, 0.9);
    this.ambience = createGain(ctx, 0.42);

    this.yawnTone = ctx.createBiquadFilter();
    this.yawnTone.type = 'highshelf';
    this.yawnTone.frequency.value = 2800;
    this.yawnTone.gain.value = -3.2;

    this.musicMuffle = ctx.createBiquadFilter();
    this.musicMuffle.type = 'lowpass';
    this.musicMuffle.frequency.value = 18000;
    this.musicMuffle.Q.value = 0.55;

    this.reverbBus = createGain(ctx, 0.13);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeImpulse(ctx);
    this.reverbWet = createGain(ctx, 0.55);

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 18;
    this.comp.ratio.value = 5.5;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.16;

    this.safety = createGain(ctx, 0.84);

    this.musicPre.connect(this.musicDuck).connect(this.musicMuffle).connect(this.music).connect(this.master);
    this.sfx.connect(this.master);
    this.voice.connect(this.master);
    this.yawn.connect(this.yawnTone).connect(this.master);
    this.ambience.connect(this.master);
    this.reverbBus.connect(this.reverb).connect(this.reverbWet).connect(this.master);
    this.master.connect(this.comp).connect(this.safety).connect(ctx.destination);
  }

  bus(name) {
    if (name === 'music') return this.musicPre;
    return this[name] || this.sfx;
  }
}

class SampleHandle {
  constructor(engine, id, source, gain, startedAt, baseRate, offset, duration, sourceDuration, envelope, cleanup) {
    this.engine = engine;
    this.id = id;
    this.source = source;
    this.gainNode = gain;
    this.startTime = startedAt;
    this.duration = duration;
    this.rate = baseRate;
    this._offset = offset || 0;
    this._basePos = offset || 0;
    this._baseTime = startedAt;
    this._lastRate = baseRate;
    this._lastScale = engine.timeScale;
    this._sourceDuration = sourceDuration || duration * baseRate;
    this._env = envelope || emptyEnvelope;
    this._cleanup = cleanup;
    this._playing = true;
  }
  get playing() { return !!this._playing; }
  _position(t = this.engine.ctx.currentTime) {
    return this._basePos + Math.max(0, t - this._baseTime) * Math.abs(this._lastRate) * this._lastScale;
  }
  progress() { return clamp(this._position() / Math.max(EPS, this._sourceDuration)); }
  level() {
    if (!this._env.length) return 0;
    const p = this._position();
    const idx = clamp(Math.floor(p * 60), 0, this._env.length - 1);
    return this._env[idx] || 0;
  }
  setRate(r, rampTime = 0.1) {
    if (!this.source || !this.engine.ctx) return;
    const t = this.engine.ctx.currentTime;
    this._basePos = this._position(t);
    this._baseTime = t;
    this.rate = Math.max(0.05, r || 1);
    this._lastRate = this.rate;
    this._lastScale = this.engine.timeScale;
    setParam(this.source.playbackRate, this.rate * this.engine.timeScale, t, rampTime);
  }
  setGain(g, rampTime = 0.05) {
    if (!this.gainNode || !this.engine.ctx) return;
    setParam(this.gainNode.gain, Math.max(0, g), this.engine.ctx.currentTime, rampTime);
  }
  stop(fade = 0.05) {
    if (!this._playing || !this.engine.ctx) return;
    const t = this.engine.ctx.currentTime;
    this._playing = false;
    setParam(this.gainNode.gain, 0.0001, t, fade);
    try { this.source.stop(t + fade + 0.02); } catch {}
    if (this._cleanup) setTimeout(this._cleanup, Math.max(20, (fade + 0.08) * 1000));
  }
}

class SynthKit {
  constructor(engine) { this.e = engine; }
  get ctx() { return this.e.ctx; }
  get g() { return this.e.graph; }
  ok() { return !!(this.e.ctx && this.e.graph && !this.e.muted); }

  out(bus = 'sfx', gain = 1, pan = 0, t = this.ctx.currentTime) {
    const ctx = this.ctx;
    const level = createGain(ctx, gain);
    const p = panStereo(ctx, pan);
    level.connect(p).connect(this.g.bus(bus));
    return { in: level, gain: level.gain, pan: p, t };
  }

  osc(type, freq, dest, t, dur, gain = 0.1, opts = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = createGain(ctx, 0.0001);
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.detune) o.detune.value = opts.detune;
    o.connect(g).connect(dest);
    const a = opts.attack ?? 0.01, r = opts.release ?? 0.08, hold = Math.max(0, dur - a - r);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + a);
    g.gain.setValueAtTime(gain, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.04);
    return { o, g };
  }

  noise(dest, t, dur, gain = 0.1, filter = null, source = 'noise') {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = source === 'pink' ? this.g.pinkNoise : source === 'brown' ? this.g.brownNoise : this.g.noise;
    s.loop = true;
    const amp = createGain(ctx, 0.0001);
    let tail = amp;
    if (filter) {
      const f = ctx.createBiquadFilter();
      Object.assign(f, {});
      f.type = filter.type || 'bandpass';
      f.frequency.value = filter.freq || 1000;
      f.Q.value = filter.q || 1;
      if (filter.gain != null) f.gain.value = filter.gain;
      s.connect(f).connect(amp);
      tail = f;
    } else s.connect(amp);
    amp.connect(dest);
    const a = filter?.attack ?? 0.006, r = filter?.release ?? 0.04;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(gain, t + a);
    amp.gain.setValueAtTime(gain, Math.max(t + a, t + dur - r));
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (filter?.sweepTo && tail.frequency) tail.frequency.exponentialRampToValueAtTime(filter.sweepTo, t + dur);
    s.start(t); s.stop(t + dur + 0.04);
    return s;
  }

  click() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.45, -0.12, t);
    this.noise(o.in, t, 0.018, 0.18, { type: 'highpass', freq: 2500, q: 0.6, attack: 0.001, release: 0.014 });
    this.noise(o.in, t + 0.045, 0.025, 0.14, { type: 'bandpass', freq: 1700, q: 2.5, attack: 0.001, release: 0.018 });
    this.osc('triangle', 920, o.in, t + 0.002, 0.035, 0.045);
  }

  whoosh(dir = 1) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.5, clamp(dir, -1, 1) * 0.3, t);
    this.noise(o.in, t, 0.27, 0.16, { type: 'bandpass', freq: dir >= 0 ? 520 : 1800, sweepTo: dir >= 0 ? 2300 : 480, q: 0.8, attack: 0.018, release: 0.08 }, 'pink');
  }

  pop(pitch = 1) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.46, 0, t);
    const a = this.osc('sine', 420 * pitch, o.in, t, 0.18, 0.18, { attack: 0.002, release: 0.14 });
    a.o.frequency.exponentialRampToValueAtTime(145 * pitch, t + 0.12);
    this.noise(o.in, t, 0.035, 0.04, { type: 'bandpass', freq: 1800, q: 1.8, attack: 0.001, release: 0.03 });
  }

  tell() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.28, 0, t);
    const a = this.osc('sine', 650, o.in, t, 0.16, 0.055, { attack: 0.006, release: 0.08 });
    a.o.frequency.exponentialRampToValueAtTime(980, t + 0.14);
  }

  ding(n = 0) {
    if (!this.ok()) return;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    const t = this.ctx.currentTime, degree = scale[((n || 0) % scale.length + scale.length) % scale.length];
    const f = midiToHz(64 + degree);
    const o = this.out('sfx', 0.42, -0.1 + Math.random() * 0.2, t);
    [1, 2.01, 3.98].forEach((m, i) => this.osc(i ? 'sine' : 'triangle', f * m, o.in, t, 0.82 - i * 0.12, [0.14, 0.045, 0.018][i], { attack: 0.004, release: 0.65 }));
  }

  suspense() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.62, 0, t);
    this.osc('sine', 72, o.in, t, 0.33, 0.22, { attack: 0.006, release: 0.22 });
    [58, 61, 66].forEach((m, i) => this.osc('sawtooth', midiToHz(m), o.in, t + 0.05, 0.64, 0.035, { attack: 0.18, release: 0.35, detune: (i - 1) * 7 }));
    this.noise(o.in, t + 0.02, 0.48, 0.045, { type: 'lowpass', freq: 950, q: 0.9, attack: 0.05, release: 0.25 }, 'pink');
  }

  caught() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.75, 0, t);
    const scratch = this.noise(o.in, t, 0.38, 0.16, { type: 'bandpass', freq: 2600, sweepTo: 420, q: 7, attack: 0.002, release: 0.15 });
    [45, 42, 39].forEach((m, i) => {
      const s = this.osc('sawtooth', midiToHz(m), o.in, t + 0.36 + i * 0.18, 0.45, 0.055, { attack: 0.02, release: 0.28 });
      s.o.frequency.exponentialRampToValueAtTime(midiToHz(m - 2), t + 0.62 + i * 0.18);
    });
    this.noise(o.in, t + 0.36, 0.95, 0.035, { type: 'lowpass', freq: 550, q: 0.7, attack: 0.02, release: 0.35 }, 'brown');
  }

  strike() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.64, 0, t);
    this.osc('sine', 92, o.in, t, 0.24, 0.22, { attack: 0.002, release: 0.18 });
    this.noise(o.in, t + 0.01, 0.13, 0.16, { type: 'bandpass', freq: 780, q: 1.2, attack: 0.001, release: 0.08 }, 'pink');
  }

  psst() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.38, -0.05, t);
    this.noise(o.in, t, 0.025, 0.2, { type: 'highpass', freq: 1800, q: 0.7, attack: 0.001, release: 0.018 });
    this.noise(o.in, t + 0.025, 0.28, 0.14, { type: 'bandpass', freq: 5200, q: 2.2, attack: 0.004, release: 0.09 });
  }

  tick() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.26, 0.16, t);
    this.osc('triangle', 1150, o.in, t, 0.045, 0.035, { attack: 0.001, release: 0.035 });
    this.noise(o.in, t, 0.035, 0.035, { type: 'bandpass', freq: 1350, q: 3, attack: 0.001, release: 0.028 });
  }

  paper() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.34, Math.random() * 0.4 - 0.2, t);
    for (let i = 0; i < 4; i++) this.noise(o.in, t + i * 0.045, 0.12, 0.06, { type: 'bandpass', freq: 900 + Math.random() * 2100, q: 0.75, attack: 0.005, release: 0.07 }, 'pink');
  }

  snort() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.42, 0, t);
    this.noise(o.in, t, 0.18, 0.14, { type: 'bandpass', freq: 360, q: 1.4, attack: 0.01, release: 0.07 }, 'brown');
    this.osc('sawtooth', 95, o.in, t + 0.02, 0.16, 0.045, { attack: 0.005, release: 0.09 });
  }

  uiHover() { if (this.ok()) { const t = this.ctx.currentTime, o = this.out('sfx', 0.22, 0, t); this.osc('sine', 520, o.in, t, 0.12, 0.04, { attack: 0.01, release: 0.07 }); } }
  uiClick() { if (this.ok()) { const t = this.ctx.currentTime, o = this.out('sfx', 0.28, 0, t); this.osc('triangle', 360, o.in, t, 0.11, 0.055, { attack: 0.003, release: 0.07 }); this.osc('sine', 720, o.in, t + 0.015, 0.08, 0.026, { attack: 0.003, release: 0.05 }); } }
  uiBack() { if (this.ok()) { const t = this.ctx.currentTime, o = this.out('sfx', 0.25, 0, t); const s = this.osc('sine', 460, o.in, t, 0.15, 0.05, { attack: 0.006, release: 0.09 }); s.o.frequency.exponentialRampToValueAtTime(260, t + 0.14); } }

  star(i = 0) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.42, (i - 1) * 0.15, t);
    const f = midiToHz(76 + i * 4);
    [0, 0.055, 0.11].forEach((d, k) => this.osc('sine', f * (k ? 1.5 : 1), o.in, t + d, 0.7, 0.08 / (k + 1), { attack: 0.003, release: 0.55 }));
    this.noise(o.in, t, 0.42, 0.025, { type: 'highpass', freq: 5200, q: 0.7, attack: 0.02, release: 0.35 });
  }

  winJingle() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.72, 0, t);
    const chords = [[60,64,67,71],[57,60,64,69],[62,65,69,72],[67,71,74,77]];
    chords.forEach((c, ci) => c.forEach((m, j) => this.osc(j ? 'sine' : 'triangle', midiToHz(m), o.in, t + ci * 0.55, 0.74, 0.045, { attack: 0.025, release: 0.42, detune: (j - 1.5) * 3 })));
    [72,76,79,84,83,79,76,72].forEach((m, i) => this.osc('triangle', midiToHz(m), o.in, t + 0.18 + i * 0.27, 0.29, 0.052, { attack: 0.012, release: 0.16 }));
    for (let i = 0; i < 16; i++) this.noise(o.in, t + i * 0.14, 0.055, 0.025, { type: 'highpass', freq: 6000, q: 0.5, attack: 0.002, release: 0.035 });
  }

  loseJingle() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.62, 0, t);
    [55, 54, 53, 52, 48].forEach((m, i) => {
      const s = this.osc('sawtooth', midiToHz(m), o.in, t + i * 0.33, i === 4 ? 0.9 : 0.35, 0.052, { attack: 0.025, release: 0.25, detune: -6 });
      s.o.frequency.exponentialRampToValueAtTime(midiToHz(m - 1), t + i * 0.33 + 0.28);
    });
  }

  fanfare() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.45, 0, t);
    [[60,64,67],[62,65,69]].forEach((c, i) => c.forEach(m => this.osc('triangle', midiToHz(m), o.in, t + i * 0.38, 0.44, 0.05, { attack: 0.02, release: 0.24 })));
    this.osc('sine', midiToHz(84), o.in, t + 0.74, 0.45, 0.06, { attack: 0.003, release: 0.32 });
  }

  stampRRHH() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, o = this.out('sfx', 0.78, 0, t);
    this.osc('sine', 55, o.in, t, 0.62, 0.28, { attack: 0.003, release: 0.48 });
    this.noise(o.in, t + 0.015, 0.18, 0.23, { type: 'bandpass', freq: 520, q: 0.9, attack: 0.001, release: 0.12 }, 'brown');
    this.noise(o.in, t + 0.09, 0.12, 0.11, { type: 'highpass', freq: 1800, q: 0.6, attack: 0.001, release: 0.08 });
  }
}

class ChoirEngine {
  constructor(engine) {
    this.e = engine;
    this.voices = [];
    this.target = 0;
    this.swellNodes = [];
  }
  stop() {
    if (!this.e.ctx) return;
    const t = this.e.ctx.currentTime;
    this.setVoices(0);
    for (const n of this.swellNodes.splice(0)) {
      setParam(n.gain.gain, 0.0001, t, 0.5);
      for (const o of n.oscs) { try { o.stop(t + 0.6); } catch {} }
    }
  }
  _makeVoice(i) {
    const ctx = this.e.ctx, graph = this.e.graph;
    const out = createGain(ctx, 0.0001);
    const pan = panStereo(ctx, -0.55 + (i % 10) * 0.12 + (Math.random() - 0.5) * 0.06);
    const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), f3 = ctx.createBiquadFilter();
    [f1, f2, f3].forEach(f => { f.type = 'bandpass'; f.Q.value = 7; });
    f1.frequency.value = 730 + Math.random() * 40;
    f2.frequency.value = 1090 + Math.random() * 60;
    f3.frequency.value = 2440 + Math.random() * 120;
    const mix = createGain(ctx, 0.24);
    const formMix = createGain(ctx, 1);
    const oscs = [];
    const notes = [36, 40, 43, 50, 57, 64, 67, 71, 74, 79];
    const base = midiToHz(notes[i % notes.length] + (i >= 10 ? 12 : 0));
    for (let k = 0; k < 2; k++) {
      const o = ctx.createOscillator();
      o.type = k ? 'triangle' : 'sawtooth';
      o.frequency.value = base * (k ? 2.001 : 1);
      o.detune.value = (Math.random() - 0.5) * 10;
      const vg = createGain(ctx, k ? 0.018 : 0.035);
      o.connect(vg);
      vg.connect(f1); vg.connect(f2); vg.connect(f3);
      o.start(); oscs.push(o);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = graph.pinkNoise; noise.loop = true;
    const ng = createGain(ctx, 0.012);
    noise.connect(ng); ng.connect(f1); noise.start();
    f1.connect(formMix); f2.connect(formMix); f3.connect(formMix);
    formMix.connect(mix).connect(out).connect(pan).connect(graph.yawn);
    const send = createGain(ctx, 0.07); out.connect(send).connect(graph.reverbBus);
    return { out, oscs, noise, f1, f2, f3, base, born: ctx.currentTime };
  }
  setVoices(n) {
    if (!this.e.ctx || !this.e.graph) return;
    n = clamp(Math.round(n || 0), 0, 40);
    this.target = n;
    const audible = Math.min(10, n);
    while (this.voices.length < audible) this.voices.push(this._makeVoice(this.voices.length));
    const t = this.e.ctx.currentTime;
    const richness = n <= 0 ? 0 : (0.018 + 0.115 * Math.log1p(n) / Math.log(41));
    this.voices.forEach((v, i) => {
      const on = i < audible && n > 0;
      const level = on ? richness * (0.85 + (i / 10) * 0.25) : 0.0001;
      setParam(v.out.gain, level, t, on ? 0.35 : 0.6);
      const morph = clamp(n / 12);
      setParam(v.f1.frequency, lerp(730, 560, morph), t, 0.7);
      setParam(v.f2.frequency, lerp(1090, 840, morph), t, 0.7);
    });
    for (let i = this.voices.length - 1; i >= audible; i--) {
      const v = this.voices[i];
      setParam(v.out.gain, 0.0001, t, 0.6);
      setTimeout(() => {
        try { v.noise.stop(); } catch {}
        v.oscs.forEach(o => { try { o.stop(); } catch {} });
      }, 900);
      this.voices.splice(i, 1);
    }
  }
  swell(duration = 4) {
    if (!this.e.ctx || !this.e.graph) return;
    const ctx = this.e.ctx, t = ctx.currentTime;
    this.setVoices(10);
    const g = createGain(ctx, 0.0001), pan = panStereo(ctx, 0);
    g.connect(pan).connect(this.e.graph.yawn);
    const send = createGain(ctx, 0.13); g.connect(send).connect(this.e.graph.reverbBus);
    const oscs = [];
    [36,40,43,48,52,55,62,67,71,76].forEach((m, i) => {
      const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 8; f1.frequency.value = 620 + (i % 3) * 260;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiToHz(m); o.detune.value = (Math.random() - 0.5) * 8;
      const vg = createGain(ctx, 0.018);
      o.connect(vg).connect(f1).connect(g); o.start(t); o.stop(t + duration + 1.2); oscs.push(o);
    });
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.28, t + duration * 0.72);
    g.gain.linearRampToValueAtTime(0.18, t + duration);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration + 1.0);
    this.swellNodes.push({ gain: g, oscs });
    setTimeout(() => this.swellNodes = this.swellNodes.filter(x => x.gain !== g), (duration + 1.5) * 1000);
  }
}

class SnoreEngine {
  constructor(engine) { this.e = engine; this.active = new Map(); }
  start(key, opts = {}) {
    if (!this.e.ctx || this.active.has(key)) return;
    const id = 'snore';
    if (this.e.has(id)) {
      const h = this.e.play(id, { bus: 'sfx', gain: opts.gain ?? 0.35, pan: opts.pan ?? 0, rate: 0.92 + Math.random() * 0.16 });
      if (!h) return this._proc(key, opts);
      h.source.loop = true;
      this.active.set(key, { type: 'sample', h });
    } else this._proc(key, opts);
  }
  _proc(key, opts = {}) {
    const ctx = this.e.ctx, graph = this.e.graph, t = ctx.currentTime;
    const out = createGain(ctx, (opts.gain ?? 0.28) * 0.7);
    const pan = panStereo(ctx, opts.pan ?? 0);
    out.connect(pan).connect(graph.sfx);
    const nodes = [];
    const schedule = () => {
      if (!this.active.has(key) || !this.e.ctx) return;
      const start = ctx.currentTime + 0.02;
      const kit = new SynthKit(this.e);
      const local = createGain(ctx, 1); local.connect(out);
      kit.noise(local, start, 1.15, 0.12, { type: 'bandpass', freq: 260, q: 1.4, attack: 0.18, release: 0.35 }, 'brown');
      const wh = kit.osc('sine', 480 + Math.random() * 70, local, start + 1.18, 1.0, 0.035, { attack: 0.2, release: 0.45 });
      wh.o.frequency.exponentialRampToValueAtTime(330, start + 2.05);
      const timer = setTimeout(schedule, 2800 + Math.random() * 600); nodes.push(timer);
    };
    this.active.set(key, { type: 'proc', nodes, out });
    schedule();
  }
  stop(key) {
    const e = this.active.get(key); if (!e) return;
    this.active.delete(key);
    if (e.h) e.h.stop(0.2);
    if (e.nodes) e.nodes.forEach(clearTimeout);
    if (e.out && this.e.ctx) setParam(e.out.gain, 0.0001, this.e.ctx.currentTime, 0.25);
  }
}

class AmbienceEngine {
  constructor(engine) { this.e = engine; this.running = false; this.nodes = []; this.timer = null; }
  start() {
    if (!this.e.ctx || this.running) return;
    this.running = true;
    const ctx = this.e.ctx, g = this.e.graph;
    const out = g.ambience;
    const brown = ctx.createBufferSource(); brown.buffer = g.brownNoise; brown.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    const hum = createGain(ctx, 0.055); brown.connect(lp).connect(hum).connect(out); brown.start();
    this.nodes.push(brown, lp, hum);
    [100, 120].forEach((f, i) => { const o = ctx.createOscillator(); const og = createGain(ctx, i ? 0.008 : 0.012); o.type = 'sine'; o.frequency.value = f; o.connect(og).connect(out); o.start(); this.nodes.push(o, og); });
    this._randomOffice();
  }
  _randomOffice() {
    if (!this.running || !this.e.ctx) return;
    const delay = 3500 + Math.random() * 9000;
    this.timer = setTimeout(() => {
      if (!this.running) return;
      const k = new SynthKit(this.e), r = Math.random();
      if (r < 0.34) { const o = k.out('ambience', 0.22, Math.random() * 1.4 - 0.7); k.noise(o.in, this.e.ctx.currentTime, 0.25, 0.035, { type: 'bandpass', freq: 900, q: 1.1, attack: 0.04, release: 0.13 }, 'pink'); }
      else if (r < 0.66) { const o = k.out('ambience', 0.18, Math.random() * 1.2 - 0.6); k.osc('triangle', 145, o.in, this.e.ctx.currentTime, 0.32, 0.025, { attack: 0.06, release: 0.18 }); }
      else { const o = k.out('ambience', 0.16, Math.random() * 1.2 - 0.6); k.noise(o.in, this.e.ctx.currentTime, 0.38, 0.02, { type: 'highpass', freq: 3000, q: 0.5, attack: 0.05, release: 0.2 }); }
      this._randomOffice();
    }, delay);
  }
  stop() {
    if (!this.running) return;
    this.running = false;
    clearTimeout(this.timer);
    const t = this.e.ctx?.currentTime || 0;
    for (const n of this.nodes.splice(0)) {
      if (n.gain) setParam(n.gain, 0.0001, t, 0.5);
      if (n.stop) { try { n.stop(t + 0.55); } catch {} }
    }
  }
}

class MusicEngine {
  constructor(engine) {
    this.e = engine;
    this.playing = false;
    this.style = 'office';
    this.intensity = 0;
    this.muffled = 0;
    this.tempoScale = 1;
    this._timer = null;
    this._nextBeat = 0;
    this._beat = 0;
    this._bar = 0;
    this._pausedUntil = 0;
    this._rootStarted = false;
  }
  // (re)starts from bar one; switching style while playing restarts cleanly, and any
  // earlier stop() fade on the music bus is undone
  start(style = 'office') {
    if (!this.e.ctx) return;
    style = style || 'office';
    if (this.playing && this.style === style) return;
    if (this.playing) { clearInterval(this._timer); this._timer = null; }
    this.style = style;
    this.playing = true;
    const ctx = this.e.ctx;
    setParam(this.e.graph.musicPre.gain, 1, ctx.currentTime, 0.12);
    this._pausedUntil = 0;
    this._beat = 0; this._bar = 0; this._nextBeat = ctx.currentTime + 0.14;
    this._applyMuffle();
    this._timer = setInterval(() => this._tick(), 25);
    this._tick();
  }
  stop(fade = 1) {
    if (!this.e.ctx) return;
    this.playing = false;
    clearInterval(this._timer); this._timer = null;
    setParam(this.e.graph.musicPre.gain, 0.0001, this.e.ctx.currentTime, fade);
    setTimeout(() => { if (this.e.graph && !this.playing) this.e.graph.musicPre.gain.value = 1; }, Math.max(30, fade * 1000 + 50));
  }
  pause(duration = 1) {
    if (!this.e.ctx || !this.playing) return;
    const t = this.e.ctx.currentTime;
    this._pausedUntil = Math.max(this._pausedUntil, t + duration);
    setParam(this.e.graph.musicPre.gain, 0.0001, t, 0.025);
    setTimeout(() => { if (this.playing && this.e.ctx) setParam(this.e.graph.musicPre.gain, 1, this.e.ctx.currentTime, 0.5); }, duration * 1000);
  }
  setIntensity(x) { this.intensity = clamp(x); }
  setMuffled(x) { this.muffled = clamp(x); this._applyMuffle(); }
  setTempoScale(x) { this.tempoScale = clamp(x, 0.5, 1.2); }
  _bpm() { return (this.style === 'title' ? 84 : this.style === 'keynote' ? 104 : 96) * this.tempoScale * this.e.timeScale; }
  _spb() { return 60 / this._bpm(); }
  _applyMuffle() {
    if (!this.e.ctx || !this.e.graph) return;
    const f = lerp(18000, 500, this.muffled);
    setParamExp(this.e.graph.musicMuffle.frequency, f, this.e.ctx.currentTime, 0.25);
  }
  _tick() {
    if (!this.playing || !this.e.ctx) return;
    const ctx = this.e.ctx, look = 0.12;
    const cutoff = ctx.currentTime - 0.05;
    if (this._nextBeat < cutoff) this._nextBeat = ctx.currentTime + 0.03;
    while (this._nextBeat < ctx.currentTime + look) {
      if (this._nextBeat >= this._pausedUntil) this._scheduleBeat(this._nextBeat, this._beat);
      const swing = (this._beat % 2 === 0 ? 0 : 0.045) * (this.style === 'title' ? 0.7 : 1);
      this._beat++;
      if (this._beat % 4 === 0) this._bar++;
      this._nextBeat += this._spb() + swing;
    }
  }
  _scheduleBeat(t, beat) {
    const beatInBar = beat % 4, bar = Math.floor(beat / 4);
    const chord = this._chord(bar);
    if (beatInBar === 0) this._chordStab(t, chord, 0.7);
    if (beatInBar === 2) this._chordStab(t + this._spb() * 0.18, chord, 0.45);
    this._bass(t, chord, beatInBar);
    this._drums(t, beatInBar, beat);
    if (this.intensity > 0.22 && beatInBar === 0 && bar % (this.intensity > 0.65 ? 2 : 4) === 1) this._lead(t, chord, bar);
    if (this.style === 'keynote' && beatInBar === 0) this._pad(t, chord);
  }
  _chord(bar) {
    const prog = [
      { root: 48, notes: [60,64,67,71,74] }, { root: 45, notes: [57,60,64,67,71] },
      { root: 50, notes: [62,65,69,72,76] }, { root: 43, notes: [59,65,69,72,76] },
      { root: 52, notes: [55,59,62,67,71] }, { root: 45, notes: [57,61,67,70,76] },
      { root: 50, notes: [62,65,69,72,76] }, { root: 43, notes: [59,65,69,72,76] }
    ];
    return prog[bar % prog.length];
  }
  _out(gain = 1, pan = 0) {
    const ctx = this.e.ctx;
    const g = createGain(ctx, gain), p = panStereo(ctx, pan);
    g.connect(p).connect(this.e.graph.musicPre);
    return g;
  }
  _epiano(t, freq, dur, gain, pan = 0) {
    const ctx = this.e.ctx, out = this._out(gain, pan);
    const carrier = ctx.createOscillator(), mod = ctx.createOscillator(), modGain = createGain(ctx, freq * 1.7);
    const amp = createGain(ctx, 0.0001);
    carrier.type = 'sine'; mod.type = 'sine'; carrier.frequency.value = freq; mod.frequency.value = freq * 2;
    mod.connect(modGain).connect(carrier.frequency); carrier.connect(amp).connect(out);
    modGain.gain.setValueAtTime(freq * 1.6, t); modGain.gain.exponentialRampToValueAtTime(freq * 0.08, t + 0.45);
    amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(1, t + 0.015); amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    carrier.start(t); mod.start(t); carrier.stop(t + dur + 0.04); mod.stop(t + dur + 0.04);
  }
  _chordStab(t, chord, strength) {
    const vol = (this.style === 'title' ? 0.045 : 0.055) * strength;
    chord.notes.slice(0, 4).forEach((m, i) => this._epiano(t + i * 0.012, midiToHz(m), 1.25, vol / (i ? 1.25 : 1), -0.15 + i * 0.1));
  }
  _bass(t, chord, beatInBar) {
    const m = beatInBar < 2 ? chord.root : chord.root + 7;
    const ctx = this.e.ctx, out = this._out(0.12, -0.08);
    const o = ctx.createOscillator(), g = createGain(ctx, 0.0001), lp = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = midiToHz(m); lp.type = 'lowpass'; lp.frequency.value = 520;
    o.connect(lp).connect(g).connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + this._spb() * 0.72);
    o.start(t); o.stop(t + this._spb() * 0.8);
  }
  _drums(t, beatInBar, beat) {
    const kit = new SynthKit(this.e);
    const out = this._out(0.7, 0.05);
    if (beatInBar === 1 || beatInBar === 3) kit.noise(out, t + 0.01, 0.035, 0.055, { type: 'bandpass', freq: 1500, q: 2.2, attack: 0.001, release: 0.025 });
    if (beat % 2 === 0) kit.noise(out, t + this._spb() * 0.5, 0.055, 0.026 + this.intensity * 0.015, { type: 'highpass', freq: 5300, q: 0.6, attack: 0.002, release: 0.035 });
    if (this.intensity > 0.45) kit.noise(out, t + this._spb() * 0.75, 0.042, 0.018, { type: 'highpass', freq: 6500, q: 0.6, attack: 0.002, release: 0.03 });
  }
  _lead(t, chord, bar) {
    const motifs = [[0,2,4,7],[7,4,2,0],[4,7,9,7,4],[12,9,7,4]];
    const motif = motifs[bar % motifs.length];
    const scale = [0,2,4,5,7,9,11,12];
    const outPan = 0.22;
    motif.forEach((deg, i) => {
      const m = 72 + scale[deg % scale.length] + (deg >= 8 ? 12 : 0);
      const ctx = this.e.ctx, out = this._out(0.075, outPan);
      const o = ctx.createOscillator(), g = createGain(ctx, 0.0001);
      o.type = 'triangle'; o.frequency.value = midiToHz(m);
      const vib = ctx.createOscillator(), vg = createGain(ctx, 3.5); vib.type = 'sine'; vib.frequency.value = 5.3; vib.connect(vg).connect(o.frequency);
      o.connect(g).connect(out);
      const st = t + i * this._spb() * 0.47;
      g.gain.setValueAtTime(0.0001, st); g.gain.linearRampToValueAtTime(1, st + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, st + this._spb() * 0.42);
      o.start(st); vib.start(st); o.stop(st + this._spb() * 0.48); vib.stop(st + this._spb() * 0.48);
    });
  }
  _pad(t, chord) { chord.notes.slice(0, 3).forEach((m, i) => { const o = new SynthKit(this.e); const out = this._out(0.025, i * 0.18 - 0.18); o.osc('sawtooth', midiToHz(m - 12), out, t, this._spb() * 3.7, 0.06, { attack: 0.35, release: 0.7 }); }); }
}

const engine = {
  ctx: null,
  graph: null,
  samples: new Map(),
  loading: new Map(),
  handles: new Set(),
  yawnHandles: [],
  activeVoiceCount: 0,
  timeScale: 1,
  muted: false,
  volumes: { master: 0.88, music: 0.76, sfx: 0.86, voice: 0.94, yawn: 0.9, ambience: 0.42 },
  synth: null,
  choir: null,
  snore: null,
  music: null,
  ambience: null,

  async init() {
    if (!this.ctx) {
      const AC = safeWindowAudioContext();
      if (!AC) return false;
      this.ctx = new AC();
      this.graph = new EngineGraph(this.ctx);
      this.synth = new SynthKit(this);
      this.choir = new ChoirEngine(this);
      this.snore = new SnoreEngine(this);
      this.music = new MusicEngine(this);
      this.ambience = new AmbienceEngine(this);
      this._applyVolumes();
    }
    if (this.ctx.state !== 'running' && this.ctx.resume) {
      try { await this.ctx.resume(); } catch {}
    }
    return this.unlocked;
  },
  get unlocked() { return !!(this.ctx && this.ctx.state === 'running'); },
  now() { return this.ctx ? this.ctx.currentTime : 0; },

  _applyVolumes() {
    if (!this.graph) return;
    const t = this.ctx.currentTime;
    Object.entries(this.volumes).forEach(([k, v]) => {
      const node = this.graph[k];
      if (node?.gain) setParam(node.gain, this.muted ? 0 : clamp(v), t, 0.05);
    });
  },
  setMuted(b) { this.muted = !!b; this._applyVolumes(); },
  setVolume(bus, v) {
    if (!(bus in this.volumes)) return;
    this.volumes[bus] = clamp(v);
    this._applyVolumes();
  },
  setTimeScale(s) {
    this.timeScale = clamp(s, 0.25, 1);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const h of this.handles) if (h.source?.playbackRate) h.setRate(h.rate, 0.18);
    if (this.music) this.music._applyMuffle();
    if (this.graph?.musicMuffle) {
      const extra = lerp(0, 0.25, 1 - this.timeScale);
      setParamExp(this.graph.musicMuffle.frequency, lerp(18000, 900, Math.max(this.music?.muffled || 0, extra)), t, 0.25);
    }
  },

  async loadManifest(manifest, lang = 'es', onProgress) {
    if (!this.ctx) await this.init();
    if (!this.ctx || !manifest) { onProgress?.(1); return; }
    const items = [];
    const voices = manifest.voices?.[lang] || manifest.voices?.es || manifest.voices?.en || {};
    for (const [id, meta] of Object.entries(voices)) if (meta?.file) items.push({ id, file: meta.file, meta: { ...meta, kind: 'voice' } });
    for (const y of (manifest.yawns || [])) if (y?.id && y.file) items.push({ id: y.id, file: y.file, meta: { ...y, kind: 'yawn' } });
    for (const [id, meta] of Object.entries(manifest.fx || {})) if (meta?.file) items.push({ id, file: meta.file, meta: { ...meta, kind: 'fx' } });
    const queue = items.filter(it => !this.samples.has(it.id));
    let done = items.length - queue.length; onProgress?.(items.length ? done / items.length : 1);
    const worker = async () => {
      while (queue.length) {
        const it = queue.shift();
        await this._loadOne(it).catch(() => {});
        done++; onProgress?.(done / Math.max(1, items.length));
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  },
  // drop the loaded voice lines so another language can be loaded under the same ids
  unloadVoices() {
    for (const [id, s] of [...this.samples]) if (s.meta?.kind === 'voice') { this.samples.delete(id); this.loading.delete(s.file); }
  },
  async _loadOne({ id, file, meta }) {
    if (this.samples.has(id)) return;
    const key = file;
    try {
      let buffer = this.loading.get(key);
      if (!buffer) {
        const p = fetch(file).then(r => { if (!r.ok) throw new Error(`${r.status} ${file}`); return r.arrayBuffer(); }).then(ab => decodeArrayBuffer(this.ctx, ab));
        this.loading.set(key, p); buffer = p;
      }
      const audioBuffer = await buffer;
      this.samples.set(id, { id, file, buffer: audioBuffer, duration: audioBuffer.duration, envelope: computeEnvelope(audioBuffer), meta: meta || {} });
    } catch (err) {
      console.warn(`[BOSTEZO audio] Skipping ${id}: ${err?.message || err}`);
    }
  },
  has(id) { return this.samples.has(id); },
  duration(id) { return this.samples.get(id)?.duration || 0; },
  envelope(id) { return this.samples.get(id)?.envelope || emptyEnvelope; },
  yawnIds(gender) {
    const out = [];
    for (const [id, s] of this.samples) if (s.meta?.kind === 'yawn' && (!gender || s.meta.gender === gender)) out.push(id);
    return out;
  },

  play(id, opts = {}) {
    if (!this.ctx || !this.graph || this.muted) return null;
    const s = this.samples.get(id);
    if (!s?.buffer) return null;
    const ctx = this.ctx;
    const bus = opts.bus || (s.meta.kind === 'voice' ? 'voice' : s.meta.kind === 'yawn' ? 'yawn' : 'sfx');
    if (bus === 'yawn' && this.yawnHandles.length >= 14) {
      const oldest = this.yawnHandles.shift(); oldest?.stop?.(0.04);
    }
    const delay = Math.max(0, opts.delay || 0);
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = s.buffer;
    const gain = createGain(ctx, 0.0001);
    const rate = Math.max(0.05, opts.rate ?? 1);
    src.playbackRate.setValueAtTime(rate * this.timeScale, t);
    let chain = gain;
    if (opts.lowpass) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(40, opts.lowpass); lp.Q.value = 0.7; chain.connect(lp); chain = lp; }
    const pan = panStereo(ctx, opts.pan || 0); chain.connect(pan).connect(this.graph.bus(bus));
    if (bus === 'yawn' || bus === 'voice') { const send = createGain(ctx, bus === 'voice' ? 0.035 : 0.09); gain.connect(send).connect(this.graph.reverbBus); }
    const targetGain = Math.max(0, opts.gain ?? 1);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(targetGain, t + 0.012);
    const dur = s.buffer.duration / rate;
    const actualDur = s.buffer.duration / (rate * this.timeScale);
    const cleanup = () => { this.handles.delete(handle); this.yawnHandles = this.yawnHandles.filter(h => h !== handle); };
    const handle = new SampleHandle(this, id, src, gain, t, rate, 0, dur, s.buffer.duration, s.envelope, cleanup);
    let voiceReleaseTimer = null, voiceReleased = false;
    src.onended = () => {
      handle._playing = false; cleanup();
      if (voiceReleaseTimer) { clearTimeout(voiceReleaseTimer); voiceReleaseTimer = null; }
      if (bus === 'voice' && !voiceReleased) { voiceReleased = true; this._voiceEnded(); }
      if (typeof opts.onended === 'function') opts.onended();
      try { src.disconnect(); gain.disconnect(); pan.disconnect(); } catch {}
    };
    try { src.start(t); } catch { return null; }
    this.handles.add(handle);
    if (bus === 'yawn') this.yawnHandles.push(handle);
    if (bus === 'voice') voiceReleaseTimer = this._voiceStarted(actualDur + delay, () => { voiceReleased = true; voiceReleaseTimer = null; });
    return handle;
  },
  _voiceStarted(totalDur, markReleased) {
    this.activeVoiceCount++;
    if (this.graph) setParam(this.graph.musicDuck.gain, db(-7), this.ctx.currentTime, 0.06);
    return setTimeout(() => { markReleased?.(); this._voiceEnded(); }, Math.max(0, totalDur * 1000 + 40));
  },
  _voiceEnded() {
    this.activeVoiceCount = Math.max(0, this.activeVoiceCount - 1);
    if (this.activeVoiceCount === 0 && this.graph) setParam(this.graph.musicDuck.gain, 1, this.ctx.currentTime, 0.4);
  }
};

const Audio = {
  init: () => engine.init(),
  get unlocked() { return engine.unlocked; },
  loadManifest: (m, l, p) => engine.loadManifest(m, l, p),
  unloadVoices: () => engine.unloadVoices(),
  has: id => engine.has(id),
  duration: id => engine.duration(id),
  envelope: id => engine.envelope(id),
  play: (id, opts) => engine.play(id, opts),
  yawnIds: gender => engine.yawnIds(gender),
  setMuted: b => engine.setMuted(b),
  get muted() { return engine.muted; },
  setVolume: (bus, v) => engine.setVolume(bus, v),
  setTimeScale: s => engine.setTimeScale(s),
  now: () => engine.now(),
  suspend: () => engine.ctx?.suspend?.(),
  resume: () => engine.ctx?.resume?.(),
  get sfx() { return engine.synth || fallbackSfx; },
  get snore() { return engine.snore || fallbackSnore; },
  get choir() { return engine.choir || fallbackChoir; },
  get music() { return engine.music || fallbackMusic; },
  get ambience() { return engine.ambience || fallbackAmbience; },
  async renderPreview(seconds = 16, what = 'full') { return renderPreview(seconds, what); }
};

const noop = () => {};
const fallbackSfx = new Proxy({}, { get: () => noop });
const fallbackSnore = { start: noop, stop: noop };
const fallbackChoir = { setVoices: noop, swell: noop, stop: noop };
const fallbackMusic = { start: noop, stop: noop, setIntensity: noop, setMuffled: noop, setTempoScale: noop, pause: noop, playing: false };
const fallbackAmbience = { start: noop, stop: noop };

async function renderPreview(seconds = 16, what = 'full') {
  const OAC = (typeof OfflineAudioContext !== 'undefined' && OfflineAudioContext) || (typeof webkitOfflineAudioContext !== 'undefined' && webkitOfflineAudioContext);
  if (!OAC) throw new Error('OfflineAudioContext unavailable');
  const sr = 48000;
  const ctx = new OAC(2, Math.ceil(seconds * sr), sr);
  const old = {};
  for (const k of Object.keys(engine)) if (k !== 'unlocked') old[k] = engine[k];
  const graph = new EngineGraph(ctx);
  graph.master.gain.value = 2.25;
  Object.assign(engine, {
    ctx, graph, synth: new SynthKit(engine), choir: new ChoirEngine(engine), snore: new SnoreEngine(engine), music: new MusicEngine(engine), ambience: new AmbienceEngine(engine),
    muted: false, timeScale: 1, handles: new Set(), yawnHandles: [], activeVoiceCount: 0
  });

  const music = engine.music;
  music.style = 'office';
  music.setIntensity(what === 'music' ? 0.55 : 0.75);
  music.setTempoScale(1);
  for (let beat = 0, t = 0.05; t < seconds + 0.2; beat++) {
    music._scheduleBeat(t, beat);
    const swing = (beat % 2 === 0 ? 0 : 0.045);
    t += music._spb() + swing;
  }
  engine.ambience.start();
  if (what !== 'music') {
    const k = engine.synth;
    const burst = (t, freq, dur, gain) => k.osc('sine', freq, k.out('sfx', 0.6, 0, t).in, t, dur, gain, { attack: 0.006, release: dur * 0.7 });
    burst(0.4, 520, 0.16, 0.07);
    k.noise(k.out('sfx', 0.45, -0.1, 0.8).in, 0.8, 0.03, 0.16, { type: 'highpass', freq: 2500, attack: 0.001, release: 0.02 });
    burst(1.35, 780, 0.6, 0.08);
    k.noise(k.out('sfx', 0.5, 0.2, 2.2).in, 2.2, 0.28, 0.12, { type: 'bandpass', freq: 600, sweepTo: 2200, q: 0.9, attack: 0.02, release: 0.08 }, 'pink');
    burst(3.1, 140, 0.7, 0.18);
    k.noise(k.out('sfx', 0.55, 0, 4.0).in, 4.0, 0.5, 0.08, { type: 'lowpass', freq: 900, attack: 0.06, release: 0.25 }, 'pink');

    const choirOut = createGain(ctx, 0.0001);
    choirOut.connect(graph.yawn);
    choirOut.gain.setValueAtTime(0.0001, 2.4);
    choirOut.gain.linearRampToValueAtTime(0.22, 6.2);
    choirOut.gain.setValueAtTime(0.22, 8.5);
    choirOut.gain.exponentialRampToValueAtTime(0.0001, Math.min(seconds - 0.2, 12));
    [36,40,43,50,57,64,67,71].forEach((m, i) => {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 7; f.frequency.value = [650, 980, 2250][i % 3];
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiToHz(m); o.detune.value = (i - 4) * 3;
      const g = createGain(ctx, 0.018); o.connect(g).connect(f).connect(choirOut); o.start(2.35); o.stop(Math.min(seconds, 12.2));
    });
  }
  const buffer = await ctx.startRendering();
  clearInterval(engine.music._timer);
  Object.assign(engine, old);
  return buffer;
}

export { Audio };
export default Audio;
