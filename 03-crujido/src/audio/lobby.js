// The lobby and the house: the trio that plays before the lights go down, the projector and the
// room during the film, and the menus' little sounds of paper, brass and glass.
import { E, gain, filt, chain, hold } from './core.js';
import { note, chord, hit, burst, sweep, osc, noise } from './kit.js';
import { offline } from './reel.js';

// ---- the lobby trio: electric piano, upright bass in two, brushes, a vibraphone tune (F, 96) ----
const BPM = 96, B = 60 / BPM, BARS = 8, TAIL = 2.5;
const CH = [[53, 57, 60, 64], [50, 53, 57, 60], [55, 58, 62, 65], [48, 52, 55, 58], [57, 60, 64, 67], [50, 54, 57, 60], [55, 58, 62, 65], [53, 57, 60, 64]];   // Fmaj7 Dm7 Gm7 C7 Am7 D7 Gm7 Fmaj7
const ROOT = [41, 38, 43, 36, 45, 38, 43, 41];
const MEL = [[0, 72, 1.5], [1.5, 69, 0.5], [2, 67, 1], [3, 65, 1], [4, 69, 2], [6, 67, 0.66], [6.66, 65, 0.34], [7, 62, 1],
  [8, 70, 1.5], [9.5, 69, 0.5], [10, 67, 1], [11, 64, 1], [12, 65, 3], [16, 72, 1], [17, 74, 0.66], [17.66, 72, 0.34], [18, 69, 2],
  [20, 69, 1], [21, 72, 1], [22, 74, 1.5], [23.5, 72, 0.5], [24, 70, 1.5], [25.5, 69, 0.5], [26, 67, 1], [27, 64, 1], [28, 65, 3.5]];
function trio(dest) {
  for (let bar = 0; bar < BARS; bar++) {
    const t = bar * 4 * B, up = 0.66 * B;
    chord('epiano', dest, t + up * 0, CH[bar], B * 1.6, 0.34, 0.5);
    chord('epiano', dest, t + 2 * B + up, CH[bar], B * 0.9, 0.24, 0.5);
    note('upright', dest, t, ROOT[bar], 2 * B, 0.7, -0.15); note('upright', dest, t + 2 * B, ROOT[bar] + 7, 2 * B, 0.6, -0.15);
    for (let i = 0; i < 4; i++) { hit('brush', dest, t + i * B, i % 2 ? 0.55 : 0.35, 0.25); if (i % 2) hit('hat', dest, t + i * B, 0.14, 0.3); }
  }
  for (const [b, m, l] of MEL) note('vibes', dest, b * B, m, l * B, 0.42, 0.15);
}
let lobbyBuf = null;
async function renderLobby() {
  const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext, sr = E.ctx.sampleRate;
  const len = BARS * 4 * B, c = new OAC(2, Math.ceil((len + TAIL) * sr), sr);
  offline(c, 7, () => { const g = gain(c, 0.9); g.connect(c.destination); trio(g); });
  const b = await c.startRendering(), n = Math.round(len * sr), out = E.ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {                      // fold the ring-out into the top so the loop has no seam
    const d = b.getChannelData(ch), o = out.getChannelData(ch);
    o.set(d.subarray(0, n)); for (let i = n; i < d.length; i++) o[i - n] += d[i];
  }
  return out;
}

export const Lobby = {
  src: null, g: null, want: false,
  async start() {
    this.want = true;
    if (!E.live || this.src) return;
    lobbyBuf ||= await renderLobby().catch(() => null);
    if (!lobbyBuf || !this.want || this.src) return;
    const c = E.ctx, g = gain(c, 0), s = c.createBufferSource(); s.buffer = lobbyBuf; s.loop = true;
    chain(s, g, E.g.bus.music); s.start(); g.gain.setTargetAtTime(1, c.currentTime, 0.4);
    this.src = s; this.g = g;
  },
  stop(f = 0.8) {
    this.want = false;
    if (!this.src) return;
    const c = E.ctx, s = this.src, g = this.g; this.src = null;
    hold(g.gain, c.currentTime); g.gain.setTargetAtTime(0, c.currentTime, f / 3);
    try { s.stop(c.currentTime + f * 1.5); } catch { /* ended */ }
  },
};

