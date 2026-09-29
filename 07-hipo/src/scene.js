// The picture: a camera over the level, and the layers in the order the eye expects them. The painted
// town at the back, the still life of tiles, the things that move, the hippo, the water laid over it
// (a hippo in the pool is seen through the pool), the flying bits, and the sun-faded paper on top.
import { paintStatic } from './gfx/tiles.js';
import { Pool } from './gfx/water.js';
import { Props } from './gfx/props.js';
import { FX } from './gfx/fx.js';
import { Guard, Abuela, dizzyStars } from './gfx/people.js';
import { HippoAnim } from './gfx/hippo.js';
import { INK, paperCanvas, ell } from './gfx/paint.js';
import { P, WATER, EMPTY } from './sim.js';
import { clamp, lerp, damp } from './util.js';
import { t } from './i18n.js';

const HIC_WORD = () => t('fx.hic');
const HIC_PX = [0.55, 0.72, 0.9, 1.15];
const MAX_STATIC = 16e6;

export class Scene {
  constructor(canvas, imgs, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.imgs = imgs; this.reduce = !!opts.reduce;
    this.W = 1; this.H = 1; this.dpr = 1; this.px = 40;
    this.paper = null; this.vig = null; this.static = null; this.staticPx = 0;
    this.cam = { x: 0, y: 0, z: 1, look: 0 };
    this.hippo = new HippoAnim();
    this.fx = new FX(); this.fx.reduce = this.reduce;
    this.talking = false; this.t = 0; this.freeze = 0; this.inset = { r: 0, b: 0 }; this.pad = 0;
    this.lastSweat = 0; this.lastBubble = 0;
  }

  load(level, map, sim) {
    this.level = level; this.map = map; this.sim = sim;
    this.pool = new Pool(map);
    this.props = new Props(sim, this.pool);
    this.guards = sim.guards.map((g) => new Guard(g));
    this.abuelas = (level.decor || []).filter((d) => d.k === 'abuela').map((d) => new Abuela(d));
    this.hippo.reset(sim.hp.face);
    this.fx.clear();
    this.prev = { x: sim.hp.x, y: sim.hp.y };
    this.static = null;
    this.snapCamera();
  }
  resize(w, h, dpr) {
    this.W = w; this.H = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.px = Math.min(w / 12, h / 15);
    this.vig = null;
    if (this.map) { const want = this.staticWant(); if (Math.abs(want - this.staticPx) / want > 0.08) this.static = null; this.snapCamera(); }
  }
  staticWant() { return Math.min(this.px * this.dpr, Math.sqrt(MAX_STATIC / (this.map.w * this.map.h))); }
  ensureStatic() {
    if (this.static) return;
    this.staticPx = this.staticWant();
    this.static = paintStatic(this.level, this.map, this.staticPx);
  }
  rebuildStatic() { this.static = null; }

