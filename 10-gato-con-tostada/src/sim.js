// GATO CON TOSTADA — the buttered-cat paradox as a flight model. Deterministic at 120 Hz, no DOM: it runs in
// Node for the tests. Centimetres, y down, angles clockwise (like the canvas).
// The device is a cat with a buttered toast taped to its back, butter up. θ = 0: feet down, butter up, the cat
// facing right. Cats land on their feet and toast lands butter down, so whichever face points at the ground the
// other law objects, and the thing hovers over whatever is below it. The harder the two laws fight (|cos θ|, and
// more while it spins, when they swap sides many times a second), the higher it floats. On its end (θ = ±90°)
// neither face points down, the fight stops and it comes down: tail first (−90°) the cat sits, like a person,
// legs forward; head first (+90°) it bonks. And a cat only really sits in one place: the cardboard box.
import { clamp, mulberry32, angDiff } from './util.js';

export const DT = 1 / 120, G = 981;
export const SIT = -Math.PI / 2, HEAD = Math.PI / 2;
export const K = {
  w0: 2.6, alpha: 9, wmax: 15, brake: 45, // turning: a press starts at w0 and builds up (rad/s, rad/s²)
  keep: 6, tStop: 0.06, tSpin: 0.7,       // let go below `keep` and it stops at once; above, it spins on like a top
  spin0: 4, spinS: 12,                    // |ω| that starts to count as spinning, and full spin
  charge: [0.35, 1.3],                    // the spin's lift builds up and fades slowly (attack, release, s)
  H: 52, spinH: 0.95, reach: 150,         // hover clearance at full fight and full butter, extra for spinning, how far down the laws feel ground
  end: 0.18,                              // within ~10° of standing on its end neither face points down: no fight at all
  ks: 34, kd: 6.5, up: 2.3,               // the cushion: spring and damping to the hover clearance, push-up cap (× g)
  T: 720, drag: 1.3, dragAir: 0.25,       // thrust along the fight axis (T/2 at 45°); drag while hovering / falling
  drip: 0.0045, fling: 0.04, smear: 0.045, melt: 0.04, fan: 0.04, // butter lost: per s, per s of full spin, per scrape, per s over a hob…
  r: 13, half: 15,                        // the capsule along the cat, tail to head
  sitWin: 0.42, sitV: 190, settle: 0.6,   // sitting: within 24° of tail-down and slow enough; this long in the box wins
  dizzy: 0.8,
  push: 175, rub: 3, mDev: 4,             // the cushion shoves loose things below it; their friction on a surface (1/s); device mass (kg)
};

const bf = (b) => 0.45 + 0.55 * b;       // how much the toast's law still has to say
const btf = (b) => 0.55 + 0.45 * b;

export class Sim {
  constructor(level, opts = {}) {
    this.lv = level; this.seed = opts.seed ?? 1; this.rng = mulberry32(this.seed * 7919 + 13);
    this.W = level.W; this.H = level.H; this.fallY = level.fallY ?? level.H + 160;
    this.solids = level.solids.map((s, i) => ({ id: i, x: s[0], y: s[1], w: s[2], h: s[3], tag: s[4] || '' }));
    this.water = (level.water || []).map((w) => ({ x: w[0], y: w[1], w: w[2], h: w[3] }));
    this.box = level.box ? { x: level.box[0], y: level.box[1], w: 60, h: 40, in0: level.box[0] + 3, in1: level.box[0] + 57 } : null;
    this.objs = (level.objects || []).map((o, i) => ({
      id: i, k: o.k, x: o.x, y: o.y - o.r, vx: 0, vy: 0, a: 0, va: 0, r: o.r, m: o.m ?? 0.4, fragile: !!o.fragile, tempt: !!o.tempt,
      home: o.y, sleep: true, still: 0, broken: false, fell: false, gone: false,
    }));
    this.cukes = (level.cucumbers || []).map((c) => ({ x: c[0], y: c[1], cd: 0 }));
    this.hobs = (level.hobs || []).map((h) => ({ x0: h[0], x1: h[1], y: h[2] }));
    this.fans = (level.fans || []).map((f) => ({ x: f[0], y: f[1], r: f[2], cd: 0, a: 0 }));
    this.dogs = (level.dogs || []).map((d) => ({ x0: d[0], x1: d[1], y: d[2], x: d[3] ?? d[0], dir: 1, v: 90, jy: 0, jvy: 0, jvx: 0, cd: 0.8, bark: 0, hit: 0, jump: false }));
    this.gusts = (level.gusts || []).map((g) => ({ t: g[0], d: g[1], a: g[2], on: false }));
    const [sx, sy] = level.start;
    Object.assign(this, { x: sx, y: sy, vx: 0, vy: 0, th: 0, w: 0, b: level.butter ?? 1 });
    this.input = { turn: 0 };
    this.time = 0; this.ev = []; this.end = null;
    this.charge = 0; this.spin = 0; this.fight = 1; this.dizzy = 0; this.gust = 0;
    this.sit = null; this.sitT = 0; this.offGround = 0;
    this.hover = { h: 0, target: 0, gy: Infinity, water: false, none: true, solid: null };
    this.touch = null; this.lastSmear = -1; this.lastPaw = -1; this.lastSizzle = -1;
    this.broke = 0; this.tempted = false; this.lowSaid = false; this.spinSaid = false;
    this.contacts = [];
  }

