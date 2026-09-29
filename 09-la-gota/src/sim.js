// LA GOTA — the race down a fogged bus window. Deterministic at 120 Hz, no DOM: it runs in Node for the
// tests. Centimetres, y down: the pane is 12 × 21 cm and the rubber seal along the bottom is the finish.
// The glass is a grid of 1.25 mm cells holding the fog (f), the wet lanes (L) and what the glass itself
// is like: hb, how hard it grips a drop (contact-angle hysteresis), and fmax, how much fog it can hold.
import { clamp, mulberry32, hashStr } from './util.js';

export const PW = 12, PH = 21, CELL = 0.125, GW = PW / CELL, GH = PH / CELL, DT = 1 / 120;
export const YOU = 0, NEUTRAL = -1;
export const K = {
  a: 13.4,        // pull of gravity on a drop, per r² (cm/s per cm²)
  b: 0.84,        // grip per unit of hysteresis (cm/s): a drop of r = √(b/a) = 0.25 cm just holds on clean glass
  laneCut: 0.8,   // how much a fresh lane lowers the grip
  fogH: 0.12,     // fog grips a little more than bare glass
  kL: 11.5,       // a lane's pull on the edge of a drop that touches it, per cm of radius (half the rim wet ≈ 0.3 of it)
  kN: 0.3,        // the glass's own unevenness, per cm of radius per unit of gradient
  mob: 0.5,       // how easily a drop that has let go slides (sets the pace of a race, not who can move)
  vmax: 18,
  cF: 0.01,       // water a drop gets from a cm² of thick fog (cm³): the fog is food
  cW: 0.01,       // …and from a cm² of fresh lane: a wipe doesn't destroy the fog's water, it smears it into a film
  cC: 0.0011,     // condensation straight onto a drop, per cm of radius per s at full humidity (cm³)
  cS: 0.0005,     // what a drop leaves behind in beads on dry glass, per cm² swept (cm³)
  trail: 0.55,    // how wet the track behind a running drop stays
  finger: 0.65,   // fingertip wipe radius (cm)
  core: 0.42,     // inside this the wipe is total
  touch: 0.35,    // a fingertip this close to a drop's edge has touched it
  merge: 0.85,
  reach: 0.35,    // a running drop reaches for a drop whose edge is this close (cm) …
  kR: 3,          // … with this pull per cm of its radius, strongest at contact
  busGain: 1.6,   // the bus's pull and brake on the drops, a little louder than life
  stickW: 0.3,
};
export const volOf = (r) => 1.28 * r * r * r;
export const radOf = (V) => Math.cbrt(Math.max(0, V) / 1.28);
// the steepest lane (from vertical) a drop of radius r can still be held in
export const holdAngle = (r) => Math.asin(Math.min(1, (K.kL * 0.3) / (K.a * r)));
// the rim: a drop feels the glass where its contact line is
const RIM = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)]);

// smooth value noise on a 1 cm lattice, in [-1, 1]
function vnoise(seed) {
  const h = (i, j) => {
    let n = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (((n ^ (n >>> 16)) >>> 0) / 4294967296) * 2 - 1;
  };
  return (x, y) => {
    const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    return (h(i, j) * (1 - su) + h(i + 1, j) * su) * (1 - sv) + (h(i, j + 1) * (1 - su) + h(i + 1, j + 1) * su) * sv;
  };
}
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 1e-9 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
};

