// The film scores, rendered offline with the kit. Same voice interface as world.js: dest follows
// the cue's loudness, t0..t1 is the cue's life, x.hold is when its release begins.
// Music is written in beats: [beat, midi, beats, vel?]. Pieces that return (the musical's song,
// the love theme) keep their bar numbers across cues, so a number picks up exactly where it is.
import { mtof, gain, filt } from './core.js';
import { note, chord, hit, sweep, osc } from './kit.js';
import { levelAt } from '../film.js';

// schedule a phrase that starts at T0, optionally looping every `cyc` beats; notes starting in [from, to)
export function phrase(x, inst, dest, T0, B, notes, { cyc = 0, from = x.t0, to = x.hold, v = 0.7, p = 0, dm = 0, len = 1, o } = {}) {
  const k0 = cyc ? Math.floor((from - T0) / (cyc * B)) : 0, k1 = cyc ? Math.ceil((to - T0) / (cyc * B)) : 0;
  for (let k = k0; k <= k1; k++) for (const [b, m, l, vv = 1] of notes) {
    const t = T0 + (k * cyc + b) * B;
    if (t >= from - 1e-4 && t < to) note(inst, dest, t, m + dm, l * B * len, v * vv, p, o);
  }
}
// every whole beat in [from, to): fn(beat, time)
export function beats(T0, B, from, to, fn) { for (let b = Math.ceil((from - T0) / B - 1e-6); T0 + b * B < to; b++) fn(b, T0 + b * B); }
const mod = (a, n) => ((a % n) + n) % n;
// the nearest chord tone at least a minor third under m: the second trumpet's line
const under = (m, ch) => Math.max(...ch.flatMap((c) => [c - 24, c - 12, c, c + 12]).filter((n) => n <= m - 3));

