// HIPO sound: the one import the game uses. Everything is synthesised from src/audio/kit.js: the
// hiccups, the pool's splashes and springs, the lifeguard's whistle, the cicadas and the far-off
// crowd, and the verbena band. The band plays a waltz whose downbeat IS the hiccup: «HIP-dos-tres».
// While Hipólito holds his breath the band chokes up and climbs a semitone per hiccup held, so the
// ear always knows where the clock is and how full he is.
import { E, gain, filt, chain, glide, mtof } from './audio/core.js';
import { burst, sweep, osc, env, noise, note, hit, input } from './audio/kit.js';
import { P } from './sim.js';

const rnd = Math.random;
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const bus = (k, p = 0) => input(E.g.bus[k], cl(p, -0.9, 0.9));
let cam = { x: 0, w: 20 };
const panOf = (x) => (x == null ? 0 : cl((x - cam.x) / (cam.w * 0.6), -0.8, 0.8));

// ---------- the hippo's body ----------
// a baby hiccup: a glottal click, then a squeezed «ih» that jumps up and falls; bigger ones are lower,
// longer and carry a spring under them
function hiccup(L, p = 0, v = 1, t = E.now) {
  const c = E.ctx, d = bus('me', p), f0 = [420, 360, 300, 250][L], len = [0.07, 0.1, 0.14, 0.2][L];
  const { g, end } = env(d, t, { pk: 0.34 * v, a: 0.003, d: len, sus: 0, len: len * 0.6, r: 0.05 });
  const f1 = filt(c, 'bandpass', 330, 5), f2 = filt(c, 'bandpass', 2300, 9), mix = gain(c, 1);
  chain(mix, f1, g); chain(mix, gain(c, 0.8), f2, g);
  const o = osc('sawtooth', f0, t, end, mix);
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.75, t + 0.03); o.frequency.exponentialRampToValueAtTime(f0 * 1.1, t + len);
  burst(d, t, { type: 'highpass', f: 2600, pk: 0.16 * v, a: 0.0005, d: 0.006, len: 0.004, r: 0.006 });
  if (L >= 1) sweep(bus('sfx', p), t + 0.01, 150, 150 + 110 * L, { pk: 0.1 + 0.05 * L, a: 0.004, d: 0.12, len: 0.1 + 0.04 * L, r: 0.05 });
  if (L === 3) slide(p, 520, 1500, 0.38, t + 0.04);
}
// «mm!»: the hiccup caught behind puffed cheeks
function store(n, p = 0, t = E.now) {
  const c = E.ctx, d = bus('me', p), lp = filt(c, 'lowpass', 520, 1.5);
  const { g, end } = env(d, t, { pk: 0.26, a: 0.006, d: 0.1, sus: 0.3, len: 0.09, r: 0.05 });
  lp.connect(g); const o = osc('triangle', 170 + 40 * n, t, end, lp); o.frequency.exponentialRampToValueAtTime(230 + 50 * n, t + 0.08);
  burst(d, t, { type: 'lowpass', f: 260, pk: 0.28, a: 0.002, d: 0.05, len: 0.03, r: 0.03 });
}
function slide(p, f0, f1, len, t = E.now) {
  const c = E.ctx, { g, end } = env(bus('sfx', p), t, { pk: 0.13, a: 0.02, d: 0.3, sus: 0.9, len, r: 0.06 });
  const o = osc('sine', f0, t, end, g); o.frequency.exponentialRampToValueAtTime(f1, t + len);
  const vib = gain(c, f0 * 0.03); vib.connect(o.frequency); osc('sine', 9, t, end, vib);
}
function thud(v, p = 0, t = E.now, wet = false) {
  const d = bus('steps', p);
  sweep(d, t, 130, 55, { pk: 0.18 + 0.3 * v, a: 0.002, d: 0.08, len: 0.06 + 0.05 * v, r: 0.05 });
  burst(d, t, { type: 'lowpass', f: 500 + 500 * v, pk: 0.08 + 0.12 * v, a: 0.001, d: 0.03, len: 0.02, r: 0.03 });
  if (wet) burst(d, t + 0.01, { f: 1300, q: 2, pk: 0.05 + 0.05 * v, a: 0.002, d: 0.04, len: 0.03, r: 0.03 });
}
function splash(v, p = 0, t = E.now) {
  const d = bus('sfx', p);
  burst(d, t, { color: 'white', f: 1800, to: 520, q: 0.7, pk: 0.14 + 0.3 * v, a: 0.004, d: 0.3, sus: 0.2, len: 0.12 + 0.3 * v, r: 0.2 });
  burst(d, t, { type: 'lowpass', f: 380, pk: 0.1 + 0.2 * v, a: 0.004, d: 0.1, len: 0.06, r: 0.08 });
  const n = 2 + Math.round(5 * v);
  for (let i = 0; i < n; i++) { const f = 900 + rnd() * 1500; sweep(d, t + 0.05 + rnd() * (0.2 + 0.4 * v), f, f * 1.6, { pk: 0.035, a: 0.001, d: 0.03, len: 0.025, r: 0.02 }); }
}
function boing(v, p = 0, t = E.now) {
  const c = E.ctx, { g, end } = env(bus('sfx', p), t, { pk: 0.16 + 0.12 * v, a: 0.003, d: 0.3, sus: 0.1, len: 0.28, r: 0.1 });
  const o = osc('sine', 260, t, end, g); o.frequency.exponentialRampToValueAtTime(120, t + 0.3);
  const w = gain(c, 40); w.connect(o.frequency); osc('sine', 17, t, end, w);
}
function creak(p = 0, t = E.now) {
  const c = E.ctx, bp = filt(c, 'bandpass', 950, 7), { g, end } = env(bus('sfx', p), t, { pk: 0.12, a: 0.02, d: 0.2, sus: 0.6, len: 0.22, r: 0.06 });
  const am = gain(c, 0); bp.connect(am); am.connect(g); const lfo = gain(c, 1); lfo.connect(am.gain); osc('square', 26, t, end, lfo);
  const o = osc('sawtooth', 150, t, end, bp); o.frequency.linearRampToValueAtTime(120, t + 0.22);
}
function crack(p = 0, t = E.now) {
  const d = bus('sfx', p);
  burst(d, t, { type: 'highpass', f: 2200, pk: 0.4, a: 0.0005, d: 0.02, len: 0.012, r: 0.02 });
  burst(d, t + 0.035, { type: 'bandpass', f: 1500, q: 1.2, pk: 0.3, a: 0.0005, d: 0.03, len: 0.02, r: 0.03 });
  sweep(d, t, 240, 90, { pk: 0.18, a: 0.001, d: 0.05, len: 0.05, r: 0.04, type: 'triangle' });
}
function whistle(v = 1, p = 0, t = E.now) {
  const c = E.ctx, len = 0.55, { g, end } = env(bus('ppl', p), t, { pk: 0.13 * v, a: 0.01, d: 0.3, sus: 0.9, len, r: 0.05 });
  const am = gain(c, 0.55), lfo = gain(c, 0.45); lfo.connect(am.gain); osc('square', 29, t, end, lfo); am.connect(g);
  osc('sine', 2950, t, end, am); osc('sine', 3180, t, end, am);
  burst(g, t, { type: 'highpass', f: 4000, pk: 0.4, a: 0.005, d: 0.3, sus: 0.6, len, r: 0.05 });
}
function crowd(kind, t = E.now) {
  // a pool's worth of kids through two vowel formants: «¡eeeh!» swells up, «oooh» sags
  const c = E.ctx, cheer = kind === 'cheer', len = cheer ? 1.6 : 1.1;
  const { g, end } = env(bus('ppl'), t, { pk: cheer ? 0.2 : 0.13, a: cheer ? 0.15 : 0.2, d: 0.6, sus: 0.8, len, r: 0.5 });
  const src = gain(c, 1);
  for (const [F, Q, G] of cheer ? [[650, 4, 1], [1900, 6, 0.6], [2900, 7, 0.3]] : [[420, 5, 1], [820, 6, 0.5]]) chain(src, filt(c, 'bandpass', F, Q), gain(c, G * 3), g);
  noise('pink', t, end, src);
  for (let i = 0; i < (cheer ? 9 : 5); i++) {
    const f = mtof((cheer ? 76 : 64) + Math.floor(rnd() * 8)), t0 = t + rnd() * 0.3;
    const e = env(g, t0, { pk: 0.04, a: 0.08, d: 0.5, sus: 0.7, len: len * (0.6 + rnd() * 0.4), r: 0.3 });
    const lp = filt(c, 'lowpass', 2200, 0.7); lp.connect(e.g);
    const o = osc('sawtooth', f, t0, e.end, lp); o.frequency.linearRampToValueAtTime(f * (cheer ? 1.12 : 0.8), t0 + len);
  }
}

