// UN SOLO VIAJE: players that are not people, for tests, tuning and the attract loop. They read what
// the screen shows (what each hand carries and still holds, what the next door wants) and press the
// same keys a person would, at human speeds and with human mistakes. The better ones plan: they
// weigh freeing a hand for the door against how long that hand can carry everything alone.
import { Sim, GRIP, MVC, PACE, V0, V_STAIRS, V_DARK, W_SLOW, IMB, T_PASS, DT, tDown, tUp, howFor } from './sim.js';
import { mulberry32 } from './util.js';

// think: seconds between looks · K: doors planned ahead · safe/stairs: kg of margin kept (more on stairs)
// lead/sd: how early and how steadily a hand is freed before a door · miss: taps that go to the wrong hand
// samples: ways to share out the bags they consider · waits: chance of resting while waiting
// warn: put it all down when a hand would give within this many seconds · goal: seconds of carrying
// wanted before picking up again · wf: seconds a unit of fatigue is worth · noise: misjudgement
export const PROFILES = {
  perfect: { think: 0.1, K: 2, safe: 1.0, stairs: 1.0, lead: 0.12, sd: 0.02, miss: 0, samples: 1024, waits: 1, warn: 2.5, goal: 26, wf: 6, noise: 0 },
  good: { think: 0.2, K: 2, safe: 1.8, stairs: 1.5, lead: 0.3, sd: 0.1, miss: 0.01, samples: 128, waits: 0.9, warn: 3, goal: 22, wf: 5, noise: 0.25 },
  average: { think: 0.32, K: 1, safe: 2.4, stairs: 1.5, lead: 0.5, sd: 0.25, miss: 0.03, samples: 24, waits: 0.5, warn: 2.5, goal: 16, wf: 3, noise: 0.8 },
  novice: { think: 0.5, K: 1, safe: 1.2, stairs: 0.4, lead: 0.3, sd: 0.4, miss: 0.07, samples: 6, waits: 0.15, warn: 1.2, goal: 10, wf: 1, noise: 2 },
  lazy: { think: 0.3, lazy: true },
  masher: { think: 0.07, masher: true },
};
export const BOTS = Object.keys(PROFILES);

const Fp = GRIP.F * PACE, Rp = GRIP.R * PACE, Rr = Rp * GRIP.r;
// fatigue after holding kg for t seconds (the 3CC with the active part tracking the load)
export function mfAfter(mf, kg, t) {
  if (kg <= 0) return mf * Math.exp(-Rr * t);
  const eq = (Fp * kg) / MVC / Rp;
  return eq + (mf - eq) * Math.exp(-Rp * t);
}
// hand `from` gives its outermost j bags to the other, one by one
export function moveN(H, from, j) {
  const a = H[from].slice(), b = H[1 - from].slice();
  for (let k = 0; k < j; k++) b.push(a.pop());
  return from === 0 ? [a, b] : [b, a];
}
function options(H) {
  const out = [];
  for (const f of [0, 1]) for (let j = 1; j <= H[f].length; j++) out.push({ c: moveN(H, f, j), n: j, to: 1 - f });
  return out;
}