  emit(e) { e.t = this.time; this.ev.push(e); }
  get headX() { return this.x + Math.cos(this.th) * (K.half + K.r * 0.6); }
  get headY() { return this.y + Math.sin(this.th) * (K.half + K.r * 0.6); }
  // how far the capsule reaches below its centre and to either side
  lowY() { return this.y + K.half * Math.abs(Math.sin(this.th)) + K.r; }
  extX() { return K.half * Math.abs(Math.cos(this.th)) + K.r; }
  sitting() { return !!this.sit; }

  // the nearest top below yFrom along x: a solid (ground) or water (no ground: the laws can't land on water)
  probe(x, yFrom) {
    let best = Infinity, water = false, solid = null;
    for (const s of this.solids) if (x >= s.x && x <= s.x + s.w && s.y >= yFrom - 3 && s.y < best) { best = s.y; solid = s; water = false; }
    for (const w of this.water) if (x >= w.x && x <= w.x + w.w && w.y >= yFrom - 3 && w.y < best) { best = w.y; solid = null; water = true; }
    return { y: best, water, solid };
  }
  ground() {
    const yl = this.lowY(), e = this.extX() * 0.7;
    let g = this.probe(this.x, yl);
    for (const dx of [-e, e]) { const p = this.probe(this.x + dx, yl); if (p.y < g.y) g = p; }
    const h = g.y - yl;
    return { gy: g.y, h, water: g.water, solid: g.solid, none: g.water || !isFinite(g.y) || h > K.reach };
  }

