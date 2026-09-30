// The sound of the paradox, all of it synthesised. Under everything, the flat: the fridge humming in the kitchen,
// the clock, the tap dripping into the sink, the crickets on the terrace at night. Over it, the paradox itself:
// two tones that can't agree, beating faster the harder the two laws fight, a whirr when the cat spins like a
// top, and silence when it gives up the fight and sits. The cat is a voice run through a mouth that opens and
// closes (m-i-a-u): a meow when it's spun, a yowl in the water, a «mrrp» when it sits in the box, then a purr.
// The jam splats and gloops, the squeezy bottles go «pfrrt» and glug, the tape rips, glass tinkles, ceramic
// crunches, the rubber duck squeaks, the dog barks and its tags jingle, the box goes «bof».
import { E, gain, filt, pan as panner, chain, glide, clamp } from './audio/core.js';

const R = Math.random, rr = (a, b) => a + (b - a) * R();

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
function tone(c, type, f, t) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); return o; }
// left and right of the cat (the camera follows it)
const rel = (x, sim) => (sim && x != null ? clamp((x - sim.x) / 380, -1, 1) * 0.75 : 0);

// ---------- the cat ----------
// a meow: a buzzy voice through a mouth that opens and closes (m-i-a-u), the pitch arching over it
function meow(t, { dur = 0.6, f0 = 540, peak = 0.15, p = 0, arc = 1.25, end = 0.82, vib = 0, trill = 0 } = {}) {
  const c = E.ctx, f = f0 * rr(0.95, 1.05), o = tone(c, 'sawtooth', f * 0.9, t), amp = gain(c, 0), mouth = filt(c, 'lowpass', 450, 0.9), mix = gain(c, 1);
  o.frequency.linearRampToValueAtTime(f * arc, t + dur * 0.35);
  o.frequency.linearRampToValueAtTime(f * end, t + dur);
  if (vib) { const v = tone(c, 'sine', rr(5.5, 7), t); chain(v, gain(c, f * vib), o.frequency); v.start(t); v.stop(t + dur + 0.1); }
  const F = [[750, 1900, 3300], [1150, 1750, 3000], [650, 1100, 2700]], Q = [7, 9, 11], G = [1.8, 1.1, 0.4];
  for (let k = 0; k < 3; k++) {
    const b = filt(c, 'bandpass', F[0][k], Q[k]);
    b.frequency.setValueAtTime(F[0][k], t); b.frequency.linearRampToValueAtTime(F[1][k], t + dur * 0.3); b.frequency.linearRampToValueAtTime(F[2][k], t + dur * 0.95);
    chain(o, b, gain(c, G[k]), mix);
  }
  // the lips: shut for the m, wide for the a, rounding for the u
  mouth.frequency.setValueAtTime(420, t); mouth.frequency.exponentialRampToValueAtTime(4200, t + Math.min(0.12, dur * 0.25)); mouth.frequency.exponentialRampToValueAtTime(800, t + dur);
  amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(peak, t + 0.035);
  amp.gain.setValueAtTime(peak * 0.92, t + dur * 0.72); amp.gain.linearRampToValueAtTime(0, t + dur);
  let tail = amp;
  if (trill) {
    // the rolled r of a «mrrp»: the voice fluttering at ~25 Hz
    const tr = gain(c, 1 - trill * 0.5), lfo = tone(c, 'sine', rr(22, 28), t);
    chain(lfo, gain(c, trill * 0.5), tr.gain); lfo.start(t); lfo.stop(t + dur + 0.1);
    tail = chain(amp, tr);
  }
  chain(mix, mouth, amp); chain(tail, panner(c, p), E.g.bus.cat);
  // a little breath on the attack
  const br = noise(c, 'white', t), bg = env(c, t, 0.01, 0.03, 0.05, peak * 0.12);
  chain(br, filt(c, 'bandpass', 2600, 1.2), bg, panner(c, p), E.g.bus.cat); br.stop(t + 0.2);
  o.start(t); o.stop(t + dur + 0.1);
}
const MEOW = {
  spun: { dur: 0.75, f0: 600, vib: 0.07, arc: 1.3, end: 0.75, peak: 0.13 },
  worried: { dur: 0.38, f0: 720, arc: 1.12, end: 0.72, peak: 0.1 },
  mrrp: { dur: 0.26, f0: 420, arc: 1.35, end: 1.2, trill: 0.8, peak: 0.13 },
  mrr: { dur: 0.2, f0: 380, arc: 1.15, end: 0.95, trill: 0.7, peak: 0.08 },
  yelp: { dur: 0.24, f0: 820, arc: 1.3, end: 0.8, peak: 0.14 },
  yowl: { dur: 1.05, f0: 470, vib: 0.05, arc: 1.45, end: 0.7, peak: 0.16 },
  happy: { dur: 0.5, f0: 560, arc: 1.3, end: 1.05, peak: 0.14 },
  sad: { dur: 0.7, f0: 500, arc: 1.08, end: 0.62, peak: 0.12 },
};
// fright: a hiss that starts with a spit
function hiss(t, dur = 0.5, peak = 0.12, p = 0) {
  const c = E.ctx, s = noise(c, 'white', t), g = env(c, t, 0.015, dur * 0.6, dur * 0.4, peak);
  chain(s, filt(c, 'highpass', 2200, 0.7), filt(c, 'peaking', 5200, 1.2, 8), g, panner(c, p), E.g.bus.cat); s.stop(t + dur + 0.3);
  const k = noise(c, 'white', t), kg = env(c, t, 0.001, 0.008, 0.02, peak * 1.4);
  chain(k, filt(c, 'bandpass', 1800, 1), kg, panner(c, p), E.g.bus.cat); k.stop(t + 0.08);
}

