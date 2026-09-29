// UN SOLO VIAJE: the rules. A deterministic, fixed-step simulation of carrying the whole shopping up
// in one trip. You walk on your own; what you decide is which hand holds which bag. Each hand is a
// muscle with the published three-compartment fatigue model for grip (Xia & Frey-Law 2008; grip
// parameters from Frey-Law, Looft & Heitsman 2012; rest multiplier from Looft, Herkert & Frey-Law
// 2018): what it can still hold drops while it holds, and only an empty hand gets it back. Every
// door wants a free hand on its side; with none you use your nose, your elbow, your bum or your
// foot, and it takes longer. When a hand holds more than it can, the outermost bag slips. On the
// stairs it rolls all the way down, and that is a second trip. Nothing here draws or plays.
import { BAG, flatten } from './levels.js';

export const GRIP = { F: 0.0098, R: 0.00064, r: 30, LD: 10, LR: 10 };
export const MVC = 40;     // kg one fresh hand can hook: an average adult grip
export const PACE = 3.5;   // muscle time runs 3.5× the clock: the stairs are shorter than yours, the fingers are not
export const V0 = 1.5, V_STAIRS = 0.6, V_DARK = 0.6, W_SLOW = 90, IMB = 0.18;
export const T_PASS = 0.3, T_PICK = 0.32, T_DOWN0 = 0.35, T_DOWN1 = 0.09, DT = 1 / 60;
export const AGAIN = 5, HONK_EVERY = 5;   // a missed lift or entryphone comes back this much later
export const ACT = {
  trunk: { fast: 0.8, cross: 0.8, fb: 'head', tfb: 2.2 },
  keys: { fast: 2.2, cross: 3.3, fb: 'crouch', tfb: 2.6 },
  keys2: { fast: 3.0, cross: 4.3, fb: 'crouch', tfb: 3.4 },
  push: { fast: 0.6, cross: 0.6, fb: 'bum', tfb: 2.0 },
  pull: { fast: 1.0, cross: 1.7, fb: 'foot', tfb: 3.6 },
  button: { fast: 0.5, cross: 1.0, fb: 'nose', tfb: 2.4 },
  switch: { fast: 0.4, cross: 0.8, fb: 'elbow', tfb: 1.8 },
};
export const FALLBACKS = ['head', 'crouch', 'bum', 'foot', 'nose', 'elbow'];
export const SIDE = { L: 0, R: 1 };
export const tDown = (n) => T_DOWN0 + T_DOWN1 * n;
export const tUp = (n) => T_PICK * n;

// how an act gets done with n[0] bags in the left hand and n[1] in the right
export function howFor(st, n) {
  const A = ACT[st.type], sd = st.side ? SIDE[st.side] : null;
  if (sd != null) {
    if (!n[sd]) return { how: 'fast', hand: sd, T: A.fast };
    if (!n[1 - sd]) return { how: 'cross', hand: 1 - sd, T: A.cross };
  } else if (!n[0] || !n[1]) return { how: 'fast', hand: n[1] ? 0 : 1, T: A.fast };
  const k = n[0] + n[1];
  if (A.fb === 'crouch') {
    const a = tDown(k), b = a + A.tfb;
    return { how: 'crouch', hand: sd ?? 1, T: b + tUp(k), a, b };
  }
  return { how: A.fb, hand: null, T: A.tfb };
}

function hand(id) { return { id, bags: [], MA: 0, MR: 1, MF: 0, TL: 0, kg: 0 }; }

export class Sim {
  constructor(lv, { seed = 1 } = {}) {
    this.lv = lv; this.seed = seed >>> 0;
    const f = flatten(lv);
    this.steps = f.steps; this.len = f.len;
    this.bags = lv.bags.map((k, i) => ({ i, k, kg: BAG[k].kg, fragile: BAG[k].fragile, at: 'trunk', broken: false }));
    this.H = [hand(0), hand(1)];
    this.t = 0; this.events = []; this.end = null;
    this.si = 0; this.sp = 0; this.s = 0; this.waitT = 0;
    this.act = null; this.rest = null; this.pass = null; this.grab = null;
    this.passQ = []; this.grabQ = []; this.wantRest = false; this.autoLoad = false;
    this.light = { until: -1, on: false }; this.again = 0; this.win = null;
    this.honkAt = lv.par; this.honks = 0;
    this.stats = { fast: 0, cross: 0, fb: {}, slips: 0, broken: [], rests: 0, restT: 0, gone: 0, passes: 0, dark: 0, darkT: 0, peak: [0, 0] };
    this.enter(0);
  }
  emit(e) { e.t = this.t; this.events.push(e); }
  drain() { const e = this.events; this.events = []; return e; }
  get step() { return this.steps[this.si]; }