// ---------- the verbena band: a waltz on the hiccup's clock ----------
// C major: I I V7 V7 V7 V7 I I, tuba on the downbeat, the accordion's «pah pah» on two and three
const BARS = [[48, [64, 67, 72]], [48, [64, 67, 72]], [43, [62, 65, 71]], [43, [62, 65, 71]], [43, [62, 65, 71]], [43, [62, 65, 71]], [48, [64, 67, 72]], [48, [64, 67, 72]]];
function reed(dest, t, m, len, v) {
  const c = E.ctx, lp = filt(c, 'lowpass', 2600, 0.8), { g, end } = env(dest, t, { pk: v * 0.05, a: 0.008, d: 0.08, sus: 0.7, len, r: 0.04 });
  lp.connect(g); const f = mtof(m);
  osc('sawtooth', f, t, end, lp).detune.value = -7; osc('sawtooth', f, t, end, lp).detune.value = 7; osc('square', f / 2, t, end, gain(c, 0.4)).connect(lp);
}
function tuba(dest, t, m, v) {
  const c = E.ctx, lp = filt(c, 'lowpass', 700, 1), { g, end } = env(dest, t, { pk: v * 0.3, a: 0.01, d: 0.18, sus: 0.4, len: 0.16, r: 0.06 });
  lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(380, t + 0.15);
  lp.connect(g); osc('sawtooth', mtof(m), t, end, lp); osc('sine', mtof(m), t, end, g);
}
const band = {
  on: false, bar: 0, clock: 0, beat: 0, key: 0, lp: null, in: null, wet: 0,
  build() {
    const c = E.ctx; this.in = gain(c, 1); this.lp = filt(c, 'lowpass', 16000, 0.6);
    chain(this.in, this.lp, E.g.bus.music);
  },
  start() { if (!E.ctx) return; if (!this.in) this.build(); this.on = true; this.clock = 0; this.beat = 1; this.bar = 0; },
  stop() { this.on = false; },
  down(held) {
    if (!this.on || !E.live) return;
    const [root] = BARS[this.bar % BARS.length], t = E.now;
    tuba(this.in, t, root + this.key - (this.bar % 2 ? 5 : 0) + (this.bar % 2 && root === 43 ? 7 : 0), held ? 0.55 : 1);
    hit('shaker', this.in, t, 0.25);
    this.clock = 0; this.beat = 1;
  },
  pah(i) {
    if (!E.live) return;
    const [, ch] = BARS[this.bar % BARS.length], t = E.now;
    for (const m of ch) reed(this.in, t, m + this.key, 0.1, i === 2 ? 0.75 : 1);
    hit('shaker', this.in, t, 0.15);
    if (i === 2) this.bar++;
  },
  frame(sim, dt) {
    if (!this.on || !E.ctx || !this.in) return;
    const h = sim.hic, per = h.cure > 0 || sim.end ? P.T : sim.period(), b = per / 3;
    this.clock += dt;
    if (this.beat === 1 && this.clock >= b) { this.pah(1); this.beat = 2; }
    else if (this.beat === 2 && this.clock >= 2 * b) { this.pah(2); this.beat = 3; }
    else if (this.beat === 3 && this.clock >= per * (h.cure > 0 || sim.end ? 1 : 1.25)) { this.bar++; this.down(false); }
    // holding: the band chokes up and climbs; under water it goes dull
    const key = sim.hp.hold ? h.k : 0;
    if (key !== this.key) this.key = key;
    const under = sim.hp.inWater && !sim.end ? 1 : 0, held = sim.hp.hold ? 1 : 0;
    const want = under ? 600 : held ? 2200 - 500 * h.k : 16000;
    if (Math.abs(want - this.wet) > 1) { glide(this.lp.frequency, want, E.now, 0.06); this.wet = want; }
  },
};