// ---------------------------------------------------------------- f4 · "the song" (B-flat, 132, swung)
export const SW = {
  mel: [[0, 65, 0.66], [0.66, 67, 0.34], [1, 70, 1], [2, 74, 1.66], [3.66, 72, 0.34],
    [4, 71, 1], [5, 67, 0.66], [5.66, 65, 0.34], [6, 67, 1.66], [7.66, 70, 0.34],
    [8, 72, 0.66], [8.66, 75, 0.34], [9, 79, 1], [10, 77, 0.66], [10.66, 75, 0.34], [11, 72, 1],
    [12, 74, 0.66], [12.66, 72, 0.34], [13, 69, 1], [14, 65, 1.66], [15.66, 64, 0.34]],
  ch: [[58, 62, 65, 67], [55, 59, 62, 65], [60, 63, 67, 70], [57, 60, 63, 65]],   // B♭6 · G7 · Cm7 · F7
  walk: [[34, 38, 41, 42], [43, 41, 38, 37], [36, 39, 43, 40], [41, 45, 39, 35]],
  root: [46, 43, 48, 41],
};
// beat 0 of the song for this cue: the start of the musical number it belongs to, else the cue
function tuneStart(cue, x) {
  const g = (x.film.grid || []).find((g) => cue.t >= g.t0 - 0.01 && cue.t <= g.t1 + 0.01);
  return g ? g.t0 : cue.t;
}
function swing(cue, x) {
  const { dest, t0, hold } = x, B = x.B, T0 = tuneStart(cue, x), up = 0.66 * B;
  const each = (fn) => beats(T0, B, t0, hold, (b, t) => fn(t, mod(Math.floor(b / 4), 4), mod(b, 4)));
  if (cue.mood === 'soft') {                                                     // the trio: piano, bass in two, brushes
    phrase(x, 'piano', dest, T0, B, SW.mel, { cyc: 16, v: 0.55, p: 0.2, len: 0.95 });
    each((t, bar, i) => {
      if (i % 2 === 0) { note('upright', dest, t, SW.root[bar] + (i ? 7 : 0), 2 * B, 0.65, -0.15); chord('piano', dest, t + (i ? up : 0), SW.ch[bar], B * 1.4, 0.28, 0.3); }
      hit('brush', dest, t, i % 2 ? 0.7 : 0.45, 0.25);
      if (i % 2) hit('hat', dest, t, 0.22, 0.3);
    });
    return;
  }
  // the big band: trumpets on the tune in thirds, saxes holding the changes, a walking bass, the ride
  phrase(x, 'brass', dest, T0, B, SW.mel, { cyc: 16, v: 0.8, p: 0.12, len: 0.92, o: { vib: true } });
  phrase(x, 'brass', dest, T0, B, SW.mel.map(([b, m, l]) => [b, under(m, SW.ch[Math.floor(b / 4)]), l]), { cyc: 16, v: 0.55, p: -0.12, len: 0.92 });
  each((t, bar, i) => {
    note('upright', dest, t, SW.walk[bar][i], B * 0.9, 0.8, -0.1);
    hit('ride', dest, t, i % 2 ? 0.75 : 0.6, 0.35, { len: 0.8 });
    if (i % 2) { hit('ride', dest, t + up, 0.45, 0.35, { len: 0.5 }); hit('hat', dest, t, 0.5, 0.3); }
    hit('kick', dest, t, 0.22);
    if (i === 0) chord('horn', dest, t, SW.ch[bar], 4 * B - 0.05, 0.4, 0.8);
    if (i % 2) chord('piano', dest, t + up, SW.ch[bar], B * 0.4, 0.32, 0.4);
    if (i === 3 && bar === 3) hit('snare', dest, t + up, 0.5);                   // a kick into the next chorus
  });
}
// the band on one chord: stop-time hits walk ii-V home; the last hit of a number is the tonic, crashed
function bandhit(cue, x) {
  const { dest, t0 } = x, big = x.len > 0.11, bar = Math.floor(Math.round((cue.t - tuneStart(cue, x)) / x.B) / 4);
  const ch = big ? [58, 62, 65, 67, 72] : SW.ch[bar % 2 ? 3 : 2], l = big ? 1.4 : 0.26;
  chord('brass', dest, t0, ch.map((m) => m + 12), l, 0.95, 0.8, { a: 0.01, fall: !big });            // the trumpets shake the stab off
  chord('brass', dest, t0, ch, l, 0.8, 0.5, { dark: true, a: 0.012 });
  note('brass', dest, t0, ch[0] - 12, l, 0.75, -0.2, { dark: true, solo: true, a: 0.012 });          // bass trombone
  note('upright', dest, t0, big ? 34 : bar % 2 ? 41 : 36, 0.35, 1);
  hit('kick', dest, t0, 1); hit('snare', dest, t0, 0.8); hit('crash', dest, t0, big ? 0.9 : 0.3, 0, { len: big ? 2.4 : 0.5 });
  if (big) hit('timp', dest, t0, 0.7, 0, { f: 58, len: 1.6 });
}
// the man next to you knows every note and whistles them a hair behind the band, a hair out of tune
export function fanWhistle(cue, x) {
  const { dest, t0, hold } = x, B = x.B, T0 = tuneStart(cue, x);
  for (let k = Math.floor((t0 - T0) / (16 * B)); T0 + k * 16 * B < hold; k++) for (const [b, m, l] of SW.mel) {
    const t = T0 + (k * 16 + b) * B;
    if (t >= t0 - 1e-4 && t < hold) note('whistle', dest, t + 0.015 + x.rnd() * 0.03, m + 12 + (x.rnd() - 0.5) * 0.3, l * B * 0.9, 0.7 + 0.2 * x.rnd());
  }
}

