// Foley and ambience for the reel: every sound the film makes that isn't music or the audience.
// A voice gets its cue and x = { ctx, dest, t0, t1, hold, len, rnd, film, meta, TEX, B, buf };
// dest already follows the cue's loudness curve, so a bed plays steadily at unit level from t0
// to t1 and a hit plays its natural transient at t0. Balances here are by ear: the audio test
// measures every voice and reel.js trims it to where its level says it should sit.
import { gain, filt, pan, chain, mtof } from './core.js';
import { osc, noise, env, burst, sweep, hit } from './kit.js';
import { fanWhistle } from './score.js';

const TAU = Math.PI * 2;
export const peakOf = (cue) => Math.max(...cue.pts.map((p) => p[1]));
// phase of the cue's level wobble at time t: its sine is +1 where the cue is loudest
export const lfoAt = (cue, t) => (cue.lfo ? TAU * cue.lfo.f * (t - cue.t) + (cue.lfo.ph || 0) : 0);
// every crest of the wobble in [t0, t1)
export function crests(cue, t0, t1) {
  const { f, ph = 0 } = cue.lfo, base = cue.t + (Math.PI / 2 - ph) / (TAU * f), out = [];
  for (let k = Math.ceil((t0 - base) * f); ; k++) { const t = base + k / f; if (t >= t1) break; out.push(t); }
  return out;
}
// an AudioParam driven by a JS function of time
export function curve(p, t0, t1, fn, hz = 50) {
  const d = Math.max(0.02, t1 - t0), n = Math.max(2, Math.ceil(d * hz) + 1), a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = fn(t0 + (i / (n - 1)) * d);
  p.setValueCurveAtTime(a, t0, d);
}
// smooth random wandering in [0, 1] with `hz` new targets a second (draws from x.rnd in time order)
export function drift(x, hz) {
  const k = [x.rnd(), x.rnd()]; let s0 = null;
  return (t) => {
    if (s0 === null) s0 = t;
    const u = Math.max(0, (t - s0) * hz), i = Math.floor(u), s = (1 - Math.cos(Math.PI * (u - i))) / 2;
    while (k.length < i + 2) k.push(x.rnd());
    return k[i] + (k[i + 1] - k[i]) * s;
  };
}
// a looping texture buffer entered at a random point
export function loop(x, b, dest, { rate = 1, t0 = x.t0, t1 = x.t1, g = 1 } = {}) {
  const s = x.ctx.createBufferSource(), gg = gain(x.ctx, g); s.buffer = b; s.loop = true; s.playbackRate.value = rate;
  chain(s, gg, dest); s.start(t0, x.rnd() * b.duration); s.stop(t1 + 0.05);
  return gg;
}
// a steady band of noise, two decorrelated sides (w = width): the body of rain, wind, surf...
// returns the filters (each with its gain as .g) for automation
export function wash(x, dest, { color = 'pink', type = 'bandpass', f = 1000, q = 0.7, g = 0.5, w = 0.7, t0 = x.t0, t1 = x.t1, rate = 1 } = {}) {
  const c = x.ctx, out = [];
  for (const p of w ? [-w, w] : [0]) {
    const b = filt(c, type, f, q), gg = gain(c, g);
    if (p) chain(b, gg, pan(c, p), dest); else chain(b, gg, dest);
    noise(color, t0, t1 + 0.05, b, rate);
    b.g = gg; out.push(b);
  }
  return out;
}
const panned = (x, dest, p) => { const n = pan(x.ctx, p); n.connect(dest); return n; };

