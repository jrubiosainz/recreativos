// HIPO: the rules. Deterministic, fixed step (120 Hz), tile units, y grows downward. Nothing here
// is random: the hiccups keep time and the level is the level, so the same inputs give the same run.
//
// The hippo can't jump. It hiccups, on a clock (P.T). Holding the button holds the breath: a hiccup
// that falls due while you hold is kept («una bola») instead of fired, and letting go fires everything
// kept as one bigger hop. Keep three and it bursts out on its own. Cold water fires one early; water to
// drink slows the clock, fizz speeds it up, and a fright (el susto) makes it leap and cures it for a
// moment. Every level ends by jumping off the top into a pool: holding the breath at the splash is a
// BOMBA, not holding it is a PLANCHAZO.
import { clamp } from './util.js';

export const DT = 1 / 120;
export const MPT = 0.25; // metres per tile: the hippo is a calf, the world is full size

export const P = {
  hw: 0.82, hh: 1.2,                  // collider half-width and height
  g: 45, fallMul: 1.35, term: 22,     // tiles/s²; falling pulls harder (weight), terminal speed
  walk: 5.0, tiptoe: 2.3, dizzyWalk: 2.6,
  acc: 42, dec: 60, turn: 90, airAcc: 28, airDec: 10,
  T: 1.5, tell: 0.25,                 // hiccup period, and the visible wind-up before it
  hop: [1.35, 2.4, 3.45, 4.9],        // hop heights: natural, 1 held, 2 held, burst
  dizzy: 0.8, cure: 3.0,              // after a burst; after a fright (hiccups gone for a while)
  w: { g: 0.3, term: 3.2, walk: 2.8, acc: 16, dec: 12, hop: [2.2, 3.2, 4.3, 5.6], entry: 0.35 },
  fizz: { T: 0.75, n: 8 }, agua: { T: 3.0, n: 3 },
  chair: { hold: 0.5, back: 4 },
  float: { sink: 1.3, rise: 1.7, max: 0.45 },  // sinks to the waterline under the hippo, never under it
  susto: { h: 6.0, k: 0.6 },          // a fright: a leap this high (+ per bola held), then no hiccups for a while
  pop: [2.0, 2.9, 3.9, 5.2],          // breaking the surface on the way up: out of the water like on land
  bounce: 0.8,                        // parasol restitution (at least a natural hop)
  // springboards: a dead landing soaks most of the fall; a hiccup on contact keeps it and adds its own speed
  board: { t: 0.14, soak: 0.5, keep: 0.8, gain: 1.3, pump: 1, max: 11, minV: 8 },
  whistle: { range: 6.5, tele: 0.7, cd: 3.3, slack: 0.5 }, // step into his range: he raises it, then blows; then he rests
  tuck: 0.15,                         // breath held this long before the splash = tucked
};
export const hopV = (h, g = P.g) => Math.sqrt(2 * g * h);
export const EMPTY = 0, SOLID = 1, ONEWAY = 2, WATER = 3;
const EPS = 1e-4;
const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

export class Sim {
  constructor(level, map, opts = {}) {
    this.lv = level; this.map = map; this.w = map.w; this.h = map.h;
    this.tiles = map.tiles;
    this.opt = { slow: !!opts.slow };
    this.t = 0; this.ev = []; this.end = null; this.dive = null; this.respawns = 0;
    this.input = { dir: 0, hold: false };
    const s = map.start;
    this.hp = { x: s.x, y: s.y, vx: 0, vy: 0, face: s.face || 1, ground: null, inWater: false, hold: false, holdT: 0,
      spring: null, air: 0, peak: s.y, lastLand: 0, bonkT: -9, hicT: -9, hicL: 0 };
    this.hic = { phase: 0, k: 0, cure: 0, dizzy: 0, mod: null, n: 0, stored: 0 };
    this.check = { x: s.x, y: s.y, face: this.hp.face, id: -1 };
    // entities, all flat lists the scene reads directly
    this.plats = map.plats.map((p) => {
      const q = { ...p, top: p.rest, prevTop: p.rest, state: 'ok', t: 0, d: 0, dv: 0, occ: false, cd: 0, dx: 0, bx0: p.x0, len: p.x1 - p.x0 };
      if (q.amp) { q.x0 = q.bx0 + q.amp * Math.sin(2 * Math.PI * q.ph); q.x1 = q.x0 + q.len; }
      if (q.kind === 'board') q.lever = boardLever(q);
      return q;
    });
    this.showers = map.showers.map((s) => ({ ...s, inside: false }));
    this.fountains = map.fountains.map((f) => ({ ...f, cd: 0, dw: 0 }));
    this.fizz = map.fizz.map((z) => ({ ...z, gone: 0 }));
    this.sticks = map.sticks.map((k) => ({ ...k, got: false, at: 0 }));
    this.towels = map.towels.map((k, i) => ({ ...k, id: i, laid: false }));
    this.guards = map.guards.map((g) => ({ ...g, ph: 0, up: false, cd: 0, d: 99 }));
    this.goal = map.goal;
    this.par = level.par || 60;
    this.hp.ground = this.support(this.hp.x, this.hp.y);
  }