// ---------- the dog ----------
// a bark: a voice dropping fast through an «o», with a puff of breath; two of them, the second shorter
function bark(t, { peak = 0.16, p = 0, big = false } = {}) {
  const c = E.ctx;
  (big ? [0, 0.19, 0.34] : [0, 0.2]).forEach((d, n) => {
    const at = t + d, f = (big ? 300 : 260) * rr(0.94, 1.06) * (n ? 0.94 : 1), len = n ? 0.1 : 0.13;
    const o = tone(c, 'sawtooth', f * 1.25, at), amp = env(c, at, 0.006, len * 0.35, len * 0.6, peak * (n ? 0.85 : 1)), mix = gain(c, 1);
    o.frequency.exponentialRampToValueAtTime(f * 0.7, at + len);
    [[560, 5, 1.6], [1150, 7, 0.8], [2500, 9, 0.25]].forEach(([fq, q, g]) => chain(o, filt(c, 'bandpass', fq, q), gain(c, g), mix));
    chain(mix, amp, panner(c, p), E.g.bus.dog); o.start(at); o.stop(at + len + 0.15);
    const s = noise(c, 'pink', at), sg = env(c, at, 0.004, 0.03, 0.05, peak * 0.35);
    chain(s, filt(c, 'bandpass', 900, 0.8), sg, panner(c, p), E.g.bus.dog); s.stop(at + 0.15);
  });
}
// the tags on its collar, a step at a time
function jingle(t, peak = 0.025, p = 0) {
  const c = E.ctx;
  for (let k = 0; k < 2; k++) {
    const at = t + k * rr(0.02, 0.05), o = tone(c, 'sine', rr(4200, 6400), at), g = env(c, at, 0.001, 0.004, 0.09, peak);
    chain(o, g, panner(c, p), E.g.bus.dog); o.start(at); o.stop(at + 0.2);
  }
}

