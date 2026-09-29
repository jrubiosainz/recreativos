// The sound of a rainy ride, all of it synthesised. Under everything the rain: a hush on the roof and
// single drops ticking on the glass, left and right. The diesel under the floor rises with the bus's
// speed and growls when it pulls away; tyres hiss on the wet road; cobbles rattle the whole box. The
// fingertip squeaks on clear wet glass and whispers through fog. Drops «plic» when they merge (the
// bigger, the lower), the doors sigh and beep, the brakes squeal. And the kids: every call, «¡ya!»,
// «¡ñam!» and the final «¡bieeen!» or «¡ooooh!» is a little chant in each kid's own pitch.
import { E, gain, filt, pan as panner, chain, glide, clamp } from './audio/core.js';
import { PW, YOU, NEUTRAL } from './sim.js';

const R = Math.random, rr = (a, b) => a + (b - a) * R();
// kids' formants run higher than grown-ups'
const VOW = { a: [950, 1450, 3200], e: [560, 2300, 3300], i: [380, 2900, 3700], o: [560, 1000, 3000], u: [400, 900, 2900] };
const PITCH = { you: 330, dani: 285, lucia: 372, iker: 300, vega: 400 };

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
const panX = (x) => clamp((x / PW) * 2 - 1, -1, 1) * 0.7;

// ---------- the kids ----------
// a line said as a chant: one blip per syllable on its vowel, a click or a hiss for the consonant,
// the pitch lilting on each (rel), gliding down at the end if asked (fall)
function kid(t, who, syl, { peak = 0.2, p = 0, fall = 1, speed = 1 } = {}) {
  const c = E.ctx, f0 = (PITCH[who] || 330) * rr(0.97, 1.03);
  const o = c.createOscillator(), vib = c.createOscillator(), amp = gain(c, 0), mix = gain(c, 1);
  o.type = 'sawtooth'; o.frequency.value = f0 * syl[0][3];
  vib.frequency.value = rr(6, 8); chain(vib, gain(c, f0 * 0.025), o.frequency);
  const fs = [0, 1, 2].map((k) => { const b = filt(c, 'bandpass', VOW[syl[0][1]][k], [6, 9, 11][k]); o.connect(b); chain(b, gain(c, [2.4, 1.3, 0.5][k]), mix); return b; });
  chain(mix, amp, panner(c, p), E.g.bus.kids);
  let at = t;
  syl.forEach(([cons, v, d0, rel], n) => {
    const d = d0 / speed, F = VOW[v], last = n === syl.length - 1;
    fs.forEach((b, k) => b.frequency.setTargetAtTime(F[k], at, 0.015));
    o.frequency.setTargetAtTime(f0 * rel, at, 0.018);
    if (last && fall !== 1) o.frequency.setTargetAtTime(f0 * rel * fall, at + d * 0.3, d * 0.4);
    if (cons === 's' || cons === 'ch') hiss(at - 0.05, 0.06, peak * 0.35, p);
    else if (cons) tick(at, peak * 0.3, cons === 'm' || cons === 'n' ? 700 : 2400, p);
    amp.gain.setTargetAtTime(peak, at + 0.005, 0.01);
    amp.gain.setTargetAtTime(0, at + d * 0.8, 0.025);
    at += d;
  });
  o.start(t); vib.start(t); o.stop(at + 0.25); vib.stop(at + 0.25);
}
function tick(t, peak, f, p = 0) {
  const c = E.ctx, s = noise(c, 'white', t), g = env(c, t, 0.001, 0.004, 0.015, peak);
  chain(s, filt(c, 'bandpass', f, 1.2), g, panner(c, p), E.g.bus.kids); s.stop(t + 0.08);
}
function hiss(t, dur, peak, p = 0) {
  const c = E.ctx, s = noise(c, 'white', t), g = env(c, t, 0.01, dur, 0.03, peak);
  chain(s, filt(c, 'bandpass', 6500, 1.5), g, panner(c, p), E.g.bus.kids); s.stop(t + dur + 0.1);
}
// the lines
const LINE = {
  dibs: [['m', 'e', 0.1, 1], ['p', 'i', 0.1, 1.1], ['d', 'o', 0.15, 1], ['', 'e', 0.09, 1.16], ['s', 'a', 0.26, 1.04]],
  ya: [['', 'i', 0.05, 1.1], ['', 'a', 0.3, 1.22]],
  nam: [['n', 'a', 0.24, 1.2], ['m', 'u', 0.1, 1.0]],
  bien: [['b', 'i', 0.08, 1.05], ['', 'e', 0.5, 1.3]],
  oh: [['', 'o', 0.7, 1.05]],
  ua: [['', 'u', 0.08, 1], ['', 'a', 0.45, 1.25]],
  trampa: [['t', 'a', 0.12, 1.2], ['p', 'a', 0.3, 1.0]],
};