  tick() {
    const dt = DT; this.time += dt;
    if (this.end) { this.after(dt); return; }
    // ---- turning
    let turn = this.dizzy > 0 ? 0 : this.input.turn | 0;
    if (this.dizzy > 0) this.dizzy -= dt;
    let w = this.w;
    if (turn) {
      if (w * turn < -0.5) w += turn * K.brake * dt;
      else if (Math.abs(w) < K.w0) w = turn * K.w0;
      else w += turn * K.alpha * dt;
      w = clamp(w, -K.wmax, K.wmax);
    } else w *= Math.exp(-dt / (Math.abs(w) > K.keep ? K.tSpin : K.tStop));
    if (this.sit && !turn) { w = 0; this.th += angDiff(SIT, this.th) * (1 - Math.exp(-7 * dt)); }
    this.w = w; this.th = angDiff(this.th + w * dt, 0);
    // ---- the fight
    const c = clamp((Math.abs(Math.cos(this.th)) - K.end) / (1 - K.end)), s = clamp((Math.abs(w) - K.spin0) / (K.spinS - K.spin0));
    const tgt = s * s; this.charge += (tgt - this.charge) * (1 - Math.exp(-dt / (tgt > this.charge ? K.charge[0] : K.charge[1])));
    this.spin = s; this.fight = c;
    if (s > 0.6 && !this.spinSaid) { this.spinSaid = true; this.emit({ k: 'spin' }); } else if (s < 0.2) this.spinSaid = false;
    const g = this.ground(); this.hover = g;
    const target = K.H * bf(this.b) * (c + K.spinH * this.charge); g.target = target;
    let ax = 0, ay = G;
    if (this.sit) ax = -K.drag * this.vx; // sitting: the cushion is off, it rests on its bottom
    else if (!g.none) {
      ay = clamp(K.ks * (g.h - target) - K.kd * this.vy, -K.up * G, G);
      ax = K.T * btf(this.b) * Math.sin(2 * this.th) * 0.5 - K.drag * this.vx;
    } else ax = -K.dragAir * this.vx;
    // wind
    this.gust = 0;
    for (const q of this.gusts) {
      const u = (this.time - q.t) / q.d;
      if (u >= 0 && u <= 1) { this.gust = q.a * Math.sin(Math.PI * u); if (!q.on) { q.on = true; this.emit({ k: 'gust', dir: Math.sign(q.a) }); } }
    }
    ax += this.gust;
    this.vx += ax * dt; this.vy += ay * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    // ---- contacts
    this.contacts = this.collide();
    this.react(dt);
    if (this.end) return;
    this.objects(dt);
    this.hazards(dt, g);
    // ---- butter
    this.b -= (K.drip + K.fling * s * s) * dt;
    if (this.b < 0.25 && !this.lowSaid) { this.lowSaid = true; this.emit({ k: 'low' }); }
    if (this.b <= 0) { this.b = 0; this.emit({ k: 'nobutter' }); this.finish(false, 'butter'); return; }
    if (this.y > this.fallY) this.finish(false, 'fell');
  }

  // push the capsule out of the solids; returns the contacts of this tick
  collide() {
    const ca = Math.cos(this.th), sa = Math.sin(this.th), R = K.r, hits = [];
    for (let pass = 0; pass < 2; pass++) {
      for (const s of this.solids) {
        if (this.x + K.half + R < s.x || this.x - K.half - R > s.x + s.w || this.y + K.half + R < s.y || this.y - K.half - R > s.y + s.h) continue;
        let best = null;
        for (let i = 0; i < 5; i++) {
          const u = -1 + i * 0.5, px = this.x + ca * K.half * u, py = this.y + sa * K.half * u;
          const qx = clamp(px, s.x, s.x + s.w), qy = clamp(py, s.y, s.y + s.h);
          let nx = px - qx, ny = py - qy, pen;
          const d = Math.hypot(nx, ny);
          if (d > 1e-6) { pen = R - d; nx /= d; ny /= d; }
          else {
            const l = px - s.x, r = s.x + s.w - px, t = py - s.y, b = s.y + s.h - py, m = Math.min(l, r, t, b);
            if (m === t) { nx = 0; ny = -1; } else if (m === b) { nx = 0; ny = 1; } else if (m === l) { nx = -1; ny = 0; } else { nx = 1; ny = 0; }
            pen = R + m;
          }
          if (pen > 0 && (!best || pen > best.pen)) best = { pen, nx, ny, u, s };
        }
        if (!best) continue;
        this.x += best.nx * best.pen; this.y += best.ny * best.pen;
        const vn = this.vx * best.nx + this.vy * best.ny;
        if (vn < 0) {
          const e = 0.15;
          this.vx -= (1 + e) * vn * best.nx; this.vy -= (1 + e) * vn * best.ny;
          const tx = -best.ny, ty = best.nx, vt = this.vx * tx + this.vy * ty;
          const f = Math.min(Math.abs(vt), 0.35 * -vn * (1 + e)) * Math.sign(vt);
          this.vx -= f * tx; this.vy -= f * ty;
        }
        if (pass === 0) hits.push({ nx: best.nx, ny: best.ny, u: best.u, s: best.s, v: Math.max(0, -vn), x: this.x - best.nx * R + ca * K.half * best.u, y: this.y - best.ny * R + sa * K.half * best.u });
      }
    }
    return hits;
  }

