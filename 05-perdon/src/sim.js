// PERDÓN, PERDÓN: the rules. A deterministic, fixed-step simulation of one trip across the station.
// You walk up the corridor at a commuter's pace; everyone else walks their own way, and the polite
// ones try to get out of yours. Where they glance is where they will step. Follow them there once
// they have committed and you are dancing: both stop, both apologise, both try again… and on the
// fourth «perdón» it turns into a rumba. Nothing here draws or plays; it emits events.
import { clamp, smooth } from './util.js';
import { Route } from './route.js';
import { KIND, populate, pickLane } from './levels.js';

export const VP = 1.5, STEP = 0.24, CONTACT = 0.62, FACE = 1.0, NEAR = 2.4, T_DANCE = 0.8, ASK_R = 2.6, SPAWN = 17, RUMBA = 3.4;
export const DANCERS = new Set(['polite', 'tourist', 'espejo']);
const OVER = 0.62;      // two bodies overlap sideways closer than this, in lanes
const HOLD = 0.45;      // validating the ticket at a turnstile
const GATE_STOP = 0.42; // where you come to a stop in front of something in your lane
const LEAD = ['st', 'passed', 'stopUntil', 'hold', 'gates', 'ghost', 'tell', 'noticed', 'askAt', 'split', 'follow'];

const startStep = (a, to, dur, t) => { a.from = a.x; a.lane = to; a.stepAt = t; a.stepDur = dur; };
const stepping = (a, t) => t - a.stepAt < a.stepDur;
const onc = (a) => a.dir < 0;
const lanesOf = (a) => (a.grp ? a.grp.map((m) => m.lane) : [a.lane]);

export class Sim {
  constructor(lv, { seed = 1 } = {}) {
    this.lv = lv; this.seed = seed >>> 0;
    this.route = new Route(lv); this.len = this.route.len;
    const pop = populate(lv, this.seed);
    this.rng = pop.rng; this.pending = pop.on; this.runQ = pop.runners.slice();
    this.t = 0; this.events = []; this.agents = []; this.end = null; this.nid = 1; this.tick4 = 0;
    this.met = new Set(); this.waveT = -99;
    this.P = {
      id: 'you', dir: 1, z: 0, lane: lv.start, x: lv.start, from: lv.start, stepAt: -9, stepDur: STEP, v: 0, walk: 0, back: 0,
      stagger: -9, hold: 0, askAt: -9, buf: null, bounce: 0, bounceAt: -9, gates: new Set(), blockBy: null, blockT: 0,
      perdones: 0, asks: 0, bumps: 0, brushes: 0, blocked: 0, dances: [], rumbas: [], dance: null,
    };
    for (const c of pop.co) this.group(c, c.z0, c.lane, 1);
  }
  emit(e) { e.t = this.t; this.events.push(e); }
  drain() { const e = this.events; this.events = []; return e; }
  clockAt(t = this.t) { const [h, m, s] = this.lv.clock; return h * 3600 + m * 60 + s + t; }