// ---- the house during the film: room tone and the projector at the back ----
export const House = {
  n: null,
  start() {
    if (!E.live || this.n) return;
    const c = E.ctx, t = E.now, g = gain(c, 0); g.connect(E.g.bus.amb);
    const hum = filt(c, 'lowpass', 260, 0.7), whirr = filt(c, 'bandpass', 1900, 3), clk = filt(c, 'highpass', 2500, 0.7);
    chain(hum, gain(c, 0.08), g); chain(whirr, gain(c, 0.012), g);
    const gate = gain(c, 0.02); chain(clk, gate, gain(c, 0.35), g);                   // sprockets: 24 frames a second
    const lfo = osc('square', 24, t, t + 3600, null); lfo.connect(gain(c, 0.02)).connect(gate.gain);
    const src = [noise('brown', t, t + 3600, hum), noise('pink', t, t + 3600, whirr), noise('white', t, t + 3600, clk), lfo];
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.6);
    burst(E.g.bus.amb, t, { type: 'highpass', f: 1400, pk: 0.12, a: 0.001, d: 0.02, len: 0.02 });   // the clack of the gate
    this.n = { g, src };
  },
  stop(f = 0.6) {
    if (!this.n) return;
    const { g, src } = this.n, t = E.now; this.n = null;
    hold(g.gain, t); g.gain.linearRampToValueAtTime(0, t + f);
    for (const s of src) try { s.stop(t + f + 0.05); } catch { /* stopped */ }
    E.later(() => g.disconnect(), f * 1000 + 100);
  },
};

// ---- menus ----
const out = (v, bus = 'ui') => { const g = gain(E.ctx, v); g.connect(E.g.bus[bus]); E.later(() => g.disconnect(), 4000); return g; };
export const Ui = {
  tap() { if (!E.live) return; const g = out(0.7); hit('wood', g, E.now, 0.6); },
  ticket() {                                           // a ticket torn along its perforation
    if (!E.live) return; const g = out(0.9), t = E.now;
    for (let i = 0; i < 9; i++) burst(g, t + i * 0.016 + Math.random() * 0.006, { f: 2400 + i * 260, q: 1.3, pk: 0.22, a: 0.001, d: 0.012, len: 0.01, r: 0.01 });
    burst(g, t, { color: 'pink', f: 3200, q: 0.6, to: 5200, pk: 0.08, a: 0.01, d: 0.14, len: 0.14, r: 0.04 });
  },
  stamp() { if (!E.live) return; const g = out(0.9), t = E.now; hit('kick', g, t, 0.35); burst(g, t, { color: 'pink', f: 900, q: 0.7, pk: 0.3, a: 0.002, d: 0.06, len: 0.05, r: 0.03 }); },
  star(i) { if (!E.live) return; const g = out(0.8), t = E.now; note('glock', g, t, [84, 88, 91][i] ?? 91, 0.8, 0.6, (i - 1) * 0.4); note('celesta', g, t + 0.02, ([84, 88, 91][i] ?? 91) - 12, 0.6, 0.35); },
  jingle(kind) {
    if (!E.live) return; const g = out(1, 'music'), t = E.now;
    if (kind === 'win') {                              // the credits roll: vibes up a major-seventh arpeggio, a brush swirl, a bass
      [65, 69, 72, 76, 77].forEach((m, i) => note('vibes', g, t + i * 0.11, m, 1.4 - i * 0.12, 0.6, (i - 2) * 0.2));
      hit('brush', g, t, 0.8); note('upright', g, t, 41, 1.2, 0.8); chord('epiano', g, t + 0.55, [53, 57, 60, 64, 69], 1.6, 0.5, 0.6);
    } else if (kind === 'lose') {                      // shown out by the usher: a muted trombone, wah-wah-wah-waaah
      [[0, 58], [0.42, 57], [0.84, 56], [1.26, 55]].forEach(([d, m], i) => note('brass', g, t + d, m - 12, i === 3 ? 1.3 : 0.34, 0.75, 0, { dark: true, vib: i === 3, solo: true, fall: i === 3 }));
    } else {                                           // the lights come up and you are still hungry
      note('piano', g, t, 67, 0.7, 0.5); note('piano', g, t + 0.32, 62, 1.4, 0.45); note('upright', g, t + 0.32, 43, 1.2, 0.6);
    }
  },
  _trio: trio,
};