// ---------------------------------------------------------------- f1 · action
function boom(cue, x) {
  const { ctx: c, dest, t0, t1 } = x;
  burst(dest, t0, { color: 'white', type: 'lowpass', f: 7000, to: 700, q: 0.5, pk: 0.8, a: 0.001, d: 0.09, len: 0.07, r: 0.06 });   // the blast front
  sweep(dest, t0, 96, 30, { pk: 1.2, a: 0.004, d: 0.5, len: 0.5, r: 0.25, curve: 0.9 });                                           // in your chest
  const roll = drift(x, 3);
  for (const b of wash(x, dest, { color: 'brown', type: 'lowpass', f: 1200, q: 0.6, g: 1.4, w: 0.55, t1 })) {                      // the fireball
    curve(b.frequency, t0, t1, (t) => 220 + 1300 * Math.exp(-(t - t0) / 0.45), 40);
    curve(b.g.gain, t0, t1, (t) => 1.4 * (0.6 + 0.4 * roll(t)), 30);
  }
  const d = gain(c, 0); d.gain.setValueAtTime(0, t0 + 0.2); d.gain.linearRampToValueAtTime(0.7, t0 + 0.45); d.gain.setTargetAtTime(0.15, t0 + 0.7, 0.9);
  chain(d, filt(c, 'highpass', 1600, 0.7), dest); loop(x, x.TEX.crackle(c), d, { t0: t0 + 0.2, t1 });                            // debris coming down
}
function fusehiss(cue, x) {
  const { ctx: c, dest, t0, t1 } = x, g = gain(c, 1); g.connect(dest);
  wash(x, g, { color: 'white', type: 'highpass', f: 3800, q: 0.8, g: 0.55, w: 0 });
  wash(x, g, { color: 'white', type: 'bandpass', f: 1900, q: 1.5, g: 0.35, w: 0 });
  curve(g.gain, t0, t1, () => 0.35 + 0.65 * Math.pow(x.rnd(), 0.5), 24);                                                          // it sputters
  const p = gain(c, 0.8); chain(p, filt(c, 'bandpass', 2600, 0.8), dest); loop(x, x.TEX.crackle(c), p, { rate: 1.4 });
}
function engine(cue, x) {
  const { ctx: c, dest, t0, t1 } = x;
  // a V8 flat out through the gears: four firings a turn, revs climbing, a drop at every shift
  const rpm = (t) => { const u = (t - t0 + 0.8) % 2.3; return 2700 + 2900 * Math.pow(Math.min(1, u / 2.05), 0.8) - (u > 2.05 ? 2400 * (u - 2.05) / 0.25 : 0); };
  const fire = (t) => rpm(t) / 15, lp = filt(c, 'lowpass', 900, 2.2), g1 = gain(c, 0.3), g2 = gain(c, 0.32);
  chain(g1, lp); chain(g2, lp); lp.connect(dest);
  const a = osc('sawtooth', fire(t0), t0, t1 + 0.05, g1), b = osc('square', fire(t0) / 2, t0, t1 + 0.05, g2);
  curve(a.frequency, t0, t1, fire, 80); curve(b.frequency, t0, t1, (t) => fire(t) / 2, 80);
  curve(lp.frequency, t0, t1, (t) => 250 + fire(t) * 2.6, 80);
  wash(x, dest, { color: 'brown', type: 'lowpass', f: 380, g: 0.6, w: 0.4 });                         // the road
  wash(x, dest, { color: 'pink', type: 'bandpass', f: 2600, q: 0.5, g: 0.1, w: 0.8 });                // wind and tyres
}
function horn(cue, x) {
  const { ctx: c, dest, t0, len } = x, truck = !cue.n;
  // an air-horn chord or a two-tone car horn, falling in pitch as it goes past (Doppler)
  const fs = truck ? [233, 294, 349] : [415, 523], p = pan(c, truck ? -0.7 : 0.7), lp = filt(c, 'lowpass', truck ? 1900 : 3200, 0.9);
  const e = env(p, t0, { pk: 0.45, a: 0.02, d: 0.1, sus: 1, len: len + 0.05, r: 0.12 });
  p.connect(dest); lp.connect(e.g); p.pan.setValueAtTime(truck ? -0.7 : 0.7, t0); p.pan.linearRampToValueAtTime(truck ? 0.7 : -0.7, e.end);
  for (const f of fs) { const o = osc(truck ? 'sawtooth' : 'square', f * 1.035, t0, e.end, lp); o.frequency.linearRampToValueAtTime(f * 0.95, e.end); }
}
function beep(cue, x) {
  const { ctx: c, dest, t0 } = x, f = cue.n === 1 ? 2349 : 1976, bp = filt(c, 'bandpass', f, 3);
  const e = env(dest, t0, { pk: 0.5, a: 0.002, d: 0.1, sus: 1, len: 0.085, r: 0.01 });
  bp.connect(e.g); osc('square', f, t0, e.end, bp); osc('sine', f, t0, e.end, e.g);
}
function rotor(cue, x) {
  const { ctx: c, dest, t0, t1 } = x;
  wash(x, dest, { color: 'pink', type: 'lowpass', f: 650, q: 0.5, g: 0.75, w: 0.6 });                  // the downwash
  const tw = gain(c, 0.035); tw.connect(dest); osc('sine', 1160, t0, t1 + 0.05, tw); osc('triangle', 2330, t0, t1 + 0.05, tw);   // turbine whine
  for (const t of crests(cue, t0 - 0.05, t1)) {                                                                                  // every blade slapping the air
    burst(dest, Math.max(t0, t - 0.04), { color: 'brown', type: 'lowpass', f: 240, q: 1, pk: 1.4, a: 0.012, d: 0.13, len: 0.1, r: 0.07 });
    burst(dest, Math.max(t0, t - 0.04), { type: 'bandpass', f: 850, q: 1.2, pk: 0.3, a: 0.004, d: 0.05, len: 0.04 });
  }
}