  // ---------- people ----------
  mk(spec, z, lane, dir) {
    const K = KIND[spec.kind];
    const a = {
      id: this.nid++, kind: spec.kind, dir, z, lane, x: lane, from: lane, stepAt: -9, stepDur: K.step || 0.3,
      v0: spec.v, v: spec.v, see: spec.see, go: spec.go, rt: spec.rt, habit: spec.habit || -1, look: spec.look,
      st: 'walk', t0: 0, tell: 0, goAt: Infinity, passed: false, ghost: -9, stopUntil: -9, askAt: null, walk: 0,
      phone: !!K.phone, deaf: !!K.deaf, bag: K.bag ? { x: lane } : null, trolley: !!K.trolley, back: K.trolley ? 0.55 : 0,
      grp: null, role: 0, off: null, tuckAt: 0, wave: !!spec.wave, script: !!spec.script, stay: !!spec.stay, gone: false, hold: 0,
      gates: null, noticed: false, overAt: 0, blk: Infinity, rail: null,
    };
    this.agents.push(a);
    return a;
  }
  group(spec, z, lane, dir) {
    const n = KIND[spec.kind].size || 1, lead = this.mk(spec, z, lane, dir);
    if (n === 1) return lead;
    lead.grp = [lead];
    for (let i = 1; i < n; i++) {
      const m = this.mk({ ...spec, look: (spec.look * (i + 7) + i) >>> 0 }, z + (this.rng() - 0.5) * 0.16, lane + i, dir);
      m.grp = lead.grp; m.role = i; lead.grp.push(m);
    }
    return lead;
  }
  // is the spot clear for someone new to appear (and will their lanes still be there where you meet)
  spawnFree(z, lane, size, zm) {
    for (let i = 0; i < size; i++) {
      const l = lane + i;
      if (!this.route.open(z, l, -1) || !this.route.inBand(zm, l)) return false;
      for (const b of this.agents) if (!b.gone && Math.abs(b.x - l) < 0.8 && Math.abs(b.z - z) < 1.5) return false;
    }
    return true;
  }
  spawnDue() {
    const P = this.P;
    while (this.pending.length) {
      const s = this.pending[0];
      if (P.z < s.meet - SPAWN * VP / (VP + s.v)) break;
      this.pending.shift();
      const size = KIND[s.kind].size || 1, z = Math.min(P.z + SPAWN, this.len - 0.4);
      if (z < P.z + 6) continue;
      const zm = P.z + (z - P.z) * VP / (VP + s.v), b = this.route.band(zm);
      let lane = s.lane === 'you' ? clamp(P.lane, b[0], b[1] - size + 1) : typeof s.lane === 'number' ? s.lane : pickLane(this.rng, b, -1, size);
      let ok = this.spawnFree(z, lane, size, zm);
      for (let k = 0; k < 4 && !ok; k++) { lane = pickLane(this.rng, b, -1, size); ok = this.spawnFree(z, lane, size, zm); }
      if (!ok) continue;
      this.group(s, z, lane, -1);
      if (s.wave && this.t - this.waveT > 8) { this.waveT = this.t; this.emit({ k: 'wave' }); }
    }
    while (this.runQ.length && P.z >= this.runQ[0].at) {
      const r = this.runQ.shift(), z = P.z - 6.5, b = this.route.band(P.z);
      const lanes = [P.lane, P.lane - 1, P.lane + 1].filter((l) => l >= b[0] && l <= b[1] && this.route.open(z, l, 1));
      if (!lanes.length || z < 0.5) continue;
      const a = this.mk(r, z, lanes[Math.floor(this.rng() * Math.min(2, lanes.length))], 1);
      this.emit({ k: 'runner', id: a.id, lane: a.lane });
    }
  }
  // can `a` step into `lane` here? Open, not across a rail, nobody there along their way (nor you, unless o.you)
  freeFor(a, lane, o = {}) {
    const R = this.route, z = a.z, ahead = o.short ? 0.8 : 1.8;
    if (!R.open(z, lane, a.dir) || !R.open(z + a.dir * Math.min(ahead, 1.2), lane, a.dir)) return false;
    if (Math.abs(lane - a.lane) === 1 && R.sideBlocked(z, a.lane, lane)) return false;
    if (!o.npc) for (const b of this.agents) {
      if (b === a || b.gone || (a.grp && a.grp === b.grp)) continue;
      if (b.lane === lane || Math.abs(b.x - lane) < 0.75) { const d = (b.z - z) * a.dir; if (d > -0.8 && d < ahead) return false; }
    }
    const P = this.P;
    if (!o.you && (P.lane === lane || Math.abs(P.x - lane) < 0.7)) { const d = (P.z - z) * a.dir; if (d > -0.6 && d < 3) return false; }
    return true;
  }
  pickSide(a, pref = a.habit, o) {
    for (const s of [pref, -pref]) if (this.freeFor(a, a.lane + s, o)) return s;
    return 0;
  }
  // a pair or a group moves sideways as one: every lane open, nothing across a rail, the lane beyond its edge free
  canShift(a, s, d = 1.2, o = {}) {
    const R = this.route, g = a.grp || [a];
    for (const m of g) {
      if (!R.open(m.z, m.lane + s, m.dir) || !R.open(m.z + m.dir * d, m.lane + s, m.dir)) return false;
      if (R.sideBlocked(m.z, m.lane, m.lane + s)) return false;
    }
    for (const m of g) { const e = m.lane + s; if (!g.some((q) => q.lane === e) && !this.freeFor(m, e, o)) return false; }
    return true;
  }
  shift(a, s, dur) { for (const m of a.grp || [a]) startStep(m, m.lane + s, dur, this.t); }
  sideUnit(a) { for (const s of [a.habit, -a.habit]) if (this.canShift(a, s)) return s; return 0; }
  // the one in your lane tucks in behind (or, walking your way, ahead of) a neighbour and you slip through
  tuck(a) {
    const g = a.grp, t = this.t;
    if (!g || g.tucked || g.filed) return false;
    const n = g.length, r = a.role, into = g[r === 0 ? 1 : r === n - 1 ? n - 2 : r - 1];
    g.tucked = t;
    if (r === 0) {                                   // the first one steps out of line: the next one leads
      const A = g.shift(); g.push(A);
      for (const k of LEAD) g[0][k] = A[k];
      g.forEach((m, i) => { m.role = i; });
    }
    a.off = into.lane - g[0].lane; a.tuckAt = t;
    startStep(a, into.lane, 0.45, t);
    for (const m of g) m.ghost = Math.max(m.ghost, t + 1.6);
    this.emit({ k: 'tuck', id: a.id, kind: a.kind });
    return true;
  }
  // abreast at a stair rail with no room to all get to one side: they go single file
  file(a) {
    const g = a.grp, t = this.t, L = g[0];
    g.filed = t; a.rail = null;
    g.forEach((m, i) => { if (i > 0) { m.off = 0; m.fileK = i; m.tuckAt = t; startStep(m, L.lane, 0.45, t); } });
    this.emit({ k: 'file', id: L.id, kind: a.kind });
  }
  split(a) {
    const L = a.grp[0], t = this.t;
    if (L.split) return;
    L.split = t;
    for (const m of a.grp) m.ghost = t + 2.6;
    this.emit({ k: 'split', id: L.id, kind: a.kind });
  }

