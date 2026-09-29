// The stage: a bus window at the back, seen from your seat. The bus wall and the window's aluminium
// frame and black rubber are painted once per size; every frame the street goes by behind the glass,
// the fog and the drops are drawn from the sim, and the kids' shouts pop over it all. The rubber along
// the bottom is the finish line: somebody wrote META on it in marker.
import { PW, PH, YOU, NEUTRAL, DT, Bus } from './sim.js';
import { City, moodOf } from './gfx/city.js';
import { Glass } from './gfx/glass.js';
import { DropArt, KID_COL } from './gfx/drops.js';
import { Fx } from './gfx/fx.js';
import { F } from './fonts.js';
import { t, getLang } from './i18n.js';
import { mulberry32, roundRect, TAU } from './util.js';

const WALL = { dawn: ['#3a3e4b', '#23262f'], morning: ['#474b57', '#2c2f38'], day: ['#4c505b', '#30333c'], dusk: ['#40394a', '#27232f'], blue: ['#343a4d', '#1f2331'], night: ['#2d3243', '#171a24'] };
const SEAL = 0.25; // cm of rubber lip along the bottom: a drop that reaches it has finished

// where the bus will stand still (metres), so each stop has its shelter waiting in the street
export function stopsOf(lv) {
  const b = new Bus(lv.bus || []), out = [0], rng = () => 0.5;
  const emit = (e) => { if (e.k === 'bus' && e.what === 'still') out.push(b.dist); };
  for (let tt = 0; tt < (lv.stop || 60) + 4; tt += DT) b.step(tt, DT, rng, emit);
  return out;
}

export class Scene {
  constructor(canvas, opts = {}) {
    // two layers: the bus around the window never moves, so it lives on a canvas of its own behind this
    // one and is painted once per size; every frame only the window (and any shout or confetti) is redrawn
    this.c = canvas; this.g = canvas.getContext('2d');
    this.bg = opts.bg || null; this.fxWas = true;
    this.reduce = !!opts.reduce;
    this.city = new City(opts.seed || 27); this.glass = new Glass(); this.art = new DropArt(); this.fx = new Fx();
    this.backC = this.bg || document.createElement('canvas'); this.lipC = document.createElement('canvas');
    this.pad = { t: 0, b: 0, l: 0, r: 0, hud: 0 };
    this.W = 1; this.H = 1; this.dpr = 1; this.time = 0; this.shake = 0; this.kick = [0, 0];
    this.ptr = { x: 0, y: 0, on: false, in: false }; this.mouse = true; this.lastF = null;
    this.rng = mulberry32(5); this.pane = { x: 0, y: 0, w: 1, h: 1, s: 1 };
    this.title = false; this.distOff = 0;
  }
  load(lv, sim, o = {}) {
    this.lv = lv; this.sim = sim; this.title = !!o.title;
    this.mood = moodOf(lv);
    this.city.setMood(this.mood); this.city.line = lv.line || '27';
    this.city.setStops(this.title ? [0] : stopsOf(lv));
    this.glass.setLevel(lv, this.mood, getLang());
    this.art.reset(); this.fx.clear();
    this.shake = 0; this.lastF = null;
    this.paintFrame();
  }