// ---------------------------------------------------------------- weather, sea, wild things
function rain(cue, x) {
  const { ctx: c, dest } = x, heavy = Math.max(0, Math.min(1, (peakOf(cue) - 44) / 20));   // 44 dB drizzle .. 64 dB downpour
  const drops = x.TEX.drops(c);
  loop(x, drops, panned(x, dest, -0.6), { rate: 0.93, g: 0.8 - 0.25 * heavy });
  loop(x, drops, panned(x, dest, 0.6), { rate: 1.08, g: 0.8 - 0.25 * heavy });
  wash(x, dest, { color: 'white', type: 'bandpass', f: 5200, q: 0.5, g: 0.1 + 0.3 * heavy, w: 0.8 });    // a million far-off drops
  wash(x, dest, { color: 'pink', type: 'lowpass', f: 650, q: 0.5, g: 0.06 + 0.4 * heavy, w: 0.5 });      // roofs, gutters, puddles
}
function thunder(cue, x) {
  const { ctx: c, dest, t0, t1 } = x;
  burst(dest, t0, { color: 'white', type: 'highpass', f: 1500, q: 0.6, pk: 0.55, a: 0.002, d: 0.14, len: 0.1, r: 0.12 });          // the bolt tears the air
  const cr = gain(c, 0); cr.gain.setValueAtTime(1, t0); cr.gain.setTargetAtTime(0, t0 + 0.06, 0.18);
  chain(cr, filt(c, 'bandpass', 2400, 0.6), dest); loop(x, x.TEX.crackle(c), cr, { t1: Math.min(t1, t0 + 1.2), rate: 0.6 });
  sweep(dest, t0 + 0.03, 72, 28, { pk: 0.9, a: 0.01, d: 0.6, len: 0.6, r: 0.3 });
  // then the roll: a rumble whose surges wander from one side of the sky to the other
  for (const b of wash(x, dest, { color: 'brown', type: 'lowpass', f: 400, q: 0.9, g: 1.5, w: 0.65, t1 })) {
    const roll = drift(x, 2.2), tone = drift(x, 0.8);
    curve(b.frequency, t0, t1, (t) => 120 + 150 * tone(t) + 500 * Math.exp(-(t - t0) / 0.6), 30);
    curve(b.g.gain, t0, t1, (t) => 1.5 * (0.35 + 0.65 * Math.pow(roll(t), 1.4)), 30);
  }
}
function wind(cue, x) {
  const { dest, t0, t1 } = x, gust = drift(x, 0.35);
  for (const b of wash(x, dest, { color: 'pink', type: 'bandpass', f: 500, q: 0.6, g: 0.45, w: 0.7 })) curve(b.frequency, t0, t1, (t) => 350 + 500 * gust(t), 20);
  for (const [p, f0] of [[-0.5, 420], [0.55, 610]]) {                                               // two howls round the eaves
    const [b] = wash(x, panned(x, dest, p), { color: 'white', type: 'bandpass', f: f0, q: 10, g: 1.1, w: 0 }), h = drift(x, 0.5);
    curve(b.frequency, t0, t1, (t) => f0 * (0.75 + 0.6 * h(t) + 0.3 * gust(t)), 30);
    curve(b.g.gain, t0, t1, (t) => 1.1 * (0.2 + 0.8 * Math.pow(gust(t), 1.5)), 20);
  }
}
function waves(cue, x) {
  const { ctx: c, t0, t1 } = x; let dest = x.dest;
  if (cue.muffle) { const m = filt(c, 'lowpass', 420, 0.7); m.connect(dest); dest = m; }             // the sea heard through the lighthouse's stone
  const crest = (t) => (cue.lfo ? (1 + Math.sin(lfoAt(cue, t))) / 2 : 0.5), rough = Math.max(0, Math.min(1, (peakOf(cue) - 50) / 14));
  for (const b of wash(x, dest, { color: 'pink', type: 'lowpass', f: 900, q: 0.5, g: 0.9, w: 0.7 })) curve(b.frequency, t0, t1, (t) => 360 + (2200 + 2000 * rough) * Math.pow(crest(t), 1.7), 30);
  wash(x, dest, { color: 'brown', type: 'lowpass', f: 170, q: 0.7, g: 0.55 + 0.4 * rough, w: 0.3 });  // the weight of the swell
  const fz = gain(c, 0); chain(fz, filt(c, 'highpass', 2300, 0.5), dest);                            // foam fizzing once it has broken
  curve(fz.gain, t0, t1, (t) => 0.7 * Math.pow(Math.max(0, Math.sin(lfoAt(cue, t) - 1.1)), 2), 30);
  loop(x, x.TEX.drops(c), fz, { rate: 1.7 });
  const pb = gain(c, 0); chain(pb, filt(c, 'bandpass', 1800, 0.9), dest);                            // shingle dragged back down
  curve(pb.gain, t0, t1, (t) => 0.9 * Math.pow(Math.max(0, -Math.sin(lfoAt(cue, t) - 0.4)), 3), 30);
  loop(x, x.TEX.crackle(c), pb, { rate: 0.8 });
}
function gull(cue, x) {
  const { ctx: c, dest, t0, len } = x, n = Math.max(2, Math.round(len / 0.15)), p = panned(x, dest, x.rnd() < 0.5 ? -0.55 : 0.5);
  for (let i = 0; i < n; i++) {                                                                      // "kyow-kyow-kyow"
    const t = t0 + i * 0.16, f = 1550 - i * 70, bp = filt(c, 'bandpass', 2100, 1.6), e = env(p, t, { pk: i ? 0.4 : 0.5, a: 0.012, d: 0.1, sus: 0.7, len: 0.1, r: 0.04 });
    bp.connect(e.g); const o = osc('sawtooth', f, t, e.end, bp); o.frequency.linearRampToValueAtTime(f * 1.12, t + 0.03); o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.13);
    const s = gain(c, 0.5); s.connect(e.g); osc('sine', f, t, e.end, s).frequency.exponentialRampToValueAtTime(f * 0.72, t + 0.13);
  }
}
function foghorn(cue, x) {
  const { ctx: c, dest, t0, len } = x, f = 84, lp = filt(c, 'lowpass', 300, 1.2), end = t0 + len;
  // a diaphone: one enormous reed note that ends in its famous grunt
  const e = env(dest, t0, { pk: 0.5, a: 0.14, d: 0.4, sus: 1, len: len + 0.1, r: 0.35 });
  lp.connect(e.g); lp.frequency.setValueAtTime(300, t0); lp.frequency.linearRampToValueAtTime(1100, t0 + 0.3); lp.frequency.setValueAtTime(1100, end - 0.3); lp.frequency.linearRampToValueAtTime(380, end + 0.25);
  for (const [r, d, g] of [[1, 0, 0.8], [1, 9, 0.6], [2, -5, 0.25]]) {
    const gg = gain(c, g); gg.connect(lp);
    const o = osc('sawtooth', f * r, t0, e.end, gg); o.detune.value = d; o.frequency.setValueAtTime(f * r, end - 0.25); o.frequency.exponentialRampToValueAtTime(f * r * 0.66, end + 0.3);
  }
  const sub = gain(c, 0.5); sub.connect(e.g); osc('sine', f / 2, t0, e.end, sub);
}
function birds(cue, x) {
  const { ctx: c, dest, t0, t1 } = x;
  wash(x, dest, { color: 'white', type: 'bandpass', f: 4300, q: 2.2, g: 0.05, w: 0.8 });                // a haze of distant calls
  const SONG = [
    (d, t) => { for (let i = 0; i < 3; i++) sweep(d, t + i * 0.12, 3900, 2600, { pk: 0.3, a: 0.004, len: 0.07, r: 0.02 }); return 0.36; },
    (d, t) => { const e = env(d, t, { pk: 0.22, a: 0.02, d: 0.4, sus: 0.8, len: 0.5, r: 0.05 }), o = osc('sine', 4200, t, e.end, e.g), m = gain(c, 380); osc('sine', 27, t, e.end, m); m.connect(o.frequency); return 0.55; },
    (d, t) => { sweep(d, t, 2500, 3300, { pk: 0.3, a: 0.01, len: 0.1, r: 0.03, curve: 1 }); sweep(d, t + 0.16, 3500, 3350, { pk: 0.34, a: 0.01, len: 0.22, r: 0.05, curve: 1 }); return 0.42; },
    (d, t) => { for (const [dt, l] of [[0, 0.25], [0.35, 0.15], [0.55, 0.4]]) { const e = env(d, t + dt, { pk: 0.3, a: 0.04, d: 0.2, sus: 0.8, len: l, r: 0.06 }); osc('sine', 540, t + dt, e.end, e.g).frequency.linearRampToValueAtTime(470, t + dt + l); } return 1; },
  ];
  for (let t = t0 + x.rnd() * 0.4; t < t1 - 0.7;) {
    const g = gain(c, 0.35 + 0.65 * x.rnd()); chain(g, pan(c, x.rnd() * 1.6 - 0.8), dest);
    t += SONG[Math.floor(x.rnd() * SONG.length)](g, t) + 0.12 + x.rnd() * 0.8;
  }
}
function grass(cue, x) {
  const { ctx: c, dest, t0, t1 } = x, gust = drift(x, 0.4);
  for (const b of wash(x, dest, { color: 'pink', type: 'highpass', f: 1700, q: 0.5, g: 0.45, w: 0.8 })) curve(b.g.gain, t0, t1, (t) => 0.45 * (0.3 + 0.7 * gust(t)), 20);
  for (let t = t0 + 0.3; t < t1 - 0.3; t += 0.25 + x.rnd() * 0.7) burst(panned(x, dest, x.rnd() * 1.4 - 0.7), t, { color: 'white', type: 'bandpass', f: 2200 + x.rnd() * 2000, q: 1.2, pk: 0.25, a: 0.03, d: 0.12, len: 0.1, r: 0.06 });
}
function waterfall(cue, x) {
  const { ctx: c, dest } = x;
  wash(x, dest, { color: 'pink', type: 'lowpass', f: 3600, q: 0.4, g: 0.75, w: 0.85 });
  wash(x, dest, { color: 'brown', type: 'lowpass', f: 140, q: 0.7, g: 0.9, w: 0.4 });                  // the thunder at its foot
  wash(x, dest, { color: 'white', type: 'bandpass', f: 1100, q: 0.4, g: 0.22, w: 0.6 });
  loop(x, x.TEX.drops(c), dest, { rate: 1.35, g: 0.35 });                                            // spray
}
function crickets(cue, x) {
  const { ctx: c, dest, t0, t1 } = x;
  loop(x, x.TEX.crickets(c), dest, { g: 0.9 });
  wash(x, dest, { color: 'white', type: 'bandpass', f: 6800, q: 3, g: 0.03, w: 0.8 });
  for (let t = t0 + 1 + x.rnd(); t < t1 - 0.5; t += 1.6 + x.rnd() * 2.2) {                           // a frog somewhere down by the water
    const p = panned(x, dest, x.rnd() * 1.2 - 0.6), e = env(p, t, { pk: 0.18, a: 0.01, d: 0.15, sus: 0.7, len: 0.18, r: 0.04 }), bp = filt(c, 'bandpass', 600, 2);
    const am = gain(c, 0.5), depth = gain(c, 0.5); chain(bp, am, e.g); osc('square', 32, t, e.end, depth); depth.connect(am.gain);   // the croak's rattle
    osc('sawtooth', 190, t, e.end, bp).frequency.linearRampToValueAtTime(150, t + 0.2);
  }
}

