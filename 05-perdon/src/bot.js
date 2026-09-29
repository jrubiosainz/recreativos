// Players of different skill, used to balance the six trips. They read what a player reads on screen
// (where each face is turned, who is on the phone, who walks your way and how slowly, the runner's
// warning, the pillars and the turnstile lamps) and they react late: about a fifth of a second for a
// good player, twice that for a beginner.
//   skilled  reads every glance and goes the other way; asks the slow ones and the dithering one
//   average  looks a few metres ahead and reads most glances
//   novice   sees people late and steps to their own right, glance or no glance
//   random   steps any old way now and then
//   masher   says «perdón» and steps as fast as the keys allow
//   dancer   follows everybody on purpose (to prove the rumba can be had)
import { mulberry32 } from './util.js';

const PROF = {
  skilled: { dt: 0.08, react: 0.2, look: 10, read: 0.95, err: 0.02, askWait: 0.5, hyst: 0.35, ask: 0.7 },
  average: { dt: 0.12, react: 0.32, look: 7.5, read: 0.72, err: 0.1, askWait: 0.9, hyst: 0.45, ask: 0.4 },
  novice: { dt: 0.18, react: 0.45, look: 5, read: 0.5, err: 0.25, askWait: 1.8, hyst: 0.6, ask: 0.15 },
  dancer: { dt: 0.1, react: 0.22, look: 8, read: 0, err: 0, askWait: 0.8, hyst: 0.4, ask: 0 },
};
const HARD = new Set(['zombie', 'group']);

export class Bot {
  constructor(sim, kind = 'skilled', seed = 1) {
    this.sim = sim; this.kind = kind; this.r = mulberry32(seed * 7919 + 17);
    this.p = PROF[kind] || null; this.q = []; this.next = 0; this.seenTell = null; this.readOf = new Map();
  }
  update() {
    const sim = this.sim, t = sim.t;
    while (this.q.length && this.q[0].at <= t) {
      const a = this.q.shift().act;
      if (a === 'ask') sim.ask(); else sim.move(a === 'L' ? -1 : 1);
    }
    if (t < this.next || this.q.length || sim.end) return;
    if (this.kind === 'random') { this.next = t + 0.3 + this.r() * 0.5; const k = this.r(); if (k < 0.5) this.push(k < 0.25 ? 'L' : 'R', 0); return; }
    if (this.kind === 'masher') { this.next = t + 0.1 + this.r() * 0.06; const k = this.r(); this.push(k < 0.34 ? 'L' : k < 0.67 ? 'R' : 'ask', 0); return; }
    this.next = t + this.p.dt;
    const act = this.decide();
    if (act) this.push(act, this.p.react * (0.8 + 0.4 * this.r()));
  }
  push(act, delay) { this.q.push({ at: this.sim.t + delay, act }); }

