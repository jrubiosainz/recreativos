// The stadium on screen: lays out the bowl and the big screen for the window, paints the static ground
// once, then every frame the crowd, the ribbon, the players, the camera's viewfinder on the stand, the
// big screen and the pops. Also turns a pointer into a seat column for the camera to aim at.
import { Bowl, View, nearestCol, FRONT, ROW, RISE, Z0 } from './gfx/geom.js';
import { paintStadium, WX, pitchSize } from './gfx/stadium.js';
import { CrowdLayer, LAP } from './gfx/crowd.js';
import { BigScreen } from './gfx/bigscreen.js';
import { Fx } from './gfx/fx.js';
import { F } from './fonts.js';
import { P as SP, ringDelta } from './sim.js';
import { clamp, damp, TAU } from './util.js';

export class Scene {
  constructor(canvas, { reduce = false } = {}) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.view = new View(); this.crowd = new CrowdLayer(); this.screen = new BigScreen(); this.fx = new Fx();
    this.reduce = reduce; this.now = 0; this.W = 1; this.H = 1; this.dpr = 1; this.aim = null;
    this.shake = 0; this.flash = 0; this.pad = { t: 0, b: 0, l: 0, r: 0 };
    this.drops = [];
  }
  load(lv, ring, sim) {
    this.lv = lv; this.ring = ring; this.sim = sim;
    this.bowl = new Bowl(ring.C, lv.rows);
    this.wx = WX[lv.weather] || WX.sun;
    this.screen.load(lv, ring, sim);
    this.fx.clear();
    this.camX = sim.cam.x;
  }
  resize(W, H, dpr) {
    this.W = W; this.H = H; this.dpr = dpr;
    const c = this.c; c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    this.layout();
    this.paintStatic();
  }
  // where the bowl and the big screen go on this screen (device px)
  layout() {
    const d = this.dpr, W = this.W * d, H = this.H * d, pad = this.pad;
    this.tall = this.H > this.W * 1.12;
    const t = pad.t * d, b = pad.b * d, l = pad.l * d, r = pad.r * d;
    if (this.tall) {
      // phone upright: the big screen above, the bowl below it
      // the bowl takes the width it needs; the big screen gets the height left above it
      const sw = W - 24 * d, x0 = l + 4 * d, bw = W - l - r - 8 * d;
      this.view.fit(this.bowl, W, H, { x: x0, y: 0, w: bw, h: H }, true);
      const need = this.view.wide.y1 - this.view.wide.y0, room = H - t - b - need - 24 * d;
      const sh = Math.round(clamp(room, sw * 0.5, sw * 0.9));
      this.scr = { x: 12 * d, y: t + 8 * d, w: sw, h: sh, hang: false };
      const top = this.scr.y + sh + 10 * d;
      this.view.fit(this.bowl, W, H, { x: x0, y: top, w: bw, h: H - top - b - 6 * d }, true);
    } else {
      this.view.fit(this.bowl, W, H, { x: l + 10 * d, y: t + 6 * d, w: W - l - r - 20 * d, h: H - t - b - 12 * d }, false);
      // hung over the centre circle, as big as the pitch lets it be
      const { pw, ph } = pitchSize(this.bowl), s = this.view.s, [cx, cy] = this.view.p(0, 0, 0);
      const pwS = pw * 2 * s, phS = ph * 2 * 0.745 * s;
      let sw = Math.min(pwS * 0.66, phS * 1.35 / 0.62), sh = sw * 0.62;
      sw = Math.round(sw); sh = Math.round(sh);
      this.scr = { x: Math.round(cx - sw / 2), y: Math.round(cy - sh / 2 - phS * 0.06), w: sw, h: sh, hang: true };
    }
    this.screen.resize(this.scr, d);
    this.fx.resize(d, W, H, Math.max(pad.t, pad.hud || 0) * d);
  }
  // the part of the canvas worth a photo (device px): the bowl, which in landscape has the big screen
  // hung inside it; upright, the screen sits above and would be cut in half by the card's crop
  bowlBox() {
    const w = this.view.wide, s = this.scr, m = 8 * this.dpr;
    let x0 = w.x0 - m, y0 = w.y0 - m, x1 = w.x1 + m, y1 = w.y1 + m;
    if (!this.tall) { x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x + s.w); y1 = Math.max(y1, s.y + s.h); }
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(this.c.width, x1); y1 = Math.min(this.c.height, y1);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  paintStatic() {
    const bg = this.bg, W = this.c.width, H = this.c.height;
    bg.width = W; bg.height = H;
    const g = bg.getContext('2d');
    this.st = paintStadium(g, this.bowl, this.view, this.ring, this.lv, W, H);
    this.crowd.build(this.bowl, this.view, this.ring, this.lv, this.wx);
    // the camera's frame, per column: the front of the stand and the heads of the back row
    // (on the near stand heads rise toward the pitch, so the inner edge is the front row's heads and
    // the outer one the back row's seats; on the far stand it's the other way round)
    const C = this.ring.C, rows = this.lv.rows, zTop = Z0 + rows * RISE, v = this.view;
    const [pcx, pcy] = v.p(0, 0, 0), far = (q) => (q[0] - pcx) ** 2 + (q[1] - pcy) ** 2;
    this.fr = new Float32Array(C * 4);
    for (let i = 0; i < C; i++) {
      const q0 = this.bowl.pt(i, FRONT - 0.3), q1 = this.bowl.pt(i, FRONT + rows * ROW + 0.1);
      const f0 = v.p(q0[0], q0[1], 0.1), f1 = v.p(q0[0], q0[1], Z0 + 1.9);
      const b0 = v.p(q1[0], q1[1], zTop - RISE), b1 = v.p(q1[0], q1[1], zTop + 1.9);
      const a = far(f0) < far(f1) ? f0 : f1, b = far(b0) > far(b1) ? b0 : b1;
      this.fr[i * 4] = a[0]; this.fr[i * 4 + 1] = a[1]; this.fr[i * 4 + 2] = b[0]; this.fr[i * 4 + 3] = b[1];
    }
  }

  // a pointer (CSS px) → the column it points at, or null off the bowl
  columnAt(x, y) {
    const d = this.dpr, v = this.view, rows = this.lv.rows;
    const [wx, wy] = v.inv(x * d, y * d, Z0 + rows * RISE * 0.5 + 0.6);
    return nearestCol(this.bowl, wx, wy);
  }
  // where a column is on screen (CSS px), at the middle of its stand
  colToScreen(i, up = 0.5) {
    const C = this.ring.C, rows = this.lv.rows, j = ((Math.round(i) % C) + C) % C;
    const x = this.fr[j * 4] + (this.fr[j * 4 + 2] - this.fr[j * 4]) * up, y = this.fr[j * 4 + 1] + (this.fr[j * 4 + 3] - this.fr[j * 4 + 1]) * up;
    return [x / this.dpr, y / this.dpr];
  }

  events(evs) {
    const sim = this.sim;
    for (const e of evs) {
      this.screen.event(e, sim);
      const at = (i, up = 1.05) => this.colToScreen(i, up).map((v) => v * this.dpr);
      switch (e.k) {
        case 'ola': this.fx.word(at(e.i), 'ola', LAP[0], 1.4); break;
        case 'lap': { const w = sim.waves[e.id]; this.fx.word(at(w.pos), 'lap', LAP[Math.min(LAP.length - 1, e.n)], 1.25, e.n); if (e.n >= 1 && w.id === sim.bestId) this.fx.burst(at(w.pos, 0.6), LAP[Math.min(LAP.length - 1, e.n)], 26); break; }
        case 'rescue': this.fx.word(at(e.i), 'rescue', '#ffffff', 1.2); this.flash = 0.5; break;
        case 'die': if (e.laps > 0.15) this.fx.word(at(e.i, 0.9), 'die', '#ff5a4f', 0.9, e.why); break;
        case 'boo': this.fx.word(at(e.i), 'boo', '#8fb6ff', 1); break;
        case 'wake': this.fx.word(at(e.i), 'wake', '#e9f1ff', 0.9); break;
        case 'palco': this.fx.word(at(e.i), 'palco', '#ffd45e', 1.2); break;
        case 'kiss': this.fx.word(at(e.i), e.ola ? 'kissOla' : 'kiss', '#ff6fa8', e.ola ? 1.3 : 0.9); break;
        case 'cut': this.shake = 0.35; break;
        case 'whistle': this.fx.confetti(this.c.width, this.c.height, e.stars?.[0]); break;
      }
    }
  }
  update(dt) {
    this.now += dt;
    const sim = this.sim;
    this.crowd.pitch.update(sim.end ? dt * 0.3 : dt);
    this.fx.update(dt);
    this.screen.update(dt, sim);
    this.shake = Math.max(0, this.shake - dt); this.flash = Math.max(0, this.flash - dt * 2);
    // the viewfinder glides where the camera is (smoothed for the eye, the sim is exact)
    const C = this.ring.C, d = ringDelta(sim.cam.x - this.camX, C);
    this.camX = Math.abs(d) > C / 4 ? sim.cam.x : this.camX + d * (1 - Math.exp(-dt * 30));
    if (this.wx.rain) this.updateRain(dt);
  }

  draw() {
    const g = this.g, sim = this.sim, cr = this.crowd, now = this.now, d = this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.shake > 0 && !this.reduce) { const a = this.shake * 10 * d; g.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a); }
    g.drawImage(this.bg, 0, 0);
    cr.drawPeople(g, sim, 0, now);
    cr.drawRibbon(g, sim, true, now);
    cr.pitch.draw(g, cr.u);
    cr.drawRibbon(g, sim, false, now);
    cr.drawPeople(g, sim, 1, now);
    cr.drawSigns(g, sim, now, (px) => F.body(px, 700));
    this.drawFrame(g);
    if (this.wx.rain) this.drawRain(g);
    if (this.scr.hang) this.drawHangShadow(g);
    this.screen.draw(g, sim, now, this);
    this.fx.draw(g);
    if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${this.flash * 0.25})`; g.fillRect(0, 0, this.c.width, this.c.height); }
  }

  // the viewfinder on the stand: white corners on standby, red and lit when it's ON AIR
  drawFrame(g) {
    const sim = this.sim, C = this.ring.C, fr = this.fr, d = this.dpr, half = SP.frameW / 2;
    const on = sim.cam.onAir, cut = sim.cut > 0, lock = sim.lock > 0;
    const c0 = this.camX - half, c1 = this.camX + half;
    const P = (c, back) => {
      const i0 = Math.floor(c), f = c - i0, a = ((i0 % C) + C) % C, b = (a + 1) % C, o = back ? 2 : 0;
      return [fr[a * 4 + o] + (fr[b * 4 + o] - fr[a * 4 + o]) * f, fr[a * 4 + o + 1] + (fr[b * 4 + o + 1] - fr[a * 4 + o + 1]) * f];
    };
    const col = cut || lock ? 'rgba(255,255,255,0.35)' : on ? '#ff3b30' : '#ffffff';
    // the shot itself, tinted while on air
    if (on) {
      g.beginPath();
      for (let c = c0, j = 0; c <= c1 + 1e-6; c += 1, j++) { const q = P(c, false); j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
      for (let c = c1; c >= c0 - 1e-6; c -= 1) { const q = P(c, true); g.lineTo(q[0], q[1]); }
      g.closePath(); g.fillStyle = 'rgba(255,59,48,0.13)'; g.fill();
    }
    const A = P(c0, false), B = P(c1, false), Cc = P(c1, true), D = P(c0, true);
    const corner = (p, q1, q2) => {
      const k = 0.26;
      g.beginPath(); g.moveTo(p[0] + (q1[0] - p[0]) * k, p[1] + (q1[1] - p[1]) * k); g.lineTo(p[0], p[1]); g.lineTo(p[0] + (q2[0] - p[0]) * k, p[1] + (q2[1] - p[1]) * k); g.stroke();
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const pass of [0, 1]) {
      g.strokeStyle = pass ? col : 'rgba(0,0,0,0.45)'; g.lineWidth = (pass ? 2.4 : 5) * d * (on ? 1.15 : 1);
      corner(A, B, D); corner(B, A, Cc); corner(Cc, D, B); corner(D, Cc, A);
    }
    // the tally light over the shot
    const tx = (D[0] + Cc[0]) / 2, ty = Math.min(D[1], Cc[1]) - 9 * d;
    if (on) {
      const r = 4.5 * d, bl = Math.sin(this.now * 9) > -0.3;
      g.fillStyle = bl ? '#ff3b30' : '#7a1510'; g.beginPath(); g.arc(tx, ty, r, 0, TAU); g.fill();
      if (bl) { g.fillStyle = 'rgba(255,59,48,0.3)'; g.beginPath(); g.arc(tx, ty, r * 2.2, 0, TAU); g.fill(); }
    }
    // where the pointer is sending it
    if (this.aim != null && !sim.end) {
      const q = P(this.aim, false), q2 = P(this.aim, true);
      const x = q[0] + (q[0] - q2[0]) * 0.18, y = q[1] + (q[1] - q2[1]) * 0.18, r = 5 * d;
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5 * d;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
    }
  }
  drawHangShadow(g) {
    const s = this.scr, d = this.dpr;
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.beginPath(); g.ellipse(s.x + s.w / 2 + 14 * d, s.y + s.h + 26 * d, s.w * 0.46, s.h * 0.1, 0, 0, TAU); g.fill();
  }
  updateRain(dt) {
    const W = this.c.width, H = this.c.height, d = this.dpr, want = this.reduce ? 60 : 220;
    while (this.drops.length < want) this.drops.push({ x: Math.random() * W, y: Math.random() * H, v: (700 + Math.random() * 500) * d, l: (10 + Math.random() * 14) * d });
    for (const p of this.drops) { p.y += p.v * dt; p.x -= p.v * dt * 0.18; if (p.y > H) { p.y = -p.l; p.x = Math.random() * W * 1.2; } }
  }
  drawRain(g) {
    g.strokeStyle = 'rgba(210,225,240,0.35)'; g.lineWidth = Math.max(1, this.dpr * 0.9); g.beginPath();
    for (const p of this.drops) { g.moveTo(p.x, p.y); g.lineTo(p.x + p.l * 0.18, p.y - p.l); }
    g.stroke();
  }
}
