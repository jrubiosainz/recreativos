// Balance and QA bots. They read the sim like a player reads the screen (his next turn), then tap with
// human-ish error. Profiles: skilled, average, novice, spam, metronome.
import { TYPES, crowdScale } from './types.js';
import { mulberry32 } from './util.js';

export const PROFILES = {
  skilled: { sigma: 0.022, bias: 0.006, react: 0.18, greed: 'smart', granny: 0, cakeCare: true, runners: 1 },
  average: { sigma: 0.048, bias: 0.018, react: 0.28, greed: 'smart', granny: 0.12, cakeCare: false, slack: 0.35, runners: 0.5 },
  novice: { sigma: 0.085, bias: 0.03, react: 0.4, greed: 'always', granny: 0.45, cakeCare: false, early: 0.12 },
  spam: { spam: 0.13 },
  metronome: { beat: 0.9 },
};

export class Bot {
  constructor(sim, profile = 'skilled', seed = 7) {
    this.sim = sim;
    this.p = typeof profile === 'string' ? PROFILES[profile] : profile;
    this.rng = mulberry32(seed);
    this.plan = null; // sim time of the next tap
    this.forId = null;
    this.lastT = 0;
    this.watchRunners = this.rng() < (this.p.runners || 0);
  }
  gauss() { let u = 0, v = 0; while (!u) u = this.rng(); while (!v) v = this.rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185 * v); }

  // estimate if one more passenger fits before the doors reach him
  fits(next) {
    const s = this.sim, P = TYPES[next.type];
    if (P.rule === 'nopush') return s.t + P.step + P.board * 1.4 < s.T.move + 0.6;
    const sc = crowdScale(s.fill);
    const need = (P.N || 1) * sc.need;
    const pushes = Math.ceil(need * 1.25) + 1;
    const period = (P.T || 1) / sc.omega;
    const eta = s.t + P.step + pushes * period * 1.08 + (this.p.slack || 0.15);
    // a runner is coming: keep the doorway free for him
    if (this.watchRunners && s.runners.some((r) => !r.done && r.at > s.t - 0.1 && r.at < eta + 0.2)) return false;
    return eta < s.T.move + 0.85;
  }

  runnerDue() { const s = this.sim; return this.watchRunners && s.runners.some((r) => !r.done && Math.abs(r.at - s.t) < 1.2); }

  valid(P) {
    const s = this.sim;
    if (P.kind === 'point') return s.phase === 'shisa';
    if (P.kind === 'beckon') return !s.cur && s.canBeckon();
    return !!s.cur && s.cur.id === P.id && (s.cur.state === 'swing' || s.cur.state === 'granny');
  }

  update() {
    const s = this.sim, p = this.p;
    if (s.over) return;
    if (p.spam) { if (s.t - this.lastT >= p.spam) { this.lastT = s.t; s.input(s.t); } return; }
    if (p.beat) { if (s.t - this.lastT >= p.beat) { this.lastT = s.t; s.input(s.t); } return; }
    const P = this.plan;
    if (P && !this.valid(P)) this.plan = null;
    if (s.phase === 'shisa') { if (!this.plan) this.plan = { kind: 'point', t: s.t + 0.35 + this.rng() * 0.2 }; }
    else if (!s.cur) {
      if (s.canBeckon() && s.pusher.lock <= 0 && !this.plan) {
        const next = s.queue[s.qi];
        const target = s.fill < s.L.target;
        const go = p.greed === 'always' || this.fits(next) || (target && s.t < s.T.move - 0.8 && !this.runnerDue());
        if (go) this.plan = { kind: 'beckon', t: s.t + p.react * (0.7 + 0.6 * this.rng()) };
      }
    } else {
      const c = s.cur;
      if (c.state === 'granny') {
        if (this.forId !== c.id) { this.forId = c.id; if (this.rng() < p.granny) this.plan = { kind: 'push', id: c.id, t: s.t + 0.5 + this.rng() }; }
      } else if (c.state === 'swing' && !this.plan) {
        if (p.early && this.rng() < p.early * 0.02) this.plan = { kind: 'push', id: c.id, t: s.t + 0.01 };
        else {
          const nt = s.nextTurn(c);
          if (nt && !nt.board) {
            const sd = c.P.rule === 'perfect' && p.cakeCare ? p.sigma * 0.6 : p.sigma;
            this.plan = { kind: 'push', id: c.id, t: Math.max(s.t, nt.t + p.bias + this.gauss() * sd) };
          } else if (!nt && s.energy(c) < 0.03) this.plan = { kind: 'push', id: c.id, t: s.t + p.react };
        }
      }
    }
    if (this.plan && this.plan.t <= s.t + 1 / 60) {
      s.input(this.plan.t);
      this.plan = null;
    }
  }
}
