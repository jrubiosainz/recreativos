// Everything that flies off: drops, bubbles, puffs of dust, sweat, confetti, sparkles, the rings on
// the water, and the comic words («¡HIP!», «¡PRIII!», «¡PLAF!»). One flat pool of particles in tile
// units, drawn in two passes (under and over the water), plus the camera shake.
import { INK, ell, popText, star5 } from './paint.js';
import { TAU, clamp, lerp } from '../util.js';

const G = 30;

export class FX {
  constructor() { this.ps = []; this.words = []; this.shakeA = 0; this.shakeT = 0; this.t = 0; this.rng = Math.random; this.reduce = false; }
  clear() { this.ps.length = 0; this.words.length = 0; this.shakeA = 0; }
  add(p) { if (this.ps.length < 900) this.ps.push({ t: 0, life: 1, vx: 0, vy: 0, g: 0, r: 0.1, a: 0, va: 0, drag: 0, ...p }); }
  word(text, x, y, px, o = {}) { this.words.push({ text, x, y, px, t: 0, life: o.life || 0.9, vy: o.vy ?? -1.2, rot: o.rot ?? (this.rng() - 0.5) * 0.3, face: o.face, side: o.side, key: o.key }); }
  shake(a) { if (!this.reduce) this.shakeA = Math.max(this.shakeA, a); }
  offset() {
    if (this.shakeA < 0.002) return [0, 0];
    const t = this.t * 60;
    return [Math.sin(t * 1.9) * this.shakeA, Math.cos(t * 2.3) * this.shakeA * 0.8];
  }

