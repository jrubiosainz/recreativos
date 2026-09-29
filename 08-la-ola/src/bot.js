// The autopilot director: used by the tests to prove every level can be won, and by the title screen
// as the attract mode. It only reads what a player could see (the wave on the ring, the sections) and
// only writes what a player could do (aim, hold the screen ON AIR).
import { P, K } from './sim.js';
import { mulberry32 } from './util.js';

const wrap = (i, C) => ((i % C) + C) % C;
const rd = (d, C) => { d %= C; if (d > C / 2) d -= C; else if (d < -C / 2) d += C; return d; };

export class Bot {
  // jitter: seconds of human lateness on each call; dir: which way it starts waves
  constructor(sim, o = {}) {
    this.s = sim; this.dir = o.dir || 1; this.jit = o.jitter || 0; this.rnd = mulberry32(o.seed || 7);
    this.mode = 'go'; this.plan = null; this.x0 = sim.level.cam ?? 0; this.tMode = 0; this.late = 0;
  }
  blocks(j, eta) {
    const s = this.s, k = s.kind[j];
    return k === K.gap || k === K.away || k === K.vip || k === K.kiss || (k === K.sleep && (s.woke[j] <= eta + 0.5 || (s.level.feat === 'wake' && !s.once[j])));
  }
  // the next stretch a wave can't cross on its own, ahead of x going dir (unwrapped coordinates)
  ahead(x, dir, n) {
    const s = this.s, C = s.C;
    let run = 0, a = 0, vip = false, zz = false;
    for (let d = 1; d <= n; d++) {
      const j = wrap(Math.round(x) + dir * d, C);
      if (this.blocks(j, d / P.v)) { if (!run) a = d; run++; if (s.kind[j] === K.vip) vip = true; if (s.kind[j] === K.sleep) zz = true; }
      else if (run) { if (run >= 3 || vip) return { a: Math.round(x) + dir * a, b: Math.round(x) + dir * (d - 1), vip, zz }; run = 0; vip = zz = false; }
    }
    return null;
  }
  main() {
    const s = this.s; let best = null;
    for (let k = 1; k < s.waves.length; k++) {
      const w = s.waves[k];
      if (!w.dir || (w.dead >= 0 && s.deadFor(w) > P.rescueT - 0.4)) continue;
      if (!best || w.laps > best.laps + 0.02) best = w;
    }
    return best;
  }
  clean(x, dir) { return !this.ahead(x, dir, 70); }
  step() {
    const s = this.s, inp = s.input, t = s.time, C = s.C, cam = s.cam;
    inp.fast = true; inp.pan = 0;
    const w = this.main();
    if (!w) {
      // no wave worth saving: go somewhere clear and sweep a new one
      if (this.mode !== 'sweep') {
        if (this.mode !== 'go') { this.mode = 'go'; this.x0 = this.pickStart(); }
        inp.aim = this.x0; inp.air = false;
        if (Math.abs(rd(cam.x - this.x0, C)) < 1.2 && Math.abs(cam.v) < 4 && !s.lock && s.air > 0.5) { this.mode = 'sweep'; this.tMode = t; }
        return;
      }
      inp.air = true; inp.aim = cam.x + this.dir * 1.6;
      if (t - this.tMode > 1.1) { this.mode = 'wait'; this.tMode = t; inp.air = false; }
      return;
    }
    if (this.mode === 'sweep' && t - this.tMode < 1.1) { inp.air = true; inp.aim = cam.x + this.dir * 1.6; return; }
    this.mode = 'ride';
    const dir = w.dir, alive = w.dead < 0;
    const exp = s.ghost(w);
    let pl = this.plan;
    if (pl && (pl.id !== w.id || (pl.alive && !alive) || pl.done(w, exp, pl))) pl = this.plan = null;
    if (!pl) pl = this.plan = this.choose(w, alive, exp);
    if (!pl) { inp.air = false; inp.aim = null; return; }
    let target, on;
    if (pl.k === 'save') { target = exp + dir * 6; on = true; }
    else if (pl.k === 'kiss') { target = pl.a; on = (pl.a - exp) * dir < 5; }
    else if (pl.k === 'vip' || pl.k === 'zz') {
      // shoot the block itself; the palco is slow to notice, so be on them well before the wave
      const lead = (pl.a - exp) * dir, mid = (pl.a + pl.b) / 2;
      target = mid; on = lead < (pl.k === 'vip' ? 17 : 8) + pl.late * P.v && (pl.b - exp) * dir > -6;
    } else {
      target = pl.b + dir * 6;
      const lead = (target - exp) * dir;
      on = lead < 12 + pl.late * P.v;
      if (on) target = dir > 0 ? Math.max(target, exp + dir * 5) : Math.min(target, exp + dir * 5);
    }
    inp.aim = wrap(target, C);
    inp.air = on && s.air > 0.02;
  }
  choose(w, alive, exp) {
    const s = this.s, dir = w.dir, id = w.id;
    const late = this.jit ? (this.rnd() - 0.3) * this.jit : 0;
    const mk = (k, o, done) => ({ id, k, alive, late, ...o, done });
    const block = (ob) => mk(ob.vip ? 'vip' : 'zz', { a: ob.a, b: ob.b }, (w2, e) => (w2.dead < 0 && (w2.pos - ob.b) * dir > 10) || (e - ob.b) * dir > 40);
    if (!alive) {
      // a dead wave in front of a block the screen has to stand up anyway: shoot the block, still
      const ob = this.ahead(exp - dir * 12, dir, 44);
      if (ob && (ob.vip || ob.zz) && (ob.a - exp) * dir > -8) return block(ob);
      const x = exp;
      return mk('save', {}, (w2, e, p) => {
        if (w2.dead < 0) { p.rx ??= w2.pos; return (w2.pos - p.rx) * dir > 14; }
        return (e - x) * dir > 40;
      });
    }
    const ob = this.ahead(w.pos, dir, 100);
    if (s.level.feat === 'kiss' && !s.feat.kiss) {
      // the kiss cam with the wave going over the couple
      for (let d = 1; d <= 100; d++) {
        const x = Math.round(w.pos) + dir * d;
        if (ob && (x - ob.a) * dir >= 0) break;
        if (s.kind[wrap(x, s.C)] === K.kiss) return mk('kiss', { a: x }, (w2) => s.feat.kiss || (w2.pos - x) * dir > 12);
      }
    }
    if (!ob) return null;
    if (ob.vip || ob.zz) return block(ob);
    return mk('jump', { a: ob.a, b: ob.b }, (w2, e) => (w2.dead < 0 && (w2.pos - ob.b) * dir > 12) || (e - ob.b) * dir > 45);
  }
  pickStart() {
    const s = this.s, C = s.C;
    for (let k = 0; k < C; k += 6) {
      const x = wrap((this.s.cam.x | 0) + k, C);
      if (s.kind[x] <= K.ultra && this.clean(x, this.dir)) return x;
    }
    return this.x0;
  }
}