  // ---------- your input ----------
  move(side, auto = false) {
    const P = this.P, t = this.t;
    if (this.end || t < P.stagger || P.dance?.phase === 'rumba') return false;
    if (stepping(P, t) && !auto) {
      const k = (t - P.stepAt) / P.stepDur, rev = Math.sign(P.lane - P.from) === -side;
      if (!rev && k < 0.55) { P.buf = { side, t }; return false; }
    }
    const to = P.lane + side, R = this.route;
    if (!R.open(P.z, to, 1) || !R.open(P.z + 0.35, to, 1)) { if (!auto) { this.emit({ k: 'deny', why: R.inBand(P.z, to) ? 'block' : 'wall', side }); this.bounce(side); } return false; }
    const sb = R.sideBlocked(P.z, P.lane, to);
    if (sb) { if (!auto) { this.emit({ k: 'deny', why: sb, side }); this.bounce(side); } return false; }
    const who = this.occupant(to);
    if (who) {
      if (auto) return false;
      this.bounce(side); P.brushes++;
      this.perdon(1, 'brush', who);
      this.emit({ k: 'brush', id: who.id, kind: who.kind, side });
      return false;
    }
    startStep(P, to, STEP, t);
    this.emit({ k: 'step', side, auto });
    if (P.dance) this.danceStep(side);
    return true;
  }
  bounce(side) { this.P.bounce = side; this.P.bounceAt = this.t; }
  occupant(lane) {
    const P = this.P;
    for (const a of this.agents) {
      if (a.gone || (P.dance && P.dance.a === a)) continue;
      if (a.bag && Math.abs(a.bag.x - lane) < 0.6 && Math.abs(a.z + 0.75 - P.z) < 0.35) return a;
      if (a.lane !== lane && Math.abs(a.x - lane) > 0.6) continue;
      const d = a.z - P.z;
      if (d > -0.5 && d < 0.5 + a.back) return a;
    }
    return null;
  }
  ask() {
    const P = this.P, t = this.t;
    if (this.end || t < P.stagger || t - P.askAt < 0.45) return false;
    P.askAt = t;
    const D = P.dance;
    if (D) {
      if (D.phase === 'tell' && D.side) { D.tellAt = t - D.a.rt - 0.01; P.asks++; this.perdon(1, 'ask', D.a); this.emit({ k: 'ask', id: D.a.id, kind: D.a.kind, dance: true }); }
      return true;
    }
    let best = null, bg = ASK_R;
    for (const a of this.agents) {
      if (a.gone || Math.abs(a.x - P.x) > OVER) continue;
      const gap = a.z - a.back - P.z;
      if (gap > 0 && gap < bg) { best = a; bg = gap; }
    }
    if (!best) { this.emit({ k: 'ask', id: null }); return true; }
    P.asks++;
    this.perdon(1, 'ask', best);
    this.emit({ k: 'ask', id: best.id, kind: best.kind, deaf: best.deaf });
    this.answer(best);
    return true;
  }
  answer(a) {
    const t = this.t;
    if (a.deaf) return;
    if (a.kind === 'couple') { this.split(a); return; }
    if (a.grp) { this.tuck(a); return; }
    if (onc(a)) {
      if (['walk', 'tell', 'dither', 'stuck'].includes(a.st)) { a.st = 'tell'; a.tell = this.pickSide(a); a.goAt = t + 0.12; a.asked = true; if (!a.noticed) this.notice(a); }
      return;
    }
    if (a.kind !== 'runner') a.askAt = t;
  }

  // ---------- the clock ----------
  tick(dt) {
    if (this.end) return;
    this.t += dt;
    this.tick4 = (this.tick4 + 1) & 3;
    this.spawnDue();
    for (const a of this.agents) if (!a.gone) this.npc(a, dt);
    this.you(dt);
    if (!this.P.dance) this.contacts();
    if (this.tick4 === 0) this.cull();
    if (this.P.z >= this.len - 0.4) this.finish('arrive');
    else if (this.t >= this.lv.dep) this.finish('missed');
  }
  stepTo(T, dt = 1 / 120) { while (this.t < T - 1e-9 && !this.end) this.tick(dt); }
  cull() {
    const P = this.P;
    this.agents = this.agents.filter((a) => {
      if (a.gone) return false;
      if (a.z < P.z - 14 || (a.dir > 0 && a.z > this.len + 0.5) || (a.dir < 0 && a.z < -3)) { a.gone = true; return false; }
      return true;
    });
  }

