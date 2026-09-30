// The autopilot, for the tests and the attract loop. It flies the level's route like a player: tilts the nose
// down to go (a tilt is a speed), spins to climb and brakes the spin so it comes out level, keeps its speed over
// gaps, tops up the jam at a bottle, and over the box turns tail-down and lets the cat sit. `late` is a gentler,
// clumsier pilot.
import { K, SIT } from './sim.js';
import { clamp, angDiff } from './util.js';

export const STYLE = {
  sharp: { gain: 1, tilt: 0.62, dead: 0.05 },
  late: { gain: 0.78, tilt: 0.5, dead: 0.09 },
};
const btf = (b) => 0.55 + 0.45 * b;

export class Bot {
  constructor(sim, style = 'sharp') {
    this.s = sim; this.o = STYLE[style] || STYLE.sharp; this.route = (sim.lv.route || []).map((w) => [...w]);
    this.i = 0; this.phase = 0; this.dir = 0; this.back = false; this.stuck = 0; this.t0 = 0;
  }
  step() {
    const s = this.s, inp = s.input;
    if (s.end || this.i >= this.route.length) { inp.turn = 0; return; }
    const [xt, mode, o = {}] = this.route[this.i];
    inp.turn = mode === 'climb' ? this.climb(o) : mode === 'sit' ? this.sit(xt) : mode === 'wait' ? this.hold(xt, o) : mode === 'jar' ? this.jar(xt, o) : this.fly(xt, mode, o);
  }
  next() { this.i++; this.phase = 0; this.dir = 0; this.back = false; }

  // hold θ at `th`: tap-and-release, never letting ω reach `keep` (it would spin on)
  steer(th, dead = this.o.dead) {
    const s = this.s, w = s.w;
    if (Math.abs(w) >= K.keep - 0.3) return -Math.sign(w);
    const e = angDiff(th, s.th + w * K.tStop);
    if (Math.abs(e) < dead) return 0;
    const d = Math.sign(e);
    if (w * d < -0.3 || Math.abs(w) > K.keep - 1.2) return 0;
    return d;
  }
  // the tilt that gives a horizontal speed of `v`
  tiltFor(v) {
    const s = this.s, a = 4 * (v - s.vx) + K.drag * s.vx, m = Math.sin(2 * this.o.tilt);
    return 0.5 * Math.asin(clamp(a / (0.5 * K.T * btf(s.b)), -m, m));
  }
  fly(xt, mode, o) {
    const s = this.s, dx = xt - s.x;
    if (!this.dir) this.dir = Math.sign(dx) || 1;
    const vmax = (o.v ?? 150) * this.o.gain, nxt = this.route[this.i + 1];
    const careful = !nxt || nxt[1] === 'climb' || nxt[1] === 'sit';
    if (mode === 'pass' ? dx * this.dir <= 0 : Math.abs(dx) < 12 && (!careful || Math.abs(s.vx) < 30)) { this.next(); return this.steer(0); }
    const v = mode === 'pass' ? this.dir * vmax : clamp(dx * 2.2, -vmax, vmax);
    // pressed against something it can't float over: spin up and climb it
    this.stuck = Math.abs(v) > 40 && Math.abs(s.vx) < 15 && s.contacts.some((h) => Math.abs(h.nx) > 0.5) ? this.stuck + 1 / 120 : 0;
    if (this.stuck > 0.4) { this.stuck = 0; this.route.splice(this.i, 0, [s.x, 'climb', { c: 0.85 }]); this.phase = 0; return 0; }
    return this.steer(this.tiltFor(v));
  }
  // spin (the safe way round: tail down first) until the lift has built up, then brake so it stops facing
  // where it's going next
  climb(o) {
    const s = this.s;
    if (this.phase === 0) { if (s.charge >= (o.c ?? 0.6)) this.phase = 1; return -1; }
    const nxt = this.route[this.i + 1], go = nxt ? Math.sign(nxt[0] - s.x) * 0.3 : 0;
    const W = Math.abs(s.w), stop = s.th + Math.sign(s.w) * (Math.max(0, W * W - 27) / (2 * K.brake) + 5.2 * K.tStop);
    if (this.phase === 1) { if (W < K.keep || Math.abs(angDiff(go, stop)) < 0.3) this.phase = 2; else return -1; }
    if (Math.abs(s.w) > K.keep - 0.8) return -Math.sign(s.w);
    this.next(); return 0;
  }
  // a refill: stop over the bottle, turn jam side down (tail first, past sitting), hold station while the cushion
  // squeezes the bottle into the toast, then turn back the same way round
  jar(xt, o) {
    const s = this.s, dx = xt - s.x, hold = this.tiltFor(clamp(dx * 2.2, -60, 60));
    if (this.phase === 0) {
      if (Math.abs(dx) < 8 && Math.abs(s.vx) < 30) { this.phase = 1; this.t0 = s.time; }
      return this.steer(this.tiltFor(clamp(dx * 2.2, -110, 110)));
    }
    if (this.phase === 1) { if (s.th < -2.2 || s.th > 2.9) this.phase = 2; else return this.steer(-2.6); }
    if (this.phase === 2) {
      if (s.b >= (o.to ?? 0.97) || s.time - this.t0 > (o.max ?? 6)) this.phase = 3;
      else return this.steer(Math.PI + hold);
    }
    if (this.phase === 3) { if (s.th < 0 && s.th > -2.2) this.phase = 4; else return this.steer(-1.6); }
    if (Math.abs(angDiff(0, s.th)) < 0.12 && Math.abs(s.w) < 1) { this.next(); return 0; }
    return this.steer(hold);
  }
  // hold still over a spot until the coast is clear (the dog's gone by)
  hold(xt, o) {
    const s = this.s, d = s.dogs[0];
    const clear = !o.dog || !d || (d.dir < 0 && d.x < s.x - 20 && !d.jump);
    if (clear && Math.abs(xt - s.x) < 20) { this.next(); return 0; }
    return this.steer(this.tiltFor(clamp((xt - s.x) * 2.2, -80, 80)));
  }
  // come in over the spot at a walking pace and turn tail-down right above it: the turn itself pushes the cat
  // back (nose up goes backwards), which eats the pace, and it drops onto its bottom. If it sat anywhere but in
  // the box, stand up, back off and try again.
  sit(xt) {
    const s = this.s, dx = xt - s.x;
    if (s.sit) {
      if (s.sit.s.tag === 'boxfloor' || s.time - s.sit.t < 0.4) return 0;
      this.phase = 0; this.back = true; return 1;
    }
    if (this.phase === 0) {
      if (dx < -6) this.back = true;
      if (this.back && dx > 30) this.back = false;
      const v = this.back ? -60 : dx > 30 ? Math.min(dx * 2.2, 150) * this.o.gain : 55;
      if (!this.back && dx < 2 && s.vx > 30) this.phase = 1;
      else return this.steer(this.tiltFor(v));
    }
    return this.steer(SIT, 0.06);
  }
}