  emit(k, o = {}) { this.ev.push({ ...o, k, t: this.t }); }
  period() { const m = this.hic.mod; return (m ? P[m.kind].T : P.T) * (this.opt.slow ? 1.3 : 1); }
  holding() { return this.hp.hold; }
  sticksGot() { return this.sticks.reduce((n, s) => n + (s.got ? 1 : 0), 0); }

  // ---------- map queries ----------
  tile(c, r) {
    if (c < 0 || c >= this.w) return SOLID;
    if (r < 0) return EMPTY;
    if (r >= this.h) return SOLID;
    return this.tiles[r * this.w + c];
  }
  tileAt(x, y) { return this.tile(Math.floor(x), Math.floor(y)); }
  solidSpan(c, y0, y1) {
    for (let r = Math.floor(y0); r <= Math.floor(y1); r++) if (this.tile(c, r) === SOLID) return true;
    return false;
  }
  // what the feet stand on at (x, y), or null
  support(x, y) {
    const c0 = Math.floor(x - P.hw + EPS), c1 = Math.floor(x + P.hw - EPS);
    const r = Math.round(y);
    if (Math.abs(y - r) < 0.002) for (let c = c0; c <= c1; c++) { const k = this.tile(c, r); if (k === SOLID || k === ONEWAY) return 'tile'; }
    for (const p of this.plats) if (p.state !== 'broken' && x + P.hw > p.x0 && x - P.hw < p.x1 && Math.abs(y - p.top) < 0.002) return p;
    return null;
  }
  overlaps(x0, y0, x1, y1) { const hp = this.hp; return hp.x + P.hw > x0 && hp.x - P.hw < x1 && hp.y > y0 && hp.y - P.hh < y1; }

  // ---------- the hiccup ----------
  // a hiccup falls due (the clock, cold water, or the cure wearing off)
  due(src) {
    const h = this.hic;
    if (h.cure > 0) return;
    if (this.hp.hold) {
      h.k++; h.stored++;
      this.useMod();
      if (h.k >= 3) { this.hiccup(3, 'burst'); return; }
      h.phase = 0;
      this.emit('store', { n: h.k, src });
    } else this.hiccup(0, src);
  }
  useMod() { const m = this.hic.mod; if (m && --m.n <= 0) { this.hic.mod = null; this.emit('modEnd', { kind: m.kind }); } }
  hiccup(L, src, Hs = 0) {
    const hp = this.hp, h = this.hic, water = hp.inWater;
    const H = Hs ? (water ? Math.min(Hs, P.w.hop[3]) : Hs) : (water ? P.w.hop : P.hop)[L];
    if (src !== 'burst' && src !== 'release' && src !== 'susto') this.useMod(); // kept ones were counted when kept
    if (hp.spring) hp.spring.bonus = Math.max(hp.spring.bonus, H); // pumping the springboard: paid at launch
    else {
      const onBoard = hp.ground && hp.ground.kind === 'board';
      const v = hopV(onBoard ? H * P.board.gain : H, water ? P.g * P.w.g : P.g);
      if (onBoard) this.kickBoard(hp.ground, v);
      hp.vy = Math.min(hp.vy, -v);
      hp.ground = null;
    }
    h.phase = 0; h.k = 0; h.n++;
    if (L === 3) h.dizzy = P.dizzy;
    hp.hicT = this.t; hp.hicL = L;
    this.emit('hic', { L, src, water, air: hp.air > 0.05 });
  }
  susto(src) {
    const h = this.hic, L = 3, k = h.k;
    h.k = 0; h.cure = 0;
    this.hiccup(L, 'susto', Math.min(7, P.susto.h + P.susto.k * k));
    h.cure = P.cure; h.phase = 0; h.mod = null;
    this.emit('susto', { src, L });
  }