  decide() {
    const sim = this.sim, P = sim.P, p = this.p, t = sim.t, R = sim.route;
    if (t < P.stagger) return null;
    if (P.dance) return this.dance();
    if (t - P.stepAt < P.stepDur) return null;
    if (this.r() < p.err * p.dt) { const s = this.r() < 0.5 ? -1 : 1; if (R.open(P.z, P.lane + s, 1)) return s < 0 ? 'L' : 'R'; }
    if (this.kind === 'dancer') { const d = this.seek(); if (d) return d; }
    // someone in the way right in front that a word would move
    const front = this.front();
    if (front && this.r() < p.ask) {
      const a = front.a, g = front.gap;
      if (a.dir < 0 && a.kind === 'espejo' && a.st === 'dither' && g < 5) return 'ask';
      if (a.dir < 0 && a.kind === 'couple' && (a.st === 'stuck' || (a.st === 'walk' && g < 3.2)) && !a.grp[0].split) return this.better() ? this.better() : 'ask';
      if (a.dir < 0 && a.kind === 'group' && g < 3.4 && !a.grp.tucked) return this.better(1.5) || 'ask';
    }
    const b = this.better();
    if (b) return b;
    const B = P.blockBy;
    if (B && !B.deaf && t - P.blockT > p.askWait && B.askAt == null && t - P.askAt > 1.2 && !(t - (B.cant ?? -9) < 3)) return 'ask';
    return null;
  }
  front() {
    const sim = this.sim, P = sim.P;
    let best = null;
    for (const a of sim.agents) {
      if (a.gone || Math.abs(a.x - P.x) > 0.62) continue;
      const gap = a.z - a.back - P.z;
      if (gap > 0 && gap < 2.6 && (!best || gap < best.gap)) best = { a, gap };
    }
    return best;
  }
  // the lane to head for, one step at a time; null to stay
  better(extra = 0) {
    const sim = this.sim, P = sim.P, R = sim.route, p = this.p, b = R.band(P.z);
    const here = this.cost(P.lane) - extra;
    let best = P.lane, bc = here;
    for (let L = Math.max(0, b[0] - 1); L <= Math.min(6, b[1] + 1); L++) {
      if (L === P.lane) continue;
      const c = this.cost(L) + 0.35 * Math.abs(L - P.lane);
      if (c < bc - p.hyst) { bc = c; best = L; }
    }
    if (best === P.lane) return null;
    const s = Math.sign(best - P.lane), nxt = P.lane + s;
    if (R.sideBlocked(P.z, P.lane, nxt) || sim.occupant(nxt)) return null;
    if (nxt !== best && this.cost(nxt) > 4) return null;
    return s < 0 ? 'L' : 'R';
  }
  cost(L) {
    const sim = this.sim, P = sim.P, R = sim.route, p = this.p;
    if (!R.open(P.z, L, 1) || !R.open(P.z + 0.35, L, 1)) return Infinity;
    let c = 0;
    const blk = R.blockAhead(P.z, L, 1, 6);
    if (blk < 6) c += 5 * (1 - blk / 6.5);
    for (let d = 0.5; d <= 5; d += 0.5) if (!R.inBand(P.z + d, L)) { c += 2.5 * (1 - d / 6); break; }
    const novice = this.kind === 'novice';
    for (const a of sim.agents) {
      if (a.gone) continue;
      const gap = a.z - P.z, inL = a.lane === L || Math.abs(a.x - L) < 0.6;
      if (a.dir < 0) {
        if (gap < -0.3 || gap > p.look || a.passed) continue;
        const near = 0.4 + (1 - gap / p.look);
        if (HARD.has(a.kind)) { if (inL) c += 5 * near; continue; }
        if (a.kind === 'couple') {
          if (a.grp[0].split) continue;
          if (inL) c += (a.st === 'walk' && gap > 5 ? 1.2 : a.st === 'go' || a.st === 'clear' ? 4 : 5) * near;
          else if (a.st === 'tell' && a.tell && a.grp.some((m) => m.lane + a.tell === L)) c += 4 * near;
          continue;
        }
        const ttc = (gap - 0.62) / Math.max(0.5, P.v + a.v);
        const reads = this.kind === 'dancer' || this.reads(a);
        if (a.st === 'tell' && a.tell) {
          if (L === a.lane + (reads ? a.tell : -a.tell)) c += 5 * near;   // a misread glance: they think it is the other way
          else if (L === a.lane) c += L === P.lane ? 0.2 : 3;
        } else if (a.st === 'go' || a.st === 'clear' || a.st === 'stuck' || a.st === 'dance') {
          if (inL) c += (reads ? 4.5 : 1.5) * near;
        } else if (a.st === 'dither') {
          if (inL) c += 2.5 * near;
        } else if (inL) c += ttc < 1.1 ? 5 : ttc < 2.4 ? 1.1 : 0.5;
      } else {
        if (a.kind === 'runner') { if (gap < 0.8 && gap > -8 && (a.lane === L || Math.abs(a.x - L) < 0.7)) c += 6; continue; }
        if (gap < -0.4 || gap > p.look) continue;
        if (inL) c += (Math.max(0, 1.5 - a.v) / 1.5 * 4 + (a.deaf ? 0.6 : 0) + (a.kind === 'stander' ? 1 : 0)) * (0.35 + 0.65 * (1 - gap / p.look));
      }
    }
    if (novice) c += L > P.lane ? -0.15 : 0.15;          // beginners keep to their right
    return c;
  }
  // is this glance read right? Decided once per glance: a player either catches it or does not
  reads(a) {
    const key = a.id * 4096 + Math.round(a.t0 * 20);
    let r = this.readOf.get(key);
    if (r == null) { r = this.r() < this.p.read; this.readOf.set(key, r); }
    return r;
  }
  // face to face: read where they look and go the other way (or stand still and let them)
  dance() {
    const sim = this.sim, P = sim.P, D = P.dance, R = sim.route;
    if (D.phase !== 'tell') return null;
    const key = `${D.k}:${D.side}:${D.t0.toFixed(2)}`;
    if (this.seenTell === key) return null;
    this.seenTell = key;
    const free = (s) => R.open(P.z, P.lane + s, 1) && !R.sideBlocked(P.z, P.lane, P.lane + s) && !sim.occupant(P.lane + s);
    if (!D.side) { for (const s of [1, -1]) if (free(s)) return s < 0 ? 'L' : 'R'; return null; }
    if (this.kind === 'dancer') return free(D.side) ? (D.side < 0 ? 'L' : 'R') : null;
    if (this.r() >= this.p.read) return free(D.side) ? (D.side < 0 ? 'L' : 'R') : null;   // misread: follow them
    if (free(-D.side) && this.r() < 0.6) return D.side > 0 ? 'L' : 'R';
    if (this.kind === 'skilled' && this.r() < 0.15) return 'ask';
    return null;
  }
  // the dancer goes looking for trouble: whoever has just stepped aside, step there too
  seek() {
    const sim = this.sim, P = sim.P;
    for (const a of sim.agents) {
      if (a.gone || a.dir > 0 || !['polite', 'tourist', 'espejo'].includes(a.kind) || a.passed) continue;
      const gap = a.z - P.z;
      if ((a.st === 'go' || a.st === 'clear') && gap > 1.9 && gap < 4.5 && Math.abs(a.lane - P.lane) === 1 && !sim.occupant(a.lane)) return a.lane < P.lane ? 'L' : 'R';
    }
    return null;
  }
}

export function playOut(sim, kind = 'skilled', seed = 1, dt = 1 / 120) {
  const bot = kind === 'idle' ? null : new Bot(sim, kind, seed);
  while (!sim.end) { bot?.update(); sim.tick(dt); sim.drain(); }
  return sim;
}