// ---------------------------------------------------------------- f3 · the house
function owl(cue, x) {
  const { ctx: c, t0, len } = x, dest = pan(c, -0.55);
  chain(dest, filt(c, 'lowpass', 2200, 0.7), x.dest);                                                 // off in the trees
  const hoot = (t, l, f) => {
    const e = env(dest, t, { pk: 0.5, a: 0.05, d: 0.2, sus: 0.85, len: l, r: 0.09 }), o = osc('sine', f * 0.9, t, e.end, e.g);
    o.frequency.linearRampToValueAtTime(f, t + l * 0.3); o.frequency.linearRampToValueAtTime(f * 0.93, t + l);
    const h = gain(c, 0.07); h.connect(e.g); osc('sine', f * 2, t, e.end, h);
    burst(e.g, t, { type: 'bandpass', f: f * 2, q: 2.5, pk: 0.06, a: 0.05, d: l, sus: 0.8, len: l });
  };
  if (len > 0.5) { hoot(t0, 0.16, 400); hoot(t0 + 0.24, 0.32, 388); } else hoot(t0, 0.42, 410);
}
function tick(cue, x) { hit('tick', x.dest, x.t0, 1, 0, { f: Math.round(cue.t) % 2 ? 2500 : 3100 }); }
// wood under load: stick-slip pulses rubbed through the board's resonances, rate bending with it
function creakAt(x, dest, t, len, { f0 = 30, f1 = 85, res = [420, 980, 1850], pk = 0.6 } = {}) {
  const c = x.ctx, e = env(dest, t, { pk, a: 0.02, d: 0.2, sus: 0.9, len, r: 0.05 }), src = gain(c, 1);
  res.forEach((f, i) => chain(src, filt(c, 'bandpass', f, 6 + i * 2), gain(c, 1.6 / (i + 1)), e.g));
  const o = osc('sawtooth', f0, t, e.end, src);
  curve(o.frequency, t, t + len, (u) => (f0 + (f1 - f0) * Math.sin(Math.PI * Math.min(1, (u - t) / len))) * (0.75 + 0.5 * x.rnd()), 140);
}
function creak(cue, x) { creakAt(x, x.dest, x.t0, x.len + 0.1); }
function rock(cue, x) {
  creakAt(x, x.dest, x.t0, x.len * 0.8, { f0: 55, f1: 120, res: [640, 1450, 2600], pk: 0.5 });
  hit('wood', x.dest, x.t0 + x.len * 0.8, 0.45);                                                    // the runners touch down
}
function hiss(cue, x) {
  const { ctx: c, dest, t0, t1 } = x;
  burst(dest, t0, { color: 'white', type: 'bandpass', f: 2800, q: 0.8, pk: 1, a: 0.002, d: 0.04, len: 0.03, r: 0.02 });           // the spit
  const [b] = wash(x, dest, { color: 'white', type: 'bandpass', f: 4200, q: 1.1, g: 0.8, w: 0 });
  curve(b.frequency, t0, t1, (t) => 4700 - 1500 * Math.min(1, (t - t0) / Math.max(0.1, t1 - t0)) + 700 * (x.rnd() - 0.5), 40);
  const e = env(dest, t0 + 0.05, { pk: 0.13, a: 0.08, d: 0.3, sus: 0.8, len: Math.max(0.2, t1 - t0 - 0.3), r: 0.1 }), bp = filt(c, 'bandpass', 700, 3);
  bp.connect(e.g); curve(osc('sawtooth', 180, t0 + 0.05, e.end, bp).frequency, t0 + 0.05, e.end, () => 150 + 70 * x.rnd(), 60);   // and a growl
}
function heart(cue, x) {
  for (const [dt, v] of [[0, 1], [0.19, 0.7]]) {                                                     // lub-dub, felt more than heard
    sweep(x.dest, x.t0 + dt, 70, 38, { pk: 0.9 * v, a: 0.008, d: 0.1, len: 0.09, r: 0.05 });
    burst(x.dest, x.t0 + dt, { color: 'brown', type: 'lowpass', f: 170, pk: 0.4 * v, a: 0.006, d: 0.06, len: 0.05 });
  }
}
function breath(cue, x) {
  const { ctx: c, dest, t0, t1 } = x, g = gain(c, 0); g.connect(dest);
  // in on the crest of the cue's own wobble, out on the fall, a catch at each turn
  curve(g.gain, t0, t1, (t) => 0.15 + 0.85 * Math.pow(Math.abs(Math.sin(lfoAt(cue, t))), 0.7), 80);
  const [b] = wash(x, g, { color: 'pink', type: 'bandpass', f: 1200, q: 1.3, g: 1, w: 0 });
  curve(b.frequency, t0, t1, (t) => { const s = Math.sin(lfoAt(cue, t)); return s > 0 ? 1700 + 600 * s : 950 + 250 * s; }, 80);
  wash(x, g, { color: 'white', type: 'highpass', f: 3200, q: 0.7, g: 0.12, w: 0 });                  // the rasp
}
function step(cue, x) {
  const { dest, t0 } = x, p = panned(x, dest, Math.round(cue.t / 0.32) % 2 ? 0.18 : -0.18);        // left foot, right foot, up the stairs
  sweep(p, t0, 115, 55, { pk: 0.8, a: 0.003, d: 0.07, len: 0.06, r: 0.04 });
  burst(p, t0, { type: 'bandpass', f: 650 + 350 * x.rnd(), q: 1.5, pk: 0.5, a: 0.001, d: 0.04, len: 0.03 });
  burst(p, t0 + 0.012, { type: 'bandpass', f: 2200, q: 2, pk: 0.12, d: 0.02, len: 0.015 });          // the tread answers
}
function whisper(cue, x) {
  const { dest, t0, t1 } = x, V = [[700, 1200], [400, 2100], [300, 800], [550, 1700], [330, 2400]];   // a e u o i: (F1, F2)
  for (let t = t0 + 0.1; t < t1 - 0.4;) {                                                               // voices in the walls, never in one place
    const p = panned(x, dest, x.rnd() * 1.8 - 0.9), n = 3 + Math.floor(x.rnd() * 6);
    for (let i = 0; i < n && t < t1 - 0.25; i++) {
      const [f1, f2] = V[Math.floor(x.rnd() * V.length)], l = 0.08 + x.rnd() * 0.14;
      burst(p, t, { color: 'white', type: 'bandpass', f: f1 * 1.3, q: 4, pk: 0.5, a: 0.02, d: l, sus: 0.7, len: l, r: 0.04 });
      burst(p, t, { color: 'white', type: 'bandpass', f: f2 * 1.2, q: 5, pk: 0.4, a: 0.02, d: l, sus: 0.7, len: l, r: 0.04 });
      if (x.rnd() < 0.45) burst(p, t + l, { color: 'white', type: 'highpass', f: 4800, pk: 0.3, a: 0.01, d: 0.05, len: 0.05 });   // an s, a t
      t += l + 0.03 + x.rnd() * 0.05;
    }
    t += 0.15 + x.rnd() * 0.4;
  }
}