// ---------------------------------------------------------------- studio idents
function fanfare(cue, x) {
  const { dest, t0, hold } = x;
  if (x.meta.studio === 'luces') {                                               // showbiz: a snare fill into a shout chorus, B♭6/9
    const T = t0 + 0.9;
    for (let i = 0; i < 12; i++) hit('snare', dest, t0 + i * 0.075, 0.3 + 0.05 * i, 0.1);
    hit('kick', dest, T, 1); hit('crash', dest, T, 0.9, 0, { len: 1.8 });
    chord('brass', dest, T, [70, 74, 77, 79, 84], hold - T + 0.2, 1, 0.8, { vib: true });
    chord('brass', dest, T, [46, 53, 58, 62], hold - T + 0.2, 0.8, 0.4, { dark: true });
    note('upright', dest, T, 34, 0.6, 1);
    return;
  }
  const T = t0 + 1.1;                                                            // 'sol': timpani roll up into a trumpet call over C major
  for (let t = t0; t < T - 0.03; t += 0.055) hit('timp', dest, t, 0.2 + 0.6 * (t - t0) / 1.1, (x.rnd() - 0.5) * 0.3, { f: 65.4, len: 0.3 });
  for (let t = t0 + 0.5; t < T - 0.03; t += 0.045) hit('snare', dest, t, 0.1 + 0.3 * (t - t0) / 1.1, 0.15);
  for (const [dt, m, l] of [[0, 72, 0.18], [0.2, 67, 0.12], [0.33, 72, 0.12], [0.46, 76, 0.12], [0.6, 79, 1.9]]) note('brass', dest, T + dt, m, l, 0.95, 0.1, { vib: l > 1 });
  chord('horn', dest, T, [48, 55, 60, 64], 2.5, 0.9, 0.6);
  chord('strings', dest, T, [60, 64, 67, 72, 76], 2.6, 0.8, 0.9, { a: 0.08 });
  hit('timp', dest, T, 1, 0, { f: 65.4, len: 1.5 }); hit('timp', dest, T + 0.6, 1, 0, { f: 98, len: 2 }); hit('crash', dest, T + 0.6, 1, 0, { len: 2.5 });
}
function harp(cue, x) {                                                          // 'estrella': a harp glissando up to a twinkle
  const { dest, t0, hold } = x, sc = [0, 2, 4, 7, 9];
  let t = t0;
  for (let i = 0; i < 16; i++) { note('harp', dest, t, 44 + 12 * Math.floor(i / 5) + sc[i % 5], 2.4, 0.45 + i * 0.02, (i / 15 - 0.5) * 0.8); t += 0.1 - i * 0.002; }
  for (const [dt, m] of [[0, 80], [0.15, 87], [0.3, 84], [0.55, 92]]) note('celesta', dest, t + dt, m, 0.8, 0.55, 0.4);
  chord('strings', dest, t0 + 0.4, [56, 60, 63, 68], Math.max(1, hold - t0 - 0.2), 0.5, 0.6, { a: 0.7, r: 0.9 });
}
function drone(cue, x) {                                                         // 'noche' and the house: a low minor-ninth hum, a bowed cymbal
  const { ctx: c, dest, t0, t1, hold } = x, lp = filt(c, 'lowpass', 320, 0.9);
  lp.connect(dest);
  for (const [m, d] of [[33, -6], [33, 7], [40, 4], [46, -3]]) { const g = gain(c, 0.2); g.connect(lp); osc('sawtooth', mtof(m), t0, t1 + 0.05, g).detune.value = d; }
  const sub = gain(c, 0.35); sub.connect(dest); osc('sine', 55, t0, t1 + 0.05, sub);
  const hi = gain(c, 0.012), w = osc('sine', 1864, t0, t1 + 0.05, hi), v = gain(c, 9); hi.connect(dest); osc('sine', 0.3, t0, t1 + 0.05, v); v.connect(w.frequency);
  if (cue.t < 4) {                                                                // the ident ends on a bell that should not be in a cinema
    lp.frequency.setValueAtTime(250, t0); lp.frequency.exponentialRampToValueAtTime(1500, hold - 0.4);
    note('bell', dest, hold - 0.7, 45, 3, 1); hit('gong', dest, hold - 0.7, 0.6, 0, { f: 55 });
  }
}
const LULLABY = [[0, 76, 1], [1, 81, 1], [2, 83, 1], [3, 84, 2], [5, 83, 1], [6, 81, 1], [7, 76, 1], [8, 77, 1], [9, 76, 3],
  [12, 76, 1], [13, 81, 1], [14, 84, 1], [15, 86, 2], [17, 84, 1], [18, 83, 1], [19, 80, 1], [20, 83, 1], [21, 81, 3]];
const LBASS = [57, 57, 53, 52, 57, 50, 52, 57];
function musicbox(cue, x) {                                                      // a lullaby in A minor, a little flat; the last one winds down
  const { dest, t0, hold } = x, B = 0.58, down = cue.t > 60, mel = new Map(LULLABY.map(([b, m, l]) => [b, [m, l]]));
  const T = (b) => t0 + b * B + (down ? Math.pow(Math.max(0, b - 5.4), 2) * 0.045 : 0);
  for (let b = 0; T(b) < hold; b++) {
    const t = T(b), sag = -0.15 - (down ? Math.max(0, b - 6) * 0.05 : 0), n = mel.get(b % 24), bass = LBASS[Math.floor(b / 3) % 8];
    if (n) note('box', dest, t, n[0] + sag, n[1] * B, 0.7, 0.1);
    if (b % 3 === 0) note('box', dest, t, bass + sag, 2 * B, 0.45, -0.15);
    else if (b % 3 === 1) note('box', dest, t + 0.01, bass + 7 + sag, B, 0.25, -0.1);
  }
}
function pianonote(cue, x) {                                                     // the pit pianist sets the key: D minor, rolled, pedal down
  [38, 50, 57, 62, 65].forEach((m, i) => note('piano', x.dest, x.t0 + i * 0.035, m, 6, i ? 0.5 : 0.75, (i / 4 - 0.5) * 0.4, { pedal: true }));
}

