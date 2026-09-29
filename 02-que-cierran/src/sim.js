// ¡QUE CIERRAN! rules. Deterministic: same level + seed + inputs = same run. Drawing and sound only read it.
// One input, `tap`: beckon the next passenger when the doorway is free, push the one in it otherwise,
// point-and-call once the doors are shut.
import { TYPES, crowdScale } from './types.js';
import { mulberry32, clamp, lerp, TAU } from './util.js';

export const TUNE = {
  sub: 1 / 480,
  arrive: 3.0, // the train pulls in and opens its doors
  announce: 1.4, // melody over → "the doors are closing" → doors move
  travel: 1.5, // door travel, open to shut
  reach: 0.32, // how deep (normalised) your gloves still reach him
  win: { pe: 0.065, pl: 0.085, ge: 0.14, gl: 0.2 }, // perfect early/late, good early/late (s from his turn)
  gain: { start: 0.9, perfect: 1, good: 0.55, weak: 0.18, combo: 0.05, comboMax: 0.3 },
  lock: { push: 0.16, bump: 0.42, whiff: 0.2, bow: 1.25, beckon: 0.26, point: 0.6 },
  e0: 0.1, // a beckoned passenger backs in with a little push of his own
  free: 0.45, // walking in while the car still has room
  stall: 0.55, reopenTo: 0.3, reopen: 0.35, hold: 0.5, retravel: 1.0, maxStalls: 2,
  giveup: 0.8, point: 1.1, depart: 4.2, doorW: 1.3,
};

const Vn = (u, us) => (u >= us ? u * u : us * us + 2 * -us * (us - u));
const accel = (u, v, om, us, z) => (u >= us ? -om * om * u : -om * om * us) - 2 * z * om * v;
const easeIO = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

function buildQueue(L, rng) {
  const out = [];
  const mix = Object.entries(L.mix);
  const total = mix.reduce((s, [, w]) => s + w, 0);
  const script = L.queue || [];
  for (let i = 0; i < 48; i++) {
    let type = script[i];
    if (!type) {
      let r = rng() * total;
      type = mix[mix.length - 1][0];
      for (const [k, w] of mix) { if ((r -= w) <= 0) { type = k; break; } }
    }
    out.push({ id: i, type, look: (rng() * 2 ** 31) | 0, side: i % 2 ? 1 : -1 });
  }
  return out;
}

export class Sim {
  constructor(level, seed = 1) {
    this.L = level;
    this.rng = mulberry32(seed >>> 0);
    this.t = 0;
    this.phase = 'arrive'; // arrive | board | melody | closing | shisa | depart | done
    this.fill = level.fill0;
    this.events = [];
    this.queue = buildQueue(level, this.rng);
    this.qi = 0;
    this.cur = null;
    this.boarded = [];
    this.pending = [];
    this.combo = 0;
    this.stats = { perfect: 0, good: 0, weak: 0, bump: 0, whiff: 0, start: 0, pushes: 0, beckons: 0, incidents: 0, stalls: 0, giveups: 0, runners: 0, missed: 0, maxCombo: 0 };
    this.pusher = { act: 'idle', t: 0, lock: 0, q: null };
    this.doors = { p: 0, st: 'open', t: 0, from: 0, dur: 0, stalls: 0 };
    const A = TUNE.arrive, M = A + level.dwell, C = M + level.melody;
    this.T = { board: A, melody: M, close: C, move: C + TUNE.announce, sched: C + TUNE.announce + TUNE.travel };
    this.runners = (level.runners || []).map((dt) => ({ at: C + dt, done: false }));
    this.closedAt = null;
    this.delay = 0;
    this.pointAt = null;
    this.over = false;
    this.result = null;
  }

  emit(type, data = {}) { this.events.push({ type, t: this.t, ...data }); }

  // ---------- input ----------
  input(at = this.t) { this.pending.push({ at: Math.max(at, this.t) }); this.pending.sort((a, b) => a.at - b.at); }
  canBeckon() { return (this.phase === 'board' || this.phase === 'melody' || this.phase === 'closing') && this.t < this.T.move && this.doors.st === 'open' && !this.cur; }