// ---------------------------------------------------------------- f4 · the musical
function tap(cue, x) {
  const { ctx: c, dest, t0 } = x, n = cue.n || 1;
  const plate = (d, t, v) => {                                                                          // a steel plate striking a sprung wooden stage
    burst(d, t, { color: 'white', type: 'bandpass', f: 3900, q: 1.4, pk: 0.9 * v, a: 0.0006, d: 0.025, len: 0.02, r: 0.02 });
    const e = env(d, t, { pk: 0.22 * v, a: 0.0005, d: 0.07, len: 0.06 }); osc('sine', 2700 + x.rnd() * 400, t, e.end, e.g);
    const e2 = env(d, t, { pk: 0.3 * v, a: 0.001, d: 0.05, len: 0.04 }); osc('sine', 175, t, e2.end, e2.g);
  };
  if (n === 1) plate(dest, t0, 1);
  else if (n === 2) {                                                                                   // borrowed boots in a puddle
    burst(dest, t0, { color: 'brown', type: 'lowpass', f: 700, q: 0.8, pk: 1, a: 0.002, d: 0.06, len: 0.05 });
    burst(dest, t0 + 0.004, { color: 'white', type: 'bandpass', f: 2800, q: 0.6, to: 1100, pk: 0.8, a: 0.003, d: 0.12, len: 0.1, r: 0.08 });
    for (let i = 0; i < 3; i++) sweep(panned(x, dest, x.rnd() - 0.5), t0 + 0.05 + x.rnd() * 0.12, 1500 + x.rnd() * 900, 2900, { pk: 0.12, a: 0.001, len: 0.02, r: 0.02, curve: 1 });
  } else for (let i = 0; i < 6; i++) plate(panned(x, dest, (i / 5 - 0.5) * 1.5), t0 + (x.rnd() - 0.3) * 0.018, 0.5);   // a chorus line, never quite together
}