// ---------------------------------------------------------------- solo piano
const RAIN = { B: 0.75, mel: [[0, 72, 1.5], [1.5, 75, 0.5], [2, 80, 1], [3, 79, 1.5], [4.5, 77, 0.5], [5, 72, 1], [6, 73, 1], [7, 77, 1], [8, 80, 1], [9, 79, 2], [11, 75, 1],
  [12, 72, 1.5], [13.5, 75, 0.5], [14, 84, 1], [15, 82, 1.5], [16.5, 79, 0.5], [17, 75, 1], [18, 77, 1], [19, 80, 1], [20, 79, 1], [21, 75, 3]],
  ch: [[44, 51, 60], [41, 48, 56], [37, 44, 53], [39, 46, 55], [44, 51, 60], [36, 43, 51], [37, 44, 53], [39, 46, 55]] };        // A♭ Fm D♭ E♭ A♭ Cm D♭ E♭
const PIT = { B: 0.625, mel: [[0, 69, 1], [1, 74, 1], [2, 77, 1], [3, 79, 2], [5, 77, 1], [6, 76, 1], [7, 73, 1], [8, 76, 1], [9, 74, 3],
  [12, 77, 1], [13, 74, 1], [14, 70, 1], [15, 70, 1.5], [16.5, 72, 0.5], [17, 74, 1], [18, 73, 1], [19, 69, 1], [20, 76, 1], [21, 74, 3]],
  ch: [[38, 57, 62, 65], [43, 58, 62, 67], [45, 55, 61, 64], [38, 57, 62, 65], [46, 58, 62, 65], [43, 58, 62, 67], [45, 55, 61, 64], [38, 57, 62, 65]] };   // Dm Gm A7 Dm B♭ Gm A7 Dm
function piano(cue, x) {
  const { dest, t0, hold } = x, id = x.meta.id;
  if (id === 'claque') {                                                         // backstage: someone at the upright plays the song as a ballad
    const B = 0.8, T0 = t0 + 0.1;
    phrase(x, 'piano', dest, T0, B, SW.mel, { v: 0.45, p: 0.15, dm: 12, len: 1.1 });
    beats(T0, B, t0, hold, (b, t) => {
      const bar = mod(Math.floor(b / 4), 4), i = mod(b, 4);
      if (i === 0) note('piano', dest, t, SW.root[bar] - 12, 2 * B, 0.4, -0.25);
      if (i === 1 || i === 3) chord('piano', dest, t, SW.ch[bar], 1.6 * B, 0.3, 0.35);
    });
    return;
  }
  const P = id === 'silencio' ? PIT : RAIN, B = P.B, T0 = t0 + 0.05, pit = P === PIT;
  phrase(x, 'piano', dest, T0, B, P.mel, { cyc: 24, v: 0.6, p: 0.15 });
  if (pit) phrase(x, 'piano', dest, T0, B, P.mel, { cyc: 24, v: 0.22, p: 0.2, dm: 0.14 });   // an upright in a pit: two strings never agree
  beats(T0, B, t0, hold, (b, t) => {
    const bar = mod(Math.floor(b / 3), 8), i = mod(b, 3), [lo, ...hi] = P.ch[bar];
    if (pit) { if (i === 0) note('piano', dest, t, lo, B * 0.9, 0.5, -0.2); else chord('piano', dest, t, hi, B * 0.6, 0.3, 0.2); return; }   // oom-pah-pah
    const arp = [lo, hi[0], hi[1], hi[0] + 12, hi[1] + 12, hi[0] + 12];               // rain on the window: a flowing, pedalled arpeggio
    for (let h = 0; h < 2; h++) note('piano', dest, t + h * B / 2, arp[i * 2 + h], (3 - i - h / 2) * B, 0.3, -0.25);
  });
}