  tap() {
    if (this.over) return 'over';
    if (this.phase === 'shisa') { if (this.pointAt == null) this.point(); return 'point'; }
    if (this.phase === 'arrive' || this.phase === 'depart' || this.phase === 'done') return 'ignored';
    if (this.pusher.lock > 0) return 'locked';
    this.stats.pushes++;
    if (!this.cur) {
      if (this.canBeckon()) return this.beckon();
      return this.act('whiff', TUNE.lock.whiff);
    }
    return this.push(this.cur);
  }

  act(q, lock) {
    this.pusher.act = q; this.pusher.t = 0; this.pusher.lock = lock; this.pusher.q = q;
    if (q === 'whiff') { this.stats.whiff++; this.emit('whiff', { p: this.cur }); }
    return q;
  }

  beckon() {
    const p = this.queue[this.qi++];
    this.stats.beckons++;
    this.activate(p, 'step');
    this.act('beckon', TUNE.lock.beckon);
    this.emit('beckon', { p: this.cur });
    return 'beckon';
  }

  activate(p, state) {
    const P = TYPES[p.type];
    const sc = crowdScale(this.fill);
    this.cur = {
      ...p, P, state, st: 0, u: 0, v: 0, e: 0,
      om: (TAU / (P.T || 1)) * sc.omega, need: (P.N || 1) * sc.need, us: P.us ?? -0.6, zeta: P.zeta ?? 0.02,
      lastTurn: -1, fresh: true, ph: this.rng() * TAU, ruined: false, fillAt: this.fill, pushes: 0, perfects: 0,
    };
  }

  energy(c = this.cur) { return c ? (c.v * c.v) / (c.om * c.om) + Vn(c.u, c.us) : 0; }

  // time until he stops coming at you (his outer turn), from the current state
  timeToTurn(c) {
    let u = c.u, v = c.v, t = 0;
    const h = 1 / 960;
    while (v < 0 && t < 2) { v += accel(u, v, c.om, c.us, c.zeta) * h; u += v * h; t += h; }
    return t;
  }

  // absolute time of his next outer turn, or of boarding if he gets in first (for bots and hints)
  nextTurn(c = this.cur) {
    if (!c || c.state !== 'swing') return null;
    let u = c.u, v = c.v, t = 0, sawOut = v < 0;
    const h = 1 / 960;
    while (t < 3) {
      const v0 = v;
      v += accel(u, v, c.om, c.us, c.zeta) * h; u += v * h; t += h;
      if (u >= 1) return { t: this.t + t, board: true };
      if (v0 < 0 && v >= 0 && sawOut) return { t: this.t + t, u };
      if (v < 0) sawOut = true;
    }
    return null;
  }

  push(c) {
    if (c.state === 'granny') { this.incident('granny', c); return 'incident'; }
    if (c.state !== 'swing') return this.act('whiff', TUNE.lock.whiff);
    const W = TUNE.win, G = TUNE.gain;
    const e = this.energy(c);
    let q, d = 0;
    if (c.u > TUNE.reach) q = 'whiff';
    else if (e < 0.03) q = 'start';
    else if (c.v < 0) { d = -this.timeToTurn(c); q = d >= -W.pe ? 'perfect' : d >= -W.ge ? 'good' : 'bump'; }
    else { d = c.fresh ? Infinity : this.t - c.lastTurn; q = d <= W.pl ? 'perfect' : d <= W.gl ? 'good' : 'weak'; }
    if (q === 'whiff') return this.act('whiff', TUNE.lock.whiff);

    c.pushes++;
    this.stats[q]++;
    let gain = 0;
    if (q === 'perfect') {
      this.combo++; c.perfects++;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      gain = (G.perfect + Math.min(G.comboMax, G.combo * (this.combo - 1))) / c.need;
    } else if (q !== 'start') this.combo = 0;
    if (q === 'start') gain = G.start / c.need;
    if (q === 'good') gain = G.good / c.need;
    if (q === 'weak') gain = G.weak / c.need;

    if (q === 'bump') {
      // he runs into your hands: his momentum is gone, and so is your rhythm
      c.v = Math.abs(c.v) * 0.12;
      this.act('bump', TUNE.lock.bump);
    } else {
      const e1 = e + gain;
      c.v = c.om * Math.sqrt(Math.max(0, e1 - Vn(c.u, c.us)));
      c.fresh = false;
      this.act(q, TUNE.lock.push);
    }
    this.emit('push', { q, d, combo: this.combo, p: c, e: this.energy(c) });
    if (c.P.rule === 'perfect' && q !== 'perfect' && q !== 'start' && !c.ruined) { c.ruined = true; this.incident('cake', c); }
    return q;
  }

