// The sound of the ground, all of it synthesised. A murmur that never quite stops; a roar that
// grows with the share of the stadium on its feet; and for each wave, the crowd's long «¡eeeeh!»
// heard where the wave is on screen, so you can hear it come round. On top: the moments (the first
// wave that carries itself, every lap, a rescue, the groan when one dies, boos, the kiss cam's oooh),
// the referee's whistle, the PA's ding-dong (arriving twice, off the far stand), the ultras' bass
// drum, and from the director's booth the relays, the ON AIR hum, the static of a lost signal.
import { E, gain, filt, pan as panner, chain, glide, mtof, clamp, softclip } from './audio/core.js';
import { UP, K } from './sim.js';

const R = Math.random, rr = (a, b) => a + (b - a) * R();
// formants of a crowd singing one vowel (a mix of voices, so a little broad)
const VOW = { e: [470, 1900, 2600], a: [760, 1250, 2600], o: [520, 880, 2500], u: [330, 800, 2400] };

function env(c, t, a, h, r, peak) {
  const g = gain(c, 0);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + h); g.gain.setTargetAtTime(0, t + a + h, r / 3);
  return g;
}
function noise(c, kind, t) {
  const s = c.createBufferSource(); s.buffer = E.nz[kind]; s.loop = true;
  s.start(t, R() * (s.buffer.duration - 0.2));
  return s;
}
function formants(c, vowel) {
  const input = gain(c, 1), out = gain(c, 1), F = VOW[vowel], Q = [6, 9, 11], G = [3, 1.6, 0.6];
  const fs = F.map((f, k) => { const b = filt(c, 'bandpass', f, Q[k]); input.connect(b); chain(b, gain(c, G[k]), out); return b; });
  return { input, out, fs };
}