// ---------------------------------------------------------------- horror hit
function stinger(cue, x) {                                                       // the jump scare: a piano slammed with both forearms, violins shrieking upward, a room-sized drum
  const { dest, t0 } = x, L = 2.4, dm = Math.floor(x.rnd() * 3) - 1;
  chord('piano', dest, t0, [31, 32, 34, 35, 37, 38, 40, 41].map((m) => m + dm), L, 1.2, 0.3);
  chord('brass', dest, t0 + 0.01, [60, 61, 66, 67].map((m) => m + dm), L * 0.8, 0.75, 0.7, { dark: true, a: 0.02, r: 0.8 });
  [84, 85, 87, 88].forEach((m, i) => note('strings', dest, t0 + i * 0.012, m + dm, L, 0.55, (i - 1.5) * 0.35, { a: 0.012, r: 0.9, bright: 3000, to: mtof(m + dm + 7), vib: 0.012, voices: 3 }));
  for (const m of [36, 42]) note('strings', dest, t0, m + dm, L, 0.7, 0, { a: 0.01, r: 1, voices: 3 });
  hit('timp', dest, t0, 1, 0, { f: 49, len: 2.6 }); hit('gong', dest, t0, 0.9, 0, { f: 62 });
  sweep(dest, t0, 64, 24, { pk: 1.2, a: 0.004, d: 0.6, len: 0.7, r: 0.3 });
}

// ---------------------------------------------------------------- the orchestra
const peakOf = (cue) => cue.pts.reduce((a, p) => (p[1] > a[1] ? p : a));
// a tempo that lands beat `last` of a tune (started `off` s into the cue) just before the release
const fit = (x, off, last) => (x.hold - 0.1 - (x.t0 + off)) / last;
// an orchestra on a tune: the lead doubled in octaves, the section holding the harmony, a bass
// line, and more of everything as the cue grows (g: 0 at the first bow, 1 at the peak)
function orch(cue, x, T0, B, mel, CH, per, o = {}) {
  const { dest, t0, hold } = x, [pt, P] = peakOf(cue), lead = o.lead || 'strings';
  const G = (t) => Math.max(0, Math.min(1, (levelAt(cue, t) - P + 24) / 24));
  for (const [b, m, l] of mel) {
    const t = T0 + b * B; if (t < t0 - 1e-4 || t >= hold) continue;
    const g = G(t), L = l * B * 1.02;
    if (lead === 'brass') { note('brass', dest, t, m, L, 0.9, 0.1, { vib: L > 0.6, a: 0.02 }); note('horn', dest, t, m - 12, L, 0.7, -0.15); note('strings', dest, t, m + 12, L, 0.45, 0.25, { a: 0.05, r: 0.4 }); continue; }
    if (lead === 'horn') note('horn', dest, t, m, L, 0.85, -0.05);
    if (lead !== 'horn' || g > 0.5) { note('strings', dest, t, m + 12, L, 0.8, 0.2, { a: 0.09, r: 0.45, vib: 0.005 }); note('strings', dest, t, m, L, 0.5, -0.15, { a: 0.1, r: 0.45 }); }
    if (lead === 'strings' && g > 0.3) note('horn', dest, t, m - 12, L, 0.3 + 0.4 * g, -0.05);
    if (g > 0.72) note('brass', dest, t, m, L * 0.95, 0.25 + 2 * (g - 0.72), 0.05, { vib: L > 0.7, a: 0.03 });
  }
  const k0 = Math.max(0, Math.floor((t0 - T0) / (per * B) - 1e-6));
  for (let k = k0; T0 + k * per * B < hold; k++) {
    const t = T0 + k * per * B; if (t < t0 - 1e-4) continue;
    const ch = CH[k % CH.length], g = G(t), L = per * B * 1.05, root = ch[0];
    note('strings', dest, t, root, L, 0.6, -0.3, { a: 0.15, r: 0.5 });                                                   // cellos and basses
    note('bass', dest, t, root - 12, L, 0.3 + 0.3 * g);
    chord('strings', dest, t, ch.slice(1), L, 0.45 + 0.25 * g, 0.9, { a: 0.25, r: 0.6 });
    if (o.harp) { const up = [...ch.slice(1), ch[1] + 12, ch[2] + 12]; for (let i = 0; i < per * 2; i++) note('harp', dest, t + i * B / 2, up[i % up.length] + 12, B * 1.5, 0.4, 0.5); }
    if (o.choir && g > 0.25) chord('choir', dest, t, ch.slice(1).map((m) => m + 12), L, 0.5 + 0.4 * g, 0.7);
    if (g > 0.55 && o.timp !== false) hit('timp', dest, t, 0.3 + 0.6 * g, 0, { f: mtof(36 + (root % 12)), len: 1.2 });
    if (o.march) beats(t, B / 2, t, Math.min(hold, t + per * B), (i, u) => hit('snare', dest, u, i % 2 ? 0.25 : 0.4, 0.15));
  }
  const tp = cue.t + pt;                                                                                              // the peak: a roll into a cymbal
  if (o.crash !== false && tp > t0 + 1 && tp < hold + 0.05) {
    for (let t = tp - 1.1; t < tp - 0.03; t += 0.05) hit('timp', dest, t, 0.15 + 0.5 * (1 - (tp - t) / 1.1), 0, { f: mtof(36 + (CH[0][0] % 12)), len: 0.25 });
    hit('crash', dest, tp, 0.9, 0, { len: 2.6 }); hit('timp', dest, tp, 1, 0, { f: mtof(36 + (CH[0][0] % 12)), len: 2 });
  }
}
const toMajor = (m) => (m % 12 === 5 || m % 12 === 10 || m % 12 === 0 ? m + 1 : m);   // D minor → D major
const HERO = { mel: [[0, 67, 0.75], [0.75, 67, 0.25], [1, 72, 2], [3, 74, 0.5], [3.5, 76, 0.5], [4, 79, 2.5], [6.5, 77, 0.5], [7, 76, 0.5], [7.5, 74, 0.5],
  [8, 76, 1.5], [9.5, 72, 0.5], [10, 74, 2], [12, 79, 0.75], [12.75, 79, 0.25], [13, 84, 3]],
  ch: [[36, 52, 55, 60], [36, 52, 55, 60], [40, 55, 59, 64], [40, 55, 59, 64], [45, 57, 60, 64], [43, 55, 59, 62], [36, 52, 55, 60], [36, 52, 55, 60]] };   // C C Em Em Am G C C
