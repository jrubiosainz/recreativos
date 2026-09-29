// A decent automatic player: times the yawn to the boss's turn and pssts coworkers
// who are not looking. Used by the balance tests, the QA screenshots and ?bot=1.
import { TUNE, Y } from './sim.js';

export class Bot {
  constructor(sim, o = {}) {
    this.sim = sim;
    this.lead = o.lead ?? 1.9;
    this.hold = o.hold ?? 2.4;
    this.psstOn = o.psst ?? true;
    this.stifle = o.stifle ?? true;
    this.wake = !!o.wake;
    this.holdUntil = -1;
    this.nextPsst = 0;
  }

  step() {
    const sim = this.sim, me = sim.player, b = sim.boss, t = sim.t;
    if (sim.over) { sim.input.hold = false; return; }
    const ttt = sim.timeToTurn();
    if (me.yp === Y.IDLE && me.refr <= 0 && this.holdUntil < t && ttt <= this.lead && ttt > this.lead - 0.05) this.holdUntil = t + this.hold;
    sim.input.hold = t < this.holdUntil;
    if (this.stifle && sim.input.hold && sim.bossWatching() && b.phase !== 'drowsy' && me.yp === Y.INHALE) {
      const others = sim.people.filter((p) => p !== me && sim.isYawning(p)).length;
      if (others + 1 < sim.K) { this.holdUntil = -1; sim.input.hold = false; }
    }
    if (this.psstOn && t >= this.nextPsst && sim.bossSafe() && ttt < this.lead + 1.6) {
      let best = null, bd = 1e9;
      for (const p of sim.people) {
        if (p === me || p.kind === 'pelota' || p.psst > 0 || p.refr > 0 || p.yp !== Y.IDLE) continue;
        if (p.kind === 'coffee' && p.cup > 0) continue;
        if (p.sleeping && !this.wake) continue;
        if (!p.sleeping && sim.canSee(p, me)) continue;
        const d = sim.dist(me, p);
        if (d > TUNE.psstRange) continue;
        const score = d - (p.sleeping ? 3 : 0);
        if (score < bd) { bd = score; best = p; }
      }
      if (best) { sim.psst(best.id); this.nextPsst = t + 1.05; }
    }
  }
}
