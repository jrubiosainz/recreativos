// UN SOLO VIAJE music: a verbena band that walks with you. There is no tempo: your feet are the
// beat. Every step on the flat is half a bar of a two-step (the tuba's «oom», the accordion's
// «pah», a clarinet on top); up a flight the band drops out and a pizzicato climbs the scale a
// step at a time; with the light off it tiptoes in minor. When a hand is about to give, a string
// tremolo creeps in and the tuba sags flat. The modern lift has piped bossa; the ending gets the
// band's flourish or the sad trombone.
import { E, gain, filt, chain, hold, mtof } from './core.js';
import { note, hit, env, osc, noise, burst } from './kit.js';
import { out, U, cl } from './foley.js';

// ---------- the band's instruments ----------
// tuba: a fat sawtooth whose bell opens on the attack, lipped up into the note; `sag` in cents
function tuba(d, t, m, len, v, sag = 0) {
  const c = E.ctx, f = mtof(m), { g, end } = env(d, t, { pk: 0.3 * v, a: 0.02, d: 0.2, sus: 0.7, len, r: 0.08 });
  const lp = filt(c, 'lowpass', 220, 0.9); lp.connect(g);
  lp.frequency.setValueAtTime(220, t); lp.frequency.linearRampToValueAtTime(600 + 900 * v, t + 0.035); lp.frequency.setTargetAtTime(420, t + 0.04, 0.08);
  const saw = osc('sawtooth', f, t, end, lp), sine = osc('sine', f, t, end, null);
  chain(sine, gain(c, 0.5), g);
  for (const o of [saw, sine]) { o.detune.setValueAtTime(sag - 45, t); o.detune.linearRampToValueAtTime(sag, t + 0.04); }
  return end;
}
// accordion: three reeds a few cents apart (the musette's shimmer), bellows on the attack
function reed(d, t, ms, len, v) {
  const c = E.ctx, { g, end } = env(d, t, { pk: 0.11 * v / Math.sqrt(ms.length), a: 0.012, d: 0.1, sus: 0.8, len, r: 0.05 });
  const lp = filt(c, 'lowpass', 2600, 0.6), pk = filt(c, 'peaking', 1150, 1.2, 5);
  chain(lp, pk, g);
  for (const m of ms) for (const dt of [-13, 0, 12]) osc('sawtooth', mtof(m), t, end, lp).detune.value = dt + U(-2, 2);
  return end;
}
// clarinet: odd harmonics (a square, rounded), a vibrato that arrives late
function clar(d, t, m, len, v) {
  const c = E.ctx, f = mtof(m), { g, end } = env(d, t, { pk: 0.075 * v, a: 0.025, d: 0.2, sus: 0.8, len, r: 0.07 });
  const lp = filt(c, 'lowpass', 1800 + 900 * v, 0.7); lp.connect(g);
  const o = osc('square', f, t, end, lp), vg = gain(c, 0);
  vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.3, len));
  osc('sine', 5.3, t, end, vg); vg.connect(o.frequency);
  return end;
}
// trombone with a plunger: the filter opens and shuts on each note (wah); the last one wobbles
function bone(d, t, m, len, v, wob = false) {
  const c = E.ctx, f = mtof(m), { g, end } = env(d, t, { pk: 0.16 * v, a: 0.04, d: 0.3, sus: 0.85, len, r: 0.12 });
  const lp = filt(c, 'lowpass', 300, 1.6); lp.connect(g);
  lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1400, t + 0.12); lp.frequency.linearRampToValueAtTime(500, t + len);
  const o = osc('sawtooth', f, t, end, lp);
  o.detune.setValueAtTime(-60, t); o.detune.linearRampToValueAtTime(0, t + 0.08);
  if (wob) {
    const vg = gain(c, 0); vg.gain.setValueAtTime(0, t + 0.2); vg.gain.linearRampToValueAtTime(f * 0.03, t + 0.5);
    osc('sine', 5.5, t, end, vg); vg.connect(o.frequency);
    const wg = gain(c, 0); wg.gain.setValueAtTime(0, t + 0.2); wg.gain.linearRampToValueAtTime(500, t + 0.5);
    osc('sine', 5.5, t, end, wg); wg.connect(lp.frequency);
    o.frequency.setTargetAtTime(f * 0.94, t + len - 0.3, 0.2);
  }
  return end;
}