  you(dt) {
    const P = this.P, t = this.t, R = this.route;
    const k = clamp((t - P.stepAt) / P.stepDur);
    P.x = P.from + (P.lane - P.from) * smooth(k);
    if (P.buf) { if (t - P.buf.t >= 0.2) P.buf = null; else if (k >= 0.55) { const s = P.buf.side; P.buf = null; this.move(s); } }
    if (P.dance) { this.danceTick(dt); P.v = 0; return; }
    // the corridor narrows ahead: you drift in with it
    if (!stepping(P, t) && t >= P.stagger && !R.inBand(P.z + 1.3, P.lane)) { const b = R.band(P.z + 1.3); this.move(P.lane < b[0] ? 1 : -1, true); }
    let v = VP * R.speedAt(P.z), why = null;
    if (t < P.stagger || t < P.hold) v = 0;
    // turnstiles: your ticket in, the validator stamps it, the paddles open
    for (const [i, g] of R.gates.entries()) {
      if (P.gates.has(i)) continue;
      const d = g.z - P.z;
      if (d < GATE_STOP + 0.03 && d > -0.2 && g.lanes[P.lane] === 'in' && Math.abs(P.x - P.lane) < 0.2) { P.gates.add(i); P.hold = t + HOLD; v = 0; this.emit({ k: 'gate', i, lane: P.lane }); }
    }
    // something fixed in your lane (a pillar, a closed turnstile): you stop in front of it
    const blk = R.blockAhead(P.z, Math.round(P.x), 1, 0.8);
    if (blk < 0.8) { v = Math.min(v, Math.max(0, (blk - GATE_STOP) * 4)); if (blk < GATE_STOP + 0.1) why = 'wall'; }
    // someone slower your way, right in front: you are stuck behind them
    for (const a of this.agents) {
      if (a.gone || a.dir < 0 || a.kind === 'runner' || Math.abs(a.x - P.x) > OVER) continue;
      const gap = a.z - a.back - P.z;
      if (gap > 0 && gap < 1.6) { const w = Math.max(0, a.v + (gap - CONTACT - 0.1) * 2.4); if (w < v) { v = w; why = a; } }
    }
    P.v = v < P.v ? v : Math.min(v, P.v + 2.8 * dt);
    P.z += P.v * dt; P.walk += P.v * dt;
    if (why && why !== 'wall' && t >= P.stagger && t >= P.hold) {
      P.blocked += dt;
      if (P.blockBy !== why) { P.blockBy = why; P.blockT = t; }
      else if (t - P.blockT > 0.7 && !why.blockSaid) { why.blockSaid = true; this.emit({ k: 'stuck', id: why.id, kind: why.kind }); }
    } else P.blockBy = null;
  }