// ---------------------------------------------------------------- f5 · the documentary
function snore(cue, x) {
  const { ctx: c, dest, t0, t1 } = x, P = 1 / cue.lfo.f;
  let k = 0;
  for (const tc of crests(cue, t0 - P, t1 + P)) {                                                       // in through a rattling palate on every crest
    const a = Math.max(t0, tc - 1.0), b = Math.min(t1, tc + 0.5); k++;
    if (b - a > 0.3) {
      const e = env(dest, a, { pk: 0.9, a: 0.5, d: 0.3, sus: 0.9, len: b - a - 0.15, r: 0.15 }), bp = filt(c, 'bandpass', 380, 1.3), rat = gain(c, 0.5), dep = gain(c, 0.5);
      const buzz = gain(c, 0.12); buzz.connect(bp); chain(rat, bp, e.g); noise('brown', a, e.end, rat, 0.8);
      const fl = osc('sawtooth', 28, a, e.end, dep); fl.connect(buzz); dep.connect(rat.gain); curve(fl.frequency, a, e.end, () => 24 + 9 * x.rnd(), 30);
      if (k % 5 === 3) burst(dest, b - 0.1, { color: 'brown', type: 'lowpass', f: 500, q: 2, pk: 0.8, a: 0.01, d: 0.1, len: 0.08 });   // a snort
    }
    const o = tc + 0.9; if (o < t1 - 0.3 && o > t0) burst(dest, o, { color: 'pink', type: 'bandpass', f: 1300, q: 1, pk: 0.22, a: 0.25, d: 0.6, sus: 0.6, len: 1.0, r: 0.4 });   // and out: pffff
  }
}
function roar(cue, x) {
  const { ctx: c, dest, t0, t1 } = x, len = Math.min(x.len + 0.3, 1.7);
  const src = gain(c, 0.6), e = env(dest, t0, { pk: 0.8, a: 0.08, d: 0.4, sus: 0.85, len, r: 0.35 }), rough = gain(c, 0.5);
  noise('brown', t0, e.end, rough.gain, 3);                                                             // the voice breaks up: rough, grating
  for (const [F, Q, G] of [[320, 3, 1], [780, 4, 0.6], [1500, 5, 0.3], [2600, 6, 0.12]]) chain(rough, filt(c, 'bandpass', F, Q), gain(c, G * 2), e.g);
  src.connect(rough);
  for (const d of [-14, 0, 9]) {
    const o = osc('sawtooth', 95, t0, e.end, src); o.detune.value = d;
    o.frequency.linearRampToValueAtTime(178, t0 + 0.28); o.frequency.exponentialRampToValueAtTime(66, t0 + len);
  }
  burst(e.g, t0, { color: 'pink', type: 'bandpass', f: 900, q: 0.6, pk: 0.35, a: 0.05, d: len, sus: 0.8, len, r: 0.3 });   // breath through it
  for (let i = 0, t = t0 + len + 0.55; i < 3 && t < t1 - 0.4; i++, t += 0.7 + x.rnd() * 0.3) {         // then grunts as it settles
    const g = env(dest, t, { pk: 0.4, a: 0.03, d: 0.15, sus: 0.6, len: 0.22, r: 0.1 }), bp = filt(c, 'bandpass', 420, 2);
    bp.connect(g.g); osc('sawtooth', 85, t, g.end, bp).frequency.exponentialRampToValueAtTime(60, t + 0.3);
  }
}
function trumpet(cue, x) {
  const { ctx: c, dest, t0, len } = x, l = len + 0.1, p = panned(x, dest, x.rnd() * 0.8 - 0.4), e = env(p, t0, { pk: 0.6, a: 0.05, d: 0.2, sus: 0.9, len: l, r: 0.2 });
  const bp = filt(c, 'bandpass', 1300, 1.1), vib = gain(c, 22);
  bp.connect(e.g); osc('sine', 7, t0, e.end, vib);
  for (const [type, d] of [['sawtooth', -10], ['square', 12]]) {                                        // the blare down a two-metre trunk
    const o = osc(type, 470, t0, e.end, bp); o.detune.value = d; vib.connect(o.frequency);
    o.frequency.linearRampToValueAtTime(720, t0 + 0.12); o.frequency.linearRampToValueAtTime(650, t0 + l * 0.7); o.frequency.exponentialRampToValueAtTime(430, t0 + l + 0.1);
  }
  burst(e.g, t0, { color: 'white', type: 'bandpass', f: 2600, q: 2, pk: 0.2, a: 0.04, d: l, sus: 0.7, len: l });   // rasp
}