  // ---------- camera ----------
  view(z = this.cam.z) { return { w: this.W / (this.px * z), h: this.H / (this.px * z) }; }
  camTarget() {
    const s = this.sim, hp = s.hp, v0 = this.view(1);
    let z = 1, x = hp.x + this.cam.look, y = hp.y - 1.6 + (v0.h * this.pad) / 2;
    if (s.dive || s.end) {
      const surf = s.end ? s.end.y : this.surfaceBelow(hp.x, hp.y);
      const top = Math.min(hp.y - 2.5, s.dive ? s.dive.y0 - 3 : hp.y - 2.5), bot = surf + 3.5;
      z = clamp(v0.h / (bot - top), 0.5, 1);
      if (s.end) z = Math.max(z, 0.85);
      y = s.end ? s.end.y - 1.5 : (top + bot) / 2;
      x = hp.x + s.goal.dir * 1.5;
      if (s.end) {
        // the result card covers the right (landscape) or the bottom (portrait): frame the splash in what's left
        const v = this.view(z); x += (v.w * this.inset.r) / 2; y += (v.h * this.inset.b) / 2;
      }
    }
    return { x, y, z };
  }
  clampCam(c) {
    const v = this.view(c.z), mw = this.map.w, mh = this.map.h;
    const ir = this.sim?.end ? v.w * this.inset.r : 0, ib = v.h * (this.sim?.end ? this.inset.b : this.pad);
    c.x = v.w - ir >= mw ? mw / 2 + ir / 2 : clamp(c.x, v.w / 2, mw - v.w / 2 + ir);
    c.y = v.h - ib >= mh ? mh - v.h / 2 + ib : clamp(c.y, v.h / 2 - 3, mh - v.h / 2 + ib);
  }
  snapCamera() {
    if (!this.sim) return;
    this.cam.look = this.sim.hp.face * 2;
    const t = this.camTarget(); Object.assign(this.cam, t); this.clampCam(this.cam);
  }
  surfaceBelow(x, y) {
    const c = Math.floor(x);
    for (let r = Math.max(0, Math.floor(y)); r < this.map.h; r++) if (this.sim.tile(c, r) === WATER) return r;
    return y + 6;
  }
  updateCamera(dt) {
    const s = this.sim, hp = s.hp;
    const lookT = s.dive ? 0 : Math.abs(hp.vx) > 0.5 ? hp.face * 2.6 : hp.face * 1.4;
    this.cam.look = damp(this.cam.look, lookT, 1.8, dt);
    const t = this.camTarget();
    const ly = s.dive ? 7 : !hp.ground && hp.vy > 12 ? 7 : 3.2;
    this.cam.z = damp(this.cam.z, t.z, s.end ? 3 : 2.2, dt);
    this.cam.x = damp(this.cam.x, t.x, s.dive ? 4 : 3.5, dt);
    this.cam.y = damp(this.cam.y, t.y, ly, dt);
    this.clampCam(this.cam);
  }
  worldToScreen(x, y) {
    const S = this.px * this.cam.z;
    return [(x - this.cam.x) * S + this.W / 2, (y - this.cam.y) * S + this.H / 2];
  }

