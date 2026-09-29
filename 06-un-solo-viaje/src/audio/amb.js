// UN SOLO VIAJE ambience: the air of each room. Beds loop under everything and cross-fade as you go
// from one room to the next; small things happen now and then, far off. Your car's hazard lights
// tick by the boot; the stair light's timer ticks while it's on (that's how you know it's counting);
// upstairs a telly talks behind a door and a pressure cooker hisses; at home something simmers.
import { E, gain, filt, chain, hold } from './core.js';
import { hit, burst, sweep, env, osc, noise } from './kit.js';
import { B, U, R, cl } from './foley.js';

// how loud each bed is in each room: [traffic, city hiss, hall tone, strip-light hum, home]
const BEDS = {
  trunk: [0.075, 0.014, 0, 0, 0], street: [0.07, 0.015, 0, 0, 0], lobby: [0.035, 0.004, 0.05, 0.004, 0],
  flight: [0.012, 0.002, 0.045, 0.003, 0], half: [0.012, 0.002, 0.045, 0.003, 0], landing: [0.014, 0.002, 0.04, 0.003, 0],
  cabin: [0.006, 0, 0.012, 0.005, 0], home: [0.01, 0.002, 0, 0, 0.03],
};
// which far-off things happen where: [event, first after (s), every (min, max) s]
const EVENTS = {
  trunk: [['car', 1, 4, 9], ['pigeon', 3, 8, 18], ['moped', 12, 25, 45]],
  street: [['car', 1, 4, 9], ['pigeon', 2, 7, 16], ['moped', 9, 22, 40]],
  lobby: [['farDoor', 3, 9, 20], ['dog', 8, 20, 40], ['mailbox', 12, 25, 50]],
  flight: [['tv', 2, 9, 16], ['cooker', 10, 25, 45], ['farDoor', 6, 12, 25], ['dog', 15, 25, 50]],
  half: [['tv', 2, 9, 16], ['cooker', 10, 25, 45], ['farDoor', 6, 12, 25]],
  landing: [['tv', 1, 9, 16], ['cooker', 8, 25, 45], ['dog', 10, 25, 50]],
  cabin: [],
  home: [['tv', 1, 6, 10]],
};
const STAIRS = new Set(['lobby', 'flight', 'half', 'landing']);