// ---------- the glass and the drops ----------
// a drop swallowing another: a pitch that jumps up, lower for bigger drops
function plic(t, r, peak, p = 0) {
  const c = E.ctx, o = c.createOscillator(), f = clamp(820 / (0.45 + r * 2), 330, 1700);
  o.type = 'sine'; o.frequency.setValueAtTime(f * 0.72, t); o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.04);
  const g = env(c, t, 0.002, 0.014, 0.06, peak);
  chain(o, g, panner(c, p), E.g.bus.glass); o.start(t); o.stop(t + 0.2);
}
function squish(t, peak, p = 0) {
  const c = E.ctx, s = noise(c, 'pink', t), g = env(c, t, 0.004, 0.05, 0.08, peak), f = filt(c, 'lowpass', 1400, 2);
  f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.12);
  chain(s, f, g, panner(c, p), E.g.bus.glass); s.stop(t + 0.3);
}
// the rain's single drops on the pane
function patter(t, peak) {
  const c = E.ctx, s = noise(c, 'white', t), g = env(c, t, 0.001, 0.002, rr(0.012, 0.04), peak);
  chain(s, filt(c, 'bandpass', rr(2200, 7000), rr(2, 5)), g, panner(c, rr(-0.8, 0.8)), E.g.bus.rain); s.stop(t + 0.1);
}

// ---------- the bus ----------
function bell(t, f, peak = 0.12, dec = 1.1, bus = 'sfx') {
  const c = E.ctx;
  [[1, 1], [2.76, 0.4], [5.4, 0.18]].forEach(([m, a]) => {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
    const g = env(c, t, 0.003, 0.01, dec / m, peak * a); chain(o, g, E.g.bus[bus]); o.start(t); o.stop(t + dec * 1.4);
  });
}
function pssh(t, dur = 0.7, peak = 0.16, from = 4200, to = 1300) {
  const c = E.ctx, s = noise(c, 'white', t), b = filt(c, 'bandpass', from, 0.9), g = env(c, t, 0.015, dur * 0.4, dur * 0.6, peak);
  b.frequency.setValueAtTime(from, t); b.frequency.exponentialRampToValueAtTime(to, t + dur);
  chain(s, b, g, E.g.bus.sfx); s.stop(t + dur * 1.6);
}
function beeps(t, n = 3, f = 1180, peak = 0.05) {
  const c = E.ctx;
  for (let k = 0; k < n; k++) {
    const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f;
    const g = env(c, t + k * 0.24, 0.004, 0.11, 0.02, peak); chain(o, filt(c, 'lowpass', 2600), g, E.g.bus.sfx);
    o.start(t + k * 0.24); o.stop(t + k * 0.24 + 0.2);
  }
}
function thud(t, peak = 0.3, f = 85) {
  const c = E.ctx, o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.14);
  const g = env(c, t, 0.003, 0.02, 0.12, peak); chain(o, g, E.g.bus.sfx); o.start(t); o.stop(t + 0.3);
  const s = noise(c, 'brown', t), gn = env(c, t, 0.002, 0.02, 0.08, peak * 0.8); chain(s, filt(c, 'lowpass', 500), gn, E.g.bus.sfx); s.stop(t + 0.2);
}
function rattle(t, peak = 0.08) {
  const c = E.ctx, s = noise(c, 'white', t), g = env(c, t, 0.001, 0.006, 0.03, peak);
  chain(s, filt(c, 'bandpass', rr(900, 2200), 6), g, panner(c, rr(-0.5, 0.5)), E.g.bus.sfx); s.stop(t + 0.08);
}
function squeal(t, dur = 0.9, peak = 0.07) {
  const c = E.ctx, f = rr(2600, 3000), o = c.createOscillator(), vib = c.createOscillator();
  o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.93, t + dur);
  vib.frequency.value = 11; chain(vib, gain(c, 35), o.frequency);
  const g = env(c, t, 0.08, dur * 0.7, dur * 0.3, peak);
  chain(o, g, E.g.bus.sfx); o.start(t); vib.start(t); o.stop(t + dur * 1.5); vib.stop(t + dur * 1.5);
}
function click(t, peak = 0.1, f = 3200, bus = 'ui') {
  const c = E.ctx, s = noise(c, 'white', t), g = env(c, t, 0.001, 0.003, 0.02, peak);
  chain(s, filt(c, 'bandpass', f, 1.6), g, E.g.bus[bus]); s.stop(t + 0.06);
}
function buzz(t, f = 140, dur = 0.14, peak = 0.06) {
  const c = E.ctx, o = c.createOscillator(); o.type = 'square'; o.frequency.value = f;
  const g = env(c, t, 0.005, dur, 0.03, peak); chain(o, filt(c, 'lowpass', 1200), g, E.g.bus.ui); o.start(t); o.stop(t + dur + 0.1);
}