  // ---------- layout ----------
  resize(W, H, dpr) {
    this.W = W; this.H = H; this.dpr = dpr;
    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (this.c.width !== cw || this.c.height !== ch) { this.c.width = cw; this.c.height = ch; }
    const p = this.pad, m = Math.min(W, H) < 500 ? 8 : 16;
    const x0 = p.l + m, x1 = W - p.r - m, y0 = p.t + m, y1 = H - p.b - m;
    // the window and its frame (≈ 8 % of the pane's width on each side) inside what the HUD leaves free
    let pw = Math.min((x1 - x0) / 1.16, (y1 - y0) / (PH / PW + 0.16), 560);
    pw = Math.max(120, pw);
    const ph = (pw * PH) / PW, px = x0 + (x1 - x0 - pw) / 2, py = y0 + (y1 - y0 - ph) / 2;
    const P = this.pane;
    P.x = Math.round(px * dpr); P.y = Math.round(py * dpr); P.w = Math.round(pw * dpr); P.h = Math.round((P.w * PH) / PW); P.s = P.w / PW;
    this.cssPane = { x: px, y: py, w: pw, h: ph };
    const cs = Math.min(1, 900 / P.w);
    this.city.resize(P.w * cs, P.h * cs);
    this.glass.resize(P.w, P.h, dpr);
    this.fx.resize(dpr, cw, ch, (p.hud || 0) * dpr);
    this.backC.width = cw; this.backC.height = ch;
    this.lipC.width = P.w + 4; this.lipC.height = P.h + 4; this.fxWas = true;
    if (this.lv) this.paintFrame();
  }
  // a pointer on the screen, in the sim's centimetres
  toSim(clientX, clientY) {
    const P = this.pane, x = (clientX * this.dpr - P.x) / P.s, y = (clientY * this.dpr - P.y) / P.s;
    return { x, y, in: x >= -0.3 && x <= PW + 0.3 && y >= -0.3 && y <= PH + 0.3 };
  }
  toScreen(x, y) { const P = this.pane; return [P.x + x * P.s, P.y + y * P.s]; }
  paneBox() { const P = this.pane, gk = P.w * 0.1; return { x: P.x - gk, y: P.y - gk, w: P.w + gk * 2, h: P.h + gk * 2 }; }