  // ---------- one step ----------
  tick() {
    this.ev.length = 0;
    if (this.end) { this.afterTick(); this.t += DT; return; }
    const hp = this.hp, h = this.hic, inp = this.input;
    this.updatePlats();
    if (hp.ground && hp.ground !== 'tile') {
      const g = hp.ground;
      if (g.state === 'broken') hp.ground = null;
      else { hp.y = g.top; if (g.dx) { const vx = hp.vx; hp.vx = g.dx / DT; this.moveX(); hp.vx = vx; } }
    }

    // the breath
    const want = !!inp.hold && h.dizzy <= 0;
    const released = hp.hold && !want;
    hp.hold = want; hp.holdT = want ? hp.holdT + DT : 0;
    if (h.dizzy > 0) h.dizzy = Math.max(0, h.dizzy - DT);
    if (h.cure > 0) {
      h.cure -= DT;
      if (h.cure <= 0) { h.cure = 0; h.phase = 0; this.emit('back'); this.due('back'); }
    } else {
      if (released && h.k > 0) this.hiccup(h.k, 'release');
      h.phase += DT;
      if (h.phase >= this.period()) this.due('clock');
    }

    // springboard contact: the board swallows the landing and gives it back (plus any hiccup)
    if (hp.spring) {
      const s = hp.spring;
      s.t += DT; hp.vx *= 0.9;
      if (s.t >= P.board.t) {
        // like a trampoline: the hiccup adds its speed to the rebound, so the higher you fell, the more it gives
        const B = P.board;
        const H = Math.min(B.max, s.bonus ? (Math.sqrt(B.keep * s.h) + B.pump * Math.sqrt(s.bonus)) ** 2 : B.soak * s.h);
        const v = hopV(H);
        this.kickBoard(s.p, v);
        hp.vy = -v; hp.ground = null; hp.spring = null;
        this.emit('launch', { H, pumped: s.bonus > 0 });
      }
    }

    // walking
    const inW = hp.inWater, grounded = !!hp.ground;
    let max = inW ? P.w.walk : hp.hold ? P.tiptoe : P.walk;
    if (h.dizzy > 0) max = Math.min(max, P.dizzyWalk);
    if (hp.spring) max = 0;
    const target = inp.dir * max;
    let a;
    if (target !== 0 && hp.vx !== 0 && Math.sign(target) !== Math.sign(hp.vx)) a = grounded ? P.turn : P.airAcc + P.airDec;
    else if (Math.abs(target) > Math.abs(hp.vx)) a = grounded ? (inW ? P.w.acc : P.acc) : P.airAcc;
    else a = grounded ? (inW ? P.w.dec : P.dec) : P.airDec;
    hp.vx = approach(hp.vx, target, a * DT);
    if (inp.dir && !hp.spring) hp.face = inp.dir;
    this.moveX();

    // falling, landing, bonking
    if (!hp.spring) {
      const gm = inW ? P.w.g : hp.vy > 0 ? P.fallMul : 1;
      hp.vy += P.g * gm * DT;
      const term = inW ? P.w.term : P.term;
      if (hp.vy > term) hp.vy = inW ? approach(hp.vy, term, 40 * DT) : term;
      this.moveY();
    }
    hp.air = hp.ground ? 0 : hp.air + DT;
    hp.peak = hp.ground ? hp.y : Math.min(hp.peak, hp.y);

    // water
    const wet = this.tileAt(hp.x, hp.y - P.hh * 0.5) === WATER;
    if (wet !== hp.inWater) {
      hp.inWater = wet;
      if (wet) {
        const v = hp.vy;
        if (hp.vy > 0) hp.vy *= P.w.entry;
        this.emit('splash', { v, x: hp.x, y: this.surfaceAbove(hp.x, hp.y - P.hh * 0.5) });
      } else {
        const surf = Math.floor(hp.y - P.hh * 0.5) + 1;
        if (hp.vy < -1 && !this.end) hp.vy = Math.min(hp.vy, -hopV(P.pop[hp.hicL]));
        this.emit('breach', { v: -hp.vy, x: hp.x, y: surf });
      }
    }

    this.triggers();
    if (this.dive) this.diveTick();
    this.t += DT;
  }

