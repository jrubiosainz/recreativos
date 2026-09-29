// UN SOLO VIAJE foley: what your hands, your feet, the bags and the building sound like, all
// synthesised from the kit. Every function takes the context time to play at and schedules nodes
// that stop themselves. Plastic is the star: a supermarket bag is noise gated by a train of tiny,
// uneven clicks, so one crinkle is a noise source and a gain with a hundred spikes on it.
import { E, gain, filt, pan, chain, softclip, hold } from './core.js';
import { hit, burst, sweep, env, osc, noise, note } from './kit.js';

export const R = () => Math.random();
export const U = (a, b) => a + (b - a) * R();
export const cl = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
export const B = (k) => E.g.bus[k];
export function out(bus, p = 0, v = 1) {
  const c = E.ctx, g = gain(c, v);
  if (p) chain(g, pan(c, cl(p)), B(bus)); else g.connect(B(bus));
  return g;
}
const click = (d, t, pk = 0.1, f = 3000) => burst(d, t, { type: 'highpass', f, q: 0.7, pk, a: 0.0004, d: 0.005, len: 0.004, r: 0.004 });
const thump = (d, t, pk = 0.3, f0 = 120, f1 = 45, len = 0.1) => sweep(d, t, f0, f1, { pk, a: 0.002, d: len, len, r: len * 0.4 });
const ping = (d, t, f, pk = 0.03, dk = 0.08) => { const e = env(d, t, { pk, a: 0.0008, d: dk, len: dk, r: dk * 0.5 }); osc('sine', f, t, e.end, e.g); };