const EARTH = { mel: [[0, 62, 1], [1, 66, 1], [2, 69, 2], [4, 71, 1], [5, 69, 0.5], [5.5, 66, 0.5], [6, 69, 2], [8, 74, 1.5], [9.5, 73, 0.5], [10, 71, 1], [11, 69, 1], [12, 71, 1], [13, 73, 1], [14, 74, 4]],
  ch: [[38, 57, 62, 66], [38, 57, 62, 66], [43, 59, 62, 67], [38, 57, 62, 66], [47, 59, 62, 66], [43, 59, 62, 67], [45, 57, 61, 64], [38, 57, 62, 66]] };  // D D G D Bm G A D
const ACT = [[36, 55, 60, 63], [44, 56, 60, 63], [46, 58, 62, 65], [43, 55, 59, 62]];                                   // Cm A♭ B♭ G

function score(cue, x) {                                                         // f1: underscore between the set pieces, C minor
  const { dest, t0, hold } = x, B = x.B, T0 = cue.t;
  if (cue.mood === 'tense') {                                                    // spiccato cellos on an ostinato, a pulse, a harmonic nobody trusts
    beats(T0, B / 2, t0, hold, (b, t) => {
      const bar = mod(Math.floor(b / 8), 4), i = mod(b, 8), root = ACT[bar][0];
      note('strings', dest, t, root + [0, 0, 12, 0, 7, 0, 12, 10][i], B * 0.45, 0.8, -0.2, { a: 0.006, r: 0.09, voices: 3, spread: 9 });
      note('pizz', dest, t, root + 12 + [0, 0, 12, 0, 7, 0, 12, 10][i], B * 0.4, 0.35, 0.25);
      if (i === 0 || i === 3 || i === 6) hit('tom', dest, t, i ? 0.45 : 0.7, 0, { f: 62 });
      if (i === 0) { note('bass', dest, t, root - 12, B * 3.5, 0.6); if (bar % 2) chord('brass', dest, t, ACT[bar].slice(1).map((m) => m - 12), B * 1.5, 0.45, 0.5, { dark: true, a: 0.02 }); }
    });
    note('strings', dest, t0, 36, hold - t0 + 0.3, 0.45, 0, { a: 1.2, r: 0.6, voices: 3 });
    return;
  }
  const CH = [[48, 55, 63], [44, 51, 60], [41, 48, 56], [43, 50, 59]];            // soft: pads and a lonely piano, still minor
  beats(T0, B, t0, hold, (b, t) => {
    const bar = mod(Math.floor(b / 8), 4), i = mod(b, 8);
    if (i === 0) { chord('pad', dest, t, CH[bar], 8 * B, 0.8, 0.8); note('bass', dest, t, CH[bar][0] - 12, 8 * B, 0.3); }
    if (i === 2 || i === 5) note('piano', dest, t, CH[bar][2] + (i === 5 ? 12 : 7), 2 * B, 0.3, 0.2);
  });
}
function theme(cue, x) {                                                         // f1: the hero's theme at last, brass and a march
  const B = fit(x, 0.1, 13);
  orch(cue, x, x.t0 + 0.1, B, HERO.mel, HERO.ch, 2, { lead: 'brass', march: true, crash: false });
  hit('crash', x.dest, x.t0 + 0.1, 1, 0, { len: 2.5 }); hit('crash', x.dest, x.t0 + 0.1 + 12 * B, 1, 0, { len: 3 });
}
function strings(cue, x) {
  const { dest, t0, hold } = x;
  if (x.meta.id === 'casa') {                                                    // horror: a bowed cluster, tremolo, sliding up as it swells; it is cut, never finished
    const up = hold - t0 + 0.6;
    for (const [m, p] of [[62, -0.4], [63, 0.4], [68, -0.1], [69, 0.2], [74, 0], [75, 0.3]]) note('strings', dest, t0, m, up, 0.6, p, { a: 0.5, r: 0.12, trem: 13 + x.rnd() * 3, to: mtof(m + 5), bright: 1500, voices: 2 });
    note('strings', dest, t0, 38, up, 0.6, 0, { a: 0.8, r: 0.15, to: mtof(37) });
    return;
  }
  // f2: the love theme (the rain piano's tune), given at last to the whole section over a harp
  const big = cue.t > 60, first = big ? 12 : 0, B = fit(x, 0.2, big ? 9 : 11);
  orch(cue, x, t0 + 0.2 - first * B, B, RAIN.mel.filter(([b]) => b >= first), RAIN.ch, 3, { harp: true, timp: big });
}
function orchestra(cue, x) {
  const { dest, t0, hold } = x;
  if (cue.t < 4) {                                                               // 'tierra': the earth turning into the light
    chord('strings', dest, t0, [38, 45, 50, 57], hold - t0 + 0.6, 0.8, 0.6, { a: 0.8, r: 0.9 });
    for (const [dt, m, l] of [[0.5, 62, 0.35], [0.9, 69, 0.35], [1.3, 66, 0.3], [1.6, 74, 1.9]]) note('horn', dest, t0 + dt, m, l, 0.9, -0.1);
    chord('choir', dest, t0 + 1.2, [62, 66, 69, 74], hold - t0 - 1.0, 0.9, 0.8);
    const tp = cue.t + peakOf(cue)[0];
    for (let t = tp - 1.2; t < tp - 0.03; t += 0.05) hit('timp', dest, t, 0.1 + 0.5 * (1 - (tp - t) / 1.2), 0, { f: 73.4, len: 0.25 });
    hit('timp', dest, tp, 1, 0, { f: 73.4, len: 1.6 }); hit('crash', dest, tp, 0.7, 0, { len: 2 });
    [86, 90, 93, 98].forEach((m, i) => note('glock', dest, tp + i * 0.07, m, 1, 0.5, 0.3));
    return;
  }
  if (x.meta.id === 'silencio') {                                                // f6: the pit's waltz, now in the major, for the whole orchestra
    const B = fit(x, 0.1, 21);
    orch(cue, x, t0 + 0.1, B, PIT.mel.map(([b, m, l]) => [b, toMajor(m), l]), PIT.ch.map((c) => c.map(toMajor)), 3, {});
    return;
  }
  orch(cue, x, t0 + 0.1, fit(x, 0.1, 14), EARTH.mel, EARTH.ch, 2, { lead: 'horn', choir: true });   // f5: dawn after the storm
}

export const SCORE = { swing, bandhit, fanfare, harp, drone, musicbox, pianonote, piano, stinger, score, theme, strings, orchestra };