  // ---------- reading the state ----------
  loading() { return !this.end && this.step.k === 'load'; }
  waiting() { return this.bags.filter((b) => b.at === 'trunk' || b.at === 'floor'); }
  held() { return this.H[0].bags.length + this.H[1].bags.length; }
  toGrab() { return this.waiting().length + (this.rest && this.rest.phase === 'down' ? this.held() : 0); }
  load(h) { let s = 0; for (const i of this.H[h].bags) s += this.bags[i].kg; return s; }
  cap(h) { return (1 - this.H[h].MF) * MVC; }
  margin(h) { return this.cap(h) - this.load(h); }
  carried() { return this.load(0) + this.load(1); }
  dark() { return this.step.lit === 'timer' && !this.light.on; }
  onStairs() { return this.step.k === 'walk' && !!this.step.stairs; }
  speed() {
    const a = this.load(0), b = this.load(1), W = a + b, imb = W > 0 ? Math.abs(a - b) / W : 0;
    return V0 * (1 - W / W_SLOW) * (1 - IMB * imb) * (this.onStairs() ? V_STAIRS : 1) * (this.dark() ? V_DARK : 1);
  }
  howFor(st) { return howFor(st, [this.H[0].bags.length, this.H[1].bags.length]); }
  // the steps ahead, with the metres to walk before each
  ahead(n = 6) {
    const out = [];
    let d = this.step.k === 'walk' ? this.step.len - this.sp : 0;
    for (let i = this.si + 1; i < this.steps.length && out.length < n; i++) {
      const st = this.steps[i];
      out.push({ st, i, d });
      if (st.k === 'walk') d += st.len;
    }
    return out;
  }
  nextAct() {
    for (let i = this.si; i < this.steps.length; i++) if (this.steps[i].k === 'act') return { st: this.steps[i], i };
    return null;
  }

  // ---------- what you can do ----------
  // this hand takes a bag: the next one out of the trunk or off the floor, or the other hand's outermost
  take(h) {
    if (this.end || (h !== 0 && h !== 1)) return false;
    if (this.loading() || this.rest) {
      if (this.grabQ.length >= this.toGrab()) return false;
      this.grabQ.push(h);
      if (this.rest && this.rest.phase === 'idle') this.rest.phase = 'up';
      return true;
    }
    if (this.passQ.length >= 3) return false;
    this.passQ.push(h);
    return true;
  }
  // put everything down; if it already is, pick it all up the way it was
  down() {
    if (this.end) return false;
    if (this.loading()) { this.autoLoad = true; return true; }
    if (this.rest) return this.rest.phase === 'down' ? false : this.up();
    if (this.act || !this.held()) return false;
    if (this.pass) { this.wantRest = true; this.passQ.length = 0; return true; }
    this.startRest('rest');
    return true;
  }
  up() {
    if (this.end) return false;
    if (this.loading()) { this.autoLoad = true; return true; }
    if (!this.rest) return false;
    this.rest.auto = true;
    if (this.rest.phase === 'idle') this.rest.phase = 'up';
    return true;
  }

  // ---------- the clock ----------
  tick(dt = DT) {
    if (this.end) return;
    this.t += dt;
    this.fatigue(dt);
    for (const h of [0, 1]) {
      const x = this.H[h];
      if (x.TL > this.stats.peak[h]) this.stats.peak[h] = x.TL;
      // setting it all down is controlled: the floor takes the weight as you lower it
      if (x.TL > 0 && x.TL > 1 - x.MF && !(this.rest && this.rest.phase === 'down')) { this.slip(h); if (this.end) return; }
    }
    this.lightTick();
    if (this.dark()) this.stats.darkT += dt;
    if (this.t >= this.honkAt) { this.emit({ type: 'honk', n: this.honks++ }); this.honkAt += HONK_EVERY; }
    if (this.rest) this.restTick(dt);
    this.handsTick(dt);
    this.stepTick(dt);
  }

  fatigue(dt) {
    const a = this.act, crouching = !!a && a.how === 'crouch' && a.t >= a.a && a.t < a.b;
    const r = this.rest, lower = r && r.phase === 'down' ? Math.max(0, 1 - r.t / r.T) : 1;
    const n = 4, h = dt / n;
    for (const x of this.H) {
      x.kg = 0;
      for (const i of x.bags) x.kg += this.bags[i].kg;
      x.TL = crouching ? 0 : (x.kg / MVC) * lower;
      const F = GRIP.F * PACE, R = GRIP.R * PACE * (x.TL === 0 ? GRIP.r : 1);
      for (let k = 0; k < n; k++) {
        let C;
        if (x.MA < x.TL) C = x.MR > x.TL - x.MA ? GRIP.LD * (x.TL - x.MA) : GRIP.LD * x.MR;
        else C = GRIP.LR * (x.TL - x.MA);
        const dMA = C - F * x.MA, dMR = -C + R * x.MF, dMF = F * x.MA - R * x.MF;
        x.MA += dMA * h; x.MR += dMR * h; x.MF += dMF * h;
        if (x.MR < 0) { x.MA += x.MR; x.MR = 0; }
        if (x.MF < 0) { x.MR += x.MF; x.MF = 0; }
      }
    }
  }