// how long the next K acts take carrying cfg from here, and how close a hand comes to letting go
export function plan(sim, cfg, P, K = P.K, o = {}) {
  const B = sim.bags;
  const kg = (a) => { let s = 0; for (const i of a) s += B[i].kg; return s; };
  const hold = (Hh, mf, dur, need) => {
    const out = [0, 0];
    let r = Infinity;
    for (const h of [0, 1]) {
      const k = kg(Hh[h]);
      out[h] = mfAfter(mf[h], k, dur);
      if (k > 0) r = Math.min(r, (1 - Math.max(mf[h], out[h])) * MVC - k - need);
    }
    return { mf: out, r };
  };
  const speed = (Hh, st, t, lightAt) => {
    const a = kg(Hh[0]), b = kg(Hh[1]), W = a + b, imb = W ? Math.abs(a - b) / W : 0;
    const dark = st.lit === 'timer' && t >= lightAt;
    return V0 * (1 - W / W_SLOW) * (1 - IMB * imb) * (st.stairs ? V_STAIRS : 1) * (dark ? V_DARK : 1);
  };
  let H = cfg, MF = (o.MF || [sim.H[0].MF, sim.H[1].MF]).slice();
  let t = o.t0 || 0, risk = Infinity, acts = 0, since = 0, first = null, lightAt = sim.light.until - sim.t;
  const from = o.from ?? sim.si;
  for (let i = from; i < sim.steps.length && acts < K; i++) {
    const st = sim.steps[i];
    if (st.k === 'walk' || st.k === 'wait') {
      let d, need = P.safe;
      if (st.k === 'walk') {
        d = (i === sim.si ? st.len - sim.sp : st.len) / speed(H, st, t, lightAt);
        if (st.stairs) need += P.stairs;
      } else d = i === sim.si ? Math.max(0, sim.waitT - sim.sp) : st.T;
      const x = hold(H, MF, d, need);
      MF = x.mf; risk = Math.min(risk, x.r); t += d; since += d;
      continue;
    }
    if (st.k !== 'act') break;
    const at = t;
    let best = null;
    for (const e of [0, 1, null]) {
      const passes = e == null ? 0 : H[e].length;
      if (e != null && !passes) continue;
      const Hn = e == null ? H : moveN(H, e, passes);
      const d = howFor(st, [Hn[0].length, Hn[1].length]);
      if (e != null && d.how !== 'fast' && d.how !== 'cross') continue;
      const tp = passes * T_PASS;
      let mf = MF, r = Infinity;
      if (tp > 0) { const x = hold(Hn, mf, tp, P.safe); mf = x.mf; r = Math.min(r, x.r); }
      if (d.how === 'crouch') {
        let x = hold(Hn, mf, d.a, P.safe); r = Math.min(r, x.r);
        x = hold([[], []], x.mf, d.b - d.a, 0);
        x = hold(Hn, x.mf, d.T - d.b, P.safe); mf = x.mf; r = Math.min(r, x.r);
      } else { const x = hold(Hn, mf, d.T, P.safe); mf = x.mf; r = Math.min(r, x.r); }
      const opt = { e, H: Hn, mf, r, cost: Math.max(0, tp - since) + d.T, how: d.how, passes };
      if (!best || better(opt, best)) best = opt;
    }
    H = best.H; MF = best.mf; risk = Math.min(risk, best.r); t += best.cost;
    if (!acts) first = { e: best.e, how: best.how, passes: best.passes, at, i };
    acts++; since = 0;
    if (st.type === 'switch') lightAt = t + sim.lv.light;
    // after the door, share the load out again for the walk to the next one
    if (acts < K) {
      let dur = 0;
      for (let j = i + 1; j < sim.steps.length && sim.steps[j].k !== 'act'; j++) {
        const sj = sim.steps[j];
        if (sj.k === 'walk') dur += sj.len / speed(H, sj, t + dur, lightAt);
        else if (sj.k === 'wait') dur += sj.T;
      }
      if (dur > 1) {
        let bc = H, bs = hold(H, MF, dur, 0).r;
        for (const op of options(H)) { const s = hold(op.c, MF, dur, 0).r - 0.2; if (s > bs) { bs = s; bc = op.c; } }
        H = bc;
      }
    }
  }
  return { t, risk, first, fat: MF[0] + MF[1] };
}
function better(a, b) {
  const fa = a.r >= 0, fb = b.r >= 0;
  if (fa !== fb) return fa;
  if (!fa) return a.r > b.r;
  return a.cost < b.cost - 1e-9 || (Math.abs(a.cost - b.cost) < 1e-9 && a.passes < b.passes);
}
const score = (p, P) => p.t + P.wf * p.fat + 2 * Math.max(0, -p.risk);