  npc(a, dt) {
    const t = this.t, P = this.P, R = this.route;
    const k = clamp((t - a.stepAt) / a.stepDur);
    a.x = a.from + (a.lane - a.from) * smooth(k);
    if (a.bag) a.bag.x += (a.x - a.bag.x) * (1 - Math.exp(-dt / 0.42));
    if (a.grp && a.role > 0) { this.member(a, dt); return; }
    const gap = a.z - P.z;
    if (gap > 26 || gap < -12) { a.z += a.dir * a.v * dt; return; }
    if (!this.met.has(a.kind) && gap < 9 && gap > -7) { this.met.add(a.kind); this.emit({ k: 'meet', kind: a.kind, id: a.id }); }
    let v = a.v0 * R.speedAt(a.z);
    if (t < a.stopUntil || t < a.hold) v = 0;
    if (a.st === 'dance') v = 0;
    else if (onc(a)) v = this.oncoming(a, gap, v);
    else v = this.yourWay(a, gap, v);
    if (a.st !== 'dance') v = this.traffic(a, v);
    // nobody stays wedged in the crowd for ever: held up for a while, they squeeze through
    a.stall = v < 0.08 && a.v0 > 0 && a.st !== 'dance' && t >= a.stopUntil && t >= a.hold ? (a.stall || 0) + dt : 0;
    if (a.stall > 1.6) { a.stall = 0; a.squeeze = t + 1.4; }
    a.v = v; a.z += a.dir * v * dt; a.walk += v * dt;
  }
  member(a, dt) {        // pairs and groups keep abreast with their first member
    const L = a.grp[0], t = this.t;
    a.v = L.v; a.walk = L.walk;
    const tz = L.z + (a.off != null ? (a.fileK ? -a.dir * 0.95 * a.fileK : 0.95) * smooth((t - a.tuckAt) / 0.45) : 0);
    a.z += (tz - a.z) * (1 - Math.exp(-dt * 12));
    const want = L.lane + (a.off ?? a.role);
    if (!stepping(a, t) && a.lane !== want) { a.from = a.x; a.lane = want; a.stepAt = L.stepAt; a.stepDur = L.stepDur; }
    a.st = L.st; a.tell = L.tell; a.noticed = L.noticed;
  }
  notice(a) { a.noticed = true; this.emit({ k: 'notice', id: a.id, kind: a.kind, side: a.tell }); }
  // people toward you: notice you, glance, step aside. Or not, if they are on the phone.
  oncoming(a, gap, v) {
    const P = this.P, t = this.t;
    if (a.passed) return v;
    if (gap < -0.5) { a.passed = true; a.st = a.st === 'go' || a.st === 'clear' ? 'clear' : 'past'; a.tell = 0; return v; }
    const ttc = (gap - CONTACT) / Math.max(0.5, P.v + v);
    const same = a.grp ? a.grp.some((m) => m.lane === P.lane) : a.lane === P.lane;
    if (a.kind === 'zombie' || a.kind === 'group') { if (a.phone) this.phoneStop(a); return v; }
    if (a.kind === 'couple') return this.couple(a, gap, ttc, same, v);
    if (a.kind === 'espejo' && (a.st === 'walk' || a.st === 'dither')) return this.espejo(a, gap, ttc, same, v);
    switch (a.st) {
      case 'walk':
        if (same && gap > 0 && ttc < a.see && t >= a.ghost) {
          if (ttc < T_DANCE) { this.startDance(a, 'late'); return 0; }
          a.st = 'tell'; a.t0 = t; a.tell = this.pickSide(a); a.goAt = ttc < a.go + 0.3 ? t + 0.22 : Infinity;
          this.notice(a);
        }
        break;
      case 'tell':
        if (!same) {
          // you stepped the way they were looking, and too late for them to change their mind: they step there too
          if (P.lane === a.lane + a.tell && ttc < a.go + 0.45 && !a.asked) { this.commit(a, { you: true }); break; }
          a.st = 'walk'; a.tell = 0; break;                    // you moved first: they read you and keep their line
        }
        if (ttc < a.go || t >= a.goAt) this.commit(a);
        break;
      case 'go': if (!stepping(a, t)) a.st = 'clear'; // falls through: follow them there and it is a dance
      case 'clear':
        if (same && gap > 0 && t >= a.ghost) {
          if (gap < NEAR) { this.startDance(a, 'mirror'); return 0; }
          if (a.st === 'clear' && ttc > 1.15) { a.st = 'walk'; a.tell = 0; }   // you took their new lane from far off: they go round again
        }
        break;
      case 'stuck':
        if (!same) { a.st = 'walk'; break; }
        if (gap < FACE + 0.25) { this.startDance(a, 'stuck'); return 0; }
        if (((this.tick4 + a.id) & 3) === 0) { const s = this.pickSide(a); if (s) { a.tell = s; this.commit(a); break; } }
        return Math.min(v, Math.max(0, (gap - FACE) * 1.5));
    }
    return v;
  }
  commit(a, o) {
    let s = a.tell;
    if (!s || !this.freeFor(a, a.lane + s, o)) s = this.pickSide(a);
    if (!s) { if (a.st !== 'stuck') { a.st = 'stuck'; a.tell = 0; this.emit({ k: 'wait', id: a.id, kind: a.kind }); } return; }
    a.tell = s; a.st = 'go';
    startStep(a, a.lane + s, a.stepDur, this.t);
    this.emit({ k: 'dodge', id: a.id, kind: a.kind, side: s });
  }
  // the indecisive one: copies every move you make (from where they stand, a mirror) until they make up their mind
  espejo(a, gap, ttc, same, v) {
    const P = this.P, t = this.t;
    if (a.st === 'walk') {
      if (same && gap > 0 && ttc < a.see && t >= a.ghost) {
        if (ttc < T_DANCE) { this.startDance(a, 'late'); return 0; }
        a.st = 'dither'; a.t0 = t; a.decideAt = t + 1.0; a.watch = P.lane; a.mirrorAt = null;
        this.notice(a);
      }
      return v;
    }
    if (P.lane !== a.watch) {
      const side = Math.sign(P.lane - a.watch); a.watch = P.lane;
      if (ttc > 0.6) { a.mirrorAt = t + a.rt; a.mirrorSide = side; }
    }
    if (a.mirrorAt != null && t >= a.mirrorAt && !stepping(a, t)) {
      const to = a.lane + a.mirrorSide; a.mirrorAt = null;
      if (this.freeFor(a, to, { you: true, short: true })) {
        startStep(a, to, a.stepDur, t); a.decideAt = Math.max(a.decideAt, t + 0.75);
        this.emit({ k: 'mirror', id: a.id, side: a.mirrorSide });
      }
    }
    const nowSame = a.lane === P.lane;
    if (nowSame && gap > 0 && ttc < T_DANCE) { this.startDance(a, 'mirror'); return 0; }
    if (nowSame && t >= a.decideAt && !stepping(a, t)) { a.st = 'tell'; a.t0 = t; a.tell = this.pickSide(a); a.goAt = t + 0.3; }
    else if (!nowSame && a.mirrorAt == null && !stepping(a, t) && ttc < 0.6) a.st = 'past';
    return v;
  }
  couple(a, gap, ttc, same, v) {
    const t = this.t;
    if (a.split) return v;
    switch (a.st) {
      case 'walk':
        if (same && gap > 0 && ttc < a.see && t >= a.ghost) { a.st = 'tell'; a.t0 = t; a.tell = this.sideUnit(a); a.goAt = ttc < a.go + 0.3 ? t + 0.25 : Infinity; this.notice(a); }
        break;
      case 'tell':
        if (!same) { a.st = 'walk'; a.tell = 0; break; }
        if (ttc < a.go || t >= a.goAt) {
          const s = a.tell && this.canShift(a, a.tell) ? a.tell : this.sideUnit(a);
          if (!s) { a.st = 'stuck'; a.tell = 0; this.emit({ k: 'wait', id: a.id, kind: a.kind }); break; }
          a.tell = s; a.st = 'go';
          this.shift(a, s, a.stepDur);
          this.emit({ k: 'dodge', id: a.id, kind: a.kind, side: s });
        }
        break;
      case 'go': if (!stepping(a, t)) a.st = 'clear'; break;
      case 'stuck':
        if (!same) { a.st = 'walk'; break; }
        if (((this.tick4 + a.id) & 3) === 0) { const s = this.sideUnit(a); if (s) { a.tell = s; a.st = 'go'; this.shift(a, s, a.stepDur); this.emit({ k: 'dodge', id: a.id, kind: a.kind, side: s }); break; } }
        return Math.min(v, Math.max(0, (gap - FACE) * 1.5));
    }
    return v;
  }
  phoneStop(a) {         // eyes on the screen: now and then they stop dead to read something
    if (this.tick4 !== 1) return;
    if (this.t > a.stopUntil + 2 && this.rng() < 0.006) a.stopUntil = this.t + 0.7 + this.rng() * 0.8;
  }
  // people your way: they walk on; asked, they step aside after a moment (unless on the phone)
  yourWay(a, gap, v) {
    const t = this.t;
    if (a.kind === 'runner') return this.runner(a, v);
    if (a.phone) this.phoneStop(a);
    if (a.askAt != null && t >= a.askAt + (KIND[a.kind].askT || 0.4) && !stepping(a, t)) {
      a.askAt = null;
      const s = this.pickSide(a, 1, { you: true });
      if (s) { startStep(a, a.lane + s, a.stepDur, t); this.emit({ k: 'aside', id: a.id, kind: a.kind, side: s }); }
      else { a.cant = t; this.emit({ k: 'cant', id: a.id, kind: a.kind }); }
    }
    // co-flow at the turnstiles: ticket in, a moment, through
    for (const g of this.route.gates) {
      const d = g.z - a.z;
      if (d < GATE_STOP + 0.03 && d > 0.2 && g.lanes[a.lane] === 'in' && !(a.gates ||= new Set()).has(g)) { a.gates.add(g); a.hold = t + HOLD + this.rng() * 0.35; return 0; }
    }
    return a.kind === 'stander' ? 0 : v;
  }
  // in a hurry, from behind: round anybody in the way. Step into their lane when they are right behind you and you are knocked
  runner(a, v) {
    const t = this.t, P = this.P;
    if (t - (a.bumpAt ?? -9) < 0.5) return 0;
    let who = null, wd = 3.4;
    for (const b of this.agents) {
      if (b === a || b.gone || Math.abs(b.x - a.x) > 0.7) continue;
      const d = b.z - b.back - a.z;
      if (d > 0 && d < wd) { who = b; wd = d; }
    }
    if (!a.hit && Math.abs(P.x - a.x) < 0.7 && P.z - a.z > 0 && P.z - a.z < wd) { who = P; wd = P.z - a.z; }
    if (!who) return v;
    if (who === P && wd < 1.25) return v;                          // too late to do anything about it
    if (!stepping(a, t)) {
      for (const s of a.lane <= 3 ? [-1, 1] : [1, -1]) if (this.freeFor(a, a.lane + s, { short: true })) { startStep(a, a.lane + s, 0.22, t); return v; }
    }
    return Math.min(v, Math.max(who.dir > 0 ? who.v : 0, (wd - 0.9) * 3));
  }
  // everyone: the corridor narrows, a pillar or a closed turnstile ahead, a stair rail through a pair: move over early.
  // Somebody slower in front: follow, and after a moment overtake. Somebody head-on: keep to your side
  // (the ones walking your way hold their line unless the other one is not looking). Squeezing: ignore the crowd.
  traffic(a, v) {
    const R = this.route, t = this.t, P = this.P, g = a.grp || [a];
    const mine = ((this.tick4 + a.id) & 3) === 0, sq = t < (a.squeeze ?? -9);
    if (mine || a.blkAt === undefined) {
      a.blkAt = t;
      let blk = Infinity;
      for (const m of g) blk = Math.min(blk, R.blockAhead(a.z, m.lane, a.dir, 2.4));
      a.blk = blk;
      const ls = lanesOf(a);
      a.rail = g.length > 1 && !a.grp.filed ? R.railAhead(a.z, Math.min(...ls), Math.max(...ls), a.dir, 2.6) : null;
    }
    let held = false;
    if (!stepping(a, t)) {
      if (a.blk < 2.4) {
        const b = R.band(a.z + a.dir * a.blk), c = (b[0] + b[1]) / 2;
        let moved = false;
        for (const s of a.lane < c ? [1, -1] : [-1, 1]) if (this.canShift(a, s, a.blk + 0.3, { short: true, npc: sq })) { this.shift(a, s, 0.4); moved = true; break; }
        if (!moved && a.grp && !a.grp.filed && R.gateAt(a.z + a.dir * (a.blk + 0.05))) this.file(a);   // one at a time through the turnstiles
        else if (!moved && a.blk < GATE_STOP + 0.05) { v = 0; held = true; }
      } else if (a.rail) {
        const ls = lanesOf(a), s = Math.max(...ls) - a.rail.at <= a.rail.at + 1 - Math.min(...ls) ? -1 : 1;
        if (this.canShift(a, s, 0.4, { short: true, npc: sq })) this.shift(a, s, 0.4);
        else if (this.canShift(a, -s, 0.4, { short: true, npc: sq })) this.shift(a, -s, 0.4);
        else if (a.rail.d < 0.5) this.file(a);
      }
    } else if (a.blk < GATE_STOP + 0.05) { v = 0; held = true; }
    if (mine || a.follow === undefined) {
      a.follow = null; a.head = null;
      let best = 1.6, hb = 2.6;
      if (!sq) for (const b of this.agents) {
        if (b === a || b.gone || (a.grp && a.grp === b.grp) || !g.some((m) => Math.abs(b.x - m.x) < 0.7)) continue;
        const d = (b.z - a.z) * a.dir;
        if (b.dir === a.dir) { const dd = d - (a.dir > 0 ? b.back : a.back); if (dd > 0 && dd < best) { best = dd; a.follow = b; } }
        else if (d > 0 && d < hb && b.kind !== 'runner') { hb = d; a.head = b; }
      }
      if (a.dir > 0 && g.some((m) => Math.abs(P.x - m.x) < 0.7)) { const d = P.z - a.z; if (d > 0 && d < best) { best = d; a.follow = P; } }
    }
    const f = a.follow;
    if (f && !f.gone) {
      const d = (f.z - a.z) * a.dir - (a.dir > 0 ? f.back : a.back);
      if (d > 0 && d < 1.6) {
        v = Math.min(v, Math.max(0, f.v + (d - 0.75) * 2));
        if (f.v < a.v0 * 0.6 && d < 1.3 && t >= a.overAt && !stepping(a, t) && a.st !== 'tell') {
          a.overAt = t + 0.9;
          const keep = a.dir > 0 ? -1 : 1;
          for (const s of [keep, -keep]) if (this.canShift(a, s, 1.2)) { this.shift(a, s, 0.4); break; }
        }
      }
    }
    const h = a.head;
    if (h && !h.gone && !a.grp && a.kind !== 'zombie' && !a.stay && !stepping(a, t) && t >= a.overAt && (a.st === 'walk' || a.st === 'past' || a.st === 'clear')
      && (a.dir < 0 || h.kind === 'zombie' || h.grp || h.v < 0.1)) {
      a.overAt = t + 0.7;
      const keep = a.dir > 0 ? 1 : a.habit;
      for (const s of [keep, -keep]) if (this.freeFor(a, a.lane + s, { short: true })) { startStep(a, a.lane + s, a.stepDur || 0.3, t); break; }
    }
    if (sq && !held && a.st !== 'stuck') {
      const d = (P.z - a.z) * a.dir;
      if (!(g.some((m) => Math.abs(P.x - m.x) < 0.7) && d > 0 && d < 1.3)) v = Math.max(v, 0.5 * a.v0 * R.speedAt(a.z));
    }
    return v;
  }