// ---------- the bus: a script of pull-aways, brakes, stops and cobbles in race time ----------
export class Bus {
  constructor(script) {
    this.s = script.slice().sort((p, q) => p[1] - q[1]); this.i = 0;
    this.v = 0; this.a = 0; this.to = 0; this.rate = 1; this.dist = 0;
    this.doors = 0; this.ay = 0; this.jolts = []; this.cob = 0; this.cobAmp = 0; this.stopped = true;
  }
  step(t, dt, rng, emit) {
    while (this.i < this.s.length && this.s[this.i][1] <= t) {
      const [k, , p, q] = this.s[this.i++];
      if (k === 'go') { this.to = p; this.rate = q; emit({ k: 'bus', what: 'go' }); }
      else if (k === 'brake') { this.to = p; this.rate = q; emit({ k: 'bus', what: q >= 3.5 ? 'hard' : 'brake' }); }
      else if (k === 'doors') { this.doors = p; emit({ k: 'bus', what: 'doors' }); }
      else if (k === 'bump') { for (let j = 0; j < p; j++) this.jolts.push(t + j * 0.28, q); emit({ k: 'bus', what: 'bump' }); }
      else if (k === 'cobbles') { this.cob = p; this.cobAmp = q; emit({ k: 'bus', what: 'cobbles' }); }
    }
    const dv = clamp(this.to - this.v, -this.rate * dt, this.rate * dt);
    this.v += dv; this.a = dv / dt; this.dist += this.v * dt;
    if (this.stopped !== (this.v < 0.05)) { this.stopped = this.v < 0.05; if (this.stopped) emit({ k: 'bus', what: 'still' }); }
    if (this.doors > 0) { this.doors -= dt; if (this.doors <= 0) emit({ k: 'bus', what: 'shut' }); }
    // jolts: a kick up then a smaller one down, 50 ms each
    let ay = 0;
    for (let j = 0; j < this.jolts.length; j += 2) {
      const u = t - this.jolts[j];
      if (u >= 0 && u < 0.05) ay += this.jolts[j + 1]; else if (u >= 0.05 && u < 0.1) ay -= this.jolts[j + 1] * 0.6;
    }
    this.jolts = this.jolts.filter((x, j, arr) => (j % 2 ? t - arr[j - 1] < 0.1 : t - x < 0.1));
    if (this.cob > 0) { this.cob -= dt; if (this.v > 1) ay += (rng() - 0.5) * 2 * this.cobAmp * Math.min(1, this.v / 6); }
    this.ay = ay;
  }
}

export class Sim {
  constructor(level, opts = {}) {
    this.lv = level;
    const seed = (hashStr(level.id) ^ (opts.seed || 0)) >>> 0;
    this.rng = mulberry32(seed);
    this.f = new Float32Array(GW * GH); this.Lf = new Float32Array(GW * GH);
    this.hb = new Float32Array(GW * GH); this.eta = new Float32Array(GW * GH); this.fmax = new Float32Array(GW * GH);
    this.wall = new Uint8Array(GW * GH); this.heat = new Float32Array(GW * GH);
    this.fog = { max: 0.85, regen: 0.25, lane: 5, ...level.fog };
    this.sticks = (level.stickers || []).map((s) => ({ ...s }));
    this.buildGlass(seed);
    this.drops = []; this.nid = 1;
    this.kids = [{ own: YOU, name: 'you', drop: 0 }];
    for (const r of level.rivals) this.kids.push({ own: this.kids.length, name: r.kid, drop: 0, at: r.at, cand: r.cand, out: null });
    this.cands = level.cands.map(([x, y, r]) => this.spawn(x, y, r, NEUTRAL).id);
    this.seedFood();
    this.bus = new Bus(level.bus);
    this.phase = 'call'; this.time = 0; this.race = 0; this.readyAt = 0; this.n = 0;
    this.input = { down: false, x: 0, y: 0 }; this.fx = null; this.fy = null;
    this.ev = []; this.end = null; this.ate = 0; this.beads = 0; this.wiped = 0; this.first = [];
  }