// M: everything dry, into the amb bus. W: extra room for things heard through the stairwell, faded with M.
let M = null, W = null;
const A = (p = 0, v = 1) => {
  const c = E.ctx, g = gain(c, v);
  if (p && c.createStereoPanner) { const s = c.createStereoPanner(); s.pan.value = cl(p); chain(g, s, M); } else g.connect(M);
  return g;
};
// far away, through walls: dull, quiet and mostly room
function far(p, f = 1400, v = 0.5, room = 0.7) {
  const c = E.ctx, lp = filt(c, 'lowpass', f, 0.6), g = gain(c, v);
  chain(lp, g, A(p)); if (room) g.connect(gain(c, room)).connect(W);
  return lp;
}
const EVT = {
  // a car going by in the street: tyres and engine, left to right or back
  car(t) {
    const c = E.ctx, len = U(2.4, 3.6), dir = R() < 0.5 ? -1 : 1, g = gain(c, 0), lp = filt(c, 'lowpass', 300, 0.7);
    const p = c.createStereoPanner ? c.createStereoPanner() : gain(c, 1);
    chain(lp, g, p, M);
    if (p.pan) { p.pan.setValueAtTime(-0.85 * dir, t); p.pan.linearRampToValueAtTime(0.85 * dir, t + len); }
    lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(U(1400, 2400), t + len * 0.5); lp.frequency.linearRampToValueAtTime(350, t + len);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(U(0.06, 0.12), t + len * 0.5); g.gain.linearRampToValueAtTime(0, t + len);
    noise('pink', t, t + len + 0.1, lp);
    const e = gain(c, 0.3); e.connect(lp); osc('sawtooth', U(38, 55), t, t + len, e).frequency.linearRampToValueAtTime(U(30, 42), t + len);
    return 0;
  },
  // pigeons on the balcony rails: rrou-rou-rouuu
  pigeon(t) {
    const c = E.ctx, d = far(U(-0.8, 0.8), 1800, 0.5, 0.2);
    [[0, 0.2], [0.28, 0.16], [0.5, 0.42]].forEach(([o, len]) => {
      const e = env(d, t + o, { pk: 0.05, a: 0.03, d: len, sus: 0.8, len, r: 0.05 }), f = U(400, 440);
      const s = osc('sine', f, t + o, e.end, e.g); s.frequency.linearRampToValueAtTime(f * 0.86, t + o + len);
      const v = gain(c, f * 0.05); osc('sine', 19, t + o, e.end, v); v.connect(s.frequency);
    });
    return 0;
  },
  // a moped down the street: two-stroke buzz, Doppler as it passes
  moped(t) {
    const c = E.ctx, len = 3.4, dir = R() < 0.5 ? -1 : 1, g = gain(c, 0), bp = filt(c, 'bandpass', 1300, 1.3);
    const p = c.createStereoPanner ? c.createStereoPanner() : gain(c, 1);
    chain(bp, g, p, M);
    if (p.pan) { p.pan.setValueAtTime(-0.9 * dir, t); p.pan.linearRampToValueAtTime(0.9 * dir, t + len); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + len * 0.45); g.gain.linearRampToValueAtTime(0, t + len);
    for (const [f, w] of [[96, 'sawtooth'], [192, 'square']]) { const o = osc(w, f * 1.05, t, t + len, bp); o.frequency.setValueAtTime(f * 1.05, t + len * 0.45); o.frequency.linearRampToValueAtTime(f * 0.93, t + len * 0.6); }
    return 0;
  },
  // a door shutting somewhere up the stairwell
  farDoor(t) {
    const d = far(U(-0.5, 0.5), 900, 0.6, 1.4);
    sweep(d, t, 90, 40, { pk: 0.25, a: 0.002, d: 0.1, len: 0.1, r: 0.05 });
    burst(d, t, { type: 'lowpass', f: 600, pk: 0.1, a: 0.001, d: 0.03, len: 0.03, r: 0.02 });
    return 0;
  },
  // a small dog behind a door, two yaps
  dog(t) {
    const c = E.ctx, d = far(U(-0.6, 0.6), 1300, 0.6, 0.8), n = R() < 0.5 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const tt = t + i * U(0.22, 0.32), e = env(d, tt, { pk: 0.08, a: 0.008, d: 0.1, len: 0.09, r: 0.04 }), bp = filt(c, 'bandpass', 1000, 2);
      chain(bp, e.g);
      osc('sawtooth', U(480, 560), tt, e.end, bp).frequency.exponentialRampToValueAtTime(U(260, 300), tt + 0.1);
    }
    return 0;
  },
  // the brass letterboxes rattle when somebody slams the portal
  mailbox(t) {
    const d = far(U(-0.3, 0.3), 3200, 0.5, 0.9);
    for (let i = 0; i < 8; i++) burst(d, t + i * U(0.012, 0.03), { f: U(2000, 3500), q: 5, pk: 0.03, a: 0.001, d: 0.012, len: 0.008, r: 0.01 });
    return 0;
  },
  // somebody's telly through a door: syllables of murmur, then canned laughter, maybe
  tv(t) {
    const c = E.ctx, len = U(2.5, 4.5), d = far(U(-0.6, 0.6), 1000, 0.6, 0.5), bp = filt(c, 'bandpass', U(480, 650), 1.2), g = gain(c, 0);
    chain(bp, g, d); noise('pink', t, t + len + 0.2, bp);
    let tt = t;
    g.gain.setValueAtTime(0, t);
    while (tt < t + len) { const a = R() < 0.2 ? 0 : U(0.08, 0.2), s = U(0.07, 0.2); g.gain.linearRampToValueAtTime(a, tt + s * 0.4); tt += s; }
    g.gain.linearRampToValueAtTime(0, tt + 0.05);
    const o = osc('sawtooth', U(110, 140), t, tt, null), og = gain(c, 0.25); chain(o, filt(c, 'bandpass', 700, 3), og, g);
    return 0;
  },
  // an olla exprés rocking on a stove behind a door: chu-chu-chu-chu
  cooker(t) {
    const d = far(U(-0.5, 0.5), 3000, 0.5, 0.6), n = Math.round(U(8, 14));
    for (let i = 0; i < n; i++) burst(d, t + i * 0.19, { type: 'highpass', f: 2600, q: 0.7, pk: 0.035 * (1 - i / (n + 4)), a: 0.02, d: 0.06, len: 0.08, r: 0.05 });
    return 0;
  },
};