// seconds until either hand keeps less margin than it wants, carrying cfg as it is from here on
export function endurance(sim, cfg, P, lim = 60, from = sim.si) {
  const B = sim.bags;
  const kg = (a) => { let s = 0; for (const i of a) s += B[i].kg; return s; };
  const k = [kg(cfg[0]), kg(cfg[1])], W = k[0] + k[1], imb = W ? Math.abs(k[0] - k[1]) / W : 0;
  const n = [cfg[0].length, cfg[1].length];
  let MF = [sim.H[0].MF, sim.H[1].MF], t = 0, lightAt = sim.light.until - sim.t;
  for (let i = from; i < sim.steps.length; i++) {
    const st = sim.steps[i];
    let d = 0, need = P.safe, rest = null;
    if (st.k === 'load') continue;
    if (st.k === 'walk') {
      const dark = st.lit === 'timer' && t >= lightAt;
      d = (i === sim.si ? st.len - sim.sp : st.len) / (V0 * (1 - W / W_SLOW) * (1 - IMB * imb) * (st.stairs ? V_STAIRS : 1) * (dark ? V_DARK : 1));
      if (st.stairs) need += P.stairs;
    } else if (st.k === 'wait') d = i === sim.si ? Math.max(0, sim.waitT - sim.sp) : st.T;
    else if (st.k === 'act') { const h = howFor(st, n); d = h.T; if (h.how === 'crouch') rest = [h.a, h.b]; if (st.type === 'switch') lightAt = t + d + sim.lv.light; }
    else return Infinity;
    for (const h of [0, 1]) {
      if (!k[h]) continue;
      const eq = (Fp * k[h]) / MVC / Rp, target = 1 - (k[h] + need) / MVC;
      if (MF[h] >= target) return t;
      const tau = -Math.log((eq - target) / (eq - MF[h])) / Rp;
      if (tau < (rest ? rest[0] : d)) return t + tau;
    }
    if (rest) for (const h of [0, 1]) MF[h] = mfAfter(mfAfter(mfAfter(MF[h], k[h], rest[0]), 0, rest[1] - rest[0]), k[h], d - rest[1]);
    else for (const h of [0, 1]) MF[h] = mfAfter(MF[h], k[h], d);
    t += d;
    if (t >= lim) return t;
  }
  return Infinity;
}

export class Bot {
  constructor(sim, name = 'good', seed = 1) {
    this.sim = sim; this.name = name; this.P = PROFILES[name] || PROFILES.good;
    this.rng = mulberry32((seed * 7919 + 13) >>> 0);
    this.at = 0; this.cache = null; this.waitRest = new Map(); this.recheck = 0;
  }
  gauss() { return Math.sqrt(-2 * Math.log(this.rng() + 1e-12)) * Math.cos(6.2831853 * this.rng()); }
  tap(h) { if (this.P.miss && this.rng() < this.P.miss) h = 1 - h; return this.sim.take(h); }
  update() {
    const s = this.sim, P = this.P;
    if (s.end || s.t < this.at) return;
    this.at = s.t + P.think * (0.7 + 0.6 * this.rng());
    if (!s.loading() && (!s.rest || s.rest.phase === 'down')) this.cache = null;
    if (P.masher) return this.mash();
    if (s.loading() || (s.rest && s.rest.phase !== 'down')) return this.pickup();
    if (s.rest || s.act || P.lazy) return;
    this.walk();
  }
  mash() {
    const s = this.sim, r = this.rng();
    if (r < 0.72) s.take(this.rng() < 0.5 ? 0 : 1);
    else if (r < 0.8) s.down();
    else if (r < 0.9) s.up();
  }

  // ---------- on the move ----------
  walk() {
    const s = this.sim, P = this.P, st = s.step;
    if (st.k === 'wait' && this.restAtWait()) { s.down(); return; }
    if (s.passQ.length) return;
    let cur = [s.H[0].bags.slice(), s.H[1].bags.slice()];
    if (s.pass) cur = moveN(cur, s.pass.from, 1);
    const opts = [{ c: cur, n: 0, to: null }, ...options(cur)];
    let best = null;
    for (const o of opts) {
      o.p = plan(this.sim, o.c, P);
      o.e = endurance(s, o.c, P, P.warn + 1);
      o.v = score(o.p, P) + (o.e < P.warn + o.n * T_PASS ? 60 : 0) + o.n * 0.05 + (P.noise ? this.gauss() * P.noise : 0);
      if (!best || o.v < best.v) best = o;
    }
    // a hand is about to give whatever you do: put it all down and let them come back
    if (best.e < P.warn + best.n * T_PASS && st.k !== 'act') { s.down(); return; }
    if (best.n > 0) { this.tap(best.to); return; }
    const f = best.p.first;
    if (f && f.e != null && f.passes > 0 && f.at <= f.passes * T_PASS + P.lead + this.gauss() * P.sd) this.tap(1 - f.e);
  }
  restAtWait() {
    const s = this.sim, P = this.P, st = s.step;
    if (!this.waitRest.has(s.si)) this.waitRest.set(s.si, this.rng() < P.waits);
    if (!this.waitRest.get(s.si)) return false;
    const n = s.held();
    if (s.H[0].MF + s.H[1].MF < 0.03) return false;
    return this.left() > tDown(n) + tUp(n) + 1.5;
  }
  // seconds of waiting still to come (with the lift's open doors, the time before they close)
  left() {
    const s = this.sim, st = s.step;
    if (st.k !== 'wait') return 0;
    const pad = st.door === 'auto' ? st.win : 0;
    let t = s.win ? pad - s.win.t : s.waitT - s.sp + pad;
    for (let j = s.si + 1; s.steps[j] && s.steps[j].k === 'wait'; j++) t += s.steps[j].T;
    return t;
  }