  // what the contacts mean: sitting, bonking, the butter scraping, paws
  react(dt) {
    const fx = -Math.sin(this.th), fy = Math.cos(this.th); // the feet point this way
    let ground = null;
    for (const h of this.contacts) {
      const side = -(h.nx * fx + h.ny * fy); // > 0: the feet side touched; < 0: the butter
      if (h.ny < -0.6 && (!ground || h.s.y < ground.s.y)) ground = h;
      if (side < -0.45 && (h.v > 20 || Math.hypot(this.vx, this.vy) > 40)) {
        if (this.time - this.lastSmear > 0.22) {
          this.lastSmear = this.time; this.b -= K.smear * clamp(h.v / 200, 0.35, 1.4);
          this.emit({ k: 'smear', x: h.x, y: h.y, nx: h.nx, ny: h.ny, tag: h.s.tag });
        }
      } else if (side > 0.45 && h.v > 60 && this.time - this.lastPaw > 0.3) { this.lastPaw = this.time; this.emit({ k: 'paw', v: h.v }); }
      else if (h.v > 90 && Math.abs(side) <= 0.45 && !(h.u < 0 && Math.abs(angDiff(this.th, SIT)) < K.sitWin)) this.emit({ k: 'bump', v: h.v, x: h.x, y: h.y });
    }
    // hovering a finger's breadth over a floor, tail down: that's sitting too
    const hv = this.hover;
    if (!ground && !hv.none && hv.solid && hv.h < 4 && Math.abs(angDiff(this.th, SIT)) < K.sitWin) ground = { s: hv.solid, v: Math.max(0, this.vy), x: this.x, y: hv.gy, ny: -1, nx: 0 };
    const speed = Math.hypot(this.vx, this.vy);
    if (ground && Math.abs(angDiff(this.th, HEAD)) < 0.6 && this.dizzy <= 0) {
      this.dizzy = K.dizzy; this.vy = -Math.min(360, 240 + ground.v * 0.6); this.w = (this.rng() < 0.5 ? -1 : 1) * 9;
      this.emit({ k: 'bonk', x: ground.x, y: ground.y });
    }
    const sitAng = Math.abs(angDiff(this.th, SIT));
    if (!this.sit) {
      if (ground && sitAng < K.sitWin && speed < K.sitV) {
        this.sit = { s: ground.s, t: this.time }; this.offGround = 0;
        this.emit({ k: 'sit', x: this.x, y: ground.y, box: ground.s.tag === 'boxfloor', v: ground.v });
      }
    } else {
      this.offGround = ground ? 0 : this.offGround + dt;
      if (sitAng > K.sitWin + 0.2 || this.offGround > 0.12) { this.sit = null; this.emit({ k: 'rise' }); }
      else {
        if (ground) this.sit.s = ground.s;
        this.vx *= Math.exp(-9 * dt);
        const B = this.box;
        if (B && this.sit.s.tag === 'boxfloor' && this.x > B.in0 + 4 && this.x < B.in1 - 4 && this.time - this.sit.t > K.settle) this.finish(true, 'box');
      }
    }
    // water: the laws can't land on it, and a cat in the sink is a lost cat
    for (const w of this.water) {
      const ca = Math.cos(this.th), sa = Math.sin(this.th);
      for (const u of [-1, 0, 1]) {
        const px = this.x + ca * K.half * u, py = this.y + sa * K.half * u + K.r * 0.6;
        if (px > w.x && px < w.x + w.w && py > w.y) { this.emit({ k: 'splash', x: px, y: w.y }); this.finish(false, 'water'); return; }
      }
    }
  }