// ---------- plastic ----------
export function crinkle(d, t, dur, { dens = 90, pk = 0.06, bright = 1, body = 0.3 } = {}) {
  const c = E.ctx, end = t + dur + 0.06;
  for (const [f, q, share] of [[5400 * bright, 0.9, 0.6], [2700 * bright, 1.3, 0.4]]) {
    const g = gain(c, 0), P = g.gain, b = filt(c, 'bandpass', f, q);
    chain(b, g, d); noise('white', t, end, b);
    P.setValueAtTime(0, t);
    const n = Math.max(2, Math.round(dens * dur * share));
    let tc = t + R() * 0.008;
    for (let i = 0; i < n && tc < t + dur; i++) {
      P.setValueAtTime(0, tc); P.linearRampToValueAtTime(pk * U(0.2, 1), tc + 0.0006); P.setTargetAtTime(0, tc + 0.0006, U(0.0018, 0.006));
      tc += (dur / n) * U(0.3, 1.7);
    }
  }
  if (body) burst(d, t, { color: 'pink', f: 1300, q: 0.7, pk: pk * body, a: dur * 0.3, d: dur * 0.4, sus: 0.3, len: dur * 0.7, r: dur * 0.3 });
}
// bags swapping hands, swinging, settling: n is how many are moving
export function rustle(t, n = 1, p = 0) {
  crinkle(out('sfx', p, 5.6), t, 0.16 + 0.05 * Math.min(n, 6), { dens: 70 + 12 * Math.min(n, 6), pk: 0.05 });
}
// fingers closing round the handles
export function grab(t, kg = 3) {
  const d = out('sfx', 0, 2);
  crinkle(d, t, 0.11, { dens: 140, pk: 0.06 });
  thump(d, t + 0.02, 0.1, 190, 95, 0.05);
}
// the loops take the weight: the plastic stretches (a squeak going up) and the arm drops a little
export function hook(t, kg = 3) {
  const d = out('sfx', 0, 1), k = cl(kg / 9, 0, 1);
  burst(d, t, { f: 900, to: 1700, q: 7, pk: 0.028 + 0.02 * k, a: 0.01, d: 0.1, sus: 0.5, len: 0.11, r: 0.04 });
  thump(d, t + 0.05, 0.12 + 0.2 * k, 120 - 30 * k, 42, 0.09);
  crinkle(d, t + 0.04, 0.08, { dens: 110, pk: 0.035 });
}
// everything down on the floor, one after the other
export function thud(t, n = 1) {
  const d = out('sfx', 0, 1);
  let tt = t;
  for (let i = 0; i < Math.min(n, 7); i++) {
    thump(d, tt, U(0.2, 0.3), U(90, 110), 40, 0.1);
    burst(d, tt, { type: 'lowpass', f: 650, q: 0.7, pk: 0.08, a: 0.001, d: 0.05, len: 0.04, r: 0.03 });
    crinkle(d, tt + 0.01, 0.09, { dens: 120, pk: 0.04, body: 0.2 });
    tt += U(0.05, 0.1);
  }
}
// the handle runs off the fingertips (zzip), and on flat floor, lands
export function slip(t, kg = 3, stairs = false) {
  const d = out('sfx', 0, 1), k = cl(kg / 9, 0, 1);
  burst(d, t, { f: 1400, to: 5200, q: 2, pk: 0.09, a: 0.008, d: 0.08, sus: 0.4, len: 0.09, r: 0.03 });
  crinkle(d, t + 0.03, 0.1, { dens: 150, pk: 0.05 });
  if (stairs) return;
  const ti = t + 0.27;
  thump(d, ti, 0.3 + 0.25 * k, 130 - 40 * k, 36, 0.13);
  burst(d, ti, { type: 'lowpass', f: 800, q: 0.7, pk: 0.14, a: 0.001, d: 0.06, len: 0.05, r: 0.04 });
  crinkle(d, ti + 0.01, 0.14, { dens: 120, pk: 0.05 });
}
// glass: an impact, then shards ringing and skittering; and whatever was in it, spreading
export function shatter(t, v = 1, wet = true) {
  const d = out('sfx', 0, v);
  burst(d, t, { type: 'highpass', f: 2200, q: 0.6, pk: 0.26, a: 0.0008, d: 0.07, len: 0.05, r: 0.05 });
  thump(d, t, 0.25, 180, 60, 0.06);
  for (let i = 0; i < 30; i++) {
    const tt = t + 0.004 + 0.42 * Math.pow(R(), 1.8), f = U(2100, 7600);
    ping(d, tt, f, U(0.008, 0.045) * (tt - t < 0.08 ? 1.4 : 1), U(0.02, 0.16));
    if (R() < 0.3) ping(d, tt, f * 1.53, 0.008, 0.03);
  }
  burst(d, t + 0.02, { type: 'highpass', f: 5200, q: 0.5, pk: 0.05, a: 0.002, d: 0.3, len: 0.3, r: 0.15 });
  if (wet) burst(d, t + 0.08, { color: 'pink', type: 'lowpass', f: 1400, to: 300, q: 1.1, pk: 0.07, a: 0.03, d: 0.35, sus: 0.3, len: 0.4, r: 0.2 });
}
// eggs: shells crack, then the wet part
export function splat(t, v = 1) {
  const d = out('sfx', 0, 2 * v);
  for (let i = 0; i < 6; i++) click(d, t + U(0, 0.05), U(0.04, 0.09), U(2500, 4500));
  burst(d, t + 0.01, { type: 'lowpass', f: 1500, to: 240, q: 1.6, pk: 0.32, a: 0.002, d: 0.14, len: 0.12, r: 0.06 });
  sweep(d, t + 0.02, 320, 110, { pk: 0.14, a: 0.003, d: 0.08, len: 0.09, r: 0.04, type: 'triangle' });
}