  // ---------- the sim's news, turned into pictures ----------
  events(evs) {
    const s = this.sim, hp = s.hp, fx = this.fx;
    for (const e of evs) {
      this.hippo.event(e); this.props.event(e);
      for (const g of this.guards) g.event(e);
      const hx = hp.x, hy = hp.y, f = hp.face;
      switch (e.k) {
        case 'hic': {
          const L = e.L;
          fx.word(HIC_WORD()[L], hx + f * 0.3, hy - 1.9 - L * 0.12, HIC_PX[L], { vy: -1.6 });
          fx.puffs(hx + f * 0.9, hy - 0.6, 2 + L);
          if (e.water) { fx.drops(hx, hy - 1.1, 6 + 3 * L, 6 + L); this.pool.poke(hx, hy - 1, 1.5 + L, 1); }
          else if (!e.air) fx.dust(hx, hy, 4 + 2 * L, 0.8 + 0.3 * L);
          if (L === 3) { fx.shake(0.1); fx.sparkle(hx, hy - 1.4, 6, INK.pink); }
          break;
        }
        case 'store': fx.word(e.n >= 2 ? 'mmmm!' : 'mm!', hx + f * 0.2, hy - 1.8, 0.45, { face: INK.pink, side: '#A0304E', vy: -0.8, life: 0.7 }); fx.sweat(hx, hy - 1.2, f); break;
        case 'susto': fx.word(t('fx.ay'), hx, hy - 2.4, 1.0, { face: '#fff', side: INK.red }); fx.shake(0.12); fx.sweat(hx, hy - 1.2, f); fx.sweat(hx, hy - 1.2, -f); break;
        case 'land': if (e.v > 7 && !e.water) { fx.dust(hx, hy, Math.min(12, Math.round(e.v / 2.5)), e.v / 12); if (e.v > 17) fx.shake(0.06); } break;
        case 'splash': fx.drops(e.x, e.y, Math.min(30, Math.round(6 + e.v * 1.2)), 3 + e.v * 0.45); this.pool.poke(e.x, e.y, 0.8 + e.v * 0.28, 1.4); fx.add({ k: 'ring', x: e.x, y: e.y, life: 0.8, r: 0.5, vr: 3 }); fx.bubbles(e.x, e.y + 1, 8, e.y); break;
        case 'breach': fx.drops(e.x, e.y, 10, 4 + e.v * 0.2, 0.9); this.pool.poke(e.x, e.y, -1.5, 1); break;
        case 'bonk': fx.sparkle(e.x, e.y + 0.2, 5, '#fff'); fx.word(t('fx.toc'), e.x, e.y + 0.1, 0.45, { face: '#fff', side: INK.blue, vy: 0.6, life: 0.6 }); break;
        case 'boing': fx.word(t('fx.boing'), hx, hy - 0.2, 0.55, { face: INK.pink, side: INK.blue, life: 0.7 }); break;
        case 'launch': if (e.pumped) { fx.word(t('fx.boing'), hx, hy - 0.4, 0.8, { face: INK.yellow, side: INK.blue }); fx.shake(0.06); } break;
        case 'crack': fx.word(t('fx.crac'), (e.p.x0 + e.p.x1) / 2, e.p.top - 0.2, 0.6, { face: '#fff', side: INK.key, life: 0.7 }); fx.dust((e.p.x0 + e.p.x1) / 2, e.p._ground, 8, 1.2); break;
        case 'cold': fx.cold(e.s.x0, e.s.x1, hy - 1.2); fx.word(t('fx.brrr'), hx, hy - 2.2, 0.62, { face: '#CFF3FF', side: INK.blue }); break;
        case 'drink': fx.word(t('fx.glu'), hx + f * 0.6, hy - 1.7, 0.42, { face: '#CFF3FF', side: INK.blue, life: 0.8, vy: -0.6 }); break;
        case 'fizz': fx.word(t('fx.fsss'), hx, hy - 2, 0.6, { face: '#C7F2B0', side: '#2F7A3A' }); fx.bubbles(e.z.x, e.z.y, 10); fx.sparkle(e.z.x, e.z.y, 6, '#C7F2B0'); break;
        case 'stick': fx.sparkle(e.stick.x, e.stick.y, 10, INK.yellow); fx.word(`${e.n}/${s.sticks.length}`, e.stick.x, e.stick.y - 0.8, 0.5, { life: 0.8 }); break;
        case 'towel': fx.sparkle(e.w.x, e.w.y - 0.3, 8, '#fff'); break;
        case 'whistle': {
          const g = e.g; fx.word(t('fx.prii'), g.x + g.face * 1.4, g.y - 2.8, 0.75, { face: '#fff', side: INK.red, rot: -0.12 * g.face, life: 0.8 });
          if (e.hit) fx.shake(0.1);
          break;
        }
        case 'impact': {
          if (e.why === 'bomba') {
            const size = clamp(e.splash / 8, 0.2, 1.4);
            fx.crown(e.x, e.y, size); this.pool.poke(e.x, e.y, 5 + 4 * size, 2.2);
            fx.shake(0.18 + 0.12 * size); this.freeze = 0.09;
            fx.word(t('fx.bomba'), e.x, e.y - 3.2 - 2 * size, 1.4 + 0.5 * size, { life: 1.6, vy: -0.6, rot: -0.1 });
            fx.confetti(e.x, e.y - 1, 30 + Math.round(30 * size));
          } else {
            fx.flop(e.x, e.y); this.pool.poke(e.x, e.y, 3, 2.5); fx.shake(0.14); this.freeze = 0.06;
            fx.word(t('fx.plaf'), e.x, e.y - 2.4, 1.2, { face: '#fff', side: INK.red, life: 1.4, vy: -0.4 });
          }
          break;
        }
        case 'respawn': fx.sparkle(hx, hy - 0.6, 10, '#fff'); this.prev = { x: hx, y: hy }; break;
        default:
      }
    }
  }
  savePrev() { this.prev.x = this.sim.hp.x; this.prev.y = this.sim.hp.y; }

  update(dt) {
    this.t += dt;
    const s = this.sim;
    this.hippo.update(dt, s);
    this.props.update(dt);
    for (const g of this.guards) g.update(dt);
    for (const a of this.abuelas) a.update(dt, this.talking);
    this.pool.step(dt);
    this.fx.update(dt);
    // little continuous things
    const hp = s.hp;
    if (hp.hold && s.hic.k >= 2 && this.t - this.lastSweat > 0.35) { this.lastSweat = this.t; this.fx.sweat(hp.x, hp.y - 1.2, hp.face); }
    if (hp.inWater && this.t - this.lastBubble > 0.5) { this.lastBubble = this.t; const surf = this.surfaceAbove(hp.x, hp.y - 0.5); if (hp.y - 0.4 > surf) this.fx.bubbles(hp.x + hp.face * 0.8, hp.y - 0.5, 1, surf); }
    this.updateCamera(dt);
  }
  surfaceAbove(x, y) { let r = Math.floor(y); while (r > 0 && this.sim.tile(Math.floor(x), r - 1) === WATER) r--; return r; }