// ---------- one-shots ----------
// a crowd singing a vowel: n detuned throats, each with its own wobble, plus breath
function chorus({ t = E.now, dur = 1.2, vowel = 'e', lo = 170, hi = 290, n = 9, peak = 0.3, a = 0.12, r = 0.6, bend = 1, bendT = 0.5, p = 0, breath = 0.5 }) {
  const c = E.ctx, g = env(c, t, a, Math.max(0, dur - a), r, peak), fb = formants(c, vowel), end = t + dur + r * 2 + 0.1;
  chain(fb.out, g, panner(c, p), E.g.bus.ppl);
  for (let k = 0; k < n; k++) {
    const o = c.createOscillator(), f0 = rr(lo, hi), t0 = t + rr(0, 0.09);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t);
    if (bend !== 1) o.frequency.setTargetAtTime(f0 * bend, t0 + a * 0.5, bendT / 3);
    const lfo = c.createOscillator(); lfo.frequency.value = rr(4, 6.5);
    chain(lfo, gain(c, f0 * rr(0.008, 0.022)), o.frequency);
    chain(o, gain(c, 1.2 / n), fb.input);
    o.start(t0); lfo.start(t); o.stop(end); lfo.stop(end);
  }
  if (breath) { const s = noise(E.ctx, 'pink', t); chain(s, gain(c, breath), fb.input); s.stop(end); }
}
// the unvoiced part of a cheer: many throats at once
function cheer({ t = E.now, dur = 1.4, peak = 0.3, a = 0.15, r = 1, p = 0, bright = 1 }) {
  const c = E.ctx, s = noise(c, 'pink', t), m = gain(c, 1), g = env(c, t, a, Math.max(0, dur - a), r, peak);
  const b1 = filt(c, 'bandpass', 720 * bright, 0.6), b2 = filt(c, 'bandpass', 2300 * bright, 1.1);
  s.connect(b1); s.connect(b2); b1.connect(m); chain(b2, gain(c, 0.55), m);
  chain(m, g, panner(c, p), E.g.bus.ppl);
  s.stop(t + dur + r * 2 + 0.2);
}
let clapBuf = null;
function claps(c, sec = 3) {
  const sr = c.sampleRate, n = Math.floor(sec * sr), b = c.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let k = 0; k < sec * 150; k++) {
      const at = Math.floor(R() * (n - 900)), amp = rr(0.15, 1), len = Math.floor(sr * rr(0.004, 0.012));
      for (let i = 0; i < len; i++) d[at + i] += (R() * 2 - 1) * amp * Math.exp(-i / (len * 0.25));
    }
  }
  return b;
}
function applause({ t = E.now, dur = 2, peak = 0.2, r = 1.2 }) {
  const c = E.ctx; clapBuf ||= claps(c);
  const s = c.createBufferSource(); s.buffer = clapBuf; s.loop = true;
  const g = env(c, t, 0.25, Math.max(0, dur - 0.25), r, peak);
  chain(s, filt(c, 'bandpass', 1900, 0.5), g, E.g.bus.ppl);
  s.start(t, R() * 2); s.stop(t + dur + r * 2 + 0.2);
}
// the referee's pea whistle: a bright tone rattled by the pea, and the breath through it
function whistle(t, dur, peak = 0.2) {
  const c = E.ctx, f = rr(2900, 3150), o = c.createOscillator(), trill = c.createOscillator(), amL = c.createOscillator();
  o.type = 'sine'; o.frequency.setValueAtTime(f * 0.9, t); o.frequency.linearRampToValueAtTime(f, t + 0.035);
  trill.frequency.value = amL.frequency.value = rr(27, 35);
  chain(trill, gain(c, 150), o.frequency);
  const am = gain(c, 0.72); chain(amL, gain(c, 0.28), am.gain);
  const g = env(c, t, 0.012, dur, 0.035, peak);
  chain(o, am, g, E.g.bus.sfx);
  const s = noise(c, 'white', t); chain(s, filt(c, 'bandpass', f, 2.2), gain(c, 0.1), g);
  const end = t + dur + 0.25;
  for (const n of [o, trill, amL]) { n.start(t); n.stop(end); }
  s.stop(end);
}
// the PA chime: a struck bar, through the horns' narrow band
function bell(t, f, peak = 0.18, dur = 1.6, bus = 'pa') {
  const c = E.ctx, out = gain(c, 1);
  chain(out, filt(c, 'highpass', 260, 0.7), filt(c, 'lowpass', 4800, 0.7), E.g.bus[bus]);
  for (const [m, a] of [[1, 1], [2.01, 0.32], [3, 0.16], [4.18, 0.08]]) {
    const o = c.createOscillator(), g = gain(c, 0);
    o.frequency.value = f * m;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak * a, t + 0.006); g.gain.setTargetAtTime(0, t + 0.01, dur / (3 + m));
    chain(o, g, out); o.start(t); o.stop(t + dur + 0.3);
  }
}
const dingDong = (t) => { bell(t, mtof(76)); bell(t + 0.46, mtof(72)); };
function click(t, peak = 0.22, f = 2400, bus = 'me') {
  const c = E.ctx, s = noise(c, 'white', t), g = gain(c, 0);
  g.gain.setValueAtTime(peak, t); g.gain.setTargetAtTime(0, t + 0.001, 0.005);
  chain(s, filt(c, 'bandpass', f, 1.2), g, E.g.bus[bus]); s.stop(t + 0.08);
  const o = c.createOscillator(), og = gain(c, 0);
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.045);
  og.gain.setValueAtTime(peak * 0.7, t); og.gain.setTargetAtTime(0, t, 0.012);
  chain(o, og, E.g.bus[bus]); o.start(t); o.stop(t + 0.12);
}
function beep(t, f = 1320, d = 0.06, peak = 0.05, bus = 'me', type = 'square') {
  const c = E.ctx, o = c.createOscillator(), g = env(c, t, 0.004, d, 0.02, peak);
  o.type = type; o.frequency.value = f;
  chain(o, filt(c, 'lowpass', 3600), g, E.g.bus[bus]); o.start(t); o.stop(t + d + 0.12);
}
// a lost signal: hiss chopped into crackle
function crackle(t, dur, peak = 0.14) {
  const c = E.ctx, s = noise(c, 'white', t), g = gain(c, 0);
  g.gain.setValueAtTime(0, t);
  for (let u = t; u < t + dur; u += rr(0.008, 0.03)) g.gain.setValueAtTime(peak * rr(0.25, 1), u);
  g.gain.setTargetAtTime(0, t + dur, 0.03);
  chain(s, filt(c, 'highpass', 1100, 0.7), g, E.g.bus.me); s.stop(t + dur + 0.3);
}
function swoosh(t, dur = 0.55, peak = 0.15) {
  const c = E.ctx, s = noise(c, 'white', t), b = filt(c, 'bandpass', 300, 1.4), g = gain(c, 0);
  b.frequency.setValueAtTime(300, t); b.frequency.exponentialRampToValueAtTime(4600, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
  chain(s, b, g, E.g.bus.sfx); s.stop(t + dur + 0.1);
}
// the ultras' bass drum
function drum(t, peak) {
  const c = E.ctx, o = c.createOscillator(), g = gain(c, 0);
  o.frequency.setValueAtTime(96, t); o.frequency.exponentialRampToValueAtTime(47, t + 0.13);
  g.gain.setValueAtTime(peak, t); g.gain.setTargetAtTime(0, t + 0.01, 0.1);
  chain(o, g, E.g.bus.music); o.start(t); o.stop(t + 0.6);
  const s = noise(c, 'brown', t), sg = gain(c, 0);
  sg.gain.setValueAtTime(peak * 0.7, t); sg.gain.setTargetAtTime(0, t, 0.02);
  chain(s, filt(c, 'lowpass', 1000), sg, E.g.bus.music); s.stop(t + 0.25);
}
// somebody in the stand with an air horn, for the laps
function horn(t, dur = 0.8, peak = 0.08) {
  const c = E.ctx, g = env(c, t, 0.02, dur, 0.08, peak), sc = softclip(c, 3);
  chain(sc, filt(c, 'lowpass', 2400, 0.8), g, E.g.bus.sfx);
  for (const f of [311, 370]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.94, t); o.frequency.linearRampToValueAtTime(f, t + 0.06); chain(o, gain(c, 0.5), sc); o.start(t); o.stop(t + dur + 0.3); }
}