  // ---------- the glass ----------
  buildGlass(seed) {
    const n1 = vnoise(seed), n2 = vnoise(seed ^ 0x9e3779b9), lv = this.lv, heat = lv.heater || 0;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const x = (i + 0.5) * CELL, y = (j + 0.5) * CELL, k = j * GW + i;
      const e = n1(x, y) * 0.7 + n2(x * 2.1, y * 2.1) * 0.3;
      this.eta[k] = e; this.hb[k] = 1 + 0.3 * e;
      // the fog is thicker up high, where the warm breath gets to first, and thins towards the seal
      let fm = this.fog.max * (1.05 - 0.15 * (y / PH));
      if (heat && y > PH - heat) { const u = (y - (PH - heat)) / heat; fm *= Math.max(0, 1 - u * 2.2); this.heat[k] = Math.min(1, u * 1.6); }
      this.fmax[k] = clamp(fm);
      this.f[k] = this.fmax[k] * (0.82 + 0.18 * (0.5 + 0.5 * n2(x * 0.7, y * 0.7)));
    }
    for (const [ax, ay, bx, by] of lv.scratches || []) {
      this.forCells(Math.min(ax, bx) - 0.3, Math.min(ay, by) - 0.3, Math.max(ax, bx) + 0.3, Math.max(ay, by) + 0.3, (k, x, y) => {
        const d = segDist(x, y, ax, ay, bx, by);
        if (d < 0.18) this.hb[k] = Math.max(this.hb[k], 2.6 - d * 4);
      });
    }
    for (const s of this.sticks) this.forCells(s.x - 0.3, s.y - 0.3, s.x + s.w + 0.3, s.y + s.h + 0.3, (k, x, y) => {
      if (this.inStick(s, x, y, 0)) { this.wall[k] = 1; this.fmax[k] = 0; this.f[k] = 0; }
    });
  }
  forCells(x0, y0, x1, y1, fn) {
    const i0 = Math.max(0, Math.floor(x0 / CELL)), i1 = Math.min(GW - 1, Math.floor(x1 / CELL));
    const j0 = Math.max(0, Math.floor(y0 / CELL)), j1 = Math.min(GH - 1, Math.floor(y1 / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * GW + i, (i + 0.5) * CELL, (j + 0.5) * CELL);
  }
  // bilinear sample of a field at (x, y)
  at(F, x, y) {
    const cx = clamp(x / CELL - 0.5, 0, GW - 1.001), cy = clamp(y / CELL - 0.5, 0, GH - 1.001);
    const i = cx | 0, j = cy | 0, u = cx - i, v = cy - j, k = j * GW + i;
    return (F[k] * (1 - u) + F[k + 1] * u) * (1 - v) + (F[k + GW] * (1 - u) + F[k + GW + 1] * u) * v;
  }
  inStick(s, x, y, pad) {
    if (s.k === 'circ') return Math.hypot(x - s.x - s.w / 2, y - s.y - s.h / 2) < s.w / 2 + pad;
    return x > s.x - pad && x < s.x + s.w + pad && y > s.y - pad && y < s.y + s.h + pad;
  }
  // grip of the glass at a point: its own, eased by a lane, stiffened a touch by fog
  grip(x, y) { return this.at(this.hb, x, y) * (1 - K.laneCut * Math.min(1.3, this.at(this.Lf, x, y))) + K.fogH * this.at(this.f, x, y); }
  // what a drop's rim feels: the mean grip around it, and the pull of the wet side (into a lane it touches)
  rim(x, y, r) {
    let h = 0, px = 0, py = 0;
    const rho = r + 0.04;
    for (const [c, s] of RIM) {
      const X = x + c * rho, Y = y + s * rho, l = Math.min(1.3, this.at(this.Lf, X, Y));
      h += this.at(this.hb, X, Y) * (1 - K.laneCut * l) + K.fogH * this.at(this.f, X, Y);
      px += l * c; py += l * s;
    }
    return [h / 8, px / 8, py / 8];
  }

  // ---------- drops ----------
  spawn(x, y, r, own) {
    const d = { id: this.nid++, x, y, r, V: volOf(r), vx: 0, vy: 0, own, alive: true, pin: true, fin: -1, born: this.time, gone: null };
    this.drops.push(d);
    return d;
  }
  drop(id) { for (const d of this.drops) if (d.id === id) return d; return null; }
  seedFood() {
    const { n = 20, r = [0.12, 0.27], top = 6 } = this.lv.food || {}, rng = this.rng;
    let tries = 0, made = 0;
    while (made < n && tries++ < n * 40) {
      const x = 0.8 + rng() * (PW - 1.6), y = top + rng() * (PH - top - 3), rr = r[0] + (r[1] - r[0]) * Math.pow(rng(), 1.6);
      if (this.fmax[this.cell(x, y)] < 0.2 && !(this.lv.heater && y > PH - this.lv.heater)) continue;
      if (this.wall[this.cell(x, y)] || this.drops.some((d) => Math.hypot(d.x - x, d.y - y) < d.r + rr + 1.1)) continue;
      this.spawn(x, y, rr, NEUTRAL); made++;
    }
  }
  cell(x, y) { return clamp(Math.floor(y / CELL), 0, GH - 1) * GW + clamp(Math.floor(x / CELL), 0, GW - 1); }
  you() { return this.drop(this.kids[0].drop); }
  ownerOf(id) { for (const k of this.kids) if (k.drop === id && !k.out) return k.own; return NEUTRAL; }

  // ---------- the call: «¡Me pido esa!» ----------
  call(id) {
    if (this.phase !== 'call' || this.kids[0].drop || !this.cands.includes(id)) return false;
    if (this.kids.some((k) => k.own !== YOU && !k.drop)) return false;
    if (this.kids.some((k) => k.drop === id)) return false;
    this.claim(this.kids[0], id);
    this.phase = 'ready'; this.readyAt = this.time + 1.1;
    this.emit({ k: 'ready' });
    return true;
  }
  claim(kid, id) { kid.drop = id; const d = this.drop(id); d.own = kid.own; this.emit({ k: 'call', own: kid.own, id }); }
  free() { return this.cands.filter((id) => !this.kids.some((k) => k.drop === id)); }

  emit(e) { if (!this.end || e.k === 'end' || e.k === 'merge' || e.k === 'seal') this.ev.push(e); }

  tick() {
    this.ev.length = 0; this.n++;
    this.time += DT;
    if (this.phase === 'call') {
      for (const k of this.kids) if (k.own !== YOU && !k.drop && this.time >= k.at) {
        const want = this.cands[k.cand];
        this.claim(k, this.kids.some((q) => q.drop === want) ? this.free()[0] : want);
      }
      if (this.time > (this.lv.autoCall || 9) && this.kids.every((k) => k.own === YOU || k.drop)) {
        const f = this.free().map((id) => this.drop(id)).sort((p, q) => Math.abs(p.x - PW / 2) - Math.abs(q.x - PW / 2));
        this.call(f[0].id);
      }
      this.fields(DT, true);
      return;
    }
    if (this.phase === 'ready') {
      if (this.time >= this.readyAt) { this.phase = 'race'; this.emit({ k: 'go' }); }
      this.fields(DT, true);
      return;
    }
    this.race += DT;
    this.bus.step(this.race, DT, this.rng, (e) => this.emit(e));
    if (!this.end) this.finger();
    this.move(DT);
    this.merges();
    if (this.n % 4 === 0) this.fields(DT * 4, false);
    if (!this.end) this.judge();
  }

  // ---------- the fingertip ----------
  finger() {
    const inp = this.input;
    if (!inp.down) { this.fx = this.fy = null; return; }
    const x = clamp(inp.x, 0, PW), y = clamp(inp.y, 0, PH);
    const ax = this.fx ?? x, ay = this.fy ?? y;
    this.fx = x; this.fy = y;
    const R = K.finger;
    // what the tip touches
    for (const d of this.drops) {
      if (!d.alive || d.fin >= 0) continue;
      if (segDist(d.x, d.y, ax, ay, x, y) > d.r + K.touch) continue;
      const own = this.ownerOf(d.id);
      if (own === YOU) { this.kill(d, 'squash'); this.finish(false, 'squash'); return; }
      if (own > 0) { this.kill(d, 'cheat'); this.finish(false, 'cheat', own); return; }
      // a stray drop smears into the stroke: the lane there is wetter than any
      this.kill(d, 'smear');
      this.forCells(d.x - 1, d.y - 1, d.x + 1, d.y + 1, (k, cx, cy) => { if (Math.hypot(cx - d.x, cy - d.y) < 0.9) this.Lf[k] = Math.max(this.Lf[k], 1.3); });
      this.emit({ k: 'smear', x: d.x, y: d.y });
    }
    // the wipe: a capsule from the last sample to this one
    let wiped = 0;
    this.forCells(Math.min(ax, x) - R, Math.min(ay, y) - R, Math.max(ax, x) + R, Math.max(ay, y) + R, (k, cx, cy) => {
      if (this.wall[k]) return;
      const dd = segDist(cx, cy, ax, ay, x, y);
      if (dd >= R) return;
      const u = dd <= K.core ? 1 : 1 - (dd - K.core) / (R - K.core);
      wiped += this.f[k] * u;
      this.f[k] *= 1 - u;
      this.Lf[k] = Math.max(this.Lf[k], u);
    });
    this.wiped += wiped * CELL * CELL;
  }
  kill(d, why, by = null) { d.alive = false; d.gone = why; d.by = by; d.t0 = this.time; }

  // ---------- motion: gravity and the bus against the grip, lanes and unevenness pulling sideways ----------
  move(dt) {
    const ax = (K.busGain * this.bus.a) / 9.81, ay = this.bus.ay;
    for (const d of this.drops) {
      if (!d.alive || d.fin >= 0) continue;
      const r = d.r, x = d.x, y = d.y;
      const g = K.a * r * r;
      const [h, lx, ly] = this.rim(x, y, r);
      const ex = (this.at(this.eta, x + 0.4, y) - this.at(this.eta, x - 0.4, y)) / 0.8;
      const ey = (this.at(this.eta, x, y + 0.4) - this.at(this.eta, x, y - 0.4)) / 0.8;
      let nx = g * ax + K.kL * r * lx - K.kN * r * ex, ny = g * (1 + ay) + K.kL * r * ly - K.kN * r * ey;
      // a running drop's edge wobbles out and grabs whatever it passes close to
      if (!d.pin) for (const q of this.drops) {
        if (q === d || !q.alive || q.fin >= 0) continue;
        const qx = q.x - x, qy = q.y - y, lim = r + q.r + K.reach;
        if (qx > lim || qx < -lim || qy > lim || qy < -lim) continue;
        const l = Math.hypot(qx, qy), gap = l - r - q.r;
        if (gap >= K.reach || l < 1e-6) continue;
        const f = K.kR * r * (1 - Math.max(0, gap) / K.reach);
        nx += (qx / l) * f; ny += (qy / l) * f;
      }
      // walls: the frame at the sides and the stickers take what pushes into them
      for (const [wx, wy, st] of this.contacts(d)) {
        const dot = nx * wx + ny * wy; if (dot < 0) { nx -= dot * wx; ny -= dot * wy; }
        // a sticker's top edge is never quite level: water sitting on it creeps to the nearer end and drips off
        if (st && wy < -0.9) nx += (x < st.x + st.w / 2 ? -1 : 1) * g * 0.5;
      }
      const pin = K.b * h, m = Math.hypot(nx, ny);
      d.h = h;
      if (m <= pin) { d.vx = 0; d.vy = 0; if (!d.pin) { d.pin = true; } continue; }
      if (d.pin) { d.pin = false; if (this.ownerOf(d.id) !== NEUTRAL) this.emit({ k: 'slip', id: d.id }); }
      const sp = Math.min(K.vmax, (K.mob * (m - pin)) / (0.8 + 0.2 * h));
      d.vx = (nx / m) * sp; d.vy = (ny / m) * sp;
      d.x += d.vx * dt; d.y += d.vy * dt;
      this.collide(d);
      if (d.y + d.r >= PH - 0.25) this.seal(d);
    }
  }
  seal(d) {
    d.y = PH - 0.25 - d.r; d.fin = this.race; d.vx = d.vy = 0;
    const own = this.ownerOf(d.id);
    if (own !== NEUTRAL) { this.first.push(d); this.emit({ k: 'seal', id: d.id, own }); }
  }
  contacts(d) {
    const out = [];
    if (d.x - d.r <= 0.02) out.push([1, 0]);
    if (d.x + d.r >= PW - 0.02) out.push([-1, 0]);
    for (const s of this.sticks) {
      if (!this.inStick(s, d.x, d.y, d.r + 0.03)) continue;
      out.push([...this.normal(s, d.x, d.y), s.k === 'rect' ? s : null]);
    }
    return out;
  }
  normal(s, x, y) {
    if (s.k === 'circ') { const cx = s.x + s.w / 2, cy = s.y + s.h / 2, l = Math.hypot(x - cx, y - cy) || 1; return [(x - cx) / l, (y - cy) / l]; }
    const cx = clamp(x, s.x, s.x + s.w), cy = clamp(y, s.y, s.y + s.h), l = Math.hypot(x - cx, y - cy);
    if (l > 1e-6) return [(x - cx) / l, (y - cy) / l];
    return y < s.y + s.h / 2 ? [0, -1] : [0, 1];
  }
  collide(d) {
    d.x = clamp(d.x, d.r, PW - d.r);
    for (const s of this.sticks) {
      if (!this.inStick(s, d.x, d.y, d.r)) continue;
      if (s.k === 'circ') {
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2, l = Math.hypot(d.x - cx, d.y - cy) || 1, R = s.w / 2 + d.r;
        d.x = cx + ((d.x - cx) / l) * R; d.y = cy + ((d.y - cy) / l) * R;
      } else {
        const px = clamp(d.x, s.x, s.x + s.w), py = clamp(d.y, s.y, s.y + s.h), l = Math.hypot(d.x - px, d.y - py);
        if (l > 1e-6) { d.x = px + ((d.x - px) / l) * d.r; d.y = py + ((d.y - py) / l) * d.r; }
        else d.y = s.y - d.r;
      }
    }
  }

  // ---------- merging: the bigger drop keeps its owner ----------
  merges() {
    const D = this.drops;
    for (let i = 0; i < D.length; i++) {
      const p = D[i]; if (!p.alive) continue;
      for (let j = i + 1; j < D.length; j++) {
        const q = D[j]; if (!q.alive) continue;
        const lim = K.merge * (p.r + q.r), dx = q.x - p.x, dy = q.y - p.y;
        if (dx > lim || dx < -lim || dy > lim || dy < -lim || dx * dx + dy * dy > lim * lim) continue;
        this.join(p, q);
        if (!p.alive) break;
      }
    }
  }
  join(p, q) {
    const op = this.ownerOf(p.id), oq = this.ownerOf(q.id);
    // who survives: an owned drop over a stray one; between two owned ones, the bigger
    let big = p, small = q;
    if ((op === NEUTRAL && oq !== NEUTRAL) || (op !== NEUTRAL && oq !== NEUTRAL && q.V > p.V) || (op === NEUTRAL && oq === NEUTRAL && q.V > p.V)) { big = q; small = p; }
    const V = big.V + small.V;
    big.x = (big.x * big.V + small.x * small.V) / V; big.y = (big.y * big.V + small.y * small.V) / V;
    big.V = V; big.r = radOf(V);
    big.x = clamp(big.x, big.r, PW - big.r);
    const os = this.ownerOf(small.id), ob = this.ownerOf(big.id);
    this.kill(small, 'merged', big.id);
    this.emit({ k: 'merge', id: big.id, other: small.id, x: big.x, y: big.y, r: big.r, own: ob, lost: os });
    if (os === NEUTRAL && ob === YOU) this.beads++;
    if (os !== NEUTRAL) {
      const kid = this.kids[os]; kid.out = 'eaten';
      if (os === YOU) { this.emit({ k: 'eaten', by: ob }); this.finish(false, 'eaten', ob); }
      else { this.emit({ k: 'eat', own: ob, victim: os }); if (ob === YOU) this.ate++; }
    }
    // swallowing a bead that already sits on the seal puts the drop on the seal too
    if (big.fin < 0 && (small.fin >= 0 || big.y + big.r >= PH - 0.25)) this.seal(big);
    else if (big.fin >= 0) big.y = PH - 0.25 - big.r;
  }

  // ---------- the slow part, 30 times a second: fog comes back, lanes dry, drops drink ----------
  fields(dt, still) {
    const f = this.f, L = this.Lf, fmax = this.fmax, kf = 1 - Math.exp(-this.fog.regen * this.regenBoost() * dt);
    const decay = Math.exp(-dt / this.fog.lane), hot = Math.exp(-dt / (this.fog.lane * 0.3));
    if (!still) for (let k = 0; k < f.length; k++) {
      f[k] += (fmax[k] - f[k]) * kf * (1 - 0.5 * Math.min(1, L[k]));
      L[k] *= this.heat[k] > 0 ? decay + (hot - decay) * this.heat[k] : decay;
    }
    for (const d of this.drops) {
      if (!d.alive || d.fin >= 0) continue;
      // drink the fog and the lane's film under the drop; a running one leaves a thinner film behind it
      let got = 0, film = 0; const rr = d.r * 0.95;
      this.forCells(d.x - rr, d.y - rr, d.x + rr, d.y + rr, (k, cx, cy) => {
        if (Math.hypot(cx - d.x, cy - d.y) > rr) return;
        got += f[k]; f[k] = 0;
        if (L[k] > K.trail) { film += L[k] - K.trail; L[k] = K.trail; }
      });
      if (!d.pin && !still) {
        const sp = Math.hypot(d.vx, d.vy) || 1, bx = d.x - (d.vx / sp) * d.r * 1.3, by = d.y - (d.vy / sp) * d.r * 1.3, tr = d.r * 0.8;
        this.forCells(bx - tr, by - tr, bx + tr, by + tr, (k, cx, cy) => { if (Math.hypot(cx - bx, cy - by) <= tr) L[k] = Math.max(L[k], K.trail); });
      }
      let dV = (got * K.cF + film * K.cW) * CELL * CELL;
      const hum = this.at(fmax, d.x, d.y);
      if (!still) dV += K.cC * d.r * hum * dt * (this.lv.grow || 1);
      if (!d.pin && !still) {
        const ds = Math.hypot(d.vx, d.vy) * dt, dry = 1 - Math.min(1, this.at(f, d.x, d.y + d.r) * 3 + this.at(L, d.x, d.y));
        dV -= K.cS * 2 * d.r * ds * Math.max(0, dry) * (1 + 2.5 * this.at(this.heat, d.x, d.y));
      }
      d.V = Math.max(volOf(0.05), d.V + dV); d.r = radOf(d.V);
      if (d.r < 0.07 && this.ownerOf(d.id) === NEUTRAL) this.kill(d, 'dried');
    }
    if (!still) this.nucleate(dt);
    if (this.n % 240 === 0) this.drops = this.drops.filter((d) => d.alive || this.time - d.t0 < 2);
  }
  regenBoost() { return this.bus.doors > 0 ? 2.2 : 1; }
  // new beads condense out of thick fog
  nucleate(dt) {
    const rate = (this.lv.nuc ?? 0.6) * this.regenBoost(), alive = this.drops.reduce((n, d) => n + (d.alive ? 1 : 0), 0);
    if (alive > 70) return;
    let k = rate * dt;
    while (k > 0) {
      if (this.rng() >= k) break;
      k -= 1;
      const x = 0.6 + this.rng() * (PW - 1.2), y = 1 + this.rng() * (PH - 3), c = this.cell(x, y);
      if (this.f[c] < 0.75 || this.wall[c]) continue;
      if (this.drops.some((d) => d.alive && Math.abs(d.x - x) < 1.4 && Math.abs(d.y - y) < 1.4)) continue;
      this.spawn(x, y, 0.1 + this.rng() * 0.06, NEUTRAL).fresh = true;
    }
  }

  // ---------- who won ----------
  judge() {
    if (this.first.length) {
      const d = this.first.sort((p, q) => q.y + q.r - (p.y + p.r))[0], own = this.ownerOf(d.id);
      this.first.length = 0;
      if (own === YOU) this.finish(true, 'won');
      else if (own > 0) this.finish(false, 'beaten', own);
      return;
    }
    if (this.race >= this.lv.stop) this.finish(false, 'stop');
  }
  // how far each called drop still has to go to the seal
  gap(own) { const k = this.kids[own], d = k && !k.out ? this.drop(k.drop) : null; return d && d.alive ? Math.max(0, PH - 0.25 - d.y - d.r) : null; }
  finish(win, why, by = null) {
    if (this.end) return;
    const me = this.you();
    let margin = null;
    if (win) { margin = Infinity; for (const k of this.kids) if (k.own !== YOU && !k.out) { const g = this.gap(k.own); if (g != null) margin = Math.min(margin, g); } }
    if (margin === Infinity) margin = PH;
    // ★ win · ★ by a clear margin · ★ glutton: swallowed a rival, or enough stray beads
    const glut = this.ate > 0 || this.beads >= (this.lv.beads || 3);
    const stars = win ? 1 + (margin >= this.lv.margin ? 1 : 0) + (glut ? 1 : 0) : 0;
    this.end = { win, why, by, t: this.race, margin, ate: this.ate, beads: this.beads, glut, r: me && me.alive ? me.r : 0, left: win ? 0 : this.gap(YOU), stars };
    this.emit({ k: 'end', ...this.end });
  }
}
