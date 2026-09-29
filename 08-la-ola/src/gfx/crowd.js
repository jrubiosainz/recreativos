// Everything alive in the bowl, every frame: the crowd (thousands of stamps from the atlas, far to near,
// each row a beat behind the one in front), the LED ribbon boards round the pitch that paint each wave's
// laps, and the twenty-two players knocking the ball about at 0–0.
import { Sim, UP, K, P as SP, ringDelta } from '../sim.js';
import { Crowd } from './people.js';
import { FRONT } from './geom.js';
import { pitchSize } from './stadium.js';
import { clamp, mulberry32, TAU } from '../util.js';

export const LAP = ['#ffb31a', '#39ff7a', '#3fd8ff', '#ff5fd2', '#ffffff'];
// the colour of the lap a wave is on, as the ring shows it; grey when nothing got going
export const lapColour = (laps) => (laps > 0 ? LAP[Math.min(LAP.length - 1, Math.floor(laps + 1e-6))] : '#5b6070');
const ROWLAG = 0.022; // seconds each row waits for the one in front
const RIB = 1.15;     // the ribbon boards: metres out from the pitch-side edge

const hash01 = (a, b) => { let h = Math.imul(a * 73856093 ^ b * 19349663, 0x9e3779b1); h ^= h >>> 13; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

export class CrowdLayer {
  build(bowl, view, ring, lv, wx) {
    const C = bowl.C, rows = bowl.rows, n = C * rows;
    this.bowl = bowl; this.view = view; this.ring = ring; this.wx = wx; this.rows = rows; this.C = C;
    this.u = 0.8 * view.s;
    this.atlas = new Crowd(this.u, { light: wx.light, rain: !!wx.rain });
    this.order = view.order(bowl);
    this.sx = new Float32Array(n); this.sy = new Float32Array(n); this.look = new Uint16Array(n);
    this.occ = new Uint8Array(n); this.h = new Float32Array(n); this.face = new Uint8Array(C);
    for (let i = 0; i < C; i++) {
      this.face[i] = view.backTo(bowl, i) ? 1 : 0;
      for (let r = 0; r < rows; r++) {
        const k = i * rows + r, q = bowl.seat(i, r), s = view.p(q[0], q[1], q[2]);
        this.sx[k] = s[0]; this.sy[k] = s[1];
        this.occ[k] = hash01(i + 11, r + 3) < ring.fill[i] ? 1 : 0;
        this.h[k] = hash01(i * 3 + 1, r * 7 + 5);
        this.look[k] = this.atlas.lookFor(ring.kind[i], i, r);
      }
    }
    // the pitch sits between the far stand and the near one
    const split = view.p(0, 0, 0)[1];
    let m = 0; while (m < n && this.sy[this.order[m]] < split) m++;
    this.split = m;
    // the ribbon: one segment per column
    this.rib = new Float32Array(C * 2 + 2);
    for (let i = 0; i <= C; i++) { const q = bowl.pt(i - 0.5, RIB), s = view.p(q[0], q[1], 0.45); this.rib[i * 2] = s[0]; this.rib[i * 2 + 1] = s[1]; }
    this.ribFar = new Uint8Array(C);
    for (let i = 0; i < C; i++) this.ribFar[i] = this.rib[i * 2 + 1] < split ? 1 : 0;
    this.ribW = Math.max(2.5, view.s * 0.75);
    this.col = new Array(C).fill(null); this.glow = new Float32Array(C);
    this.pitch = new Pitch(bowl, view, lv);
  }

  // part 0: the far half of the crowd; part 1: the near half
  drawPeople(g, sim, part, now) {
    const A = this.atlas, img = A.atlas, cw = A.cw, ch = A.ch, rows = this.rows, ord = this.order;
    const st = sim.st, tt = sim.t, amp = sim.amp, fill = sim.fill, kind = sim.kind;
    const onAir = sim.cam.onAir, night = this.wx.night > 0.5;
    const a = part ? this.split : 0, b = part ? ord.length : this.split;
    const torches = [];
    for (let m = a; m < b; m++) {
      const k = ord[m];
      if (!this.occ[k]) continue;
      const i = (k / rows) | 0, r = k - i * rows;
      let pose = 0;
      if (st[i] === UP && this.h[k] < amp[i] * (fill[i] > 0.3 ? 1 : 1.2)) {
        const L = Sim.liftAt(Math.max(0, tt[i] - r * ROWLAG));
        pose = L < 0.12 ? 0 : L < 0.5 ? 1 : L < 0.86 ? 2 : 3;
        // on the big screen and loving it: waving at themselves
        if (pose === 3 && onAir && sim.framed(i)) pose = 4 + (((now * 5 + this.h[k] * 2) | 0) & 1);
        if (night && pose >= 2 && this.h[k] < 0.22) torches.push(k);
      } else if (kind[i] === K.sleep && sim.woke[i] <= 0) pose = 0;
      const [cx, cy] = A.cell(this.look[k], this.face[i], pose);
      g.drawImage(img, cx, cy, cw, ch, (this.sx[k] - cw / 2) | 0, (this.sy[k] - ch + 1) | 0, cw, ch);
    }
    if (torches.length) {
      g.fillStyle = 'rgba(255,255,245,0.95)';
      const r = Math.max(1, this.u * 0.13);
      for (const k of torches) { g.beginPath(); g.arc(this.sx[k] + this.u * 0.28, this.sy[k] - this.u * 2.05, r, 0, TAU); g.fill(); }
    }
  }

  // the ribbon boards: dark, with the ads ticking over, until a wave paints its laps on them
  drawRibbon(g, sim, far, now) {
    const C = this.C, rib = this.rib, col = this.col, glow = this.glow;
    col.fill(null); glow.fill(0);
    const best = sim.bestId;
    for (let wi = 1; wi < sim.waves.length; wi++) {
      const w = sim.waves[wi];
      if (!w.dir || w.n + w.self === 0) continue;
      const dead = w.dead >= 0 ? sim.deadFor(w) : 0;
      if (dead > SP.rescueT + 0.6) continue;
      const travel = (w.pos - w.start) * w.dir;
      if (travel < 3) continue;
      const fade = dead > SP.rescueT ? 1 - (dead - SP.rescueT) / 0.6 : 1;
      const blink = dead > 0 ? 0.35 + 0.35 * (Math.sin(now * 14) > 0 ? 1 : 0) : 1;
      const al = fade * blink * (wi === best ? 1 : 0.55);
      const n = Math.min(C * 5, Math.ceil(travel));
      for (let x = 0; x <= n; x++) {
        const i = (((Math.round(w.start + w.dir * (travel - x)) % C) + C) % C);
        const pass = Math.floor(x >= travel ? 0 : (travel - x) / C);
        if (x < C && (!col[i] || glow[i] < al)) { col[i] = LAP[Math.min(LAP.length - 1, pass)]; glow[i] = al * (x < 6 ? 1.6 - x * 0.1 : 1); }
      }
      if (dead > 0 && dead <= SP.rescueT) {
        // where it would be by now: catch it there
        const gpos = sim.ghost(w);
        for (let d = -2; d <= 2; d++) { const i = (((Math.round(gpos) + d) % C) + C) % C; col[i] = '#ffffff'; glow[i] = (Math.sin(now * 22) > -0.2 ? 1.8 : 0.4) * fade; }
      }
    }
    g.lineCap = 'butt';
    // the boards
    g.strokeStyle = '#15171c'; g.lineWidth = this.ribW * 1.35;
    g.beginPath();
    for (let i = 0; i < C; i++) { if (this.ribFar[i] !== (far ? 1 : 0)) continue; g.moveTo(rib[i * 2], rib[i * 2 + 1]); g.lineTo(rib[i * 2 + 2], rib[i * 2 + 3]); }
    g.stroke();
    // the idle ads: sponsor blocks ticking along
    const tick = Math.floor(now * 1.5);
    g.lineWidth = this.ribW * 0.7;
    for (let i = 0; i < C; i++) {
      if (this.ribFar[i] !== (far ? 1 : 0)) continue;
      if (col[i]) {
        g.strokeStyle = col[i]; g.globalAlpha = clamp(glow[i], 0, 1); g.lineWidth = this.ribW * (glow[i] > 1.2 ? 1.05 : 0.85);
      } else {
        const blk = ((i + tick) / 9) | 0;
        g.strokeStyle = ['#7a2a1a', '#6d5a14', '#1f4d6e', '#5a1f3d'][blk & 3]; g.globalAlpha = (i + tick) % 9 === 0 ? 0 : 0.85; g.lineWidth = this.ribW * 0.7;
      }
      g.beginPath(); g.moveTo(rib[i * 2], rib[i * 2 + 1]); g.lineTo(rib[i * 2 + 2], rib[i * 2 + 3]); g.stroke();
    }
    g.globalAlpha = 1;
  }

  // the kinds you must plan round get a sign over them: sleepers snore, the away end is fenced blue
  drawSigns(g, sim, now, font) {
    const rows = this.rows, u = this.u;
    for (const s of this.ring.secs) {
      if (s.k !== K.sleep) continue;
      let awake = 0; for (let i = s.i0; i < s.i0 + s.n; i++) if (sim.woke[i] > 0) awake++;
      if (awake >= s.n) continue;
      const i = s.i0 + (s.n >> 1), k = i * rows + rows - 1;
      const x = this.sx[k], y = this.sy[k] - u * 2.2;
      g.font = font(Math.max(10, u * 1.7)); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      for (let j = 0; j < 3; j++) {
        const ph = (now * 0.7 + j / 3) % 1;
        g.globalAlpha = Math.sin(ph * Math.PI) * 0.95;
        g.fillStyle = '#e9f1ff'; g.strokeStyle = 'rgba(10,14,30,0.8)'; g.lineWidth = Math.max(2, u * 0.25);
        const tx = x + Math.sin(ph * 6 + j) * u * 0.6 + j * u * 0.5, ty = y - ph * u * 3.2, sz = 0.7 + ph * 0.6;
        g.save(); g.translate(tx, ty); g.scale(sz, sz); g.strokeText('z', 0, 0); g.fillText('z', 0, 0); g.restore();
      }
      g.globalAlpha = 1;
    }
  }
}

// twenty-two players, a referee and a ball, keeping it 0–0
class Pitch {
  constructor(bowl, view, lv) {
    const { pw, ph, k } = pitchSize(bowl);
    this.view = view; this.pw = pw; this.ph = ph; this.k = k;
    const rnd = (this.rnd = mulberry32(lv.n * 977 + 13));
    const form = [[-0.95, 0], [-0.62, -0.62], [-0.66, -0.22], [-0.66, 0.22], [-0.62, 0.62], [-0.25, -0.55], [-0.3, -0.18], [-0.3, 0.18], [-0.25, 0.55], [-0.05, -0.2], [-0.02, 0.22]];
    this.pl = [];
    for (let t = 0; t < 2; t++) for (let j = 0; j < 11; j++) {
      const f = form[j], hx = (t ? -f[0] : f[0]) * pw * 0.92, hy = f[1] * ph * 0.9;
      this.pl.push({ t, gk: j === 0, hx, hy, x: hx, y: hy, vx: 0, vy: 0, ph: rnd() * 6 });
    }
    this.pl.push({ t: 2, hx: 0, hy: ph * 0.3, x: 0, y: ph * 0.3, vx: 0, vy: 0, ph: 0 });
    this.ball = { x: 0, y: 0, tx: 0, ty: 0, owner: 9, t: 0, z: 0 };
    this.next = 1.2;
  }
  update(dt) {
    const b = this.ball, pl = this.pl, rnd = this.rnd, pw = this.pw, ph = this.ph, k = this.k;
    this.next -= dt;
    if (b.owner >= 0) { const o = pl[b.owner]; b.x = o.x + (o.t ? -0.6 : 0.6) * k; b.y = o.y; b.z = 0; }
    else {
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy), sp = 13 * Math.max(0.6, k);
      b.t += dt;
      if (d < sp * dt) { b.x = b.tx; b.y = b.ty; b.owner = b.to; }
      else { b.x += (dx / d) * sp * dt; b.y += (dy / d) * sp * dt; b.z = Math.sin(clamp(b.t / b.dur) * Math.PI) * b.lob; }
    }
    if (this.next <= 0 && b.owner >= 0) {
      // a pass, nearly always sideways or back: it's the 80th minute and nobody wants to lose
      const o = pl[b.owner], mates = pl.filter((p, j) => p.t === o.t && j !== b.owner && !p.gk);
      const to = mates[(rnd() * mates.length) | 0], j = pl.indexOf(to);
      if (rnd() < 0.12) { const e = pl.filter((p) => p.t !== o.t && p.t < 2 && !p.gk); const q = e[(rnd() * e.length) | 0]; b.to = pl.indexOf(q); }
      else b.to = j;
      const tg = pl[b.to];
      b.owner = -1; b.tx = tg.x; b.ty = tg.y; b.t = 0; b.dur = Math.hypot(tg.x - b.x, tg.y - b.y) / (13 * Math.max(0.6, k)); b.lob = rnd() < 0.2 ? 2.5 * k : 0.1;
      this.next = 1 + rnd() * 2.2;
    }
    const bx = b.owner >= 0 ? b.x : b.tx, by = b.owner >= 0 ? b.y : b.ty;
    for (let j = 0; j < pl.length; j++) {
      const p = pl[j];
      let tx = p.hx + bx * 0.35, ty = p.hy * 0.8 + by * 0.25;
      if (p.gk) { tx = p.hx; ty = clamp(by * 0.2, -ph * 0.15, ph * 0.15); }
      if (p.t === 2) { tx = bx - 6 * k; ty = by + 8 * k; }
      if (j === b.to && b.owner < 0) { tx = b.tx; ty = b.ty; }
      tx = clamp(tx, -pw, pw); ty = clamp(ty, -ph, ph);
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), sp = Math.min(6, d * 0.9) * Math.max(0.6, k);
      const ax = d > 0.05 ? (dx / d) * sp : 0, ay = d > 0.05 ? (dy / d) * sp : 0;
      p.vx += (ax - p.vx) * Math.min(1, dt * 3); p.vy += (ay - p.vy) * Math.min(1, dt * 3);
      p.x += p.vx * dt; p.y += p.vy * dt; p.ph += Math.hypot(p.vx, p.vy) * dt * 1.8;
    }
  }
  draw(g, u) {
    const v = this.view, s = v.s, ball = this.ball;
    const sorted = [...this.pl].sort((a, b) => v.p(a.x, a.y)[1] - v.p(b.x, b.y)[1]);
    const hgt = 1.9 * s, w = Math.max(1.5, 0.55 * s);
    for (const p of sorted) {
      const [x, y] = v.p(p.x, p.y, 0);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y, w * 1.1, w * 0.45, 0, 0, TAU); g.fill();
      const shirt = p.t === 2 ? '#1a1a1a' : p.gk ? (p.t ? '#c8e84a' : '#f29a1d') : p.t ? '#3f8fe0' : '#d6283e';
      const shorts = p.t === 2 ? '#1a1a1a' : p.t ? '#15285c' : '#f4efe6';
      const step = Math.sin(p.ph) * w * 0.5;
      g.strokeStyle = '#2a2320'; g.lineWidth = Math.max(1, w * 0.4);
      g.beginPath(); g.moveTo(x - w * 0.2, y - hgt * 0.42); g.lineTo(x - w * 0.2 + step, y); g.moveTo(x + w * 0.2, y - hgt * 0.42); g.lineTo(x + w * 0.2 - step, y); g.stroke();
      g.fillStyle = shorts; g.fillRect(x - w * 0.5, y - hgt * 0.52, w, hgt * 0.14);
      g.fillStyle = shirt; g.fillRect(x - w * 0.55, y - hgt * 0.84, w * 1.1, hgt * 0.34);
      g.fillStyle = '#e0a986'; g.beginPath(); g.arc(x, y - hgt * 0.92, w * 0.42, 0, TAU); g.fill();
    }
    const [bx, by] = v.p(ball.x, ball.y, 0), [, bz] = v.p(ball.x, ball.y, ball.z + 0.2);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(bx, by, w * 0.45, w * 0.2, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(bx, bz, Math.max(1.2, w * 0.36), 0, TAU); g.fill();
  }
}

export { ringDelta, FRONT };