// ---------- the air: cicadas in the pines and a pool full of other people ----------
const amb = {
  g: null, cic: null, crowd: null,
  start(indoor) {
    if (!E.ctx || this.g) { this.set(indoor); return; }
    const c = E.ctx, t = E.now, end = t + 36000;
    this.g = gain(c, 0); this.g.connect(E.g.bus.amb);
    // cicadas: a narrow band of hiss chopped at 90 Hz, swelling in slow waves
    const bp = filt(c, 'bandpass', 5200, 5), chop = gain(c, 0), sw = gain(c, 0.5);
    chain(bp, chop, sw, (this.cic = gain(c, 0.1)), this.g);
    const lfo = gain(c, 0.5); lfo.connect(chop.gain); osc('square', 90, t, end, lfo);
    const slow = gain(c, 0.45); slow.connect(sw.gain); osc('sine', 0.13, t, end, slow);
    noise('white', t, end, bp);
    // the crowd: far voices and far splashes, a pink murmur
    const cb = filt(c, 'bandpass', 900, 0.7); chain(cb, (this.crowd = gain(c, 0.05)), this.g); noise('pink', t, end, cb);
    this.set(indoor);
  },
  set(indoor) {
    if (!this.g) return;
    const t = E.now; glide(this.g.gain, 1, t, 0.5);
    glide(this.cic.gain, indoor ? 0.015 : 0.1, t, 0.5); glide(this.crowd.gain, indoor ? 0.025 : 0.05, t, 0.5);
    E.g.setSpace(indoor ? 'rooms' : 'deck');
  },
  stop() { if (this.g) glide(this.g.gain, 0, E.now, 0.3); },
};