// ---------- the bed: what plays all match long ----------
function voice(c, size) {
  const fb = formants(c, 'e'), g = gain(c, 0), p = panner(c, 0), oscs = [];
  chain(fb.out, g, p, E.g.bus.ppl);
  for (let k = 0; k < 6; k++) {
    const o = c.createOscillator(), f0 = rr(175, 300), lfo = c.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = f0; lfo.frequency.value = rr(3.5, 6);
    chain(lfo, gain(c, f0 * rr(0.01, 0.025)), o.frequency);
    chain(o, gain(c, 0.2), fb.input); o.start(); lfo.start();
    oscs.push({ o, lfo, f0 });
  }
  const s = noise(c, 'pink', E.now); chain(s, gain(c, 0.45), fb.input);
  return { g, p, oscs, s, size, laps: -1 };
}
function makeBed(level, sim) {
  const c = E.ctx, t = E.now, size = clamp(0.35 + 0.65 * Math.log10(level.capacity / 2000) / Math.log10(40), 0.35, 1);
  const out = gain(c, 0); out.connect(E.g.bus.ppl);
  out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(1, t + 1.4);
  const mur = noise(c, 'pink', t), mg = gain(c, 0.05 * size);
  const m1 = filt(c, 'bandpass', 420, 0.8), m2 = filt(c, 'bandpass', 1400, 1.2);
  mur.connect(m1); mur.connect(m2); m1.connect(mg); chain(m2, gain(c, 0.5), mg); mg.connect(out);
  const roar = noise(c, 'brown', t), roar2 = noise(c, 'pink', t), rg = gain(c, 0);
  const rb = filt(c, 'bandpass', 850, 0.45); roar.connect(rb); chain(roar2, gain(c, 0.4), rb); chain(rb, rg, out);
  const voices = [voice(c, size), voice(c, size)];
  for (const v of voices) { v.p.disconnect(); v.p.connect(out); }
  // the booth: the ON AIR hum
  const hum = gain(c, 0), h1 = c.createOscillator(), h2 = c.createOscillator();
  h1.frequency.value = 50; h2.frequency.value = 150; h2.type = 'triangle';
  h1.connect(hum); chain(h2, gain(c, 0.3), hum); hum.connect(E.g.bus.me); h1.start(); h2.start();
  const srcs = [mur, roar, roar2, h1, h2, ...voices.flatMap((v) => [v.s, ...v.oscs.flatMap((x) => [x.o, x.lfo])])];
  let rain = null;
  if (level.weather === 'rain') {
    rain = noise(c, 'white', t); const rgn = gain(c, 0);
    rgn.gain.setValueAtTime(0, t); rgn.gain.linearRampToValueAtTime(0.05, t + 2);
    chain(rain, filt(c, 'highpass', 1700, 0.5), filt(c, 'lowpass', 7000, 0.5), rgn, E.g.bus.amb);
    srcs.push(rain);
  }
  const ultras = [];
  for (let i = 0; i < sim.C; i++) if (sim.kind[i] === K.ultra) ultras.push(i);
  return { out, mg, rg, voices, hum, srcs, size, ultras, nextBeat: t + 0.5, step: 0, wander: 0, beepT: 0 };
}

// the ultras' pattern: boom · boom · boom-boom-boom ·
const BEAT = [1, 0, 1, 0, 1, 1, 1, 0];