// ---------- the walking band ----------
// Bb major; one chord per bar (a bar is two steps), the tune one note per step (0 = rest)
const CH = { Bb: [58, 62, 65], F7: [57, 60, 63], Eb: [55, 58, 63], Bb7: [56, 58, 62] };
const ROOT = { Bb: [34, 41], F7: [29, 36], Eb: [39, 34], Bb7: [34, 41] };
const FORM = ['Bb', 'Bb', 'F7', 'F7', 'F7', 'F7', 'Bb', 'Bb', 'Bb', 'Bb7', 'Eb', 'Eb', 'Bb', 'F7', 'Bb', 'Bb'];
const TUNE = [65, 70, 74, 70, 72, 69, 75, 72, 74, 72, 69, 65, 70, 74, 77, 0, 77, 74, 68, 70, 67, 70, 75, 79, 77, 74, 72, 75, 74, 72, 70, 0];
const CLIMB = [58, 60, 62, 63, 65, 67, 69, 70, 72, 74, 75, 77, 79, 81];
const TIPTOE = [55, 58, 62, 58, 55, 58, 63, 62, 57, 60, 62, 60];
export const Band = {
  i: 0, fl: 0, last: -9, stairs: false, sag: 0, quiet: false,
  reset() { this.i = 0; this.fl = 0; this.last = -9; this.stairs = false; this.sag = 0; this.quiet = false; },
  step(t, { stairs = false, dark = false, kg = 0 } = {}) {
    if (this.quiet) return;
    const gap = cl(t - this.last, 0.2, 0.9), fresh = t - this.last > 1.4;
    this.last = t;
    const d = out('music', 0, 0.55), len = gap * 0.8;
    if (dark) {
      note('pizz', d, t, TIPTOE[this.i % TIPTOE.length], 0.1, 0.38, (this.i & 1) * 0.4 - 0.2);
      this.i++; return;
    }
    if (stairs) {
      if (!this.stairs) this.fl = 0;
      this.stairs = true;
      const m = CLIMB[Math.min(this.fl, CLIMB.length - 1)];
      note('pizz', d, t, m, 0.2, 0.75, 0.15); note('pizz', d, t, m - 12, 0.2, 0.45, -0.15);
      if (!(this.fl & 1)) tuba(d, t, 34, len * 0.7, 0.5, this.sag);
      this.fl++; return;
    }
    // off the top of a flight: ta-da
    if (this.stairs) { this.stairs = false; if (!fresh) { reed(d, t, [58, 62, 65, 70], 0.45, 0.9); hit('crash', d, t, 0.14, 0, { len: 0.7 }); } }
    const bar = (this.i >> 1) % FORM.length, ch = FORM[bar], down = !(this.i & 1), heavy = cl(kg / 30, 0, 1);
    if (down) tuba(d, t, ROOT[ch][(bar & 1)], len, 0.7 + 0.25 * heavy, this.sag);
    else reed(d, t, CH[ch], Math.min(0.16, len * 0.5), 0.8);
    const m = TUNE[this.i % TUNE.length];
    if (m && !fresh) clar(d, t + 0.005, m, len * 0.85, 0.7);
    this.i++;
  },
};

// ---------- the strain: strings creeping in as a grip gives ----------
export const Strain = {
  n: null, x: 0,
  start() {
    this.stop();
    const c = E.ctx, t = E.now, d = out('music', 0, 1), g = gain(c, 0), tr = gain(c, 0.6), lp = filt(c, 'lowpass', 1400, 0.7);
    chain(lp, tr, g, d);
    const am = gain(c, 0.4); am.connect(tr.gain); osc('triangle', 11, t, t + 3600, am);
    const os = [];
    for (const [m, dt] of [[58, -8], [59, 6], [70, 3]]) { const o = osc('sawtooth', mtof(m), t, t + 3600, lp); o.detune.value = dt; os.push([o, dt]); }
    this.n = { g, os, lp }; this.x = 0;
  },
  set(x) {
    const n = this.n; if (!n) return;
    x = cl(x, 0, 1); if (Math.abs(x - this.x) < 0.01) return;
    this.x = x;
    const t = E.now;
    n.g.gain.setTargetAtTime(0.06 * x * x, t, 0.15);
    for (const [o, dt] of n.os) o.detune.setTargetAtTime(dt + 70 * x, t, 0.2);
    n.lp.frequency.setTargetAtTime(900 + 2200 * x, t, 0.2);
    Band.sag = -45 * x;
  },
  stop(f = 0.3) {
    const n = this.n; this.n = null; Band.sag = 0;
    if (!n || !E.ctx) return;
    const t = E.now; hold(n.g.gain, t); n.g.gain.linearRampToValueAtTime(0, t + f);
    for (const [o] of n.os) try { o.stop(t + f + 0.05); } catch { /* done */ }
  },
};