  incident(kind, c) {
    this.stats.incidents++;
    this.combo = 0;
    this.act('bow', TUNE.lock.bow);
    this.emit('incident', { kind, p: c });
  }

  point() {
    this.pointAt = this.t;
    this.pusher.act = 'point'; this.pusher.t = 0; this.pusher.lock = TUNE.lock.point;
    this.emit('point');
  }

  // ---------- time ----------
  update(dt) {
    const end = this.t + dt;
    while (this.t < end - 1e-9 && !this.over) {
      while (this.pending.length && this.pending[0].at <= this.t + 1e-9) { this.pending.shift(); this.tap(); }
      this.tick(Math.min(TUNE.sub, end - this.t));
    }
  }

  tick(h) {
    this.t += h;
    const T = this.T;
    if (this.phase === 'arrive' && this.t >= T.board) { this.phase = 'board'; this.emit('open'); }
    if (this.phase === 'board' && this.t >= T.melody) { this.phase = 'melody'; this.emit('melody'); }
    if (this.phase === 'melody' && this.t >= T.close) { this.phase = 'closing'; this.emit('announce'); }
    const pu = this.pusher;
    pu.t += h;
    if (pu.lock > 0) pu.lock = Math.max(0, pu.lock - h);
    if (pu.lock <= 0 && pu.act !== 'idle' && pu.act !== 'point') pu.act = 'idle';

    if (this.cur) this.stepPassenger(this.cur, h);
    this.stepRunners();
    this.stepDoors(h);

    if (this.phase === 'shisa') {
      if (this.pointAt == null && !this.holdPoint && this.t - this.closedAt >= TUNE.point) this.point();
      if (this.pointAt != null && this.t - this.pointAt >= 0.75) { this.phase = 'depart'; this.departAt = this.t; this.emit('depart'); }
    }
    if (this.phase === 'depart' && this.t - this.departAt >= TUNE.depart) this.finish();
  }

  stepPassenger(c, h) {
    c.st += h;
    const P = c.P;
    if (c.state === 'step' || c.state === 'dash') {
      if (c.st >= P.step) {
        c.st = 0;
        if (c.state === 'dash' && this.doors.p > this.blockAt(c) - 0.04) { this.missRunner(c); return; }
        if (P.rule === 'nopush') c.state = 'granny';
        else if (this.fill < 1) c.state = 'free';
        else {
          c.state = 'swing';
          c.v = c.om * Math.sqrt(c.type === 'runner' ? P.e0 : TUNE.e0);
        }
        this.emit('atDoor', { p: c });
      }
      return;
    }
    if (c.state === 'free') {
      c.u = Math.min(1, c.st / TUNE.free);
      if (c.u >= 1) this.board(c);
      return;
    }
    if (c.state === 'granny') {
      // the crowd shuffles to make room for her; nothing you do makes it faster
      c.u = Math.min(1, c.st / (P.board * (1 + 0.25 * Math.max(0, this.fill - 1))));
      if (c.u >= 1) this.board(c);
      return;
    }
    if (c.state === 'giveup') {
      c.u = lerp(c.u, -1.6, 1 - Math.exp(-6 * h));
      if (c.st >= TUNE.giveup) { this.cur = null; this.emit('gone', { p: c }); }
      return;
    }
    if (c.state !== 'swing') return;
    const om = P.wobble ? c.om * (1 + P.wobble * Math.sin(c.st * 0.9 + c.ph)) : c.om;
    const v0 = c.v;
    c.v += accel(c.u, c.v, om, c.us, c.zeta) * h;
    c.u += c.v * h;
    if (v0 < 0 && c.v >= 0) { c.lastTurn = this.t; c.fresh = false; this.emit('turn', { p: c, u: c.u }); }
    if (v0 > 0 && c.v <= 0) this.emit('squeak', { p: c, u: c.u, e: this.energy(c) });
    if (c.u >= 1) this.board(c);
  }