export const Audio = {
  bed: null, sc: null, acc: 0,
  init() { return !!E.init(); },
  unlock() { return E.unlock(); },
  get live() { return E.unlocked; },
  setMuted(m) { E.setMuted(m); },
  suspend() { E.suspend(); },
  resume() { E.resume(); },
  start(level) {
    if (!E.unlocked) return;
    this.stop();
    this.level = level; this.pending = level; this.acc = 0;
  },
  stop() {
    const b = this.bed; this.bed = null; this.pending = null;
    if (!b || !E.ctx) return;
    const t = E.now;
    glide(b.out.gain, 0, t, 0.12); glide(b.hum.gain, 0, t, 0.05);
    E.later(() => { for (const s of b.srcs) { try { s.stop(); } catch { /* done */ } } b.out.disconnect(); b.hum.disconnect(); }, 900);
  },
  panAt(i) {
    const sc = this.sc; if (!sc?.colToScreen) return 0;
    const [x] = sc.colToScreen(i); return clamp((x / sc.W) * 2 - 1, -1, 1) * 0.8;
  },
  // the bed needs the sim (for the ultras), so it's built on the first tick that sounds
  ensure(sim) {
    if (this.pending && E.unlocked) { this.bed = makeBed(this.pending, sim); this.pending = null; }
    return this.bed;
  },
  frame(sim, dt, sc) {
    this.sc = sc;
    const b = this.ensure(sim); if (!b) return;
    this.acc += dt; if (this.acc < 0.05) return;
    const ddt = this.acc; this.acc = 0;
    const t = E.now, C = sim.C, end = !!sim.end;
    let up = 0, tot = 0, uu = 0;
    for (let i = 0; i < C; i++) { tot += sim.fill[i]; up += sim.up(i); }
    for (const i of b.ultras) uu += sim.up(i);
    const share = tot ? up / tot : 0;
    glide(b.rg.gain, b.size * (0.015 + 0.5 * Math.pow(share, 0.75)), t, 0.12);
    b.wander -= ddt;
    if (b.wander <= 0) { b.wander = rr(0.25, 0.6); glide(b.mg.gain, 0.05 * b.size * rr(0.7, 1.2), t, 0.15); }
    // the two strongest fronts, each heard where it is
    const fronts = [];
    for (const w of sim.waves) {
      if (!w || !w.dir || w.dead >= 0) continue;
      let s = 0;
      for (let k = 0; k < 8; k++) { const j = (((Math.round(w.pos) - w.dir * k) % C) + C) % C; if (sim.st[j] === UP && sim.id[j] === w.id) s += sim.up(j); }
      fronts.push({ w, s: s / 8 });
    }
    fronts.sort((a, z) => z.s - a.s);
    b.voices.forEach((v, k) => {
      const f = fronts[k];
      glide(v.g.gain, f ? b.size * 0.3 * Math.min(1, f.s * 1.6) : 0, t, 0.09);
      if (!f) return;
      glide(v.p.pan, this.panAt(f.w.pos), t, 0.08);
      // more laps, more excited: the whole stand sings a little higher
      const lp = Math.min(4, Math.floor(f.w.laps));
      if (lp !== v.laps) { v.laps = lp; for (const x of v.oscs) glide(x.o.frequency, x.f0 * (1 + 0.045 * lp), t, 0.4); }
    });
    // the booth
    glide(b.hum.gain, sim.cam.onAir && !end ? 0.022 : 0, t, 0.04);
    if (sim.cam.onAir && sim.air < 0.3 && !end) {
      b.beepT -= ddt;
      if (b.beepT <= 0) { beep(t, 1320, 0.045, 0.04); b.beepT = 0.16 + sim.air * 1.6; }
    } else b.beepT = 0;
    // the ultras keep time, louder when they're up
    if (b.ultras.length && !end) {
      if (b.nextBeat < t) b.nextBeat = t + 0.05;
      while (b.nextBeat < t + 0.25) {
        if (BEAT[b.step % 8]) drum(b.nextBeat, (sim.lock > 0 ? 0.12 : 0.22) * (0.35 + 0.65 * Math.min(1, (uu / b.ultras.length) * 2.5)));
        b.nextBeat += 0.24; b.step++;
      }
    }
  },
  event(e, sim) {
    const b = this.ensure(sim); if (!b || !E.ctx) return;
    const t = E.now, z = b.size, p = e.i != null ? this.panAt(e.i) : 0;
    switch (e.k) {
      case 'start': dingDong(t + 0.4); break;
      case 'air': click(t, 0.2, e.on ? 2700 : 1900); break;
      case 'ola': chorus({ t, vowel: 'e', dur: 1.3, peak: 0.3 * z, lo: 180, hi: 320, bend: 1.12, p }); cheer({ t: t + 0.08, dur: 1.1, peak: 0.22 * z, p }); break;
      case 'lap': {
        const best = e.id === sim.bestId, q = this.panAt(sim.waves[e.id]?.pos ?? 0);
        chorus({ t, vowel: 'a', dur: 1.5, peak: (best ? 0.36 : 0.22) * z, lo: 200, hi: 340, bend: 1.15, p: q });
        cheer({ t, dur: 1.8, peak: (best ? 0.34 : 0.2) * z, p: q });
        if (best) { applause({ t: t + 0.2, dur: 2.4, peak: 0.2 * z }); horn(t + 0.12); }
        break;
      }
      case 'rescue':
        chorus({ t, vowel: 'o', dur: 0.45, lo: 190, hi: 300, bend: 1.35, bendT: 0.35, peak: 0.2 * z, p });
        cheer({ t: t + 0.3, dur: 0.9, peak: 0.26 * z, p });
        beep(t, 1760, 0.05, 0.035, 'me', 'sine'); beep(t + 0.07, 2349, 0.07, 0.035, 'me', 'sine');
        break;
      case 'die':
        if (e.laps > 0.2 || e.why === 'collide') chorus({ t, vowel: 'o', dur: 1.1, lo: 210, hi: 330, bend: 0.72, bendT: 1, peak: 0.24 * z * Math.min(1, 0.45 + e.laps), p });
        break;
      case 'boo': chorus({ t, vowel: 'u', dur: 1.6, lo: 95, hi: 165, n: 10, peak: 0.26 * z, bend: 0.94, p }); break;
      case 'kiss':
        chorus({ t, vowel: 'o', dur: 1.5, lo: 230, hi: 360, bend: 1.22, bendT: 1.1, peak: 0.26 * z });
        if (e.ola) { cheer({ t: t + 1, dur: 1.5, peak: 0.32 * z }); applause({ t: t + 1, dur: 2, peak: 0.2 * z }); } else applause({ t: t + 1.1, dur: 1.2, peak: 0.1 * z });
        break;
      case 'wake': cheer({ t, dur: 0.6, peak: 0.16 * z, p }); chorus({ t, vowel: 'e', dur: 0.45, peak: 0.12 * z, n: 6, p }); break;
      case 'vip': applause({ t, dur: 1, peak: 0.06 }); break;
      case 'palco': cheer({ t, dur: 1.6, peak: 0.34 * z, p }); applause({ t: t + 0.1, dur: 2.2, peak: 0.22 * z }); chorus({ t, vowel: 'a', dur: 1.2, peak: 0.24 * z, lo: 190, hi: 330, bend: 1.1, p }); break;
      case 'cut': crackle(t, 0.55, 0.15); beep(t + 0.55, 1000, 0.5, 0.03, 'me', 'sine'); break;
      case 'back': click(t, 0.2, 2200); crackle(t, 0.12, 0.07); break;
      case 'replayWarn': dingDong(t); break;
      case 'replay': swoosh(t, 0.5, 0.13); break;
      case 'whistle': {
        whistle(t, 0.22); whistle(t + 0.42, 0.22); whistle(t + 0.84, 1.05);
        const win = sim.end?.stars?.[0];
        if (win) { cheer({ t: t + 1.9, dur: 2.6, peak: 0.36 * z }); applause({ t: t + 1.9, dur: 3.2, peak: 0.26 * z }); chorus({ t: t + 1.9, vowel: 'e', dur: 1.8, peak: 0.26 * z, lo: 200, hi: 340, bend: 1.08 }); }
        else { applause({ t: t + 2, dur: 2, peak: 0.1 * z }); chorus({ t: t + 1.9, vowel: 'o', dur: 1.2, peak: 0.14 * z, bend: 0.85, bendT: 1 }); }
        break;
      }
      default: break;
    }
  },
  ui: {
    tap() { if (E.live) click(E.now, 0.1, 3200, 'ui'); },
    go() { if (E.live) whistle(E.now, 0.16, 0.1); },
    deny() { if (E.live) beep(E.now, 140, 0.14, 0.07, 'ui', 'square'); },
    // a floodlight coming on: the relay, and a chime a note higher each time
    stamp(i) { if (!E.live) return; const t = E.now; click(t, 0.2, 1400, 'ui'); bell(t + 0.02, mtof([72, 76, 79][i] ?? 72), 0.1, 1, 'ui'); },
  },
};