// ---------- things ----------
function click(t, peak = 0.1, f = 3200, bus = 'ui', p = 0) {
  const c = E.ctx, s = noise(c, 'white', t), g = env(c, t, 0.001, 0.003, 0.02, peak);
  chain(s, filt(c, 'bandpass', f, 1.6), g, panner(c, p), E.g.bus[bus]); s.stop(t + 0.06);
}
function buzz(t, f = 140, dur = 0.14, peak = 0.06) {
  const c = E.ctx, o = tone(c, 'square', f, t), g = env(c, t, 0.005, dur, 0.03, peak);
  chain(o, filt(c, 'lowpass', 1200), g, E.g.bus.ui); o.start(t); o.stop(t + dur + 0.1);
}
function bell(t, f, peak = 0.1, dec = 1, bus = 'sfx', p = 0) {
  const c = E.ctx;
  [[1, 1], [2.76, 0.35], [5.4, 0.14]].forEach(([m, a]) => {
    const o = tone(c, 'sine', f * m, t), g = env(c, t, 0.002, 0.008, dec / m, peak * a);
    chain(o, g, panner(c, p), E.g.bus[bus]); o.start(t); o.stop(t + dec * 1.4);
  });
}
// a body meeting a floor: a low knock and the scuff of it
function thud(t, peak = 0.2, f = 90, p = 0) {
  const c = E.ctx, o = tone(c, 'sine', f * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.12);
  const g = env(c, t, 0.002, 0.02, 0.11, peak); chain(o, g, panner(c, p), E.g.bus.sfx); o.start(t); o.stop(t + 0.3);
  const s = noise(c, 'brown', t), gn = env(c, t, 0.002, 0.02, 0.07, peak * 0.8); chain(s, filt(c, 'lowpass', 600), gn, panner(c, p), E.g.bus.sfx); s.stop(t + 0.2);
}
// a paw on the floor, or a cat on a cushion
function pat(t, peak = 0.08, p = 0) {
  const c = E.ctx, s = noise(c, 'brown', t), g = env(c, t, 0.002, 0.012, 0.04, peak);
  chain(s, filt(c, 'lowpass', 750, 0.8), g, panner(c, p), E.g.bus.sfx); s.stop(t + 0.12);
  const o = tone(c, 'sine', 170, t), og = env(c, t, 0.002, 0.01, 0.05, peak * 0.5); chain(o, og, panner(c, p), E.g.bus.sfx); o.start(t); o.stop(t + 0.12);
}
// the box: a hollow cardboard «bof» and the rustle of its flaps
function cardboard(t, peak = 0.22, p = 0) {
  const c = E.ctx, o = tone(c, 'sine', 150, t);
  o.frequency.exponentialRampToValueAtTime(78, t + 0.1);
  const og = env(c, t, 0.003, 0.03, 0.12, peak); chain(o, og, panner(c, p), E.g.bus.sfx); o.start(t); o.stop(t + 0.35);
  const s = noise(c, 'pink', t), sg = env(c, t, 0.004, 0.04, 0.1, peak * 0.9); chain(s, filt(c, 'bandpass', 420, 1.1), sg, panner(c, p), E.g.bus.sfx); s.stop(t + 0.3);
  const r = noise(c, 'white', t + 0.05), rg = env(c, t + 0.05, 0.03, 0.12, 0.12, peak * 0.14); chain(r, filt(c, 'bandpass', 2400, 0.7), rg, panner(c, p), E.g.bus.sfx); r.stop(t + 0.5);
}
// jam meeting a surface: a wet slap, then a squelch sliding down
function splat(t, peak = 0.14, p = 0) {
  const c = E.ctx, s = noise(c, 'pink', t), f = filt(c, 'lowpass', 1800, 3), g = env(c, t, 0.003, 0.04, 0.1, peak);
  f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(320, t + 0.16);
  chain(s, f, g, panner(c, p), E.g.bus.sfx); s.stop(t + 0.35);
  const k = noise(c, 'white', t), kg = env(c, t, 0.001, 0.006, 0.02, peak * 0.6); chain(k, filt(c, 'bandpass', 1500, 2.5), kg, panner(c, p), E.g.bus.sfx); k.stop(t + 0.06);
}
function splash(t, peak = 0.22, p = 0) {
  const c = E.ctx, s = noise(c, 'white', t), b = filt(c, 'bandpass', 3200, 0.8), g = env(c, t, 0.004, 0.08, 0.35, peak);
  b.frequency.setValueAtTime(3200, t); b.frequency.exponentialRampToValueAtTime(500, t + 0.5);
  chain(s, b, g, panner(c, p), E.g.bus.sfx); s.stop(t + 1);
  thud(t, peak * 0.6, 70, p);
  // bubbles coming back up
  for (let k = 0; k < 7; k++) {
    const at = t + 0.12 + R() * 0.55, f0 = rr(380, 900), o = tone(c, 'sine', f0, at), og = env(c, at, 0.002, 0.01, 0.04, peak * rr(0.12, 0.3));
    o.frequency.exponentialRampToValueAtTime(f0 * 2.2, at + 0.05); chain(o, og, panner(c, p + rr(-0.2, 0.2)), E.g.bus.sfx); o.start(at); o.stop(at + 0.12);
  }
}
// the tap, into the sink or the bath
function drip(t, peak = 0.04, p = 0) {
  const c = E.ctx, f0 = rr(900, 1400), o = tone(c, 'sine', f0, t), g = env(c, t, 0.001, 0.006, 0.05, peak);
  o.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + 0.045); chain(o, g, panner(c, p), E.g.bus.amb); o.start(t); o.stop(t + 0.15);
}
function sizzle(t, dur = 0.9, peak = 0.08, p = 0) {
  const c = E.ctx, s = noise(c, 'white', t), g = env(c, t, 0.03, dur * 0.5, dur * 0.5, peak);
  chain(s, filt(c, 'highpass', 3200, 0.7), g, panner(c, p), E.g.bus.sfx); s.stop(t + dur + 0.4);
  for (let k = 0; k < 9; k++) click(t + R() * dur, peak * rr(0.3, 0.8), rr(2500, 6000), 'sfx', p);
}
// air: a gust on the terrace, a fan blade going by
function whoosh(t, dur = 1.2, peak = 0.12, p = 0, from = 300, to = 1300) {
  const c = E.ctx, s = noise(c, 'pink', t), b = filt(c, 'bandpass', from, 0.9), g = env(c, t, dur * 0.35, dur * 0.15, dur * 0.5, peak);
  b.frequency.setValueAtTime(from, t); b.frequency.exponentialRampToValueAtTime(to, t + dur * 0.45); b.frequency.exponentialRampToValueAtTime(from * 1.4, t + dur);
  chain(s, b, g, panner(c, p), E.g.bus.sfx); s.stop(t + dur * 1.5);
}
// head first: a woodblock, and the birdies that circle a dizzy cat
function bonk(t, peak = 0.18, p = 0) {
  const c = E.ctx, o = tone(c, 'sine', 760, t), g = env(c, t, 0.001, 0.01, 0.1, peak);
  o.frequency.exponentialRampToValueAtTime(360, t + 0.09); chain(o, g, panner(c, p), E.g.bus.sfx); o.start(t); o.stop(t + 0.25);
  click(t, peak * 0.8, 1400, 'sfx', p);
  for (let k = 0; k < 3; k++) {
    const at = t + 0.22 + k * 0.17, f0 = rr(2600, 3400), b = tone(c, 'sine', f0, at), bg = env(c, at, 0.004, 0.03, 0.04, peak * 0.22);
    b.frequency.linearRampToValueAtTime(f0 * 1.25, at + 0.05); b.frequency.linearRampToValueAtTime(f0 * 0.95, at + 0.09);
    chain(b, bg, panner(c, p + (k % 2 ? 0.3 : -0.3)), E.g.bus.sfx); b.start(at); b.stop(at + 0.15);
  }
}
// the cucumber fright: a spring letting go
function boing(t, peak = 0.12, p = 0) {
  const c = E.ctx, o = tone(c, 'triangle', 180, t), v = tone(c, 'sine', 16, t), g = env(c, t, 0.003, 0.05, 0.3, peak), vg = gain(c, 45);
  o.frequency.exponentialRampToValueAtTime(620, t + 0.3); vg.gain.setTargetAtTime(0, t, 0.15);
  chain(v, vg, o.frequency); chain(o, g, panner(c, p), E.g.bus.sfx); o.start(t); v.start(t); o.stop(t + 0.6); v.stop(t + 0.6);
}
// the rubber duck
function squeak(t, peak = 0.1, p = 0) {
  const c = E.ctx, o = tone(c, 'sawtooth', 1050, t), g = env(c, t, 0.01, 0.1, 0.05, peak);
  o.frequency.linearRampToValueAtTime(1550, t + 0.05); o.frequency.linearRampToValueAtTime(1250, t + 0.16);
  chain(o, filt(c, 'bandpass', 1800, 3), g, panner(c, p), E.g.bus.sfx); o.start(t); o.stop(t + 0.3);
}
function cricket(t, peak = 0.012, p = 0) {
  const c = E.ctx, f = rr(4300, 4900);
  for (let k = 0; k < 3; k++) {
    const at = t + k * 0.05, o = tone(c, 'sine', f, at), g = env(c, at, 0.004, 0.012, 0.012, peak);
    chain(o, g, panner(c, p), E.g.bus.amb); o.start(at); o.stop(at + 0.06);
  }
}