  // loose things: they fall, slide, break; the capsule knocks them and the cushion shoves them off tables
  objects(dt) {
    const ca = Math.cos(this.th), sa = Math.sin(this.th), hv = this.hover;
    for (const o of this.objs) {
      if (o.gone || o.broken) continue;
      // the cushion: a column under the capsule, as strong as the fight
      const ex = this.extX() + o.r, yl = this.lowY();
      if (!hv.none && Math.abs(o.x - this.x) < ex && o.y - o.r > yl - 4 && o.y - o.r < yl + hv.target + 6) {
        const k = K.push * this.fight * bf(this.b) * (1 - clamp((o.y - o.r - yl) / (hv.target + 6)) * 0.6);
        const dir = o.x >= this.x ? 1 : -1;
        o.vx += (dir * k * dt) / Math.max(0.15, o.m); o.sleep = false; o.still = 0;
      }
      // the capsule itself
      for (let i = 0; i < 5; i++) {
        const u = -1 + i * 0.5, px = this.x + ca * K.half * u, py = this.y + sa * K.half * u;
        const dx = o.x - px, dy = o.y - py, d = Math.hypot(dx, dy), m = K.r + o.r;
        if (d < m && d > 1e-6) {
          const nx = dx / d, ny = dy / d, pen = m - d;
          o.x += nx * pen; o.y += ny * pen; o.sleep = false;
          const rv = (o.vx - this.vx) * nx + (o.vy - this.vy) * ny;
          if (rv < 0) {
            const j = -(1.3 * rv) / (1 / o.m + 1 / K.mDev);
            o.vx += (j / o.m) * nx; o.vy += (j / o.m) * ny; o.va += ((o.vx * ny - o.vy * nx) / o.r) * 0.5;
            this.vx -= (j / K.mDev) * nx; this.vy -= (j / K.mDev) * ny;
            if (-rv > 30) this.emit({ k: 'nudge', id: o.id, v: -rv });
          }
        }
      }
      if (o.sleep) continue;
      o.vy += G * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.a += o.va * dt;
      let grounded = false;
      for (const s of this.solids) {
        const qx = clamp(o.x, s.x, s.x + s.w), qy = clamp(o.y, s.y, s.y + s.h);
        let nx = o.x - qx, ny = o.y - qy; const d = Math.hypot(nx, ny);
        if (d >= o.r) continue;
        if (d > 1e-6) { nx /= d; ny /= d; } else { nx = 0; ny = -1; }
        o.x += nx * (o.r - d); o.y += ny * (o.r - d);
        const vn = o.vx * nx + o.vy * ny;
        if (vn < 0) {
          if (o.fragile && -vn > 300) { this.shatter(o, s); break; }
          if (-vn > 160) this.emit({ k: 'thud', id: o.id, kind: o.k, v: -vn, x: o.x, y: o.y });
          o.vx -= 1.3 * vn * nx; o.vy -= 1.3 * vn * ny;
          if (ny < -0.6) { grounded = true; o.va = (o.vx / o.r) * 0.6; }
        }
        if (ny < -0.6) { grounded = true; o.rest = s; }
      }
      if (o.broken) continue;
      if (grounded) {
        o.vx *= Math.exp(-K.rub * dt);
        if (Math.abs(o.vx) < 4 && Math.abs(o.vy) < 20) { o.still += dt; if (o.still > 0.3) { o.sleep = true; o.vx = o.vy = 0; o.va = 0; this.landed(o); } }
        else o.still = 0;
      } else o.still = 0;
      if (o.y > this.fallY) { o.gone = true; this.landed(o, true); }
    }
  }
  landed(o, lost = false) {
    if (!o.fell && (lost || o.y + o.r > o.home + 25)) {
      o.fell = true; this.emit({ k: 'fell', id: o.id, kind: o.k, x: o.x, y: o.y + o.r });
      if (o.tempt && !this.tempted) { this.tempted = true; this.emit({ k: 'tempt', id: o.id, kind: o.k }); }
    }
  }
  shatter(o, s) {
    o.broken = true; o.sleep = true; o.y = s.y - 1; this.broke++;
    this.emit({ k: 'break', id: o.id, kind: o.k, x: o.x, y: s.y, tempt: o.tempt });
    if (o.y > o.home + 25 || !o.fell) this.landed(o);
  }