// ---------- the bed: rain, diesel, road, and the fingertip ----------
function makeBed(level, quiet) {
  const c = E.ctx, t = E.now, B = E.g.bus, srcs = [];
  const out = gain(c, 0); out.gain.setTargetAtTime(quiet ? 0.55 : 1, t, 0.4);
  const wet = level.night ? 1.25 : 1;
  // rain: the roof's hush and a high sizzle
  const roof = noise(c, 'pink', t), rg = gain(c, 0.13 * wet); chain(roof, filt(c, 'lowpass', 2000, 0.5), rg, out); srcs.push(roof);
  const siz = noise(c, 'white', t), sg = gain(c, 0.018 * wet); chain(siz, filt(c, 'highpass', 5500, 0.6), sg, out); srcs.push(siz);
  out.connect(B.rain);
  // the diesel: a buzzing fundamental and its half, choked by a lowpass that opens with the throttle
  const eOut = gain(c, 0); eOut.gain.setTargetAtTime(1, t, 0.5); eOut.connect(B.engine);
  const eng = c.createOscillator(), sub = c.createOscillator(), lp = filt(c, 'lowpass', 200, 1.4), eg = gain(c, 0.08);
  eng.type = 'sawtooth'; sub.type = 'square'; eng.frequency.value = 27; sub.frequency.value = 13.5;
  chain(eng, gain(c, 0.55), lp); chain(sub, gain(c, 0.3), lp); chain(lp, eg, eOut);
  const rum = noise(c, 'brown', t), rmg = gain(c, 0.12); chain(rum, filt(c, 'lowpass', 130, 0.8), rmg, eOut);
  eng.start(t); sub.start(t); srcs.push(eng, sub, rum);
  // the road: a low swish and the tyres' hiss on wet tarmac, both with speed
  const road = noise(c, 'pink', t), rdg = gain(c, 0); chain(road, filt(c, 'bandpass', 380, 0.7), rdg, B.street);
  const tyre = noise(c, 'white', t), tyg = gain(c, 0); chain(tyre, filt(c, 'bandpass', 2600, 0.6), tyg, B.street);
  srcs.push(road, tyre);
  // the fingertip: a squeak on clear glass (a resonant tone that jitters) and a whisper through fog
  const sq = c.createOscillator(), sqb = filt(c, 'bandpass', 1500, 14), sqg = gain(c, 0);
  sq.type = 'sawtooth'; sq.frequency.value = 1500; chain(sq, sqb, sqg, B.glass); sq.start(t); srcs.push(sq);
  const sh = noise(c, 'white', t), shb = filt(c, 'bandpass', 3400, 0.9), shg = gain(c, 0); chain(sh, shb, shg, B.glass); srcs.push(sh);
  return { out, eOut, srcs, eng, sub, lp, eg, rdg, tyg, sq, sqb, sqg, shg, wet, quiet, fx: null, fy: null, rainT: 0, cobT: 0, plics: 0 };
}