// ---------- what things are made of ----------
const MAT = { milk: 'glass', oil: 'glass', bottle: 'glass', mug: 'china', vase: 'china', bowl: 'china', gnome: 'china', pot: 'clay', fruit: 'soft', roll: 'soft', keys: 'keys', remote: 'plastic', duck: 'duck' };
// a breakage: the crash, then the shards (glass rings high and long, china clinks, terracotta crumbles)
function shatter(t, mat, peak = 0.2, p = 0) {
  const c = E.ctx, hi = mat === 'glass', clay = mat === 'clay';
  const s = noise(c, 'white', t), g = env(c, t, 0.001, 0.03, hi ? 0.25 : 0.18, peak);
  chain(s, filt(c, 'bandpass', hi ? 4200 : clay ? 900 : 2300, 0.8), g, panner(c, p), E.g.bus.sfx); s.stop(t + 0.6);
  thud(t, peak * (clay ? 0.9 : 0.5), clay ? 110 : 140, p);
  const n = hi ? 16 : clay ? 6 : 11;
  for (let k = 0; k < n; k++) {
    const at = t + 0.01 + Math.pow(R(), 1.6) * (hi ? 0.6 : 0.45), f = hi ? rr(2800, 7500) : clay ? rr(700, 1800) : rr(1600, 4200);
    const o = tone(c, 'sine', f, at), og = env(c, at, 0.001, 0.003, hi ? rr(0.04, 0.14) : rr(0.02, 0.06), peak * rr(0.08, 0.3));
    chain(o, og, panner(c, p + rr(-0.25, 0.25)), E.g.bus.sfx); o.start(at); o.stop(at + 0.25);
  }
  if (clay) { const d = noise(c, 'brown', t + 0.03), dg = env(c, t + 0.03, 0.01, 0.08, 0.12, peak * 0.5); chain(d, filt(c, 'lowpass', 1400), dg, panner(c, p), E.g.bus.sfx); d.stop(t + 0.4); }
}
// something landing (or nudged) without breaking
function knock(t, mat, peak = 0.08, p = 0) {
  switch (mat) {
    case 'glass': bell(t, rr(2400, 2900), peak * 0.5, 0.25, 'sfx', p); click(t, peak * 0.6, 3000, 'sfx', p); break;
    case 'china': bell(t, rr(1300, 1700), peak * 0.4, 0.18, 'sfx', p); pat(t, peak * 0.6, p); break;
    case 'clay': thud(t, peak * 0.8, 130, p); break;
    case 'keys': for (let k = 0; k < 4; k++) jingle(t + k * 0.03, peak * 0.5, p); click(t, peak * 0.5, 2600, 'sfx', p); break;
    case 'plastic': click(t, peak, 1800, 'sfx', p); click(t + 0.03, peak * 0.5, 2400, 'sfx', p); break;
    case 'duck': squeak(t, Math.min(0.12, peak * 1.5), p); break;
    default: pat(t, peak, p);
  }
}