// ---------------------------------------------------------------- f2 · the station
function train(cue, x) {
  const { dest, t0, t1 } = x, f = cue.lfo ? cue.lfo.f : 2, p = panned(x, dest, -0.35);
  p.pan.setValueAtTime(-0.35, t0); p.pan.linearRampToValueAtTime(0.45, t1);                            // pulling out, left to right
  const gap = (t) => (1 / (2 * f)) * (1 + 1.6 * Math.exp(-(t - t0) / 2.2));                             // chuffs gather speed as it leaves
  for (let t = t0; t < t1 - 0.05; t += gap(t)) burst(p, t, { color: 'pink', type: 'bandpass', f: 850 + 250 * x.rnd(), q: 0.7, pk: 0.8, a: 0.01, d: 0.12, len: 0.09, r: 0.07 });
  for (let t = t0 + 0.3; t < t1 - 0.2; t += 3.2 * gap(t)) for (const dt of [0, 0.12]) hit('wood', p, t + dt, 0.3);                    // ta-dum over the rail joints
  wash(x, p, { color: 'brown', type: 'lowpass', f: 220, g: 0.7, w: 0 });
  wash(x, p, { color: 'white', type: 'highpass', f: 5200, g: 0.07, w: 0 });                             // steam leaking
}
function whistle(cue, x) {
  if (cue.src) return fanWhistle(cue, x);                                                              // f4: the man next to you, whistling along
  const { ctx: c, dest, t0, len } = x;
  for (const [m, g] of [[67, 0.4], [70, 0.34], [74, 0.3]]) {                                            // a three-chime steam whistle, minor: the saddest chord in a station
    const f = mtof(m), e = env(dest, t0, { pk: g, a: 0.09, d: 0.2, sus: 0.9, len, r: 0.28 }), o = osc('sine', f * 0.94, t0, e.end, e.g);
    o.frequency.setTargetAtTime(f, t0, 0.06); o.frequency.setTargetAtTime(f * 0.97, t0 + len, 0.12);
    const h = gain(c, 0.18); h.connect(e.g); osc('triangle', f * 2, t0, e.end, h);
    const bp = filt(c, 'bandpass', f, 25), ng = gain(c, 0.9); chain(bp, ng, e.g); noise('white', t0, e.end, bp);
  }
  burst(dest, t0, { color: 'white', type: 'highpass', f: 3000, q: 0.6, pk: 0.12, a: 0.05, d: len + 0.3, sus: 0.8, len: len + 0.3, r: 0.3 });
}

export const WORLD = {
  boom, fusehiss, engine, horn, beep, rotor, rain, thunder, wind, waves, gull, foghorn, birds, grass, waterfall, crickets,
  owl, tick, creak, rock, hiss, heart, breath, step, whisper, tap, snore, roar, trumpet, train, whistle,
};