export const Audio = {
  bed: null, acc: 0,
  init() { return !!E.init(); },
  unlock() { return E.unlock(); },
  get live() { return E.unlocked; },
  setMuted(m) { E.setMuted(m); },
  suspend() { E.suspend(); },
  resume() { E.resume(); },
  start(level, { quiet = false } = {}) {
    if (!E.unlocked) return;
    this.stop();
    this.bed = makeBed(level, quiet); this.acc = 0;
  },
  stop() {
    const b = this.bed; this.bed = null;
    if (!b || !E.ctx) return;
    const t = E.now;
    glide(b.out.gain, 0, t, 0.12); glide(b.eOut.gain, 0, t, 0.12); glide(b.sqg.gain, 0, t, 0.02); glide(b.shg.gain, 0, t, 0.02); glide(b.rdg.gain, 0, t, 0.1); glide(b.tyg.gain, 0, t, 0.1);
    E.later(() => { for (const s of b.srcs) { try { s.stop(); } catch { /* done */ } } b.out.disconnect(); b.eOut.disconnect(); }, 900);
  },
  frame(sim, dt) {
    const b = this.bed; if (!b || !E.ctx) return;
    this.acc += dt; if (this.acc < 0.04) return;
    const ddt = this.acc; this.acc = 0;
    const t = E.now, bus = sim.bus, v = bus.v, thr = clamp(bus.a / 1.1, 0, 1), still = v < 0.05;
    // diesel: idles with a chug, climbs with speed, growls when it pulls away
    glide(b.eng.frequency, 27 + v * 4.2 + thr * 7, t, 0.12); glide(b.sub.frequency, (27 + v * 4.2 + thr * 7) / 2, t, 0.12);
    glide(b.lp.frequency, 170 + thr * 520 + v * 22, t, 0.1);
    glide(b.eg.gain, (0.06 + thr * 0.11 + v * 0.007) * (b.quiet ? 0.6 : 1), t, 0.12);
    glide(b.rdg.gain, Math.min(1, v / 7) * 0.2, t, 0.2);
    glide(b.tyg.gain, Math.min(1, v / 7) * 0.035 * b.wet, t, 0.2);
    // the rain on the pane, a few ticks at a time
    b.rainT += ddt * (still ? 22 : 30) * b.wet * (b.quiet ? 0.6 : 1);
    while (b.rainT >= 1) { b.rainT -= 1; patter(t + R() * 0.04, rr(0.02, 0.07)); }
    // cobbles: the whole box rattles
    if (bus.cob > 0 && v > 1) {
      b.cobT += ddt * 11 * Math.min(1, v / 6);
      while (b.cobT >= 1) { b.cobT -= 1; if (R() < 0.45) thud(t + R() * 0.04, rr(0.05, 0.12), rr(70, 110)); rattle(t + R() * 0.04, rr(0.03, 0.07)); }
    }
    // the fingertip
    const inp = sim.input, racing = sim.phase === 'race' && !sim.end && inp.down;
    let sq = 0, sh = 0;
    if (racing && b.fx != null) {
      const sp = Math.hypot(inp.x - b.fx, inp.y - b.fy) / ddt, fog = sim.at(sim.f, inp.x, inp.y), k = Math.min(1, sp / 22);
      sq = k * (1 - Math.min(1, fog * 2.5)) * 0.07 * rr(0.35, 1);
      sh = k * Math.min(1, fog * 2) * 0.11;
      glide(b.sq.frequency, 1150 + Math.min(sp, 40) * 22 + rr(-90, 90), t, 0.02);
      glide(b.sqb.frequency, 1300 + Math.min(sp, 40) * 20, t, 0.03);
    }
    b.fx = racing ? inp.x : null; b.fy = racing ? inp.y : null;
    glide(b.sqg.gain, sq, t, 0.015); glide(b.shg.gain, sh, t, 0.03);
    b.plics = Math.max(0, b.plics - ddt * 10);
  },
  event(e, sim) {
    const b = this.bed; if (!b || !E.ctx) return;
    const t = E.now, name = (own) => sim.kids[own]?.name || 'you', dropP = (id) => { const d = sim.drop(id); return d ? panX(d.x) : 0; };
    switch (e.k) {
      case 'call': {
        const who = name(e.own), p = dropP(e.id);
        kid(t, who, LINE.dibs, { peak: e.own === YOU ? 0.22 : 0.17, p, speed: rr(0.95, 1.1) });
        if (e.own === YOU) plic(t, 0.3, 0.1, p);
        break;
      }
      case 'ready': click(t, 0.06, 2000, 'sfx'); break;
      case 'go':
        bell(t, 1480, 0.1); bell(t + 0.28, 1175, 0.09);
        sim.kids.forEach((k, i) => kid(t + 0.05 + i * 0.04, k.name, LINE.ya, { peak: 0.1, p: rr(-0.5, 0.5) }));
        break;
      case 'bus':
        if (e.what === 'hard') { squeal(t, 1.1, 0.06); thud(t + 0.1, 0.18, 70); kid(t + 0.15, sim.kids[1 + Math.floor(R() * (sim.kids.length - 1))]?.name || 'dani', LINE.ua, { peak: 0.13, p: rr(-0.4, 0.4) }); }
        else if (e.what === 'brake') squeal(t, 0.6, 0.025);
        else if (e.what === 'still') pssh(t, 0.35, 0.07, 2600, 1500);
        else if (e.what === 'go') pssh(t, 0.25, 0.04, 3200, 2200);
        else if (e.what === 'doors') { pssh(t, 0.8, 0.14); thud(t + 0.5, 0.1, 120); }
        else if (e.what === 'shut') { beeps(t, 3); pssh(t + 0.72, 0.5, 0.1, 3600, 1600); thud(t + 1.1, 0.16, 100); }
        else if (e.what === 'bump') { thud(t, 0.22); for (let k = 0; k < 5; k++) rattle(t + 0.02 + k * 0.03, 0.05); }
        break;
      case 'smear': squish(t, 0.12, panX(e.x)); break;
      case 'merge': {
        const mine = e.own === YOU || e.lost === YOU, called = e.own !== NEUTRAL || e.lost !== NEUTRAL;
        if (!called && b.plics > 6) break;
        b.plics++;
        plic(t, e.r, mine ? 0.13 : called ? 0.08 : 0.035, panX(e.x));
        break;
      }
      case 'eat': { const d = sim.drop(sim.kids[e.own]?.drop), p = d ? panX(d.x) : 0; plic(t, 0.6, 0.14, p); plic(t + 0.07, 0.9, 0.12, p); kid(t + 0.1, name(e.own), LINE.nam, { peak: 0.16, p }); break; }
      case 'eaten': plic(t, 1, 0.12); break;
      case 'seal': { const d = sim.drop(e.id), p = d ? panX(d.x) : 0; plic(t, 1.1, 0.14, p); thud(t + 0.02, 0.08, 140); break; }
      case 'end': {
        const others = sim.kids.filter((k) => k.own !== YOU);
        if (e.win) {
          bell(t + 0.05, 1480, 0.1); bell(t + 0.35, 1175, 0.1);
          [1047, 1319, 1568, 2093].forEach((f, i) => bell(t + 0.6 + i * 0.1, f, 0.05, 0.8));
          kid(t + 0.1, 'you', LINE.bien, { peak: 0.22 });
          others.forEach((k, i) => kid(t + 0.5 + i * 0.12, k.name, LINE.oh, { peak: 0.08, fall: 0.8, p: rr(-0.5, 0.5) }));
        } else if (e.why === 'squash') { squish(t, 0.2); kid(t + 0.15, 'you', LINE.oh, { peak: 0.18, fall: 0.75 }); }
        else if (e.why === 'cheat') { squish(t, 0.18); buzz(t + 0.1, 110, 0.3, 0.06); kid(t + 0.2, name(e.by), LINE.trampa, { peak: 0.2 }); }
        else if (e.why === 'stop') { bell(t, 1480, 0.1); bell(t + 0.28, 1175, 0.09); kid(t + 0.5, 'you', LINE.oh, { peak: 0.16, fall: 0.8 }); }
        else { kid(t + 0.05, name(e.by), LINE.bien, { peak: 0.2 }); kid(t + 0.55, 'you', LINE.oh, { peak: 0.14, fall: 0.8 }); }
        break;
      }
      default: break;
    }
  },
  ui: {
    // the paper of the pass under a finger
    tap() { if (E.live) click(E.now, 0.08, 3600); },
    // the validator swallows the ticket and stamps it
    go() { if (!E.live) return; const t = E.now; click(t, 0.14, 1800); click(t + 0.09, 0.12, 900); buzz(t + 0.03, 70, 0.12, 0.03); click(t + 0.18, 0.1, 2600); },
    deny() { if (E.live) buzz(E.now, 140, 0.14, 0.06); },
    // a hole punched: the snap of the punch, and a chime a note higher each time
    stamp(i) { if (!E.live) return; const t = E.now; click(t, 0.18, 2200); click(t + 0.012, 0.1, 5200); bell(t + 0.02, [1319, 1568, 2093][i] ?? 1319, 0.06, 0.9, 'ui'); },
  },
};
