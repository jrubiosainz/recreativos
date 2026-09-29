// Players of different skill, used to balance the album. They only read what a player can see on
// screen (eyes, gazes, mouths, cloud shadows, pigeons, the self-timer lamp) and they see it late: a
// person needs about a fifth of a second between seeing and tapping.
//   skilled  watches every face and every tell, times the sun, the birds and the self-timer
//   average  keeps an eye on a handful of faces, waits a moment after the «¡patata!»
//   novice   shoots on the «¡patata!», like everybody does at first
//   random   presses at any old moment
//   masher   presses as fast as the camera lets them
import { mulberry32 } from './util.js';

const HIST = 64;
const EXEMPT = new Set(['baby', 'dog', 'toddler']);

export class Bot {
  constructor(sim, kind = 'skilled', seed = 1) {
    this.sim = sim; this.kind = kind; this.r = mulberry32(seed * 7919 + 13);
    this.delay = { skilled: 0.19, average: 0.24, novice: 0.26, random: 0.2, masher: 0.2 }[kind];
    this.hist = []; this.plan = null; this.good = 0; this.focus = null; this.focusT = 0; this.waitTo = 0;
  }

  seen(lag = 0) {
    const t = this.sim.t - this.delay - lag;
    let best = this.hist[0];
    for (const v of this.hist) if (v.t <= t) best = v;
    return best;
  }

  // everything an expert checks before pressing the shutter
  sharp(v) {
    // a glance is not a look: the eyes must have settled on the camera
    const before = this.seen(0.15);
    if (before) for (const p of before.people) if (Math.abs(p.gx) > 0.2 || Math.abs(p.gy) > 0.25) return false;
    for (const p of v.people) {
      if (!p.present || (p.run && p.run.dir > 0)) return false;
      if (p.ap < 0.8 || p.blink) return false;
      if (Math.abs(p.gx) > 0.15 || Math.abs(p.gy) > 0.2) return false;
      if (p.cat === 'pat' || p.cat === 'talk' || p.cat === 'chat') return false;
      if (p.quiver > 0.15 || p.tear > 0.8 || p.squint > 0.2 || p.drowsy > 0.2) return false;
      if (!EXEMPT.has(p.kind) && p.smile < 0.55) return false;
    }
    return true;
  }

