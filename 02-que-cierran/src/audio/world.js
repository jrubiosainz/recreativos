// The world around you: the train (inverter whine that climbs a scale as it pulls
// away, wheel roar, brake squeal, rail-joint clacks computed from real axle
// crossings) and each station's ambience (dawn sparrows, a temple bell in the fog,
// rain, the sumo drum tower, a level crossing, distant PA from other platforms).
import { E, gain, filt, pan, chain, glide, mtof, clamp } from './core.js';
import { note, hit, env, osc, noise, burst, input, bonsho } from './kit.js';

const PITCH = 20.6, AXLES = [-5.45, -3.35, 8.15, 10.25], CARS = 10, JOINTS = [-26, -2, 22];   // matches CAR in car.js
const STEP = [0, 2, 4, 5, 7, 9, 11, 12];
// chain returns the tail; these want the head, so sources run through the whole path
const via = (...n) => { chain(...n); return n[0]; };

export class Train {
  constructor() { this.n = null; this.x = null; this.v = 0; this.idle = 0; this.stopped = true; }
  _nodes() {
    const c = E.ctx, out = gain(c, 1), p = pan(c, 0);
    chain(out, p, E.g.bus.sfx);
    const inv = osc('sawtooth', 700, E.now, E.now + 3600, null), bp = filt(c, 'bandpass', 700, 5), ig = gain(c, 0);
    chain(inv, bp, ig, out);
    const hum = osc('sine', 60, E.now, E.now + 3600, null), hg = gain(c, 0); chain(hum, hg, out);
    const rl = filt(c, 'lowpass', 260, 0.7), rg = gain(c, 0); chain(rl, rg, out); const n1 = noise('brown', E.now, E.now + 3600, rl);
    const rr = filt(c, 'bandpass', 900, 0.8), rrg = gain(c, 0); chain(rr, rrg, out); const n2 = noise('pink', E.now, E.now + 3600, rr);
    const sq = osc('sine', 3150, E.now, E.now + 3600, null), sg = gain(c, 0), sl = gain(c, 90); chain(sq, sg, out);
    sl.connect(sq.frequency); const lfo = osc('sine', 5.3, E.now, E.now + 3600, sl);
    this.n = { out, p, inv, bp, ig, hum, hg, rg, rrg, sg, srcs: [inv, hum, sq, lfo, n1, n2] };
  }
  _kill() {
    const n = this.n; if (!n) return; this.n = null;
    glide(n.out.gain, 0, E.now, 0.05);
    E.later(() => { for (const s of n.srcs) { try { s.stop(); } catch { /* gone */ } } try { n.out.disconnect(); } catch { /* gone */ } }, 400);
  }
  reset() { this._kill(); this.x = null; this.v = 0; this.stopped = true; }
  // x, v in world units (scene.trainX/trainV); called every frame
  update(x, v, dt) {
    if (!E.live || !(dt > 0)) { this.x = x; this.v = v; return; }
    const s = Math.abs(v), a = this.x == null ? 0 : (s - Math.abs(this.v)) / dt;
    if (s > 0.02 && !this.n) this._nodes();
    if (this.n) {
      const n = this.n, t = E.now, tau = 0.04;
      const car = s < 6 ? mtof(77 + STEP[Math.min(7, Math.floor(s / 0.75))]) : 700 + 110 * s;
      glide(n.inv.frequency, car, t, 0.012); glide(n.bp.frequency, car, t, 0.012);
      glide(n.ig.gain, s > 0.05 ? 0.018 + 0.05 * clamp(Math.abs(a) / 6) : 0, t, tau);
      glide(n.hum.frequency, 30 + 11 * s, t, tau); glide(n.hg.gain, s > 0.05 ? 0.05 * clamp(Math.abs(a) / 5 + 0.2) : 0, t, tau);
      glide(n.rg.gain, 0.3 * clamp(s / 14), t, tau); glide(n.rrg.gain, 0.12 * clamp(s / 18) ** 1.5, t, tau);
      const braking = a < -0.2 && s < 5 && s > 0.12;
      glide(n.sg.gain, braking ? 0.03 * (1 - s / 5) : 0, t, 0.06);
      // the train is heard from its nearest end: off to the right while it pulls in, then dead ahead
      const lo = x - 8.75, hi = x + (CARS - 1) * PITCH + 12.4, near = lo > 0 ? lo : hi < 0 ? hi : 0;
      if (n.p.pan) glide(n.p.pan, clamp(near / 30, -0.8, 0.8), t, 0.1);
      if (this.x != null) this._clacks(this.x, x, s, dt);
      if (s < 0.02 && this.v !== 0 && Math.abs(this.v) >= 0.02) { this.stopped = true; this.onStop?.(); }
      this.idle = s < 0.02 ? this.idle + dt : 0;
      if (this.idle > 0.6) this._kill();
    }
    this.x = x; this.v = v;
  }
  _clacks(x0, x1, s, dt) {
    if (s < 0.4 || x0 === x1) return;
    for (let c = 0; c < CARS; c++) for (const ax of AXLES) {
      const o = c * PITCH + ax, a0 = x0 + o, a1 = x1 + o;
      for (const j of JOINTS) {
        if ((a0 - j) * (a1 - j) > 0) continue;
        const f = (a0 - j) / (a0 - a1), t = E.now + f * dt, d = input(E.g.bus.sfx, clamp(j / 40, -0.8, 0.8));
        const k = clamp(s / 16) * (j === -2 ? 1 : 0.55);
        const e = env(d, t, { pk: 0.34 * k, a: 0.001, d: 0.05, len: 0.05, r: 0.02 }); osc('sine', 150, t, e.end, e.g).frequency.exponentialRampToValueAtTime(80, t + 0.04);
        burst(d, t, { type: 'lowpass', f: 1600, pk: 0.14 * k, a: 0.001, d: 0.03, len: 0.03 });
      }
    }
  }
}