// ---------- you ----------
// rubber soles on terrazo; heavier with the load, a stone tock on the stairs, careful in the dark,
// and the bags swinging with every step
export function step(t, { stairs = false, kg = 0, dark = false, foot = 0 } = {}) {
  const v = dark ? 1 : 1.6, k = cl(kg / 25, 0, 1), d = out('steps', foot ? 0.07 : -0.07, v);
  burst(d, t, { f: U(1700, 2400), q: 1.2, pk: 0.07, a: 0.001, d: 0.015, len: 0.012, r: 0.01 });
  thump(d, t, 0.1 + 0.09 * k, 145 - 45 * k, 58, 0.035);
  if (stairs) sweep(d, t + 0.004, U(420, 480), 260, { pk: 0.04, a: 0.001, d: 0.02, len: 0.025, r: 0.01, type: 'triangle' });
  burst(d, t + U(0.045, 0.065), { f: U(2600, 3400), q: 1.3, pk: dark ? 0.03 : 0.018, a: 0.008, d: 0.03, len: dark ? 0.06 : 0.025, r: 0.02 });
  if (kg > 0.5) crinkle(out('sfx', foot ? 0.2 : -0.2, 1), t + U(0.06, 0.1), 0.06 + 0.05 * k, { dens: 90, pk: 0.012 + 0.02 * k, body: 0.15 });
}
// the camera whips round at the turn of the stairs
export function whoosh(t, turn = 1) {
  const c = E.ctx, g = gain(c, 1), p = c.createStereoPanner ? c.createStereoPanner() : null;
  if (p) { chain(g, p, B('sfx')); p.pan.setValueAtTime(-0.7 * turn, t); p.pan.linearRampToValueAtTime(0.7 * turn, t + 0.26); } else g.connect(B('sfx'));
  burst(g, t, { color: 'pink', f: 420, to: 2400, q: 0.9, pk: 0.22, a: 0.1, d: 0.1, sus: 0.4, len: 0.16, r: 0.1 });
}
// a breath out, when it's all on the floor
export function sigh(t) {
  const c = E.ctx, d = out('me', 0, 1.8), src = gain(c, 1), e = env(d, t, { pk: 0.5, a: 0.14, d: 0.3, sus: 0.7, len: 0.5, r: 0.3 });
  for (const [f0, f1, q, g] of [[760, 520, 5, 1], [1250, 1050, 7, 0.55], [2600, 2400, 8, 0.2]]) {
    const b = filt(c, 'bandpass', f0, q); b.frequency.exponentialRampToValueAtTime(f1, t + 0.7);
    chain(src, b, gain(c, g * 0.3), e.g);
  }
  noise('pink', t, e.end, src);
}
// tapping for a hand that has nothing to give
export function nope(t) {
  const d = out('ui', 0, 2.5);
  sweep(d, t, 330, 300, { pk: 0.07, a: 0.003, d: 0.05, len: 0.06, r: 0.02, type: 'triangle' });
  sweep(d, t + 0.1, 262, 240, { pk: 0.07, a: 0.003, d: 0.06, len: 0.08, r: 0.03, type: 'triangle' });
}