  // ---------- recipes ----------
  drops(x, y, n, v, spread = 1.2, up = 1) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (this.rng() - 0.5) * spread * up, s = v * (0.45 + 0.7 * this.rng());
      this.add({ k: 'drop', x: x + (this.rng() - 0.5) * 0.6, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: G, r: 0.07 + 0.09 * this.rng(), life: 0.9 + 0.5 * this.rng() });
    }
  }
  crown(x, y, size) {   // the bomba: a crown of water, a column, rings, and drops everywhere
    const n = Math.round(18 + 16 * size);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, a = -Math.PI / 2 + side * (0.25 + 0.55 * this.rng()), s = (7 + 7 * this.rng()) * (0.7 + 0.35 * size);
      this.add({ k: 'drop', x: x + side * (0.3 + 0.8 * this.rng()), y: y - 0.1, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: G, r: 0.1 + 0.14 * this.rng(), life: 1.4 + 0.6 * this.rng() });
    }
    this.add({ k: 'column', x, y, life: 0.85 + 0.2 * size, r: 0.8 + 0.25 * size, h: 3.5 + 3 * size });
    for (let i = 0; i < 3; i++) this.add({ k: 'ring', x, y, life: 1.2 + i * 0.35, r: 0.5, vr: 3.2 - i * 0.6, t: -i * 0.08 });
    for (let i = 0; i < 26; i++) this.add({ k: 'bubble', x: x + (this.rng() - 0.5) * 2, y: y + 0.4 + this.rng() * 2.2, vx: (this.rng() - 0.5) * 0.8, vy: -1.2 - this.rng() * 1.8, r: 0.05 + 0.12 * this.rng(), life: 1 + this.rng() * 1.2, wy: y });
  }
  flop(x, y) {   // planchazo: a flat slap, drops sideways, not up
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1, a = -Math.PI / 2 + side * (1.0 + 0.35 * this.rng()), s = 5 + 5 * this.rng();
      this.add({ k: 'drop', x: x + side * (0.4 + this.rng()), y: y - 0.05, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: G, r: 0.08 + 0.1 * this.rng(), life: 1 + 0.4 * this.rng() });
    }
    this.add({ k: 'ring', x, y, life: 1, r: 0.8, vr: 4.5 });
  }
  dust(x, y, n = 6, v = 1) {
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      this.add({ k: 'dust', x: x + side * 0.5 * this.rng(), y: y - 0.08, vx: side * (0.8 + 1.8 * this.rng()) * v, vy: -0.4 - 0.8 * this.rng(), drag: 3, r: 0.12 + 0.12 * this.rng(), life: 0.45 + 0.25 * this.rng() });
    }
  }
  sweat(x, y, face) {
    for (let i = 0; i < 2; i++) this.add({ k: 'sweat', x: x + (this.rng() - 0.5) * 0.4, y, vx: (this.rng() - 0.5) * 3 - face * 0.8, vy: -3 - this.rng() * 2, g: 22, r: 0.09, life: 0.7 });
  }
  bubbles(x, y, n = 3, wy = -1e9) {
    for (let i = 0; i < n; i++) this.add({ k: 'bubble', x: x + (this.rng() - 0.5) * 0.8, y: y + (this.rng() - 0.5) * 0.4, vx: (this.rng() - 0.5) * 0.5, vy: -1 - this.rng() * 1.2, r: 0.04 + 0.07 * this.rng(), life: 0.8 + this.rng() * 0.8, wy });
  }
  sparkle(x, y, n = 8, col = INK.yellow) {
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + this.rng() * 0.4, s = 3 + 3 * this.rng(); this.add({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 4, r: 0.12 + 0.1 * this.rng(), life: 0.6 + 0.3 * this.rng(), col, va: (this.rng() - 0.5) * 12 }); }
  }
  confetti(x, y, n = 40) {
    const cols = [INK.red, INK.yellow, INK.blue, INK.pink, '#fff', INK.pool];
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (this.rng() - 0.5) * 1.6, s = 8 + 8 * this.rng(); this.add({ k: 'conf', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 9, drag: 1.2, r: 0.12 + 0.08 * this.rng(), life: 2.2 + this.rng(), col: cols[i % cols.length], a: this.rng() * TAU, va: (this.rng() - 0.5) * 16 }); }
  }
  puffs(x, y, n = 5) {   // the burst of breath when the held hiccups go all at once
    for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (this.rng() - 0.5) * 1.4, s = 2 + 2 * this.rng(); this.add({ k: 'puff', x: x + (this.rng() - 0.5) * 0.6, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 4, r: 0.18 + 0.14 * this.rng(), life: 0.5 + 0.2 * this.rng() }); }
  }
  cold(x0, x1, y) { for (let i = 0; i < 10; i++) this.add({ k: 'drop', x: lerp(x0, x1, this.rng()), y: y + this.rng() * 0.8, vx: (this.rng() - 0.5) * 4, vy: -2 - this.rng() * 3, g: G, r: 0.06 + 0.05 * this.rng(), life: 0.7 }); }

  update(dt) {
    this.t += dt;
    this.shakeA *= Math.exp(-dt * 9);
    const ps = this.ps;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.t += dt;
      if (p.t >= p.life) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      if (p.t < 0) continue;
      if (p.drag) { const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
      if (p.k === 'bubble') { p.x += Math.sin(p.t * 9 + p.r * 40) * 0.01; if (p.wy > -1e8 && p.y < p.wy) p.t = p.life; }
      if (p.k === 'ring') p.r += p.vr * dt;
    }
    for (let i = this.words.length - 1; i >= 0; i--) { const w = this.words[i]; w.t += dt; w.y += w.vy * dt * Math.max(0, 1 - w.t * 1.5); if (w.t >= w.life) this.words.splice(i, 1); }
  }

  draw(ctx, layer) {
    for (const p of this.ps) {
      if (p.t < 0) continue;
      const u = p.t / p.life;
      if (layer === 'under' ? p.k !== 'bubble' : p.k === 'bubble') continue;
      switch (p.k) {
        case 'drop': {
          const sp = Math.hypot(p.vx, p.vy), st = clamp(sp * 0.035, 0, 0.5), a = Math.atan2(p.vy, p.vx);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.globalAlpha = 1 - u * u;
          ell(ctx, 0, 0, p.r * (1 + st * 2), p.r * (1 - st * 0.3)); ctx.fillStyle = '#E9F9FF'; ctx.fill(); ctx.lineWidth = 0.025; ctx.strokeStyle = 'rgba(31,127,176,0.9)'; ctx.stroke();
          ctx.restore(); break;
        }
        case 'column': {
          const k = Math.sin(clamp(u * 1.15) * Math.PI), h = p.h * k, w = p.r * (1 - 0.3 * u);
          ctx.save(); ctx.globalAlpha = 0.9 * (1 - u * 0.6);
          ctx.beginPath(); ctx.moveTo(p.x - w * 1.4, p.y); ctx.bezierCurveTo(p.x - w, p.y - h * 0.5, p.x - w * 0.5, p.y - h, p.x, p.y - h); ctx.bezierCurveTo(p.x + w * 0.5, p.y - h, p.x + w, p.y - h * 0.5, p.x + w * 1.4, p.y); ctx.closePath();
          const g = ctx.createLinearGradient(0, p.y - h, 0, p.y); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, 'rgba(160,225,245,0.8)');
          ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 0.05; ctx.strokeStyle = 'rgba(31,127,176,0.8)'; ctx.stroke();
          ctx.restore(); break;
        }
        case 'ring': {
          ctx.globalAlpha = (1 - u) * 0.9; ctx.lineWidth = 0.08; ctx.strokeStyle = '#fff';
          ell(ctx, p.x, p.y + 0.05, p.r, p.r * 0.16); ctx.stroke(); ctx.globalAlpha = 1; break;
        }
        case 'bubble': {
          ctx.globalAlpha = 0.85 * (1 - u); ctx.lineWidth = 0.025; ctx.strokeStyle = '#EFFBFF'; ell(ctx, p.x, p.y, p.r, p.r); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.8)'; ell(ctx, p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.25, p.r * 0.25); ctx.fill(); ctx.globalAlpha = 1; break;
        }
        case 'dust': case 'puff': {
          ctx.globalAlpha = (1 - u) * (p.k === 'puff' ? 0.85 : 0.6); ctx.fillStyle = p.k === 'puff' ? '#FFFFFF' : '#F3E6C4';
          ell(ctx, p.x, p.y, p.r * (1 + u), p.r * (1 + u)); ctx.fill(); ctx.lineWidth = 0.02; ctx.strokeStyle = 'rgba(42,33,80,0.35)'; ctx.stroke(); ctx.globalAlpha = 1; break;
        }
        case 'sweat': {
          ctx.globalAlpha = 1 - u; ctx.fillStyle = '#BFEFFF';
          ctx.beginPath(); ctx.moveTo(p.x, p.y - p.r * 1.8); ctx.quadraticCurveTo(p.x + p.r, p.y, p.x, p.y + p.r); ctx.quadraticCurveTo(p.x - p.r, p.y, p.x, p.y - p.r * 1.8); ctx.fill();
          ctx.lineWidth = 0.02; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.globalAlpha = 1; break;
        }
        case 'spark': {
          ctx.globalAlpha = 1 - u; ctx.fillStyle = p.col; star5(ctx, p.x, p.y, p.r * (1 - u * 0.5), p.a); ctx.fill(); ctx.globalAlpha = 1; break;
        }
        case 'conf': {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(1, Math.cos(p.t * 9 + p.r * 30)); ctx.globalAlpha = u > 0.8 ? (1 - u) * 5 : 1;
          ctx.fillStyle = p.col; ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); ctx.restore(); break;
        }
        default:
      }
    }
    if (layer === 'over') for (const w of this.words) {
      const u = w.t / w.life, pop = u < 0.12 ? 0.4 + 0.6 * Math.sin(u / 0.12 * Math.PI / 2) * 1.15 : u < 0.2 ? 1.15 - (u - 0.12) / 0.08 * 0.15 : 1;
      ctx.save(); ctx.globalAlpha = u > 0.75 ? (1 - u) / 0.25 : 1; ctx.translate(w.x, w.y); ctx.scale(pop, pop);
      popText(ctx, w.text, 0, 0, w.px, { rot: w.rot, face: w.face, side: w.side, key: w.key });
      ctx.restore();
    }
  }
}