// ---------- the bed: the flat, the paradox, the purr ----------
const ROOM = {
  desayuno: { tone: 1, fridge: 0.55, clock: 1 },
  nevera: { tone: 1, fridge: 1, drip: 3.4 },
  salon: { tone: 0.9, street: 0.8, clock: 1 },
  pasillo: { tone: 0.8, street: 0.5 },
  bano: { tone: 1.1, drip: 2.6 },
  terraza: { night: 1, street: 1 },
};
function makeBed(level, quiet) {
  const c = E.ctx, t = E.now, B = E.g.bus, srcs = [], room = ROOM[level.id] || { tone: 1 };
  const out = gain(c, 0); out.gain.setTargetAtTime(quiet ? 0.5 : 1, t, 0.4); out.connect(B.amb);
  E.g.roomSend(room.night ? 0.08 : level.id === 'bano' ? 0.6 : 0.45);
  const lfo = (f, depth, param) => { const o = tone(c, 'sine', f, t); chain(o, gain(c, depth), param); o.start(t); srcs.push(o); };
  if (room.tone) { const s = noise(c, 'pink', t); chain(s, filt(c, 'lowpass', 380, 0.6), gain(c, 0.035 * room.tone), out); srcs.push(s); }
  // the fridge: its compressor humming at twice the mains, and the motor under it
  if (room.fridge) {
    const f1 = tone(c, 'sine', 100, t), f2 = tone(c, 'sine', 150, t), fg = gain(c, 0.014 * room.fridge);
    chain(f1, fg); chain(f2, gain(c, 0.5), fg); chain(fg, filt(c, 'lowpass', 400), out);
    lfo(0.23, 0.004 * room.fridge, fg.gain);
    const m = noise(c, 'brown', t); chain(m, filt(c, 'lowpass', 140, 0.8), gain(c, 0.05 * room.fridge), out);
    f1.start(t); f2.start(t); srcs.push(f1, f2, m);
  }
  // the street through a closed window, swelling as cars pass
  if (room.street) { const s = noise(c, 'brown', t), sg = gain(c, 0.05 * room.street); chain(s, filt(c, 'lowpass', 260, 0.7), sg, out); lfo(0.07, 0.02 * room.street, sg.gain); srcs.push(s); }
  // the night wind on the terrace
  if (room.night) {
    const s = noise(c, 'pink', t), bp = filt(c, 'bandpass', 520, 0.6), wg = gain(c, 0.07);
    chain(s, bp, wg, out); lfo(0.11, 0.035, wg.gain); lfo(0.07, 180, bp.frequency); srcs.push(s);
  }
  // the paradox: two tones that can't agree (the beat between them is the fight), an octave above for shimmer
  const hOut = gain(c, 0), hLp = filt(c, 'lowpass', 900, 0.9); hOut.connect(B.hum);
  const hA = tone(c, 'triangle', 160, t), hB = tone(c, 'triangle', 161, t), hC = tone(c, 'sine', 320, t);
  chain(hA, gain(c, 0.5), hLp); chain(hB, gain(c, 0.5), hLp); chain(hC, gain(c, 0.12), hLp); chain(hLp, hOut);
  hA.start(t); hB.start(t); hC.start(t); srcs.push(hA, hB, hC);
  // the whirr of a spin
  const wh = noise(c, 'pink', t), whBp = filt(c, 'bandpass', 400, 2.5), whG = gain(c, 0); chain(wh, whBp, whG, B.hum); srcs.push(wh);
  // the purr: a 26 Hz rattle through a closed mouth, breathing in and out
  const pr = tone(c, 'sawtooth', 26, t), prLp = filt(c, 'lowpass', 320, 1.5), prB = gain(c, 0.6), prG = gain(c, 0);
  const prn = noise(c, 'brown', t), prnG = gain(c, 0);
  chain(pr, gain(c, 0.8), prnG.gain); chain(prn, filt(c, 'lowpass', 600), prnG, prLp);
  chain(pr, prLp, prB, prG, B.cat); lfo(0.55, 0.4, prB.gain);
  pr.start(t); srcs.push(pr, prn);
  return { out, hOut, hA, hB, hC, hLp, whBp, whG, prG, srcs, room, quiet, clockT: rr(0, 1), dripT: rr(1, 2), crickT: rr(0.2, 1), tick: 0, dogs: [], nudgeT: 0, pawT: 0, plopT: 0, yuckT: -9, fullT: -9 };
}

// ---------- endings ----------
// out of jam: the paradox lets go (a slide down) and the cat lands on its feet like any cat, «aww»
function letGo(t, peak = 0.08) {
  const c = E.ctx, o = tone(c, 'triangle', 330, t), g = env(c, t, 0.02, 0.35, 0.25, peak);
  o.frequency.exponentialRampToValueAtTime(96, t + 0.6); chain(o, filt(c, 'lowpass', 900), g, E.g.bus.hum); o.start(t); o.stop(t + 1);
}
function aww(t, peak = 0.07) {
  const c = E.ctx;
  [[392, 0, 0.22], [330, 0.26, 0.22], [262, 0.52, 0.7]].forEach(([f, d, len], n) => {
    const at = t + d, o = tone(c, 'triangle', f, at), g = env(c, at, 0.03, len * 0.6, len * 0.4, peak);
    if (n === 2) { const v = tone(c, 'sine', 5.5, at); chain(v, gain(c, 6), o.frequency); v.start(at); v.stop(at + len + 0.3); }
    chain(o, filt(c, 'lowpass', 1100), g, E.g.bus.sfx); o.start(at); o.stop(at + len + 0.3);
  });
}
// over the rail: a falling whistle, then, far below, a bin lid
function plummet(t, peak = 0.08) {
  const c = E.ctx, o = tone(c, 'sine', 1500, t), g = env(c, t, 0.05, 0.9, 0.2, peak);
  o.frequency.exponentialRampToValueAtTime(240, t + 1.15); chain(o, g, E.g.bus.sfx); o.start(t); o.stop(t + 1.5);
  const at = t + 1.35;
  [[520, 1], [1310, 0.5], [2150, 0.3]].forEach(([f, a]) => { const b = tone(c, 'sine', f, at), bg = env(c, at, 0.002, 0.01, 1.1, peak * 0.35 * a); chain(b, filt(c, 'lowpass', 1800), bg, E.g.bus.sfx); b.start(at); b.stop(at + 1.6); });
  thud(at, peak * 0.5, 80);
}