// ---------- the other ways of pressing things ----------
export function crouch(t) {
  const d = out('sfx', 0, 1.8);
  burst(d, t, { color: 'pink', f: 1800, q: 0.8, pk: 0.035, a: 0.05, d: 0.2, len: 0.25, r: 0.1 });
  click(d, t + 0.18, 0.1, 3600); click(d, t + 0.215, 0.07, 4200);
  const s = out('me', 0, 1.8);
  burst(s, t + 0.12, { f: 520, q: 3, pk: 0.05, a: 0.02, d: 0.1, sus: 0.5, len: 0.14, r: 0.05 });
  sweep(s, t + 0.12, 190, 140, { pk: 0.035, a: 0.02, d: 0.1, len: 0.14, r: 0.05, type: 'triangle' });
}
export function boop(t) {
  const d = out('sfx', 0, 1.4);
  sweep(d, t, 620, 1500, { pk: 0.14, a: 0.004, d: 0.06, len: 0.08, r: 0.03, curve: 0.6 });
  sweep(d, t + 0.05, 2200, 2700, { pk: 0.025, a: 0.003, d: 0.03, len: 0.04, r: 0.02 });
}
export function elbow(t) {
  const d = out('sfx', 0, 1);
  hit('wood', d, t, 0.8);
  thump(d, t, 0.12, 320, 150, 0.04);
  burst(d, Math.max(E.now, t - 0.04), { color: 'pink', f: 1500, q: 0.8, pk: 0.03, a: 0.02, d: 0.05, len: 0.05, r: 0.03 });
}
export function foot(t) {
  const d = out('sfx', 0, 1);
  burst(d, Math.max(E.now, t - 0.05), { f: 2800, q: 1.3, pk: 0.03, a: 0.01, d: 0.04, len: 0.04, r: 0.02 });
  thump(d, t, 0.38, 125, 48, 0.09);
  burst(d, t, { type: 'lowpass', f: 1300, q: 0.7, pk: 0.12, a: 0.001, d: 0.03, len: 0.03, r: 0.02 });
}
export function bum(t) {
  const d = out('sfx', 0, 1);
  burst(d, Math.max(E.now, t - 0.1), { color: 'pink', f: 1000, q: 0.8, pk: 0.03, a: 0.05, d: 0.06, len: 0.1, r: 0.04 });
  thump(d, t, 0.42, 155, 58, 0.12);
  burst(d, t, { color: 'pink', type: 'lowpass', f: 600, q: 0.7, pk: 0.16, a: 0.003, d: 0.08, len: 0.08, r: 0.05 });
}
// your forehead on the boot lid: the whole car body answers
export function clonc(t) {
  const d = out('sfx', 0, 1);
  sweep(d, t, 330, 205, { pk: 0.3, a: 0.001, d: 0.25, len: 0.25, r: 0.1, type: 'triangle', curve: 0.4 });
  for (const [f, g, dk] of [[742, 0.06, 0.4], [1183, 0.04, 0.3], [1688, 0.03, 0.22], [2317, 0.015, 0.12]]) ping(d, t, f, g, dk);
  burst(d, t, { type: 'lowpass', f: 1500, q: 0.7, pk: 0.15, a: 0.0006, d: 0.02, len: 0.015, r: 0.01 });
}