// continuous tickers: [period s, what it plays]
// the hazard relay in the dashboard: tic… tac…
const HAZARD = (t, k, v) => hit('tick', A(0.3, v), t, k & 1 ? 0.5 : 0.62, 0, { f: k & 1 ? 2500 : 3100 });
// the minutero, the stair light's clockwork timer on the wall: a dry little escapement that the stairwell repeats
const TIMER = (t, k) => { const g = A(-0.25, 1); g.connect(gain(E.ctx, 0.9)).connect(W); hit('tick', g, t, 0.34, 0, { f: k & 1 ? 1800 : 2100 }); };
// the time-lapse rest: the clockwork runs away with itself
const LAPSE = (t, k) => hit('tick', A(0.15 * Math.sin(k * 1.7), 0.8), t, 0.22 + 0.1 * (k % 4 === 0), 0, { f: 2400 + 500 * (k & 1) });
const SIMMER = (t) => {
  const d = A(U(-0.2, 0.2), 0.6);
  for (let i = 0; i < 3; i++) if (R() < 0.7) { const tt = t + U(0, 0.25), f = U(250, 700); sweep(d, tt, f, f * U(1.3, 1.8), { pk: U(0.01, 0.03), a: 0.002, d: 0.02, len: 0.02, r: 0.01 }); }
};
const CLOCK = (t, k) => hit('tick', A(0.4, 0.5), t, 0.3, 0, { f: k & 1 ? 2800 : 3200 });