  // passing bags between hands while you walk, and picking them up from the trunk or the floor
  handsTick(dt) {
    if (this.pass) {
      this.pass.t += dt;
      if (this.pass.t >= T_PASS) {
        const p = this.pass, from = this.H[p.from].bags;
        this.pass = null;
        if (from[from.length - 1] === p.bag) {
          from.pop(); this.H[p.to].bags.push(p.bag); this.bags[p.bag].at = p.to; this.stats.passes++;
          this.emit({ type: 'passed', bag: p.bag, from: p.from, to: p.to });
        }
        if (this.wantRest) { this.wantRest = false; this.startRest('rest'); return; }
      }
    }
    if (!this.pass && this.passQ.length && !this.act && !this.rest && !this.loading()) {
      const to = this.passQ.shift(), from = 1 - to, fb = this.H[from].bags;
      if (fb.length) { this.pass = { bag: fb[fb.length - 1], from, to, t: 0 }; this.emit({ type: 'pass', bag: this.pass.bag, from, to }); }
      else this.emit({ type: 'empty', hand: from, to });
    }
    if (this.grab) {
      this.grab.t += dt;
      if (this.grab.t >= T_PICK) {
        const g = this.grab;
        this.grab = null;
        this.H[g.to].bags.push(g.bag); this.bags[g.bag].at = g.to;
        this.emit({ type: 'grabbed', bag: g.bag, to: g.to });
      }
    }
    const picking = this.loading() || (this.rest && this.rest.phase === 'up');
    if (!this.grab && picking) {
      const left = this.waiting();
      if (!left.length) return;
      let bag = left[0].i, to = null;
      if (this.grabQ.length) to = this.grabQ.shift();
      else if (this.rest && this.rest.auto) [bag, to] = this.autoNext(left) || [bag, null];
      else if (this.loading() && this.autoLoad) to = this.load(0) <= this.load(1) ? 0 : 1;
      if (to != null) {
        this.grab = { bag, to, t: 0 }; this.bags[bag].at = 'air';
        this.emit({ type: 'grab', bag, to });
      }
    }
  }

  // ↑: everything back the way it was, in the order it was hooked; what the tired hand can't take goes to the other
  autoNext(left) {
    const on = new Set(left.map((b) => b.i));
    let pick = this.rest.seq.find(([b]) => on.has(b));
    if (!pick) pick = [left[0].i, this.margin(0) >= this.margin(1) ? 0 : 1];
    const [b, h] = pick, kg = this.bags[b].kg;
    if (this.margin(h) >= kg + 0.5) return [b, h];
    if (this.margin(1 - h) >= kg + 0.5) return [b, 1 - h];
    return null;   // neither hand can take it yet: wait for them
  }

  startRest(reason, drop) {
    const prev = [this.H[0].bags.slice(), this.H[1].bags.slice()];
    if (drop) prev[drop.h].push(drop.bag);
    const seq = [];
    for (let k = 0; k < Math.max(prev[0].length, prev[1].length); k++) for (const h of [0, 1]) if (k < prev[h].length) seq.push([prev[h][k], h]);
    const n = this.held();
    this.rest = { phase: 'down', t: 0, T: tDown(n), prev, seq, auto: false, reason };
    this.passQ.length = 0; this.grabQ.length = 0; this.pass = null; this.wantRest = false;
    if (this.act) { this.emit({ type: 'actStop', act: this.act.type }); this.act = null; }
    if (reason === 'rest') this.stats.rests++;
    this.emit({ type: 'down', reason, n });
  }
  restTick(dt) {
    const r = this.rest;
    r.t += dt; this.stats.restT += dt;
    if (r.phase === 'down' && r.t >= r.T) {
      for (const x of this.H) { for (const i of x.bags) this.bags[i].at = 'floor'; x.bags.length = 0; }
      r.phase = this.grabQ.length || r.auto ? 'up' : 'idle';
      this.emit({ type: 'rested' });
    }
    if (r.phase !== 'down' && !this.grab && !this.waiting().length) {
      this.rest = null; this.grabQ.length = 0;
      this.emit({ type: 'up' });
    }
  }