  moveX() {
    const hp = this.hp;
    if (!hp.vx) return;
    let nx = hp.x + hp.vx * DT;
    const y0 = hp.y - P.hh + EPS, y1 = hp.y - EPS;
    if (hp.vx > 0) {
      const c = Math.floor(nx + P.hw);
      if (this.solidSpan(c, y0, y1)) { nx = c - P.hw - EPS; hp.vx = 0; }
    } else {
      const c = Math.floor(nx - P.hw);
      if (this.solidSpan(c, y0, y1)) { nx = c + 1 + P.hw + EPS; hp.vx = 0; }
    }
    hp.x = nx;
    if (hp.ground && !this.support(hp.x, hp.y)) hp.ground = null;
  }

  moveY() {
    const hp = this.hp, oy = hp.y;
    let ny = oy + hp.vy * DT;
    const c0 = Math.floor(hp.x - P.hw + EPS), c1 = Math.floor(hp.x + P.hw - EPS);
    const wasGround = !!hp.ground;
    if (hp.vy >= 0) {
      let best = Infinity, what = null;
      for (let r = Math.ceil(oy - 0.002); r <= Math.floor(ny); r++) {
        for (let c = c0; c <= c1; c++) { const k = this.tile(c, r); if (k === SOLID || k === ONEWAY) { best = r; what = 'tile'; break; } }
        if (what) break;
      }
      for (const p of this.plats) {
        if (this.dive || p.state === 'broken' || hp.x + P.hw <= p.x0 || hp.x - P.hw >= p.x1) continue;
        if (oy <= Math.max(p.top, p.prevTop) + 0.002 && ny >= p.top && p.top < best) { best = p.top; what = p; }
      }
      if (what) {
        ny = best; hp.y = ny;
        const v = hp.vy;
        hp.vy = 0;
        if (!wasGround || hp.ground !== what) this.land(what, v);
        else hp.ground = what;
        return;
      }
      hp.ground = null;
    } else {
      hp.ground = null;
      const h0 = oy - P.hh, h1 = ny - P.hh;
      for (let r = Math.floor(h0) - 1; r >= Math.floor(h1); r--) {
        let hit = false;
        for (let c = c0; c <= c1; c++) if (this.tile(c, r) === SOLID) { hit = true; break; }
        if (hit && h1 < r + 1) {
          ny = r + 1 + P.hh + EPS;
          this.emit('bonk', { v: -hp.vy, x: hp.x, y: r + 1 });
          hp.vy = 0; hp.bonkT = this.t;
          break;
        }
      }
    }
    hp.y = ny;
  }

  land(what, v) {
    const hp = this.hp;
    if (this.dive && !this.end) { this.dive = null; this.emit('miss'); }
    if (what !== 'tile' && what.kind === 'parasol') {
      const up = Math.max(P.bounce * v, hopV(P.hop[0]));
      hp.vy = -up; hp.ground = null; what.d = Math.min(1, v / 18); what.cd = 0.25;
      this.emit('boing', { v, x: hp.x, p: what });
      return;
    }
    if (what !== 'tile' && what.kind === 'board' && v >= P.board.minV) {
      hp.ground = what; hp.spring = { p: what, t: 0, v, h: Math.max(0, hp.y - hp.peak), bonus: 0 };
      this.kickBoard(what, -v);
      this.emit('board', { v, x: hp.x });
      return;
    }
    hp.ground = what; hp.lastLand = this.t;
    this.emit('land', { v, x: hp.x, y: hp.y, on: what === 'tile' ? 'tile' : what.kind, water: hp.inWater });
    if (what !== 'tile' && what.kind === 'croc' && what.cd <= 0) { what.cd = 1.2; this.susto('croc'); }
  }
  kickBoard(p, v) { p.dv += (v < 0 ? -v : -v * 0.5) * 0.09 * p.lever(this.hp.x); }