// ---------- the lift ----------
// the machine room: the new lift hums and sighs; the old one clatters and its cables tick past
export const Lift = {
  n: null,
  start(t, old = false) {
    this.stop(t);
    const c = E.ctx, d = out('sfx', 0, 0.45), g = gain(c, 0), lp = filt(c, 'lowpass', old ? 520 : 320, 0.8), end = t + 40;
    chain(lp, g, d);
    const o = osc('sawtooth', old ? 68 : 55, t, end, lp); o.frequency.linearRampToValueAtTime(old ? 74 : 60, t + 1.5);
    osc('sine', old ? 136 : 110, t, end, lp);
    const w = filt(c, 'bandpass', 380, 0.6), wg = gain(c, old ? 0.25 : 0.4); chain(w, wg, g); noise('pink', t, end, w);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(old ? 0.1 : 0.07, t + 0.8);
    const n = { g, o, iv: 0, old };
    if (old) {
      // a tremor in the cabin and the cable's joints ticking past
      const am = gain(c, 0.035); osc('sine', 7, t, end, am); am.connect(g.gain);
      let at = t + 0.4;
      const tick = () => { if (this.n !== n || !E.ctx) return; while (at < E.now + 0.5) { burst(d, at, { f: U(1500, 2600), q: 3, pk: 0.03, a: 0.001, d: 0.01, len: 0.008, r: 0.01 }); at += U(0.25, 0.6); } };
      n.iv = setInterval(tick, 150); tick();
    }
    this.n = n;
  },
  stop(t) {
    const n = this.n; this.n = null;
    if (!n || !E.ctx) return;
    clearInterval(n.iv);
    hold(n.g.gain, t); n.g.gain.linearRampToValueAtTime(0, t + 0.6);
    n.o.frequency.setTargetAtTime(n.old ? 50 : 42, t, 0.2);
    const d = out('sfx', 0, 1);
    burst(d, t + 0.5, { type: 'lowpass', f: 400, q: 0.7, pk: n.old ? 0.25 : 0.12, a: 0.002, d: 0.08, len: 0.06, r: 0.05 });
  },
};
// piped music in the new lift: a bossa through a speaker the size of a biscuit
const BOSSA = [['C', 48, [64, 67, 71, 74]], ['A7', 45, [61, 64, 67, 70]], ['Dm7', 50, [60, 65, 69, 72]], ['G7', 43, [59, 62, 65, 69]]];
const MEL = [76, 0, 74, 72, 0, 69, 71, 0, 72, 0, 74, 76, 77, 0, 76, 74];
export const Muzak = {
  on: false, iv: 0, at: 0, bar: 0, g: null,
  start() {
    if (this.on || !E.ctx) return;
    const c = E.ctx, t = E.now; this.on = true;
    this.g = gain(c, 0);
    chain(this.g, filt(c, 'highpass', 380, 0.7), filt(c, 'peaking', 1500, 1, 5), filt(c, 'lowpass', 3400, 0.8), out('music', 0, 0.6));
    this.g.gain.setValueAtTime(0, t); this.g.gain.linearRampToValueAtTime(0.7, t + 0.8);
    this.at = t + 0.2; this.bar = 0;
    this.iv = setInterval(() => this.tick(), 120); this.tick();
  },
  tick() {
    if (!this.on || !E.ctx || E.ctx.state !== 'running') return;
    const beat = 60 / 128;
    while (this.at < E.now + 0.6) {
      const t = this.at, [, b, ch] = BOSSA[this.bar % 4], d = this.g;
      note('upright', d, t, b, beat * 1.4, 0.5); note('upright', d, t + beat * 1.5, b + 7, beat * 0.4, 0.4);
      note('upright', d, t + beat * 2, b, beat * 1.4, 0.45); note('upright', d, t + beat * 3.5, b + 7, beat * 0.4, 0.4);
      for (const o of [0, 1.5, 3]) ch.forEach((m, i) => note('epiano', d, t + o * beat + i * 0.008, m, beat * 0.5, 0.28));
      for (let k = 0; k < 4; k++) { const m = MEL[(this.bar % 4) * 4 + k]; if (m) note('vibes', d, t + k * beat, m, beat * 0.9, 0.4); }
      hit('shaker', d, t + beat * 0.5, 0.4); hit('shaker', d, t + beat * 2.5, 0.4); hit('rim', d, t + beat * 1.5, 0.3);
      this.at += 4 * beat; this.bar++;
    }
  },
  stop(f = 0.5) {
    if (!this.on) return; this.on = false; clearInterval(this.iv);
    const g = this.g, t = E.now; hold(g.gain, t); g.gain.linearRampToValueAtTime(0, t + f);
    E.later(() => g.disconnect(), f * 1000 + 3000);
  },
};