  // an average player looks at a few faces at a time and notices only the obvious
  glance(v) {
    if (!this.focus || v.t >= this.focusT) {
      const ids = v.people.filter((p) => p.present).map((p) => p.id);
      for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(this.r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
      // the newcomer the album page warns about is always watched
      const star = this.sim.ev.star;
      this.focus = new Set([...(star ? [star] : []), ...ids.filter((id) => id !== star).slice(0, star ? 4 : 5)]); this.focusT = v.t + 0.35;
    }
    for (const p of v.people) {
      if (!this.focus.has(p.id)) continue;
      if (!p.present || p.run) return false;
      if (p.ap < 0.6) return false;
      if (Math.abs(p.gx) > 0.26 || Math.abs(p.gy) > 0.3) return false;
      if (p.talk && p.mouth > 0.45 && p.cat !== 'pat') return false;
    }
    return true;
  }

  // how long from a call until the family can be photographed, as an expert learns by playing
  lead() {
    const s = this.sim, line = s.ev.timer ? 'call_n' : s.calls === 0 ? 'call_e' : s.patience === 1 ? 'call_b' : 'call_n';
    const E = 1 - s.calls / s.P, mood = E >= 0.66 ? 'e' : E >= 0.33 ? 'n' : 'b';
    let w = 0.6;
    for (const p of s.people) if (p.present && p.voice) { const c = s.clips[`pat_${p.id}_${mood}`]; if (c) w = Math.max(w, c.we + p.B.lag[1]); }
    return s.clips[line].we + 0.12 + w + 0.55;
  }

  wantCall() {
    const s = this.sim, k = this.kind;
    if (k === 'random' || k === 'novice' || k === 'masher') return true;
    if (s.ev.flash && s.t < s.flashT + (k === 'skilled' ? 4.5 : 2.8)) return false;
    if (s.bands) {
      const xs = s.people.map((p) => p.x), lo = Math.min(...xs) - 0.02, hi = Math.max(...xs) + 0.02;
      const inside = (T) => s.shade(T).some(([a, b]) => a <= lo && b >= hi);
      if (k === 'average') return inside(s.t + 2.5);
      // call so that the family is posing inside the shadow, not squinting in the sun
      const tw = s.t + this.lead();
      return inside(tw - 0.4) && inside(tw + 1.4);
    }
    if (s.flights) {
      if (k === 'average') return !s.flock();
      const tw = s.t + this.lead();
      return !s.flights.some((f) => f.start - 0.1 < tw + 1.4 && f.end + 0.4 > tw - 0.3);
    }
    return true;
  }

  tick() {
    const s = this.sim;
    this.hist.push(s.view());
    if (this.hist.length > HIST) this.hist.shift();
    if (s.end) return;
    const v = this.seen();
    if (!v) return;
    const k = this.kind;
    if (s.ev.timer) return this.timerTick(v);
    if (s.canCall) {
      if (this.ready()) { s.develop(); return; }
      if (this.wantCall()) { s.act(); this.plan = null; this.waitTo = 0; }
      return;
    }
    if (!s.canShoot) return;
    if (k === 'masher') { this.shoot(v, false); return; }
    if (k === 'random') {
      if (!this.plan && v.chorus && v.chorus.t0 === s.callT) this.plan = { t: s.callT + 0.4 + this.r() * (v.chorus.end + 4 - s.callT - 0.4) };
      if (!this.plan) return;
      if (s.t >= this.plan.t) this.shoot(v, false);
      return;
    }
    const done = v.chorus && v.t >= v.chorus.end && v.chorus.t0 === s.callT;
    if (k === 'novice') {
      // «¡patata!» — and click, as soon as most of the family has said it
      const fresh = v.chorus && v.chorus.t0 === s.callT && v.t > v.chorus.start + 0.3;
      const voiced = v.people.filter((p) => p.present && s.by[p.id].voice);
      if (fresh && voiced.filter((p) => p.cat === 'pat').length * 2 < voiced.length) this.shoot(v, false);
      return;
    }
    if (k === 'average') {
      if (!done) return;
      if (!this.plan) this.plan = { t: v.chorus.end + 0.45 + this.r() * 0.35 };
      // nobody misses a flock of pigeons taking off
      const f = s.flock(v.t);
      if (v.t >= this.plan.t && !(f && !f.warn) && this.glance(v)) this.shoot(v, true);
      return;
    }
    // skilled: let the cascade of blinks after the word go by, then take the first clean moment
    if (!done || v.t < v.chorus.end + 0.2) return;
    if (v.people.some((p) => p.blink)) { this.waitTo = v.t + 0.1; return; }
    if (v.t < this.waitTo) return;
    if (this.sharp(v)) this.shoot(v, true);
  }

  ready() {
    const k = this.kind;
    if (k === 'skilled') return this.good >= 1;
    if (k === 'average') return this.good >= 2;
    return false;
  }

  timerTick(v) {
    const s = this.sim, k = this.kind;
    if (s.canTimer) {
      if (this.ready()) { s.develop(); return; }
      if (k === 'random' || k === 'novice' || k === 'masher' || s.t > s.flashT + (k === 'skilled' ? 4.5 : 3)) { s.act(); this.plan = null; }
      return;
    }
    if (s.canCall && s.timer) {
      const left = s.timer.fire - s.t;
      if (!this.plan) {
        // an average player has a rough feel for how long the family takes; a novice calls when the beeping speeds up
        const want = { skilled: this.lead() + 0.9, average: this.lead() + 1.0, novice: 3.0, random: 1 + this.r() * 7, masher: 99 }[k];
        const jitter = { skilled: 0.12, average: 0.8, novice: 1.0, random: 0, masher: 0 }[k];
        this.plan = { left: want + (this.r() * 2 - 1) * jitter };
      }
      if (left <= this.plan.left) s.act();
    }
    // the photo takes itself: judge it by how everyone looked just before
    if (s.timer && !s.timer.fired && s.timer.fire - s.t < 1 / 120 + 1e-9) {
      if (k === 'skilled' ? this.sharp(v) : k === 'average' ? this.glance(v) : false) this.good++;
    }
  }

  shoot(v, look) {
    if (look && (this.kind === 'skilled' ? this.sharp(v) : this.glance(v))) this.good++;
    this.sim.act();
    this.plan = null;
  }
}

export function playOut(sim, kind, seed, maxT = 300) {
  const bot = new Bot(sim, kind, seed);
  while (!sim.end && sim.t < maxT) { sim.tick(1 / 120); bot.tick(); }
  if (!sim.end && sim.prints.length) sim.develop();
  return sim;
}