  updatePlats() {
    const hp = this.hp;
    for (const p of this.plats) {
      p.prevTop = p.top;
      const on = hp.ground === p;
      if (p.cd > 0) p.cd -= DT;
      if (p.kind === 'float' || p.kind === 'croc') {
        p.occ = on;
        if (p.amp) {
          const nx = p.bx0 + p.amp * Math.sin(2 * Math.PI * ((this.t + DT) / p.per + p.ph));
          p.dx = nx - p.x0; p.x0 = nx; p.x1 = nx + p.len;
        }
        p.top = on ? Math.min(p.rest + P.float.max, p.top + P.float.sink * DT) : Math.max(p.rest, p.top - P.float.rise * DT);
      } else if (p.kind === 'chair') {
        if (p.state === 'ok' && on) { p.state = 'shake'; p.t = 0; this.emit('creak', { p }); }
        if (p.state === 'shake') { p.t += DT; if (p.t >= P.chair.hold) { p.state = 'broken'; p.t = 0; this.emit('crack', { p }); if (on) hp.ground = null; } }
        else if (p.state === 'broken') { p.t += DT; if (p.t >= P.chair.back && !this.overlaps(p.x0, p.top - 0.2, p.x1, p.top + 1.6)) { p.state = 'ok'; this.emit('chairBack', { p }); } }
      } else if (p.kind === 'board') {
        // the board's own wobble (drawn): a damped spring, pushed by landings and take-offs
        const load = on ? 0.18 * p.lever(hp.x) : 0;
        p.dv += (-140 * (p.d - load) - 7 * p.dv) * DT;
        p.d += p.dv * DT;
      } else if (p.kind === 'parasol') {
        p.d += (-p.d) * Math.min(1, 9 * DT);
      }
    }
  }

  triggers() {
    const hp = this.hp, h = this.hic;
    for (const s of this.showers) {
      const inside = this.overlaps(s.x0, s.y0, s.x1, s.y1);
      if (inside && !s.inside) { this.emit('cold', { s }); this.due('ducha'); }
      s.inside = inside;
    }
    for (const f of this.fountains) {
      if (f.cd > 0) { f.cd -= DT; continue; }
      // stop at it to drink: a pause the hippo chooses, not a pickup it walks through
      f.dw = hp.ground && Math.abs(hp.vx) < 0.6 && this.overlaps(f.x0, f.y0, f.x1, f.y1) ? f.dw + DT : 0;
      if (f.dw >= 0.2) {
        h.mod = { kind: 'agua', n: P.agua.n }; f.cd = 6; f.dw = 0;
        if (h.phase > P.agua.T * 0.5) h.phase = P.agua.T * 0.5;
        this.emit('drink', { f });
      }
    }
    for (const z of this.fizz) {
      if (z.gone > 0) { z.gone -= DT; if (z.gone <= 0) this.emit('fizzBack', { z }); continue; }
      if (this.overlaps(z.x - 0.35, z.y - 0.5, z.x + 0.35, z.y + 0.5)) {
        h.mod = { kind: 'fizz', n: P.fizz.n }; z.gone = 8;
        this.emit('fizz', { z });
      }
    }
    for (const k of this.sticks) {
      if (!k.got && this.overlaps(k.x - 0.3, k.y - 0.55, k.x + 0.3, k.y + 0.55)) { k.got = true; k.at = this.t; this.emit('stick', { stick: k, n: this.sticksGot() }); }
    }
    for (const w of this.towels) {
      if (hp.ground && w.id !== this.check.id && this.overlaps(w.x - 0.9, w.y - 1, w.x + 0.9, w.y + 0.1)) {
        w.laid = true; this.check = { x: w.x, y: w.y, face: hp.face, id: w.id };
        this.emit('towel', { w });
      }
    }
    // the lifeguard: stand within his range and he raises the whistle; a moment later, the blast
    for (const g of this.guards) {
      const d = Math.hypot(hp.x - g.x, hp.y - P.hh / 2 - g.y), R = g.range || P.whistle.range;
      g.d = d; g.face = hp.x < g.x ? -1 : 1;
      if (g.cd > 0) g.cd -= DT;
      if (g.up) {
        g.ph += DT;
        if (g.ph >= P.whistle.tele) {
          g.up = false; g.cd = P.whistle.cd;
          const hit = d <= R + P.whistle.slack && !this.end && !this.dive;
          this.emit('whistle', { g, d, hit });
          if (hit) this.susto('whistle');
        }
      } else if (g.cd <= 0 && d <= R && hp.ground && !hp.spring && !this.end && !this.dive) { g.up = true; g.ph = 0; this.emit('whistleUp', { g, d }); }
    }
    // the edge under «PROHIBIDO HACER BOMBAS»: off it is the bomba
    const G = this.goal;
    if (G && !this.dive && !hp.ground && (G.dir > 0 ? hp.x - P.hw > G.edge : hp.x + P.hw < G.edge) && hp.y < G.y + 1.5) {
      this.dive = { y0: G.y, minY: hp.y, t0: this.t };
      this.emit('dive');
    }
  }