// ---------- continuous: footsteps, the held breath, the fall ----------
const body = { step: 0, breath: null, breathG: null, fall: null };
function breathTone(on, k, p) {
  const c = E.ctx;
  if (!body.breath) {
    body.breathG = gain(c, 0); body.breathG.connect(E.g.bus.me);
    const lp = filt(c, 'lowpass', 700, 2); lp.connect(body.breathG);
    body.breath = osc('triangle', 200, E.now, E.now + 36000, lp);
    const trem = gain(c, 0); trem.connect(body.breathG.gain); body.trem = trem; osc('sine', 7, E.now, E.now + 36000, trem);
  }
  const t = E.now;
  glide(body.breathG.gain, on ? 0.05 + 0.03 * k : 0, t, on ? 0.04 : 0.06);
  glide(body.trem.gain, on ? 0.012 + 0.03 * p : 0, t, 0.05);
  glide(body.breath.frequency, 190 * Math.pow(2, (k * 3 + p * 2) / 12), t, 0.05);
}
function fallStart(t = E.now) {
  const c = E.ctx; fallStop();
  const g = gain(c, 0), o = osc('sine', 1700, t, t + 6, g); g.connect(E.g.bus.sfx);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.08);
  o.frequency.setValueAtTime(1700, t); o.frequency.setTargetAtTime(420, t, 0.9);
  const wind = filt(c, 'bandpass', 500, 1.2), wg = gain(c, 0); chain(wind, wg, E.g.bus.sfx); noise('pink', t, t + 6, wind);
  wg.gain.setValueAtTime(0, t); wg.gain.linearRampToValueAtTime(0.16, t + 1.2); wind.frequency.setTargetAtTime(1600, t, 0.6);
  body.fall = { g, wg, o };
}
function fallStop() {
  const f = body.fall; if (!f) return; body.fall = null;
  const t = E.now; glide(f.g.gain, 0, t, 0.02); glide(f.wg.gain, 0, t, 0.03);
}