// ---------- the building ----------
export function keys(t) {
  const d = out('sfx', 0.15, 2.4);
  for (const o of [0, 0.09, 0.2]) {
    burst(d, t + o, { type: 'highpass', f: 5200, q: 0.6, pk: 0.015, a: 0.002, d: 0.04, len: 0.03, r: 0.02 });
    for (let i = 0; i < 4; i++) {
      const tt = t + o + U(0, 0.05), f = U(2800, 6200);
      ping(d, tt, f, U(0.01, 0.03), U(0.04, 0.12)); ping(d, tt, f * 1.52, 0.006, 0.05);
    }
  }
}
export function lock(t) {
  const d = out('sfx', 0.1, 1.6);
  burst(d, t, { f: 3500, q: 3, pk: 0.02, a: 0.01, d: 0.05, len: 0.06, r: 0.02 });
  click(d, t + 0.08, 0.12, 3000);
  thump(d, t + 0.085, 0.16, 260, 120, 0.04);
  ping(d, t + 0.085, 1450, 0.02, 0.08);
}
export function door(t, what = 'door') {
  const d = out('sfx', 0, what === 'portal' ? 0.85 : what === 'liftdoor' ? 1.2 : 2);
  if (what === 'portal') {
    // iron and wired glass: the latch, the panel rattling, then the closer bringing it home
    click(d, t, 0.1, 2500); thump(d, t + 0.01, 0.18, 200, 90, 0.05);
    for (let i = 0; i < 6; i++) burst(d, t + 0.02 + i * U(0.01, 0.018), { f: 2600, q: 4, pk: 0.035, a: 0.001, d: 0.008, len: 0.006, r: 0.006 });
    burst(d, t + 0.05, { color: 'pink', f: 500, q: 0.7, pk: 0.03, a: 0.1, d: 0.3, len: 0.4, r: 0.2 });
    thump(d, t + 1.25, 0.3, 95, 40, 0.14);
    for (let i = 0; i < 5; i++) burst(d, t + 1.26 + i * U(0.01, 0.02), { f: 2400, q: 4, pk: 0.025, a: 0.001, d: 0.008, len: 0.006, r: 0.006 });
  } else if (what === 'liftdoor') {
    click(d, t, 0.12, 2000); ping(d, t + 0.01, 980, 0.04, 0.2); ping(d, t + 0.01, 1630, 0.02, 0.12);
    creak(d, t + 0.08, 0.35, 540);
    thump(d, t + 0.9, 0.2, 180, 80, 0.06); ping(d, t + 0.9, 760, 0.03, 0.25);
  } else {
    // a flat's wooden door: the latch, the hinge sometimes, the wood
    click(d, t, 0.09, 2800); hit('wood', d, t + 0.01, 0.45);
    if (R() < 0.5) creak(d, t + 0.1, 0.4, U(160, 230));
    thump(d, t + 0.03, 0.12, 150, 70, 0.05);
  }
}
// a hinge: a bowed, uneven sawtooth through the wood's resonance
function creak(d, t, len, f) {
  const c = E.ctx, b = filt(c, 'bandpass', f * 6, 5), e = env(d, t, { pk: 0.035, a: 0.04, d: len, sus: 0.8, len, r: 0.06 }), o = osc('sawtooth', f, t, e.end, null);
  const w = gain(c, f * 0.06); osc('sine', U(9, 14), t, e.end, w); w.connect(o.frequency);
  o.frequency.linearRampToValueAtTime(f * U(0.8, 1.2), t + len);
  chain(o, b, e.g);
}
// the old lift's scissor gate folding: a run of steel clicks and the final clang
export function reja(t) {
  const d = out('sfx', 0.2, 1);
  let tt = t;
  for (let i = 0; i < 14; i++) {
    burst(d, tt, { f: U(1800, 3400), q: 6, pk: 0.04, a: 0.0005, d: 0.01, len: 0.008, r: 0.008 });
    ping(d, tt, U(1200, 2600), 0.01, 0.05);
    tt += 0.045 - i * 0.0018;
  }
  for (const [f, g, dk] of [[420, 0.07, 0.6], [1130, 0.04, 0.4], [2210, 0.02, 0.25]]) ping(d, tt + 0.02, f, g, dk);
  thump(d, tt + 0.02, 0.15, 220, 100, 0.05);
}
export function trunk(t) {
  const d = out('sfx', 0, 0.7);
  burst(d, t, { color: 'pink', f: 700, q: 0.8, pk: 0.035, a: 0.1, d: 0.1, len: 0.2, r: 0.05 });
  thump(d, t + 0.22, 0.5, 110, 42, 0.12);
  burst(d, t + 0.22, { type: 'lowpass', f: 900, q: 0.7, pk: 0.2, a: 0.001, d: 0.05, len: 0.05, r: 0.03 });
  click(d, t + 0.24, 0.08, 2800);
  for (let i = 0; i < 3; i++) thump(d, t + 0.28 + i * 0.03, 0.04, 300, 180, 0.02);
}
// a push button: mechanical click; the lift's floor panel also beeps; the entryphone rings upstairs
export function button(t, what = 'call') {
  const d = out('sfx', 0, 4.5);
  click(d, t, 0.09, 3000); sweep(d, t, 900, 500, { pk: 0.05, a: 0.001, d: 0.01, len: 0.01, r: 0.01 });
  if (what === 'floor') sweep(out('sfx', 0, 2.5), t + 0.04, 1850, 1850, { pk: 0.025, a: 0.003, d: 0.05, len: 0.07, r: 0.02, type: 'square' });
  if (what === 'intercom') buzzTone(intercomIn(), t + 0.15, 0.7, 0.035);
}
// the stairs' light button: a big plastic clack
export function switchClick(t) {
  const d = out('sfx', 0, 3.5);
  click(d, t, 0.12, 2400); sweep(d, t, 620, 280, { pk: 0.08, a: 0.001, d: 0.02, len: 0.02, r: 0.01, type: 'triangle' });
}
// the timer's relay pulls in (and the tubes tick on), or lets go in the dark
export function light(t, on = true) {
  const d = out('sfx', -0.3, 2.2);
  thump(d, t, on ? 0.12 : 0.1, 180, 80, 0.04);
  burst(d, t, { f: 1800, q: 2, pk: 0.05, a: 0.001, d: 0.012, len: 0.01, r: 0.01 });
  if (on) { ping(d, t + 0.05, 3200, 0.012, 0.03); ping(d, t + 0.13, 3300, 0.008, 0.03); }
  else sweep(d, t + 0.02, 120, 60, { pk: 0.05, a: 0.01, d: 0.3, len: 0.3, r: 0.1 });
}
export function bell(t) {
  const d = out('sfx', 0.2, 1);
  note('chime', d, t, 81, 0.5, 0.45); note('chime', d, t + 0.42, 77, 1.1, 0.45);
}
// ding: the new lift arriving; the old one arrives with a clunk and its little bell
export function ding(t, old = false) {
  const d = out('sfx', -0.2, 1);
  if (old) { thump(d, t, 0.2, 150, 60, 0.08); click(d, t + 0.05, 0.06, 2000); note('bell', d, t + 0.12, 84, 0.8, 0.35); }
  else note('chime', d, t, 88, 1.2, 0.4);
}
export function liftDoor(t, open = true) {
  const c = E.ctx, d = out('sfx', 0, 1.25), len = 1;
  const e = env(d, t, { pk: 0.05, a: 0.12, d: 0.5, sus: 0.8, len, r: 0.18 }), lp = filt(c, 'lowpass', 420, 0.8);
  chain(lp, e.g);
  const o = osc('sawtooth', open ? 88 : 102, t, e.end, lp); o.frequency.linearRampToValueAtTime(open ? 104 : 86, t + len);
  burst(d, t, { f: 1100, q: 0.8, pk: 0.012, a: 0.1, d: 0.5, sus: 0.8, len, r: 0.2 });
  thump(d, t + len + 0.02, open ? 0.08 : 0.17, 110, 50, 0.07);
}
// your own car, double-parked, and the one you are blocking: a dual-tone horn
export function honk(t, n = 0, far = 0) {
  const c = E.ctx, d = out('sfx', n % 2 ? -0.55 : 0.55, 1 - 0.45 * far), head = softclip(c, 2.4);
  chain(head, filt(c, 'bandpass', 1100, 0.7), gain(c, 0.5), filt(c, 'lowpass', 6000 - 3500 * far, 0.7), d);
  // the third time it's two short ones; after a while, one long one
  const hits = n % 3 === 2 ? [[0, 0.2], [0.3, 0.2]] : [[0, n > 3 ? 0.75 : 0.45]];
  for (const [o, len] of hits) {
    const e = env(head, t + o, { pk: 0.12, a: 0.012, d: 0.1, sus: 0.9, len, r: 0.05 });
    for (const f of [392, 466]) osc('square', f * U(0.995, 1.005), t + o, e.end, e.g);
  }
}
// the entryphone's speaker: a tinny cone behind a grille, with the line's hum
let icIn = null;
export function intercomIn() {
  if (icIn && icIn.context === E.ctx) return icIn;
  const c = E.ctx; icIn = gain(c, 1);
  chain(icIn, filt(c, 'highpass', 480, 0.8), filt(c, 'peaking', 1900, 1.2, 6), filt(c, 'lowpass', 3300, 0.9), softclip(c, 2), gain(c, 0.75), B('ppl'));
  return icIn;
}
function buzzTone(d, t, len, pk) {
  const e = env(d, t, { pk, a: 0.01, d: 0.1, sus: 0.9, len, r: 0.04 });
  osc('square', 400, t, e.end, e.g); osc('square', 450, t, e.end, e.g);
}
// the portal's door release: the buzz you have to push on
export const Buzzer = {
  n: null,
  start(t) {
    this.stop(t);
    const c = E.ctx, d = out('sfx', 0.35, 2), g = gain(c, 0), bp = filt(c, 'bandpass', 760, 1.6);
    chain(bp, softclip(c, 3), g, d);
    const o1 = osc('square', 100, t, t + 30, bp), o2 = osc('sawtooth', 50, t, t + 30, bp);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.02);
    this.n = { g, o: [o1, o2] };
  },
  stop(t) {
    const n = this.n; this.n = null;
    if (!n) return;
    hold(n.g.gain, t); n.g.gain.linearRampToValueAtTime(0, t + 0.03);
    for (const o of n.o) try { o.stop(t + 0.05); } catch { /* already */ }
  },
};