const SPACE = { s1: { hall: 0.6, echo: 1.2 }, s2: { hall: 1.1, echo: 0.8 }, s3: { hall: 0.8, echo: 0.9 }, s4: { hall: 0.7, echo: 1.1 }, s5: { hall: 1, echo: 1 }, s6: { hall: 0.9, echo: 1 }, s7: { hall: 1.2, echo: 0.9 }, s8: { hall: 1.6, echo: 0.8 } };

export class Ambience {
  constructor() { this.on = null; this.timer = 0; }
  start(id, { distantPA = null } = {}) {
    this.stop(0.2);
    if (!E.ctx) return;
    const c = E.ctx, out = gain(c, 0), t = E.now, srcs = [];
    out.connect(E.g.bus.amb); glide(out.gain, 1, t, 0.6);
    E.g.space(SPACE[id] || {}, t);
    const bed = (color, type, f, q, g) => { const b = filt(c, type, f, q), gg = gain(c, g); chain(b, gg, out); srcs.push(noise(color, t, t + 3600, b)); return gg; };
    bed('brown', 'lowpass', 180, 0.7, 0.3);                                // the city under everything
    const crowd = gain(c, 0), cf = filt(c, 'bandpass', 520, 0.7), cf2 = filt(c, 'bandpass', 1250, 1.3);
    chain(cf, crowd); chain(cf2, gain(c, 0.5), crowd); crowd.connect(out); const csend = gain(c, 0.25); crowd.connect(csend).connect(E.g.hallIn);
    srcs.push(noise('pink', t, t + 3600, cf), noise('pink', t, t + 3600, cf2));
    const am = gain(c, 0.35), am2 = gain(c, 0.2); am.connect(crowd.gain); am2.connect(crowd.gain);
    srcs.push(osc('sine', 0.13, t, t + 3600, am), osc('sine', 0.31, t, t + 3600, am2));
    if (id === 's3') { bed('white', 'highpass', 1900, 0.5, 0.05); bed('pink', 'bandpass', 5200, 0.6, 0.06); }
    if (id === 's2') { const w = bed('pink', 'lowpass', 480, 0.7, 0.1), lf = gain(c, 0.06); lf.connect(w.gain); srcs.push(osc('sine', 0.09, t, t + 3600, lf)); }
    this.on = { id, out, crowd, srcs, next: {}, distantPA, fill: 0 };
    this.setCrowd(0.3);
    if (!E.offline) this.timer = setInterval(() => this._events(), 200);
  }
  // how packed the car is drives the murmur (and the groans of the upholstery)
  setCrowd(fill) {
    const o = this.on; if (!o || !E.ctx) return;
    o.fill = fill; glide(o.crowd.gain, 0.05 + 0.12 * clamp(fill / 1.8), E.now, 0.5);
  }
  _due(key, lo, hi) {
    const o = this.on, now = E.now;
    if (o.next[key] == null) { o.next[key] = now + lo * 0.4 + Math.random() * (hi - lo) * 0.5; return false; }
    if (now < o.next[key]) return false;
    o.next[key] = now + lo + Math.random() * (hi - lo); return true;
  }
  _events() {                                                            // on a timer live; by hand offline
    const o = this.on; if (!o || !E.live) return;
    const d = o.out, t = E.now + 0.05, id = o.id;
    if ((id === 's1' || id === 's4') && this._due('bird', 2.5, 6)) this.sparrow(d, t);
    if (id === 's4' && this._due('uguisu', 9, 15)) this.uguisu(d, t);
    if (id === 's2' && this._due('bell', 11, 16)) bonsho(via(filt(E.ctx, 'lowpass', 1400), gain(E.ctx, 0.55), d), t, 92, 0.45, -0.5);
    if (id === 's3' && this._due('drip', 0.25, 0.9)) { const f = 900 + Math.random() * 1400, e = env(input(d, Math.random() * 1.6 - 0.8), t, { pk: 0.05, a: 0.001, d: 0.03, len: 0.03 }); osc('sine', f, t, e.end, e.g).frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.025); }
    if (id === 's5' && this._due('yagura', 6, 10)) this.yagura(d, t);
    if (id === 's6' && this._due('crossing', 10, 15)) this.crossing(d, t);
    if ((id === 's7' || id === 's8') && o.distantPA && this._due('farPA', 10, 16)) o.distantPA();
    if (o.fill > 1.15 && this._due('creak', 1.6, 4)) {                     // bodies pressed against seats and poles
      const e = env(input(d, Math.random() * 0.6 - 0.3), t, { pk: 0.025 * clamp(o.fill - 1), a: 0.03, d: 0.25, sus: 0.5, len: 0.22 });
      const q = osc('sawtooth', 190 + Math.random() * 90, t, e.end, null), lp = filt(E.ctx, 'bandpass', 900, 3); chain(q, lp, e.g);
      q.frequency.linearRampToValueAtTime(260 + Math.random() * 120, t + 0.22);
    }
  }
  sparrow(d, t) { const n = 2 + (Math.random() * 3 | 0), p = Math.random() * 1.4 - 0.7; for (let i = 0; i < n; i++) { const e = env(input(d, p), t + i * 0.11, { pk: 0.035, a: 0.003, d: 0.05, len: 0.05, r: 0.01 }); osc('sine', 4700 + Math.random() * 600, t + i * 0.11, e.end, e.g).frequency.exponentialRampToValueAtTime(3200, t + i * 0.11 + 0.05); } }
  uguisu(d, t) {                                                          // ホーー、ホケキョ
    const p = Math.random() * 1.2 - 0.6, x = input(d, p);
    const e = env(x, t, { pk: 0.045, a: 0.12, d: 1, sus: 0.9, len: 1.1, r: 0.08 }), o = osc('sine', 1180, t, e.end, e.g); o.frequency.linearRampToValueAtTime(1320, t + 1.1);
    const e2 = env(x, t + 1.3, { pk: 0.05, a: 0.01, d: 0.1, len: 0.09, r: 0.02 }); osc('sine', 2150, t + 1.3, e2.end, e2.g);
    const e3 = env(x, t + 1.46, { pk: 0.05, a: 0.01, d: 0.1, len: 0.08, r: 0.02 }); osc('sine', 2650, t + 1.46, e3.end, e3.g);
    const e4 = env(x, t + 1.6, { pk: 0.055, a: 0.01, d: 0.3, sus: 0.8, len: 0.26, r: 0.04 }), o4 = osc('sine', 3300, t + 1.6, e4.end, e4.g); o4.frequency.exponentialRampToValueAtTime(2350, t + 1.86);
  }
  yagura(d, t) {                                                          // the drum tower calling the tournament, far off
    const x = via(filt(E.ctx, 'lowpass', 1100), gain(E.ctx, 0.4), input(d, 0.6)), pat = 'Dk.kDkDk.kDD';
    for (let i = 0; i < pat.length; i++) if (pat[i] !== '.') hit(pat[i] === 'D' ? 'don' : 'ka', x, t + i * 0.13, pat[i] === 'D' ? 0.8 : 0.6);
  }
  crossing(d, t) {                                                        // 踏切: カンカンカン
    const x = via(filt(E.ctx, 'lowpass', 3200), gain(E.ctx, 0.35), input(d, -0.7));
    for (let i = 0; i < 8; i++) { note('bell', x, t + i * 0.5, 78, 0.2, 0.5); note('bell', x, t + i * 0.5, 83.5, 0.2, 0.18); }
  }
  stop(f = 0.8) {
    const o = this.on; if (!o) return; this.on = null; clearInterval(this.timer);
    if (!E.ctx) return;
    glide(o.out.gain, 0, E.now, Math.max(0.01, f / 4));
    E.later(() => { for (const s of o.srcs) { try { s.stop(); } catch { /* gone */ } } try { o.out.disconnect(); } catch { /* gone */ } }, f * 1000 + 400);
  }
}