  // ---------- the bus around the window, once per size ----------
  paintFrame() {
    const g = this.backC.getContext('2d'), L = this.lipC.getContext('2d'), P = this.pane, d = this.dpr;
    const cw = this.backC.width, ch = this.backC.height, [w0, w1] = WALL[this.mood] || WALL.dawn;
    if (P.w < 8 || cw < 8) return;
    const gk = P.w * 0.045, al = P.w * 0.03;
    g.clearRect(0, 0, cw, ch);
    const wall = g.createLinearGradient(0, 0, 0, ch); wall.addColorStop(0, w0); wall.addColorStop(1, w1);
    g.fillStyle = wall; g.fillRect(0, 0, cw, ch);
    // moulded plastic: fine vertical ribs and two panel seams
    g.fillStyle = 'rgba(255,255,255,0.025)';
    for (let x = 0; x < cw; x += 7 * d) g.fillRect(x, 0, Math.max(1, d), ch);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (const y of [P.y - gk - al - 26 * d, P.y + P.h + gk + al + 30 * d]) if (y > 0 && y < ch) g.fillRect(0, y, cw, Math.max(1, d * 1.5));
    // the aluminium frame
    const fx = P.x - gk - al, fy = P.y - gk - al, fw = P.w + 2 * (gk + al), fh = P.h + 2 * (gk + al);
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 18 * d; g.shadowOffsetY = 6 * d;
    const alu = g.createLinearGradient(fx, fy, fx + fw, fy + fh); alu.addColorStop(0, '#d4d7dc'); alu.addColorStop(0.5, '#9a9ea7'); alu.addColorStop(1, '#c2c5cb');
    g.fillStyle = alu; roundRect(g, fx, fy, fw, fh, gk * 1.5); g.fill(); g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(1, d); roundRect(g, fx + al * 0.55, fy + al * 0.55, fw - al * 1.1, fh - al * 1.1, gk * 1.3); g.stroke();
    // the rubber
    g.fillStyle = '#111216'; roundRect(g, P.x - gk, P.y - gk, P.w + 2 * gk, P.h + 2 * gk, gk * 1.1); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = Math.max(1, d); roundRect(g, P.x - gk + d, P.y - gk + d, P.w + 2 * gk - 2 * d, P.h + 2 * gk - 2 * d, gk); g.stroke();
    // the vent under the window (warm when the heater is on)
    const vy = fy + fh + 8 * d, vh = Math.max(10 * d, gk * 1.4);
    if (vy + vh < ch) {
      g.fillStyle = '#16181e'; roundRect(g, fx + gk, vy, fw - 2 * gk, vh, vh * 0.3); g.fill();
      for (let x = fx + gk * 1.6; x < fx + fw - gk * 1.6; x += 7 * d) {
        g.fillStyle = this.lv?.heater ? 'rgba(255,120,50,0.5)' : 'rgba(0,0,0,0.6)'; g.fillRect(x, vy + vh * 0.25, 3 * d, vh * 0.5);
      }
      // the back of the seat in front: bus moquette and the yellow handle
      const sy = vy + vh + 14 * d;
      if (sy < ch - 10 * d) {
        const sx = fx - fw * 0.06, sw = fw * 1.12;
        g.save(); roundRect(g, sx, sy, sw, ch - sy + 60 * d, 28 * d); g.clip();
        g.fillStyle = '#1b2a57'; g.fillRect(sx, sy, sw, ch - sy);
        const rng = mulberry32(8), cols = ['#e2463b', '#f2c230', '#43b6a5', '#8a5fd0', '#ffffff'];
        for (let i = 0; i < (sw * (ch - sy)) / (140 * d * d); i++) {
          const x = sx + rng() * sw, y = sy + rng() * (ch - sy), a = rng() * TAU, l = (3 + rng() * 5) * d;
          g.strokeStyle = cols[i % cols.length]; g.globalAlpha = 0.55; g.lineWidth = 1.6 * d; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l, y + Math.sin(a) * l, x + Math.cos(a + 1) * l * 1.4, y + Math.sin(a + 1) * l * 1.4); g.stroke();
        }
        g.globalAlpha = 1;
        const sh = g.createLinearGradient(0, sy, 0, sy + 40 * d); sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = sh; g.fillRect(sx, sy, sw, 40 * d);
        g.restore();
        g.strokeStyle = '#f2b724'; g.lineWidth = 9 * d; g.lineCap = 'round';
        g.beginPath(); g.moveTo(sx + sw * 0.3, sy + 12 * d); g.quadraticCurveTo(sx + sw * 0.3, sy - 16 * d, sx + sw * 0.5, sy - 16 * d); g.quadraticCurveTo(sx + sw * 0.7, sy - 16 * d, sx + sw * 0.7, sy + 12 * d); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2.5 * d;
        g.beginPath(); g.moveTo(sx + sw * 0.34, sy - 10 * d); g.quadraticCurveTo(sx + sw * 0.5, sy - 17 * d, sx + sw * 0.66, sy - 10 * d); g.stroke();
      }
    }
    // the lip of the rubber over the glass: an inner shadow, and the thick seal at the bottom
    L.setTransform(1, 0, 0, 1, 2 - P.x, 2 - P.y);
    L.clearRect(P.x - 2, P.y - 2, P.w + 4, P.h + 4);
    // the stickers and scratches are part of the glass, never move: they ride on this static layer
    if (this.glass.stickC.width === P.w) L.drawImage(this.glass.stickC, P.x, P.y);
    const lip = P.s * 0.07, seal = P.s * SEAL;
    L.save(); L.beginPath(); L.rect(P.x, P.y, P.w, P.h); L.clip();
    // inner shadow: dark right at the rubber, gone a few millimetres in
    const edge = (x, y, w, h, ax, ay, bx, by) => { const gr = L.createLinearGradient(ax, ay, bx, by); gr.addColorStop(0, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); L.fillStyle = gr; L.fillRect(x, y, w, h); };
    const sd = P.s * 0.35;
    edge(P.x, P.y, P.w, sd, P.x, P.y, P.x, P.y + sd);
    edge(P.x, P.y, sd, P.h, P.x, P.y, P.x + sd, P.y);
    edge(P.x + P.w - sd, P.y, sd, P.h, P.x + P.w, P.y, P.x + P.w - sd, P.y);
    L.restore();
    L.fillStyle = '#111216';
    L.beginPath(); L.rect(P.x - 1, P.y - 1, P.w + 2, P.h + 2);
    { const x = P.x + lip, y = P.y + lip, w = P.w - 2 * lip, h = P.h - lip - seal, r = lip * 2.2;
      L.moveTo(x + r, y); L.arcTo(x + w, y, x + w, y + h, r); L.arcTo(x + w, y + h, x, y + h, r); L.arcTo(x, y + h, x, y, r); L.arcTo(x, y, x + w, y, r); L.closePath(); }
    L.fill('evenodd');
    // the seal catches the light along its top edge; META, in white marker, and the kids' dashed line
    L.fillStyle = 'rgba(255,255,255,0.14)'; L.fillRect(P.x + lip * 2, P.y + P.h - seal, P.w - lip * 4, Math.max(1, d));
    L.setTransform(1, 0, 0, 1, 0, 0);
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = Math.max(1.2, 1.6 * d); g.setLineDash([5 * d, 5 * d]); g.lineCap = 'round';
    const my = P.y + P.h + gk * 0.45;
    g.beginPath(); g.moveTo(P.x + P.w * 0.25, my); g.lineTo(P.x + P.w - gk * 0.2, my); g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#ffffff'; g.font = F.hand(Math.max(9 * d, gk * 0.72), 800); g.textBaseline = 'middle'; g.textAlign = 'left';
    g.translate(P.x + gk * 0.1, my); g.rotate(-0.04); g.fillText(t('meta'), 0, 0);
    g.restore();
    this.fxWas = true;
  }

  // ---------- what happened this tick ----------
  events(evs) {
    const sim = this.sim, P = this.pane, d = this.dpr, kidCol = (own) => KID_COL[sim.kids[own]?.name] || '#ffffff';
    const at = (x, y) => this.toScreen(x, y);
    const mid = () => [P.x + P.w / 2, P.y + P.h * 0.4];
    for (const e of evs) {
      this.art.onEvent(e, sim);
      switch (e.k) {
        case 'go': this.fx.word(mid(), 'go', '#FFC23D', 1.9); break;
        case 'bus':
          if (e.what === 'hard') { this.bump(1, -1); this.fx.word([P.x + P.w * 0.3, P.y + P.h * 0.18], 'brake', '#ffffff', 1.2); }
          else if (e.what === 'brake') this.bump(0.3, -1);
          else if (e.what === 'go') this.bump(0.2, 1);
          else if (e.what === 'bump') { this.bump(0.6, 0); }
          else if (e.what === 'cobbles') this.fx.word([P.x + P.w * 0.7, P.y + P.h * 0.18], 'cobbles', '#ffffff', 1);
          else if (e.what === 'doors') this.fx.word([P.x + P.w * 0.5, P.y + P.h * 0.12], 'doors', '#bfe3ff', 0.85);
          break;
        case 'smear': { const r = 0.2; this.glass.splat(e.x, e.y, r, P.s, this.rng); this.fx.spray(at(e.x, e.y), 8, 0.6); break; }
        case 'merge':
          if (e.own !== NEUTRAL && e.lost === NEUTRAL) this.fx.burst(at(e.x, e.y), kidCol(e.own), 6, 0.35);
          break;
        case 'eat': {
          const dr = sim.drop(sim.kids[e.own].drop), p = at(dr ? dr.x : PW / 2, dr ? dr.y : PH / 2);
          this.fx.word(p, e.own === YOU ? 'ate' : 'nam', kidCol(e.own), 1.2); this.fx.burst(p, kidCol(e.own), 16, 0.8);
          break;
        }
        case 'seal': { const dr = sim.drop(e.id); if (dr) this.fx.burst(at(dr.x, PH - SEAL), kidCol(e.own), 18, 0.9); break; }
        case 'end': this.onEnd(e); break;
      }
    }
  }
  onEnd(e) {
    const sim = this.sim, P = this.pane, name = (own) => t(`kid.${sim.kids[own]?.name}`);
    const c = [P.x + P.w / 2, P.y + P.h * 0.42];
    if (e.why === 'won') { this.fx.word(c, 'won', '#FFC23D', 1.8); if (!this.reduce) this.fx.confetti(this.c.width, this.c.height, true); }
    else if (e.why === 'beaten') this.fx.word(c, 'beaten', KID_COL[sim.kids[e.by]?.name] || '#fff', 1.5, { name: name(e.by) });
    else if (e.why === 'eaten') this.fx.word(c, 'eaten', KID_COL[sim.kids[e.by]?.name] || '#fff', 1.5, { name: name(e.by) });
    else if (e.why === 'stop') this.fx.word(c, 'stop', '#ffffff', 1.5);
    else if (e.why === 'squash' || e.why === 'cheat') {
      const k = e.why === 'squash' ? sim.kids[0] : sim.kids[e.by], d = sim.drops.find((q) => q.id === k?.drop);
      if (d) { this.glass.splat(d.x, d.y, d.r, P.s, this.rng, KID_COL[k.name]); this.fx.spray(this.toScreen(d.x, d.y), 22, 1.1); }
      this.bump(0.5, 0);
      this.fx.word(c, e.why, e.why === 'cheat' ? '#FF5A4E' : '#FFC23D', 1.7, e.why === 'cheat' ? { name: name(e.by) } : undefined);
    }
  }
  bump(k, dir) { if (this.reduce) return; this.shake = Math.min(1.2, this.shake + k); this.kick = [dir * k * 6, k * 3]; }

  // ---------- per frame ----------
  update(dt) {
    const sim = this.sim; if (!sim) return;
    this.time += dt; this.dt = dt;
    this.city.speed = sim.bus.v;
    this.shake *= Math.exp(-7 * dt); this.kick[0] *= Math.exp(-9 * dt); this.kick[1] *= Math.exp(-9 * dt);
    if (!this.reduce && sim.bus.cob > 0 && sim.bus.v > 1) this.shake = Math.max(this.shake, 0.18 * Math.min(1, sim.bus.v / 6));
    this.fx.update(dt);
    // what running drops and the fingertip leave on the glass
    const s = this.pane.s;
    for (const d of sim.drops) {
      if (!d.alive || d.pin || d.fin >= 0) continue;
      const sp = Math.hypot(d.vx, d.vy);
      if (this.rng() < sp * dt * 2.4 * (0.6 + d.r * 1.5)) this.glass.trail(d, s, this.rng);
    }
    if (sim.phase === 'race' && sim.input.down && !sim.end) {
      const f = [sim.input.x, sim.input.y];
      if (this.lastF) this.glass.streak(this.lastF[0], this.lastF[1], f[0], f[1], s, this.rng);
      this.lastF = f;
    } else this.lastF = null;
  }
  // o.fx === false leaves the shouts and confetti out (the snapshot for the share card)
  draw(o = {}) {
    const g = this.g, sim = this.sim; if (!sim) return;
    const P = this.pane, d = this.dpr;
    const a = this.shake * 4 * d, ox = (Math.random() - 0.5) * a + this.kick[0] * d, oy = (Math.random() - 0.5) * a + this.kick[1] * d;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const fxOn = this.fx.busy();
    if (!this.bg) g.drawImage(this.backC, 0, 0);
    else if (fxOn || this.fxWas) g.clearRect(0, 0, this.c.width, this.c.height);
    // everything but the shouts stays inside the frame: that box (plus the shake) is all that needs wiping
    const B = this.paneBox(), m = Math.ceil(12 * d), bx = B.x - m, by = B.y - m, bw = B.w + 2 * m, bh = B.h + 2 * m;
    if (this.bg && !(fxOn || this.fxWas)) g.clearRect(bx, by, bw, bh);
    this.fxWas = fxOn;
    const dist = this.title ? (sim.bus.dist % 700) : sim.bus.dist;
    this.city.draw(dist, this.time);
    const x0 = P.x + ox, y0 = P.y + oy;
    g.save(); g.beginPath(); g.rect(x0, y0, P.w, P.h); g.clip();
    this.glass.draw(g, x0, y0, sim, this.city.c, this.time, this.dt || 1 / 60);
    this.art.draw(g, x0, y0, P.s, sim, this.city.c, d, this.dt || 1 / 60);
    g.restore();
    g.drawImage(this.lipC, x0 - 2, y0 - 2);
    g.save(); g.beginPath(); g.rect(bx, by, bw, bh); g.clip();
    if (!this.title) this.art.marks(g, x0, y0, P.s, sim, { dpr: d, t: this.time, names: { you: t('kid.you'), dani: t('kid.dani'), lucia: t('kid.lucia'), iker: t('kid.iker'), vega: t('kid.vega') }, callText: t('call'), ptr: this.ptr, mouse: this.mouse, phase: sim.phase });
    g.restore();
    if (o.fx !== false) this.fx.draw(g);
  }
}