// ---------- the jam, the bottles, the tape ----------
// a gloop of jam letting go of the toast: a thick, low «blop»
function plop(t, peak = 0.05, p = 0) {
  const c = E.ctx, f0 = rr(260, 420), o = tone(c, 'sine', f0, t), g = env(c, t, 0.002, 0.012, 0.06, peak);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.02); o.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + 0.08);
  chain(o, g, panner(c, p), E.g.bus.sfx); o.start(t); o.stop(t + 0.2);
  const s = noise(c, 'pink', t), sg = env(c, t, 0.001, 0.01, 0.03, peak * 0.5); chain(s, filt(c, 'lowpass', 900, 2), sg, panner(c, p), E.g.bus.sfx); s.stop(t + 0.1);
}
// a squeezy bottle squeezed: jam and air through the nozzle, chopped by the bubbles, «pfrrt»
function squirt(t, peak = 0.12, p = 0, dur = 0.26) {
  const c = E.ctx, s = noise(c, 'pink', t), bp = filt(c, 'bandpass', 600, 2.2), g = env(c, t, 0.004, dur * 0.6, dur * 0.4, peak);
  bp.frequency.setValueAtTime(480, t); bp.frequency.exponentialRampToValueAtTime(1500, t + dur);
  const lfo = tone(c, 'square', rr(38, 52), t), am = gain(c, 0.5);
  chain(lfo, gain(c, 0.5), am.gain); chain(s, bp, am, g, panner(c, p), E.g.bus.sfx);
  lfo.start(t); lfo.stop(t + dur + 0.3); s.stop(t + dur + 0.3);
  const o = tone(c, 'sawtooth', 95, t), og = env(c, t, 0.003, dur * 0.5, dur * 0.3, peak * 0.35);
  chain(o, filt(c, 'lowpass', 380, 1.5), og, panner(c, p), E.g.bus.sfx); o.start(t); o.stop(t + dur + 0.2);
}
// jam pouring onto the toast: a glug, higher as it fills up, the way a bottle does
function glug(t, full = 0.5, peak = 0.07, p = 0) {
  const c = E.ctx, f0 = 160 + full * 260, o = tone(c, 'sine', f0, t), g = env(c, t, 0.004, 0.03, 0.08, peak);
  o.frequency.exponentialRampToValueAtTime(f0 * 1.8, t + 0.07);
  chain(o, filt(c, 'lowpass', 1200), g, panner(c, p), E.g.bus.sfx); o.start(t); o.stop(t + 0.2);
  const s = noise(c, 'pink', t), sg = env(c, t, 0.004, 0.02, 0.06, peak * 0.6);
  chain(s, filt(c, 'bandpass', 600 + full * 700, 4), sg, panner(c, p), E.g.bus.sfx); s.stop(t + 0.15);
}
// duct tape off the roll: a rasp chopped faster and faster, «rrrras»
function rip(t, dur = 0.34, peak = 0.12, p = 0) {
  const c = E.ctx, s = noise(c, 'white', t), bp = filt(c, 'bandpass', 2600, 0.9), g = env(c, t, 0.01, dur * 0.7, dur * 0.3, peak);
  bp.frequency.setValueAtTime(1800, t); bp.frequency.linearRampToValueAtTime(3400, t + dur);
  const lfo = tone(c, 'sawtooth', 70, t), am = gain(c, 0.5);
  lfo.frequency.linearRampToValueAtTime(115, t + dur);
  chain(lfo, gain(c, 0.5), am.gain); chain(s, bp, am, g, panner(c, p), E.g.bus.sfx);
  lfo.start(t); lfo.stop(t + dur + 0.3); s.stop(t + dur + 0.3);
}
// the long way down: a slide whistle, wobbling
function whistle(t, dur = 0.6, peak = 0.045, from = 1500, to = 420) {
  const c = E.ctx, o = tone(c, 'sine', from, t), g = env(c, t, 0.03, dur * 0.8, dur * 0.2, peak);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const v = tone(c, 'sine', 7, t); chain(v, gain(c, 18), o.frequency); v.start(t); v.stop(t + dur + 0.2);
  chain(o, g, E.g.bus.sfx); o.start(t); o.stop(t + dur + 0.2);
}
// the paradox taking hold: two tones swelling up out of nothing, not quite agreeing
function engage(t, peak = 0.07) {
  const c = E.ctx, lp = filt(c, 'lowpass', 500), g = env(c, t, 0.25, 0.2, 0.5, peak);
  lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(1600, t + 0.45);
  chain(lp, g, E.g.bus.sfx);
  for (const [f, d] of [[120, 0], [124, 1]]) {
    const o = tone(c, d ? 'triangle' : 'sine', f, t); o.frequency.exponentialRampToValueAtTime(f * 2.1, t + 0.5);
    chain(o, lp); o.start(t); o.stop(t + 1.3);
  }
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
    glide(b.out.gain, 0, t, 0.12); glide(b.hOut.gain, 0, t, 0.06); glide(b.whG.gain, 0, t, 0.05); glide(b.prG.gain, 0, t, 0.1);
    E.later(() => { for (const s of b.srcs) { try { s.stop(); } catch { /* done */ } } b.out.disconnect(); b.hOut.disconnect(); b.whG.disconnect(); b.prG.disconnect(); }, 900);
  },
  frame(sim, dt) {
    const b = this.bed; if (!b || !E.ctx) return;
    this.acc += dt; if (this.acc < 0.04) return;
    const ddt = this.acc; this.acc = 0;
    const t = E.now, e = sim.end, q = b.quiet ? 0.5 : 1, hv = sim.hover || {};
    // the paradox: higher as it floats higher, beating faster as the laws fight harder; quiet when it sits or falls
    const f = clamp(sim.fight + sim.charge * 0.9, 0, 1.4), on = !e && !sim.sit && !hv.none ? 1 : 0;
    const base = 118 + clamp(hv.h ?? 0, 0, 160) * 0.9 + f * 20, beat = 0.5 + sim.fight * 3.5 + sim.charge * 12;
    glide(b.hA.frequency, base, t, 0.08); glide(b.hB.frequency, base + beat, t, 0.08); glide(b.hC.frequency, base * 2 - beat * 0.5, t, 0.08);
    glide(b.hLp.frequency, 380 + Math.min(1, f) * 1300, t, 0.1);
    glide(b.hOut.gain, on * (0.03 + 0.11 * Math.min(1, f)) * q, t, on ? 0.12 : 0.05);
    glide(b.whBp.frequency, 250 + Math.abs(sim.w || 0) * 85, t, 0.05);
    glide(b.whG.gain, e ? 0 : Math.pow(sim.spin, 1.5) * 0.16 * q, t, 0.06);
    // a cat sitting purrs; so does one that made it
    const purr = (sim.sit && !e) || e?.win ? 1 : 0;
    glide(b.prG.gain, purr * 0.16 * q, t, purr ? 0.35 : 0.12);
    // the flat going on around it
    const rm = b.room;
    if (rm.clock) { b.clockT -= ddt; if (b.clockT <= 0) { b.clockT += 1; b.tick ^= 1; click(t, 0.03 * q, b.tick ? 2600 : 1700, 'amb', -0.35); } }
    if (rm.drip) { b.dripT -= ddt; if (b.dripT <= 0) { b.dripT = rm.drip * rr(0.7, 1.3); const w = sim.water[0]; drip(t, 0.035 * q, w ? rel(w.x + w.w / 2, sim) : 0.2); } }
    if (rm.night) { b.crickT -= ddt; if (b.crickT <= 0) { b.crickT = rr(0.25, 0.7); cricket(t, 0.012 * q, rr(-0.8, 0.8)); } }
    // the dog's tags, a jingle every few steps
    sim.dogs.forEach((d, i) => {
      const s = b.dogs[i] || (b.dogs[i] = { x: d.x, acc: 0 });
      s.acc += Math.abs(d.x - s.x); s.x = d.x;
      if (s.acc > 32) { s.acc = 0; jingle(t, 0.02 * q, rel(d.x, sim)); }
    });
  },
  event(e, sim) {
    const b = this.bed; if (!b || !E.ctx) return;
    const t = E.now, p = rel(e.x, sim);
    switch (e.k) {
      case 'spin': meow(t, MEOW.spun); break;
      case 'gust': whoosh(t, 1.5, 0.16, (e.dir || 0) * 0.6, 260, 1100); break;
      case 'low': meow(t, MEOW.worried); break;
      case 'nojam': letGo(t); break;
      case 'drip': if (t - b.plopT > 0.14) { b.plopT = t; plop(t, 0.045, p); } break;
      case 'squirt': squirt(t, 0.12, p); if (t - b.yuckT > 2.2) { b.yuckT = t; meow(t + 0.12, MEOW.yelp); } break;
      case 'refill':
        glug(t, sim.b, 0.07, p); squirt(t, 0.045, p, 0.3);
        if (e.full && t - b.fullT > 2.5) { b.fullT = t; bell(t + 0.05, 1568, 0.05, 0.8); bell(t + 0.13, 2093, 0.045, 0.8); meow(t + 0.25, MEOW.mrr); }
        break;
      case 'hop': whoosh(t, 0.28, 0.05, p, 380, 1500); pat(t + 0.02, 0.05, p); break;
      case 'leap': whoosh(t, 1.1, 0.07, 0, 250, 900); break;
      case 'tape': rip(t, 0.3 + (e.long ? 0.12 : 0), 0.11, p); break;
      case 'engage': engage(t); break;
      case 'fall': whistle(t, e.dur || 0.6); break;
      case 'brake': pat(t, 0.1, p); whoosh(t, 0.3, 0.05, p, 700, 250); break;
      case 'slap': pat(t, 0.11, p); plop(t + 0.012, 0.05, p); break;
      case 'mew': meow(t, { ...(MEOW[e.m] || MEOW.mrrp), p }); break;
      case 'smear': splat(t, 0.13, p); break;
      case 'paw': if (t - b.pawT > 0.08) { b.pawT = t; pat(t, clamp(0.03 + (e.v || 0) / 2500, 0.03, 0.1)); } break;
      case 'bump': thud(t, clamp(0.05 + (e.v || 0) / 1600, 0.05, 0.25), 95, p); break;
      case 'bonk': bonk(t, 0.18, p); meow(t + 0.05, MEOW.yelp); break;
      case 'sit': if (e.box) { cardboard(t, 0.24, p); meow(t + 0.25, MEOW.mrrp); } else { pat(t, 0.09, p); meow(t + 0.12, MEOW.mrr); } break;
      case 'rise': whoosh(t, 0.3, 0.035, 0, 500, 1400); break;
      case 'splash': splash(t, 0.24, p); meow(t + 0.1, MEOW.yowl); E.duck(t, 1.2); break;
      case 'nudge': if (t - b.nudgeT > 0.12) { b.nudgeT = t; const o = sim.objs[e.id]; knock(t, MAT[o?.k] || 'soft', clamp(0.02 + (e.v || 0) / 3000, 0.02, 0.07), rel(o?.x, sim)); } break;
      case 'thud': knock(t, MAT[e.kind] || 'soft', clamp(0.04 + (e.v || 0) / 2400, 0.04, 0.2), p); break;
      case 'tempt': bell(t, 2093, 0.06, 1.1); bell(t + 0.08, 2637, 0.05, 1.1); meow(t + 0.15, MEOW.mrr); break;
      case 'break': shatter(t, MAT[e.kind] || 'china', e.tempt ? 0.26 : 0.2, p); E.duck(t, 0.8); break;
      case 'cucumber': hiss(t, 0.55, 0.14, p); boing(t + 0.02, 0.12); meow(t + 0.12, MEOW.yelp); break;
      case 'sizzle': sizzle(t, 0.9, 0.07); break;
      case 'fan': thud(t, 0.16, 150, p); click(t, 0.12, 2400, 'sfx', p); whoosh(t, 0.45, 0.08, p, 600, 2200); meow(t + 0.06, MEOW.yelp); break;
      case 'woof': bark(t, { p, big: !!e.jump }); break;
      case 'knock': thud(t, 0.2, 110, p); meow(t + 0.04, MEOW.yelp); break;
      case 'end':
        if (e.win) { [784, 988, 1175, 1568].forEach((fq, i) => bell(t + 0.35 + i * 0.09, fq, 0.07, 0.9)); meow(t + 0.7, MEOW.happy); }
        else if (e.why === 'jam') { aww(t + 0.35); meow(t + 1.2, MEOW.sad); }
        else if (e.why === 'water') meow(t + 1, MEOW.sad);
        else if (e.why === 'fell') plummet(t);
        break;
      default: break;
    }
  },
  ui: {
    // a magnet let go against the enamel
    tap() { if (!E.live) return; const t = E.now; click(t, 0.07, 2600); click(t + 0.004, 0.05, 650); },
    // a magnet pulled off and the note taken down
    go() {
      if (!E.live) return; const t = E.now, c = E.ctx;
      click(t, 0.12, 1500); click(t + 0.005, 0.08, 500);
      const s = noise(c, 'white', t + 0.04), bp = filt(c, 'bandpass', 1800, 1.2), g = env(c, t + 0.04, 0.02, 0.06, 0.08, 0.05);
      bp.frequency.setValueAtTime(1800, t + 0.04); bp.frequency.exponentialRampToValueAtTime(4200, t + 0.16);
      chain(s, bp, g, E.g.bus.ui); s.stop(t + 0.4);
    },
    deny() { if (!E.live) return; const t = E.now; click(t, 0.1, 500); buzz(t + 0.02, 110, 0.12, 0.05); },
    // a star magnet clacks on, a chime a note higher each time
    star(i) { if (!E.live) return; const t = E.now; click(t, 0.14, 2200); click(t + 0.006, 0.08, 600); bell(t + 0.015, [1568, 1976, 2349][i] ?? 1568, 0.06, 1, 'ui'); },
    // the Polaroid pinned to the door
    stick() { if (!E.live) return; const t = E.now; click(t, 0.12, 1800); click(t + 0.005, 0.1, 480); pat(t + 0.01, 0.03); },
  },
};