  // ---------- touching ----------
  contacts() {
    const P = this.P, t = this.t;
    for (const a of this.agents) {
      if (a.gone || t < a.ghost) continue;
      const gap = a.z - P.z;
      if (gap > 2.2 || gap < -1.6) continue;
      const dx = Math.abs(a.x - P.x);
      if (onc(a)) {
        if (dx < OVER && gap > 0 && gap < CONTACT && !(a.kind === 'couple' && a.grp[0].split)) {
          if (!DANCERS.has(a.kind)) this.bump(a, a.kind === 'zombie' ? 'phone' : 'body');
          else if (a.lane === P.lane) this.startDance(a, a.st === 'stuck' ? 'stuck' : 'late');
          else this.brush(a);
          if (P.dance || t < P.stagger) return;
        }
        if (a.bag && t >= (a.bagGhost ?? -9)) {
          const bd = a.z + 0.75 - P.z;
          if (Math.abs(a.bag.x - P.x) < 0.5 && bd > -0.25 && bd < 0.25) { a.bagGhost = t + 2; this.bump(a, 'bag'); return; }
        }
      } else if (a.kind === 'runner' && dx < OVER && gap < 0.3 && gap > -0.9) { this.bump(a, 'runner'); return; }
    }
  }
  brush(a) {
    const P = this.P;
    a.ghost = this.t + 1.2; P.brushes++;
    this.perdon(1, 'brush', a);
    this.emit({ k: 'brush', id: a.id, kind: a.kind, side: Math.sign(a.x - P.x) });
  }
  bump(a, why) {
    const P = this.P, t = this.t, g = a.grp || [a], L = g[0];
    P.stagger = t + 0.7; P.v = 0; P.z = Math.max(0, P.z - 0.1); P.bumps++; P.buf = null;
    for (const m of g) m.ghost = Math.max(m.ghost, t + 1.4);
    a.bumpAt = t; L.stopUntil = t + 0.55; a.nb = (a.nb || 0) + 1;
    if (a.kind === 'runner') { a.hit = true; a.ghost = Infinity; }
    else if (a.nb >= 2) for (const m of g) m.ghost = Infinity;
    this.perdon(2, 'bump', a);
    this.emit({ k: 'bump', id: a.id, kind: a.kind, why });
    if (why === 'bag') return;
    if (a.kind === 'couple') this.split(a);
    else if (a.grp) this.tuck(a);
    else if (a.kind === 'runner') { for (const s of [-1, 1]) if (this.freeFor(a, a.lane + s, { short: true, you: true })) { startStep(a, a.lane + s, 0.25, t + 0.15); break; } }
    else {
      if (a.kind === 'zombie') { a.phone = false; a.lookUp = t; }
      const s = this.pickSide(a, a.habit, { you: true, short: true });
      if (s) startStep(a, a.lane + s, 0.45, t + 0.3);
    }
  }
  perdon(n, why, a) {
    const P = this.P;
    P.perdones += n;
    this.emit({ k: 'perdon', n: P.perdones, add: n, why, id: a?.id, kind: a?.kind });
  }