export const Audio = {
  init() { return E.init(); },
  unlock() { return E.unlock(); },
  setMuted(m) { E.setMuted(m); },
  suspend() { E.suspend(); },
  resume() { E.resume(); },
  get live() { return E.live; },
  listen(x, w) { cam.x = x; cam.w = w; },

  start(level) { if (!E.ctx) return; band.start(); amb.start(level.id === 'vestuarios'); body.step = 0; },
  stop() { band.stop(); amb.stop(); fallStop(); if (body.breathG) breathTone(false, 0, 0); },

  // what the sim said this tick
  event(e, sim) {
    if (!E.live) return;
    const p = panOf(e.x ?? sim.hp.x);
    switch (e.k) {
      case 'hic': hiccup(e.L, p); band.down(false); break;
      case 'store': store(e.n, p); band.down(true); break;
      case 'susto': slide(p, 480, 1700, 0.45); break;
      case 'launch': burst(bus('sfx', p), E.now, { f: 700, to: 2600, q: 1, pk: 0.05 + 0.02 * Math.min(4, e.H), a: 0.01, d: 0.2, len: 0.2, r: 0.1 }); break;
      case 'board': thud(0.8, panOf(sim.hp.x)); boing(0.6, p); break;
      case 'boing': boing(cl(e.v / 10), p); break;
      case 'land': if (!e.water) thud(cl(e.v / 14), p, E.now, true); break;
      case 'splash': splash(cl(e.v / 12), panOf(e.x)); break;
      case 'breach': splash(0.25, panOf(e.x)); sweep(bus('sfx', panOf(e.x)), E.now, 300, 900, { pk: 0.08, a: 0.003, d: 0.06, len: 0.06, r: 0.04 }); break;
      case 'bonk': hit('wood', bus('sfx', p), E.now, 0.9); sweep(bus('sfx', p), E.now + 0.05, 2400, 3200, { pk: 0.04, a: 0.002, d: 0.05, len: 0.05, r: 0.03 }); break;
      case 'creak': creak(p); break;
      case 'crack': crack(p); break;
      case 'chairBack': sweep(bus('sfx', p), E.now, 380, 900, { pk: 0.1, a: 0.002, d: 0.05, len: 0.05, r: 0.03, type: 'triangle' }); break;
      case 'cold': {
        const d = bus('sfx', p);
        burst(d, E.now, { type: 'highpass', f: 3200, pk: 0.14, a: 0.02, d: 0.3, sus: 0.7, len: 0.45, r: 0.15 });
        for (let i = 0; i < 7; i++) hit('tick', bus('me', p), E.now + 0.12 + i * 0.045, 0.5);
        break;
      }
      case 'drink': for (let i = 0; i < 2; i++) sweep(bus('me', p), E.now + i * 0.16, 360, 210, { pk: 0.14, a: 0.01, d: 0.08, len: 0.09, r: 0.04 }); break;
      case 'fizz': {
        const d = bus('sfx', p);
        burst(d, E.now, { type: 'highpass', f: 5200, pk: 0.09, a: 0.01, d: 0.4, sus: 0.5, len: 0.5, r: 0.2 });
        for (let i = 0; i < 14; i++) burst(d, E.now + rnd() * 0.5, { type: 'highpass', f: 3000 + rnd() * 3000, pk: 0.06, a: 0.0005, d: 0.004, len: 0.002, r: 0.004 });
        break;
      }
      case 'stick': { const d = bus('ui', p), m = 84 + [0, 4, 7, 12][Math.min(3, (e.n || 1) - 1)]; note('glock', d, E.now, m, 0.4, 0.9); note('glock', d, E.now + 0.09, m + 12, 0.5, 0.6); break; }
      case 'towel': for (let i = 0; i < 2; i++) burst(bus('sfx', p), E.now + i * 0.09, { color: 'pink', f: 900, q: 0.7, pk: 0.1, a: 0.01, d: 0.06, len: 0.05, r: 0.05 }); break;
      case 'whistleUp': burst(bus('ppl', panOf(e.g?.x)), E.now, { color: 'pink', f: 500, to: 1100, q: 1, pk: 0.05, a: 0.2, d: 0.3, sus: 0.8, len: 0.4, r: 0.05 }); break;
      case 'whistle': whistle(1, panOf(e.g?.x)); break;
      case 'dive': fallStart(); break;
      case 'impact': {
        fallStop();
        const d = bus('sfx', p);
        if (e.why === 'bomba') {
          sweep(d, E.now, 90, 36, { pk: 0.6, a: 0.003, d: 0.5, len: 0.45, r: 0.3 });
          splash(1, p); splash(0.8, p, E.now + 0.12);
          crowd('cheer', E.now + 0.25);
          E.play('kids_bomba', { bus: 'ppl', delay: 0.3, gain: 0.9 });
        } else {
          burst(d, E.now, { type: 'bandpass', f: 2300, q: 0.6, pk: 0.8, a: 0.0004, d: 0.02, len: 0.015, r: 0.03 });
          sweep(d, E.now, 110, 60, { pk: 0.4, a: 0.002, d: 0.1, len: 0.1, r: 0.08 });
          splash(0.45, p, E.now + 0.02);
          crowd('ooh', E.now + 0.2);
        }
        band.stop();
        break;
      }
      case 'respawn': sweep(bus('sfx', 0), E.now, 500, 1100, { pk: 0.08, a: 0.002, d: 0.05, len: 0.05, r: 0.03 }); break;
      default: break;
    }
  },

  // every frame: the band's clock, the steps, the held breath
  frame(sim, dt) {
    if (!E.live) { if (body.breathG) breathTone(false, 0, 0); return; }
    band.frame(sim, dt);
    const hp = sim.hp;
    if (!sim.end && hp.ground && Math.abs(hp.vx) > 0.6) {
      body.step -= dt * Math.abs(hp.vx) / 1.6;
      if (body.step <= 0) { body.step = 1; thud(0.12, panOf(hp.x), E.now, hp.inWater); }
    } else body.step = Math.min(body.step, 0.3);
    const h = sim.hic;
    breathTone(!sim.end && hp.hold, h.k, h.cure > 0 ? 0 : cl(h.phase / sim.period()));
  },

  ui: {
    tap() { if (!E.live) return; sweep(bus('ui'), E.now, 620, 940, { pk: 0.12, a: 0.002, d: 0.03, len: 0.025, r: 0.02 }); },
    go() { if (!E.live) return; sweep(bus('ui'), E.now, 280, 1250, { pk: 0.16, a: 0.004, d: 0.08, len: 0.1, r: 0.05 }); splash(0.3, 0, E.now + 0.12); },
    deny() { if (!E.live) return; sweep(bus('ui'), E.now, 230, 150, { pk: 0.14, a: 0.002, d: 0.08, len: 0.08, r: 0.04, type: 'triangle' }); },
    hic() { if (!E.live) return; hiccup(0, 0.5, 0.6); },
    stamp(i) { if (!E.live) return; hit('wood', bus('ui'), E.now, 0.9, 0, { f: 700 + 120 * i }); note('glock', bus('ui'), E.now + 0.02, 79 + [0, 4, 7][i], 0.35, 0.6); },
  },
};