export const Amb = {
  srcs: [], beds: [], iv: 0, next: [], room: null, timer: false, lit: false, lapse: false, hazard: 0, tick: {}, fade: 1,
  start(room = 'trunk') {
    this.stop(0.2);
    const c = E.ctx; if (!c) return;
    const t = E.now;
    M = gain(c, 0); M.connect(B('amb'));
    W = gain(c, 1); const wm = gain(c, 0); chain(W, wm, E.g.roomIn);
    this.master = M; this.wet = wm; this.W = W; this.srcs = []; this.beds = []; this.fade = 1;
    for (const x of [M, wm]) { x.gain.setValueAtTime(0, t); x.gain.linearRampToValueAtTime(1, t + 1.2); }
    const bed = (color, type, f, q) => {
      const s = c.createBufferSource(), g = gain(c, 0); s.buffer = E.nz[color]; s.loop = true;
      chain(s, filt(c, type, f, q), g, M); s.start(t, R() * s.buffer.duration * 0.9); this.srcs.push(s); this.beds.push(g); return g;
    };
    bed('brown', 'lowpass', 220, 0.6);        // traffic
    bed('pink', 'bandpass', 1800, 0.5);       // the city's hiss
    bed('brown', 'lowpass', 120, 0.6);        // the stairwell's own air
    const hum = gain(c, 0); hum.connect(M); this.beds.push(hum);   // strip lights
    for (const [f, g] of [[100, 1], [200, 0.5], [300, 0.25]]) { const o = osc('sine', f, t, t + 7200, null); chain(o, gain(c, g), hum); this.srcs.push(o); }
    bed('brown', 'lowpass', 300, 0.6);        // a flat: the fridge, the boiler, someone in the kitchen
    this.tick = { hazard: { at: t, k: 0 }, timer: { at: t, k: 0 }, simmer: { at: t, k: 0 }, clock: { at: t, k: 0 }, lapse: { at: t, k: 0 } };
    this.room = null; this.setRoom(room, 0.05);
    this.iv = setInterval(() => this.run(), 100); this.run();
  },
  setRoom(kind, f = 1.2) {
    if (!this.master || kind === this.room || !BEDS[kind]) return;
    this.room = kind;
    const t = E.now, lv = BEDS[kind];
    this.beds.forEach((g, i) => { hold(g.gain, t); g.gain.linearRampToValueAtTime(lv[i] * (i === 3 ? (this.lit ? 1 : 0) : 1), t + f); });
    this.next = (EVENTS[kind] || []).map(([k, a, lo, hi]) => ({ k, at: t + U(a * 0.6, a * 1.4), lo, hi }));
    this.hazard = kind === 'trunk' ? 0.55 : kind === 'street' ? 0.2 : 0;
  },
  // the stair light: its timer ticks while it's on, and the strip lights hum
  setLight(on, timer) {
    this.lit = !!on; this.timer = !!(on && timer);
    if (!this.master || !this.room) return;
    const g = this.beds[3], t = E.now;
    hold(g.gain, t); g.gain.linearRampToValueAtTime(BEDS[this.room][3] * (this.lit ? 1 : 0), t + 0.08);
  },
  run() {
    const c = E.ctx; if (!c || c.state !== 'running' || !this.master) return;
    M = this.master; W = this.W;
    const t = E.now, ahead = t + 0.3, T = this.tick;
    for (const n of this.next) while (n.at < ahead) { const at = Math.max(t + 0.02, n.at); EVT[n.k](at); n.at = at + U(n.lo, n.hi); }
    const loop = (s, per, on, fn) => { if (!on) { s.at = Math.max(s.at, t); return; } while (s.at < ahead) { if (s.at >= t - 0.05) fn(s.at, s.k); s.k++; s.at += per; } };
    loop(T.hazard, 0.68, this.hazard > 0 && this.fade > 0.5, (tt, k) => HAZARD(tt, k, this.hazard));
    loop(T.timer, 0.5, this.timer && STAIRS.has(this.room) && this.fade > 0.5, TIMER);
    loop(T.simmer, 0.25, this.room === 'home', SIMMER);
    loop(T.clock, 1, this.room === 'home', CLOCK);
    loop(T.lapse, 0.085, this.lapse, LAPSE);
  },
  // resting: the air steps back and the clockwork races
  setLapse(on) {
    on = !!on; if (on === this.lapse) return;
    this.lapse = on; this.duck(on ? 0.35 : 1, on ? 0.25 : 0.6);
  },
  // the time-lapse rest and the pause pull the air back
  duck(k = 1, f = 0.3) {
    this.fade = k;
    if (!this.master || !E.ctx) return;
    const t = E.now;
    for (const x of [this.master, this.wet]) { hold(x.gain, t); x.gain.linearRampToValueAtTime(k, t + f); }
  },
  stop(f = 0.6) {
    clearInterval(this.iv); this.iv = 0;
    const m = this.master, w = this.wet, s = this.srcs;
    this.master = this.wet = this.W = null; M = W = null; this.srcs = []; this.beds = []; this.room = null; this.lapse = false;
    if (!m || !E.ctx) return;
    const t = E.now;
    for (const x of [m, w]) { hold(x.gain, t); x.gain.linearRampToValueAtTime(0, t + f); }
    E.later(() => { for (const x of s) try { x.stop(); } catch { /* done */ } m.disconnect(); w.disconnect(); }, f * 1000 + 2500);
  },
};