  hazards(dt, g) {
    // the cucumber: every cat on the internet jumps a metre
    for (const q of this.cukes) {
      q.cd -= dt;
      if (q.cd <= 0 && Math.hypot(this.headX - q.x, this.headY - (q.y - 6)) < 62) {
        q.cd = 6; this.vy = -560; this.w += (this.rng() < 0.5 ? -1 : 1) * 10; this.dizzy = Math.max(this.dizzy, 0.45);
        this.sit = null; this.emit({ k: 'cucumber', x: q.x, y: q.y });
      }
    }
    // a lit hob right below melts the butter
    if (!g.none && g.solid && g.solid.tag === 'hob' && g.h < 110) {
      this.b -= K.melt * dt;
      if (this.time - this.lastSizzle > 0.45) { this.lastSizzle = this.time; this.emit({ k: 'sizzle' }); }
    }
    // the ceiling fan
    for (const f of this.fans) {
      f.cd -= dt; f.a += dt * 14;
      const dx = this.x - f.x, dy = this.y - f.y, d = Math.hypot(dx, dy);
      if (f.cd <= 0 && Math.abs(dx) < f.r + K.half && Math.abs(dy) < 16 + K.r) {
        f.cd = 0.6; const s = dx >= 0 ? 1 : -1;
        this.vx = s * 260; this.vy = 240; this.w += s * 7; this.b -= K.fan;
        this.emit({ k: 'fan', x: this.x, y: f.y, d });
      }
    }
    // the dog: walks its stretch of floor, and jumps at a cat flying low in front of its nose
    for (const d of this.dogs) {
      d.cd -= dt; d.bark -= dt; d.hit -= dt;
      const dx = this.x - d.x, low = this.lowY() > d.y - 125, ahead = dx * d.dir > 0;
      if (!d.jump) {
        if (low && ahead && Math.abs(dx) < 140 && d.cd <= 0) {
          d.jump = true; d.jvy = -420; d.jvx = clamp(dx * 1.4 + this.vx * 0.4, -220, 220); d.cd = 1.8;
          this.emit({ k: 'woof', x: d.x, jump: true });
        } else {
          d.x += d.dir * d.v * dt;
          if (d.x > d.x1) { d.x = d.x1; d.dir = -1; } else if (d.x < d.x0) { d.x = d.x0; d.dir = 1; }
        }
        if (low && Math.abs(dx) < 260 && d.bark <= 0) { d.bark = 1.1; this.emit({ k: 'woof', x: d.x }); }
      } else {
        d.jvy += G * dt; d.jy += d.jvy * dt; d.x = clamp(d.x + d.jvx * dt, d.x0 - 40, d.x1 + 40);
        if (d.jy >= 0) { d.jy = 0; d.jvy = 0; d.jump = false; d.jvx = 0; }
      }
      if (d.hit > 0) continue;
      const ca = Math.cos(this.th), sa = Math.sin(this.th);
      hit: for (const [hx, hy, hr] of [[d.x + d.dir * 24, d.y - 42 + d.jy, 15], [d.x, d.y - 26 + d.jy, 19]]) {
        for (const u of [-1, 0, 1]) {
          const px = this.x + ca * K.half * u, py = this.y + sa * K.half * u, ddx = px - hx, ddy = py - hy, dd = Math.hypot(ddx, ddy);
          if (dd < K.r + hr && dd > 1e-6) {
            const nx = ddx / dd, ny = ddy / dd;
            this.vx = nx * 280 + d.dir * 140; this.vy = Math.min(this.vy, ny * 280 - 160); this.w += d.dir * 7;
            this.dizzy = Math.max(this.dizzy, 0.35); this.sit = null; d.hit = 0.8;
            this.emit({ k: 'knock', x: px, y: py });
            break hit;
          }
        }
      }
    }
  }

  // after the end: the physics keeps going for the show (the fall onto its feet, the splash)
  after(dt) {
    const e = this.end;
    if (e.win) { this.w = 0; this.th += angDiff(SIT, this.th) * (1 - Math.exp(-8 * dt)); this.vx *= Math.exp(-10 * dt); return; }
    if (e.why === 'butter') { this.w *= Math.exp(-dt / 0.2); this.th += angDiff(0, this.th) * (1 - Math.exp(-6 * dt)); }
    if (e.why === 'water') { this.vx *= Math.exp(-6 * dt); this.vy = Math.min(this.vy + G * dt, 60); this.y += this.vy * dt; this.x += this.vx * dt; return; }
    this.vy += G * dt; this.vx *= Math.exp(-1 * dt); this.x += this.vx * dt; this.y += this.vy * dt;
    this.collide();
  }

  finish(win, why) {
    if (this.end) return;
    const par = this.lv.par ?? 0.5;
    const stars = win ? 1 + (this.tempted ? 1 : 0) + (this.b >= par ? 1 : 0) : 0;
    this.end = { win, why, t: this.time, butter: this.b, broke: this.broke, tempted: this.tempted, par, stars };
    this.emit({ k: 'end', win, why, stars });
  }
}