  diveTick() {
    const hp = this.hp, d = this.dive;
    d.minY = Math.min(d.minY, hp.y);
    if (this.tileAt(hp.x, hp.y) === WATER || hp.inWater) {
      const surf = this.surfaceAbove(hp.x, hp.y);
      const H = Math.max(0, surf - d.minY) * MPT;
      const tucked = hp.hold && hp.holdT >= P.tuck;
      const k = tucked ? this.hic.k : 0;
      const splash = Math.round((tucked ? 1 : 0.3) * (0.6 + 1.1 * Math.pow(H, 0.85)) * (1 + 0.35 * k) * 10) / 10;
      const why = tucked ? 'bomba' : 'planchazo';
      this.end = { why, H: Math.round(H * 10) / 10, splash, k, t: this.t, sticks: this.sticksGot(), of: this.sticks.length, x: hp.x, y: surf, v: hp.vy };
      this.emit('impact', { ...this.end, bolas: this.end.k });
      hp.vy *= 0.25; hp.vx *= 0.3;
    }
  }
  afterTick() {
    // the aftermath is only pictures: the hippo sinks, then bobs up, belly first
    const hp = this.hp, e = this.end, s = this.t - e.t;
    hp.inWater = true;
    const target = s < 0.9 ? e.y + 1.6 : e.y + 0.55;
    hp.vy = approach(hp.vy, (target - hp.y) * 3, 12 * DT);
    hp.y += hp.vy * DT; hp.vx *= 0.96; hp.x += hp.vx * DT;
  }
  surfaceAbove(x, y) {
    const c = Math.floor(x); let r = Math.floor(y);
    while (r > 0 && this.tile(c, r - 1) === WATER) r--;
    return r;
  }

  stars() {
    const e = this.end;
    if (!e) return [false, false, false];
    return [e.why === 'bomba', e.sticks === e.of, e.t <= this.par];
  }

  respawn() {
    if (this.end || this.dive) return;
    const hp = this.hp, c = this.check;
    Object.assign(hp, { x: c.x, y: c.y, vx: 0, vy: 0, face: c.face, spring: null, hold: false, holdT: 0, air: 0 });
    Object.assign(this.hic, { phase: 0, k: 0, cure: 0, dizzy: 0, mod: null });
    hp.inWater = this.tileAt(hp.x, hp.y - P.hh * 0.5) === WATER;
    hp.ground = this.support(hp.x, hp.y);
    this.respawns++;
    this.emit('respawn');
  }
  // below the last towel by this much: the shell offers to go back to it
  lost() { return !this.dive && !this.end && this.hp.y - this.check.y > 5 && this.hp.ground; }
}

// the lever of a springboard at x: 0 at the anchor, 1 at the tip
export function boardLever(p) {
  const len = p.x1 - p.x0;
  return (x) => clamp(p.anchor < 0 ? (x - p.x0) / len : (p.x1 - x) / len, 0.15, 1);
}