// ---------- stingers ----------
// all of it, in one trip: the band's pasodoble flourish, crash, and the tuba's full stop
export function win(t) {
  const d = out('music', 0, 0.9), b = 60 / 132;
  [[65, 0], [67, 0.5], [69, 1]].forEach(([m, o]) => { clar(d, t + o * b, m, b * 0.45, 0.9); note('brass', d, t + o * b, m, b * 0.45, 0.55, 0, { solo: true }); });
  const T = t + 1.5 * b, B2 = T + 1.9;
  reed(d, T, [58, 62, 65, 70], 1.4, 1); tuba(d, T, 34, 1.2, 1);
  note('brass', d, T, 70, 1.3, 0.8, 0, { vib: true }); clar(d, T, 74, 1.3, 0.9);
  hit('crash', d, T, 0.7, 0, { len: 2.2 }); hit('kick', d, T, 0.9);
  // the button: oom… PAH
  tuba(d, B2 - 0.3, 29, 0.18, 0.9);
  tuba(d, B2, 34, 0.3, 1); reed(d, B2, [58, 62, 65, 70], 0.14, 1); hit('kick', d, B2, 0.8); hit('snare', d, B2, 0.5);
}
// two trips: the sad trombone, wah by wah
export function fail(t) {
  const d = out('music', 0, 1.1);
  [[53, 0, 0.42], [52, 0.48, 0.42], [51, 0.96, 0.42], [50, 1.44, 1.5]].forEach(([m, o, len], i) => bone(d, t + o, m, len, 0.9, i === 3));
  tuba(d, t + 3.1, 26, 0.35, 0.8);
}
// the lift or the door went without you: bwomp, bwomp
export function miss(t) {
  const d = out('music', 0, 0.7);
  tuba(d, t, 41, 0.18, 0.8); tuba(d, t + 0.28, 40, 0.5, 0.8, -30);
}
// the bag goes over: the band trips on its own feet
export function oops(t) {
  const d = out('music', 0, 1), c = E.ctx, { g, end } = env(d, t, { pk: 0.22, a: 0.01, d: 0.5, sus: 0.8, len: 0.55, r: 0.1 });
  const lp = filt(c, 'lowpass', 900, 1); lp.connect(g);
  const o = osc('sawtooth', mtof(46), t, end, lp); o.frequency.exponentialRampToValueAtTime(mtof(31), t + 0.55);
  hit('crash', d, t, 0.3, 0, { len: 0.6 });
}
// the results: one bell per star, a little higher each
export function star(t, i = 0) {
  const d = out('ui', 0, 1.2);
  note('glock', d, t, [79, 83, 86][i % 3], 0.8, 0.6); note('celesta', d, t + 0.01, [91, 95, 98][i % 3], 0.5, 0.25);
}
// the fruit-shop scale's key: a short square beep
export function beep(t, hi = true) {
  sweep1(out('ui', 0, 1), t, hi ? 2350 : 1760);
}
function sweep1(d, t, f) { const e = env(d, t, { pk: 0.035, a: 0.002, d: 0.03, len: 0.045, r: 0.01 }); osc('square', f, t, e.end, e.g); }