  board(c) {
    c.state = 'in'; c.u = 1;
    this.fill += c.P.fill;
    this.boarded.push(c);
    this.cur = null;
    const D = this.doors;
    this.emit('board', { p: c, fill: this.fill, late: D.st !== 'open' });
    if (D.st === 'stall' || D.st === 'reopen' || D.st === 'hold') this.closeDoors(D.p);
  }

  stepRunners() {
    for (const r of this.runners) {
      if (r.done || this.t < r.at) continue;
      if (this.doors.st === 'closed' || this.phase === 'shisa' || this.phase === 'depart') { r.done = true; continue; }
      if (this.cur) continue;
      r.done = true;
      this.stats.runners++;
      this.activate({ id: 900 + this.stats.runners, type: 'runner', look: (this.rng() * 2 ** 31) | 0, side: this.rng() < 0.5 ? -1 : 1 }, 'dash');
      this.emit('runner', { p: this.cur });
    }
  }

  missRunner(c) {
    this.stats.missed++;
    this.cur = null;
    this.emit('missed', { p: c });
  }

  blockAt(c) { return 1 - c.P.w / TUNE.doorW; }

  closeDoors(from) {
    const D = this.doors;
    D.st = 'closing'; D.t = 0; D.from = from;
    D.dur = from > 0 ? TUNE.retravel * (1 - from) / (1 - TUNE.reopenTo) : TUNE.travel;
  }

  stepDoors(h) {
    const D = this.doors;
    if (D.st === 'open' && this.t >= this.T.move) { this.closeDoors(0); this.emit('doors'); }
    if (D.st === 'closing') {
      D.t += h;
      const k = clamp(D.t / D.dur);
      D.p = lerp(D.from, 1, easeIO(k));
      const c = this.cur;
      if (c && c.state !== 'dash' && c.state !== 'in' && D.p >= this.blockAt(c)) {
        D.p = this.blockAt(c); D.st = 'stall'; D.t = 0; D.stalls++; this.stats.stalls++;
        this.lateCause ??= c.type;
        this.emit('stall', { p: c, n: D.stalls });
      } else if (k >= 1) {
        D.p = 1; D.st = 'closed';
        this.closedAt = this.t;
        this.delay = Math.max(0, this.t - this.T.sched);
        this.phase = 'shisa';
        if (this.cur?.state === 'dash') this.missRunner(this.cur);
        this.emit('closed', { delay: this.delay });
      }
    } else if (D.st === 'stall') {
      D.t += h;
      if (D.t >= TUNE.stall) { D.st = 'reopen'; D.t = 0; D.from = D.p; this.emit('reopen'); }
    } else if (D.st === 'reopen') {
      D.t += h;
      D.p = lerp(D.from, TUNE.reopenTo, easeIO(clamp(D.t / TUNE.reopen)));
      if (D.t >= TUNE.reopen) {
        D.st = 'hold'; D.t = 0;
        const c = this.cur;
        if (c && D.stalls >= TUNE.maxStalls && c.state !== 'in') {
          c.state = 'giveup'; c.st = 0; this.stats.giveups++;
          this.emit('giveup', { p: c });
        }
      }
    } else if (D.st === 'hold') {
      D.t += h;
      if (D.t >= TUNE.hold && this.cur?.state !== 'giveup') this.closeDoors(D.p);
    }
  }

  finish() {
    this.phase = 'done';
    this.over = true;
    const L = this.L;
    const pct = Math.round(this.fill * 100);
    this.result = {
      fill: pct, target: Math.round(L.target * 100), gold: Math.round(L.gold * 100),
      pass: pct >= Math.round(L.target * 100), onTime: this.delay < 0.05, goldOk: pct >= Math.round(L.gold * 100),
      delay: this.delay, incidents: this.stats.incidents, boarded: this.boarded.length,
      maxCombo: this.stats.maxCombo, stats: { ...this.stats },
    };
    this.emit('end', { result: this.result });
  }
}