  slip(h) {
    const x = this.H[h], bag = x.bags.pop(), b = this.bags[bag];
    x.kg = this.load(h); x.TL = x.kg / MVC;
    if (this.pass && this.pass.bag === bag) this.pass = null;
    this.stats.slips++;
    if (this.onStairs() && !this.rest) {
      b.at = 'lost';
      if (b.fragile) { b.broken = true; this.stats.broken.push(bag); }
      this.emit({ type: 'slip', bag, hand: h, stairs: true });
      return this.finish('tumble', { bag });
    }
    b.at = 'floor';
    this.emit({ type: 'slip', bag, hand: h, stairs: false });
    if (b.fragile && !b.broken) { b.broken = true; this.stats.broken.push(bag); this.emit({ type: 'break', bag }); }
    if (this.rest) {
      // it went while you were picking up: everything down again, and this time rest a bit
      const r = this.rest;
      if (r.phase !== 'down') {
        r.phase = 'down'; r.t = 0; r.T = tDown(this.held()); r.auto = false;
        this.grabQ.length = 0;
        this.emit({ type: 'down', reason: 'drop', n: this.held() });
      }
      return;
    }
    this.startRest('drop', { h, bag });
  }

  lightTick() {
    const on = this.t < this.light.until;
    if (on !== this.light.on) {
      this.light.on = on; this.emit({ type: 'light', on });
      if (!on && this.step.lit === 'timer') this.stats.dark++;
    }
  }

  // ---------- the route ----------
  enter(i) {
    this.si = i; this.sp = 0; this.act = null;
    const st = this.steps[i];
    if (!st) return;
    const pv = this.steps[i - 1];
    if (!pv || pv.room !== st.room) this.emit({ type: 'room', room: st.room, kind: this.lv.rooms[st.room].kind });
    if (st.k === 'wait') {
      this.win = null;
      this.waitT = st.T + (st.win ? this.again : 0);
      this.emit({ type: 'wait', what: st.what, T: this.waitT, who: st.who, to: this.lv.rooms[st.room].to });
    }
    if (st.k === 'end') this.finish('arrive');
  }
  next() { this.enter(this.si + 1); }

  stepTick(dt) {
    const st = this.step;
    if (!st || this.end) return;
    if (st.k === 'load') {
      if (!this.waiting().length && !this.grab && !this.rest) this.next();
      return;
    }
    if (st.k === 'wait') {
      this.sp += dt;
      if (this.sp < this.waitT) return;
      if (st.door && !this.win) { this.win = { t: 0 }; this.emit({ type: 'open', what: st.what, door: st.door }); }
      if (!this.rest && !this.pass) {
        this.win = null; this.emit({ type: 'waitEnd', what: st.what });
        return this.next();
      }
      if (this.win) {
        this.win.t += dt;
        if (st.door === 'auto' && this.win.t >= st.win) {
          // someone upstairs called the lift, or the buzzer stopped: back to the button
          this.stats.gone++; this.again = AGAIN; this.win = null;
          this.emit({ type: 'gone', what: st.what });
          return this.enter(this.si - 1);
        }
      }
      return;
    }
    if (this.rest) return;
    if (st.k === 'walk') {
      const v = this.speed();
      this.sp += v * dt; this.s += v * dt;
      if (this.sp >= st.len) { this.s -= this.sp - st.len; this.next(); }
      return;
    }
    if (st.k === 'act') {
      if (!this.act) {
        if (this.pass || this.passQ.length) return;
        const d = this.howFor(st);
        this.act = { ...d, type: st.type, what: st.what, side: st.side, t: 0 };
        this.emit({ type: 'act', act: st.type, what: st.what, side: st.side, how: d.how, hand: d.hand, T: d.T, a: d.a, b: d.b });
      }
      this.act.t += dt;
      if (this.act.t >= this.act.T) {
        const a = this.act;
        if (a.how === 'fast') this.stats.fast++;
        else if (a.how === 'cross') this.stats.cross++;
        else this.stats.fb[a.how] = (this.stats.fb[a.how] || 0) + 1;
        if (a.type === 'switch') { this.light.until = this.t + this.lv.light; this.lightTick(); }
        this.emit({ type: 'actEnd', act: a.type, what: a.what, how: a.how });
        this.next();
      }
    }
  }

  finish(why, extra = {}) {
    if (this.end) return;
    this.end = { why, t: this.t, ...extra };
    this.emit({ type: 'end', why });
  }
  stars() {
    const e = this.end, ok = !!e && e.why === 'arrive';
    return [ok, ok && !this.stats.broken.length, ok && e.t <= this.lv.par];
  }
}