  // ---------- the dance ----------
  startDance(a, why) {
    const P = this.P, t = this.t;
    if (P.dance || t < a.ghost || this.end) return;
    const pref = why === 'mirror' && a.tell ? (this.rng() < 0.65 ? -a.tell : a.tell) : a.habit;
    const D = { a, k: 1, why, phase: 'tell', t0: t, start: t, tellAt: t + 0.3, side: 0, log: [{ p: P.lane, n: a.lane }], z: P.z, kind: a.kind };
    P.dance = D; a.st = 'dance'; a.v = 0; P.buf = null; P.v = 0;
    D.side = this.danceSide(a, pref); a.tell = D.side;
    this.perdon(1, 'dance', a);
    this.emit({ k: 'dance', id: a.id, n: 1, kind: a.kind, why, side: D.side });
  }
  danceSide(a, pref) {
    const p = pref || a.habit;
    for (const s of [p, -p]) if (a.lane + s !== this.P.lane && this.freeFor(a, a.lane + s, { short: true, you: true })) return s;
    return 0;
  }
  danceTick(dt) {
    const P = this.P, D = P.dance, a = D.a, t = this.t;
    a.z += (P.z + FACE - a.z) * (1 - Math.exp(-dt * 9));
    if (D.phase === 'rumba') { if (t >= D.t0 + RUMBA) this.endDance('rumba'); return; }
    if (D.phase === 'tell') {
      a.tell = D.side;
      if (!D.side) {                                   // nowhere for them to go: they wait for you to go round
        if (t - D.start > 2.6) { this.endDance('squeeze'); return; }
        if (t - D.t0 > 1.1) { D.side = this.danceSide(a, a.habit); D.t0 = t; D.tellAt = t + 0.1; if (D.side) this.emit({ k: 'tell', id: a.id, side: D.side }); }
        return;
      }
      if (t >= D.tellAt + a.rt) {
        const to = a.lane + D.side;
        if (P.lane === to || this.freeFor(a, to, { short: true, you: true })) { startStep(a, to, a.stepDur, t); D.phase = 'step'; D.t0 = t; }
        else { D.side = this.danceSide(a, -D.side); D.t0 = t; D.tellAt = t + 0.12; this.emit({ k: 'tell', id: a.id, side: D.side }); }
      }
    } else if (D.phase === 'step' && !stepping(a, t)) {
      if (P.lane === a.lane) this.loop(D);
      else this.endDance('pass');
    }
  }
  danceStep() {
    const P = this.P, D = P.dance, a = D.a;
    if (D.phase === 'rumba') return;
    const theirs = D.phase === 'step' ? a.lane : a.lane + D.side;
    if (D.side && P.lane === theirs) {                 // you went where they were going: they go too
      if (D.phase === 'tell') { startStep(a, a.lane + D.side, a.stepDur, this.t); D.phase = 'step'; D.t0 = this.t; }
    } else if (D.phase === 'tell' || !D.side) this.endDance('pass');
  }
  loop(D) {
    const P = this.P, a = D.a, t = this.t;
    D.k++; D.log.push({ p: P.lane, n: a.lane });
    this.perdon(1, 'dance', a);
    if (D.k >= 4) { D.phase = 'rumba'; D.t0 = t; a.tell = 0; this.emit({ k: 'dance', id: a.id, n: D.k, kind: a.kind }); this.emit({ k: 'rumba', id: a.id, kind: a.kind }); return; }
    D.side = this.danceSide(a, this.rng() < 0.65 ? -D.side : D.side);
    D.phase = 'tell'; D.t0 = t; D.tellAt = t + 0.22; a.tell = D.side;
    this.emit({ k: 'dance', id: a.id, n: D.k, kind: a.kind, side: D.side });
  }
  endDance(why) {
    const P = this.P, D = P.dance, a = D.a, t = this.t;
    P.dance = null;
    a.st = 'clear'; a.tell = 0; a.ghost = t + (why === 'rumba' ? 2.4 : why === 'squeeze' ? 2.6 : 1.6); a.v = a.v0;
    a.nd = (a.nd || 0) + 1;
    if (a.nd >= 2) a.ghost = Infinity;                // twice is enough: after that you just edge past each other
    if (why === 'rumba') {
      P.rumbas.push(a.kind);
      const s = this.danceSide(a, a.habit);
      if (s) startStep(a, a.lane + s, 0.35, t);
    }
    P.dances.push({ k: D.k, kind: a.kind, log: D.log, why: D.why, t0: D.start, t1: t, rumba: why === 'rumba' });
    this.emit({ k: 'part', id: a.id, n: D.k, kind: a.kind, why });
  }

  finish(why) {
    if (this.end) return;
    this.end = { why, t: this.t, margin: this.lv.dep - this.t };
    // the doors close on a dance still going: it counts, as far as it got
    const P = this.P, D = P.dance;
    if (D) {
      const rumba = D.phase === 'rumba';
      if (rumba) P.rumbas.push(D.a.kind);
      P.dances.push({ k: D.k, kind: D.a.kind, log: D.log, why: D.why, t0: D.start, t1: this.t, rumba });
    }
    P.dance = null;
    this.emit({ k: 'end', why, margin: this.end.margin });
  }
  stars() {
    const e = this.end, ok = !!e && e.why === 'arrive';
    return [ok, ok && this.P.perdones <= this.lv.par, ok && e.margin >= this.lv.margin];
  }
  longestDance() { return this.P.dances.reduce((b, d) => (!b || d.k > b.k ? d : b), null); }
}

export { KIND };