// ---------- the ending ----------
// the bag hits a step in the comic panel; the last one lands for good (and breaks, maybe)
export function hop(t, { j = 0, last = false, broken = false, glass = true } = {}) {
  const d = out('sfx', -0.1, last ? 1.25 : 0.9);
  thump(d, t, 0.35, 135 - j * 8, 42, 0.1);
  burst(d, t, { type: 'lowpass', f: 900, q: 0.7, pk: 0.12, a: 0.001, d: 0.05, len: 0.04, r: 0.03 });
  crinkle(d, t + 0.01, 0.12, { dens: 130, pk: 0.05 });
  for (let i = 0; i < 3; i++) ping(d, t + U(0.005, 0.05), U(1800, 3800), 0.012, 0.05);
  if (broken) glass ? shatter(t + 0.02, 1.1, true) : splat(t + 0.02, 1.2);
}
// the bag goes over the edge: the slide whistle every cartoon fall is owed
export function tumble(t) {
  const c = E.ctx, d = out('sfx', 0, 1), e = env(d, t, { pk: 0.08, a: 0.03, d: 0.9, sus: 0.9, len: 0.9, r: 0.12 });
  const o = osc('sine', 1550, t, e.end, e.g); o.frequency.exponentialRampToValueAtTime(330, t + 0.95);
  const v = gain(c, 30); osc('sine', 6.2, t, e.end, v); v.connect(o.frequency);
  burst(d, t, { color: 'pink', f: 600, to: 1800, q: 0.8, pk: 0.03, a: 0.08, d: 0.2, len: 0.25, r: 0.1 });
}
// the fruit-shop scale prints its sticker: stepper ticks, the motor's whine, the tear, the slap
export function sticker(t) {
  const c = E.ctx, d = out('sfx', 0.1, 2.5), len = 0.34;
  const bp = filt(c, 'bandpass', 1500, 4), e = env(d, t, { pk: 0.018, a: 0.01, d: len, sus: 0.9, len, r: 0.02 });
  chain(bp, e.g); osc('square', 520, t, e.end, bp);
  for (let i = 0; i < 22; i++) burst(d, t + i * (len / 22), { f: 2600, q: 3, pk: 0.028, a: 0.0005, d: 0.004, len: 0.003, r: 0.003 });
  burst(d, t + len + 0.02, { type: 'highpass', f: 2600, to: 5200, q: 0.8, pk: 0.05, a: 0.008, d: 0.06, len: 0.08, r: 0.03 });
  burst(d, t + len + 0.2, { type: 'lowpass', f: 1600, q: 0.7, pk: 0.09, a: 0.001, d: 0.02, len: 0.02, r: 0.02 });
}
// the rubber stamp comes down on the frame
export function stamp(t, good = true) {
  const d = out('sfx', 0, 1);
  burst(d, t, { f: 2300, q: 1, pk: 0.14, a: 0.0006, d: 0.01, len: 0.008, r: 0.008 });
  thump(d, t + 0.003, 0.6, 150, 44, 0.13);
  burst(d, t + 0.006, { type: 'lowpass', f: 3000, q: 0.7, pk: 0.12, a: 0.001, d: 0.03, len: 0.03, r: 0.02 });
  for (let i = 0; i < 3; i++) thump(d, t + 0.05 + i * 0.035, 0.05 / (i + 1), 260, 170, 0.02);
  if (!good) burst(d, t + 0.01, { type: 'highpass', f: 3000, q: 0.6, pk: 0.03, a: 0.001, d: 0.05, len: 0.05, r: 0.03 });
}