  // ---------- loading and picking up ----------
  pickup() {
    const s = this.sim, P = this.P;
    if (P.lazy) { if (s.loading()) s.down(); else s.up(); return; }
    const left = s.waiting(), q = s.grabQ.length;
    if (!left.length || q >= left.length) return;
    if (!this.cache || !left.every((b) => this.cache.has(b.i))) {
      if (s.rest && s.rest.phase === 'idle') {
        if (s.t < this.recheck) return;
        this.recheck = s.t + 0.4;
        if (!this.ready()) return;
      }
      const a = this.assign();
      this.cache = new Map(left.map((b, k) => [b.i, a.hands[k]]));
    }
    this.tap(this.cache.get(left[q].i));
  }
  ready() {
    const s = this.sim, P = this.P, n = s.waiting().length;
    if (s.step.k === 'wait') return this.left() <= tUp(n) + P.think * 2 + 0.5;
    if (s.H[0].MF + s.H[1].MF < 0.02) return true;
    const a = this.assign(true);
    return a.e >= P.goal;
  }
  // which hand each bag still down should go to, trying ways of sharing them out
  assign(quick = false) {
    const s = this.sim, P = this.P, left = s.waiting().map((b) => b.i), n = left.length;
    const cur = [s.H[0].bags.slice(), s.H[1].bags.slice()];
    if (s.grab) cur[s.grab.to].push(s.grab.bag);
    const masks = new Set();
    const lim = quick ? Math.min(P.samples, 24) : P.samples;
    if (1 << n <= lim) for (let m = 0; m < 1 << n; m++) masks.add(m);
    else {
      const kgs = left.map((i) => s.bags[i].kg);
      for (let k = 0; k <= n; k++) { masks.add((1 << k) - 1); masks.add(((1 << n) - 1) ^ ((1 << k) - 1)); }
      let m = 0, a = s.load(0), b = s.load(1);
      left.forEach((_, k) => { if (a > b) { m |= 1 << k; b += kgs[k]; } else a += kgs[k]; });
      masks.add(m);
      if (s.rest) { let r = 0; left.forEach((i, k) => { if (s.rest.prev[1].includes(i)) r |= 1 << k; }); masks.add(r); }
      while (masks.size < lim) masks.add(Math.floor(this.rng() * (1 << n)));
    }
    const from = s.loading() ? s.si + 1 : s.si;
    let best = null;
    const elim = Math.max(P.goal, P.warn) + 1;
    for (const m of masks) {
      const c = [cur[0].slice(), cur[1].slice()];
      left.forEach((b, k) => c[(m >> k) & 1].push(b));
      const p = plan(s, c, P, P.K, { from, t0: tUp(n) });
      const e = endurance(s, c, P, elim, from);
      const v = score(p, P) + (e < P.goal ? 3 * (P.goal - e) : 0) + (P.noise ? this.gauss() * P.noise : 0);
      if (!best || v < best.v) best = { m, p, v, e };
    }
    return { hands: left.map((_, k) => (best.m >> k) & 1), p: best.p, e: best.e };
  }
}

export function playOut(lv, name = 'good', seed = 1, { maxT = 600 } = {}) {
  const sim = new Sim(lv, { seed }), bot = new Bot(sim, name, seed);
  while (!sim.end && sim.t < maxT) { bot.update(); sim.tick(DT); sim.drain(); }
  return { sim, end: sim.end, stars: sim.stars(), t: sim.t, stats: sim.stats };
}