  // ---------- drawing ----------
  draw(alpha = 1) {
    const ctx = this.ctx, W = this.W, H = this.H, dpr = this.dpr, s = this.sim;
    this.ensureStatic();
    const S = this.px * this.cam.z * dpr;
    const [sx, sy] = this.fx.offset();
    const cx = this.cam.x + sx, cy = this.cam.y + sy;
    const ox = Math.round(W * dpr / 2 - cx * S), oy = Math.round(H * dpr / 2 - cy * S);
    const vw = W / (this.px * this.cam.z), vh = H / (this.px * this.cam.z);
    const view = { x0: cx - vw / 2 - 1, x1: cx + vw / 2 + 1, y0: cy - vh / 2 - 1, y1: cy + vh / 2 + 1 };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.backdrop(ctx);
    ctx.setTransform(S, 0, 0, S, ox, oy);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.static, 0, 0, this.map.w, this.map.h);
    // below the map (only under a phone's thumb pad or the result band) the ground just carries on
    if (view.y1 > this.map.h) {
      const rows = 2, sh = this.static.height, rp = (sh / this.map.h) * rows;
      for (let y = this.map.h; y < view.y1; y += rows) ctx.drawImage(this.static, 0, sh - rp, this.static.width, rp, 0, y, this.map.w, rows);
    }
    for (const g of this.guards) g.drawRange(ctx, s);
    this.props.drawBack(ctx, view);
    for (const a of this.abuelas) a.draw(ctx);
    for (const g of this.guards) { ctx.save(); g.draw(ctx); ctx.restore(); }
    this.props.drawFloats(ctx, view);
    // the hippo
    const hp = s.hp, x = lerp(this.prev.x, hp.x, alpha), y = lerp(this.prev.y, hp.y, alpha);
    this.shadow(ctx, x, y);
    ctx.save(); ctx.translate(x, y); this.hippo.draw(ctx); ctx.restore();
    if (s.hic.dizzy > 0 && !s.end) dizzyStars(ctx, x, y - 1.55, this.t, clamp(s.hic.dizzy / 0.3));
    this.fx.draw(ctx, 'under');
    this.pool.draw(ctx, view, S);
    this.props.drawFront(ctx, view);
    this.fx.draw(ctx, 'over');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.overlay(ctx);
  }
  backdrop(ctx) {
    const W = this.cv.width, H = this.cv.height, img = this.imgs.bg;
    ctx.fillStyle = '#A9DCEB'; ctx.fillRect(0, 0, W, H);
    if (!img) return;
    const sc = Math.max(W / img.width, H / img.height) * 1.18, bw = img.width * sc, bh = img.height * sc;
    const u = clamp(this.cam.x / this.map.w), v = clamp(this.cam.y / this.map.h);
    ctx.drawImage(img, -(bw - W) * u, -(bh - H) * (0.25 + 0.75 * v), bw, bh);
  }
  shadow(ctx, x, y) {
    const s = this.sim;
    if (s.hp.inWater || s.end) return;
    let gy = null;
    for (let r = Math.floor(y); r < Math.min(this.map.h, Math.floor(y) + 12); r++) { const k = s.tile(Math.floor(x), r); if (k !== EMPTY) { if (k !== WATER) gy = r; break; } }
    for (const p of s.plats) if (p.state !== 'broken' && x > p.x0 - 0.3 && x < p.x1 + 0.3 && p.top >= y - 0.01 && (gy == null || p.top < gy)) gy = p.top;
    if (gy == null) return;
    const d = gy - y, a = clamp(1 - d / 7) * 0.28;
    if (a <= 0.01) return;
    ctx.fillStyle = `rgba(42,33,80,${a})`;
    ell(ctx, x, gy - 0.02, 0.85 * (1 - d / 14), 0.13); ctx.fill();
  }
  overlay(ctx) {
    const W = this.cv.width, H = this.cv.height;
    if (!this.paper) { this.paper = ctx.createPattern(paperCanvas(256, 11), 'repeat'); }
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.32;
    ctx.fillStyle = this.paper; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (!this.vig) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256;
      const g = c.getContext('2d'), gr = g.createRadialGradient(128, 118, 60, 128, 128, 190);
      gr.addColorStop(0, 'rgba(70,40,20,0)'); gr.addColorStop(1, 'rgba(70,40,20,0.32)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256); this.vig = c;
    }
    ctx.drawImage(this.vig, 0, 0, W, H);
  }
}
