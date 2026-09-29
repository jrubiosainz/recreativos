// Visual effects: bursts, puffs, petals, floating text and stamps, screen shake and flashes.
import { TAU, clamp, lerp, ease, rgba, ellipse } from './util.js';

export const FONT = "'Fredoka', 'Zen Maru', 'Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Yu Gothic', 'Noto Sans JP', 'Trebuchet MS', system-ui, sans-serif";
export const JP = "'Zen Maru', 'Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Yu Gothic', 'Noto Sans JP', 'Fredoka', system-ui, sans-serif";
// vestibular safety: no camera shake and softer flashes when the OS asks for reduced motion
const calm = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export class FX {
  constructor() {
    this.parts = [];
    this.rings = [];
    this.texts = [];
    this.orbs = [];
    this.shakeT = 0; this.shakeDur = 1; this.shakeAmp = 0;
    this.flashA = 0; this.flashColor = '#ffffff';
    this.t = 0;
  }

  clear() { this.parts.length = 0; this.rings.length = 0; this.texts.length = 0; this.orbs.length = 0; this.shakeT = 0; this.flashA = 0; }

  shake(amp, dur = 0.35) { if (calm?.matches) return; if (amp >= this.shakeAmp * clamp(this.shakeT / this.shakeDur)) { this.shakeAmp = amp; this.shakeT = dur; this.shakeDur = dur; } }
  flash(color, a = 0.35) { if (calm?.matches) a *= 0.5; this.flashColor = color; this.flashA = Math.max(this.flashA, a); }
  offset() {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    const k = this.shakeT / this.shakeDur, a = this.shakeAmp * k * k;
    return { x: Math.sin(this.t * 71) * a, y: Math.cos(this.t * 53) * a * 0.7 };
  }

  ring(x, y, r0, r1, color, dur = 0.9, w = 3, delay = 0) { this.rings.push({ x, y, r0, r1, color, dur, w, t: -delay }); }

  // floating label; opts: { color, size, dur, rise, stamp, outline, weight, delay, font, sub }
  text(str, x, y, o = {}) {
    this.texts.push({ str, x, y, t: -(o.delay || 0), dur: o.dur ?? 1.2, color: o.color || '#ffffff', size: o.size || 26, rise: o.rise ?? 38,
      stamp: !!o.stamp, outline: o.outline || '#2a1e3a', weight: o.weight || 700, rot: o.rot ?? (Math.random() - 0.5) * 0.12, font: o.font || FONT, sub: o.sub || null });
  }

  // a soft expanding cloud (landing dust, a sigh, a bump)
  puff(x, y, n, color, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? -Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? Math.PI);
      const v = (o.speed ?? 60) * (0.5 + Math.random() * 0.7);
      this.parts.push({ kind: 'puff', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.gravity ?? -20, t: 0, dur: (o.dur ?? 0.6) * (0.7 + Math.random() * 0.6),
        size: (o.size ?? 10) * (0.6 + Math.random() * 0.8), color, rot: 0, vr: 0, drag: 3 });
    }
  }

  // short radial strokes: the comic "impact" star around a hit
  impact(x, y, r, color = '#ffffff', o = {}) {
    const n = o.n ?? 9;
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? 0) + (i / n) * (o.spread ?? TAU) + (Math.random() - 0.5) * 0.3;
      this.parts.push({ kind: 'spark', x, y, a, r0: r * 0.55, r1: r * (1.1 + Math.random() * 0.5), t: 0, dur: o.dur ?? 0.22, size: o.w ?? 3, color, vx: 0, vy: 0, g: 0, drag: 0, rot: 0, vr: 0 });
    }
  }

  petal(x, y, o = {}) {
    this.parts.push({ kind: 'petal', x, y, vx: o.vx ?? -20 - Math.random() * 30, vy: o.vy ?? 20 + Math.random() * 20, g: 8, t: 0, dur: o.dur ?? 6, size: o.size ?? 6,
      color: o.color || (Math.random() < 0.5 ? '#ffc6d9' : '#ffdbe6'), rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 4, drag: 0.3, wob: Math.random() * 6 });
  }

  burst(x, y, n, color, o = {}) {
    const sp = o.speed ?? 160, size = o.size ?? 4;
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? -Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? TAU);
      const v = sp * (0.45 + Math.random() * 0.75);
      this.parts.push({ kind: o.kind || 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.gravity ?? 260, t: 0, dur: (o.dur ?? 0.7) * (0.7 + Math.random() * 0.6),
        size: size * (0.6 + Math.random() * 0.8), color: Array.isArray(color) ? color[i % color.length] : color, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 9, drag: o.drag ?? 2.2 });
    }
  }

  zzz(x, y, size, color = '#ffffff') {
    this.parts.push({ kind: 'z', x, y, vx: 14 + Math.random() * 10, vy: -26 - Math.random() * 10, g: 0, t: 0, dur: 2.2, size, color, rot: -0.2, vr: 0.15, drag: 0.2, wob: Math.random() * 6 });
  }

  tear(x, y, dir, size) {
    this.parts.push({ kind: 'tear', x, y, vx: dir * (30 + Math.random() * 30), vy: -40 - Math.random() * 30, g: 520, t: 0, dur: 0.7, size, color: '#8fd3ff', rot: 0, vr: 0, drag: 0.5 });
  }

  sweat(x, y, size) {
    this.parts.push({ kind: 'tear', x, y, vx: (Math.random() - 0.5) * 20, vy: -10, g: 300, t: 0, dur: 0.8, size, color: '#bfe6ff', rot: 0, vr: 0, drag: 0.4 });
  }

  // a glowing orb that flies along a curve to a target (x1,y1 or a function returning {x,y})
  orb(x0, y0, target, o = {}) {
    this.orbs.push({ x0, y0, target, t: -(o.delay || 0), dur: o.dur ?? 0.8, color: o.color || '#b7a4ff', size: o.size || 9, onArrive: o.onArrive, bend: o.bend ?? (Math.random() - 0.5) * 0.6, glyph: o.glyph || 'z' });
  }

  update(dt) {
    this.t += dt;
    if (this.shakeT > 0) this.shakeT -= dt;
    this.flashA = Math.max(0, this.flashA - dt * 1.6);
    for (const p of this.parts) {
      p.t += dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.g * dt;
      p.x += p.vx * dt + (p.kind === 'z' ? Math.sin(p.t * 2.4 + p.wob) * 0.35 : p.kind === 'petal' ? Math.sin(p.t * 1.7 + p.wob) * 0.6 : 0); p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter((p) => p.t < p.dur);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.dur);
    for (const s of this.texts) s.t += dt;
    this.texts = this.texts.filter((s) => s.t < s.dur);
    for (const o of this.orbs) {
      o.t += dt;
      if (o.t >= o.dur && !o.done) { o.done = true; if (o.onArrive) o.onArrive(); }
    }
    this.orbs = this.orbs.filter((o) => !o.done);
  }

  drawWorld(g) {
    for (const r of this.rings) {
      if (r.t < 0) continue;
      const k = clamp(r.t / r.dur), e = ease.outCubic(k);
      g.strokeStyle = rgba(r.color, (1 - k) * 0.85);
      g.lineWidth = r.w * (1 - k * 0.6);
      g.beginPath(); g.arc(r.x, r.y, lerp(r.r0, r.r1, e), 0, TAU); g.stroke();
    }
    for (const p of this.parts) {
      const k = p.t / p.dur, a = k < 0.15 ? k / 0.15 : 1 - Math.pow((k - 0.15) / 0.85, 2);
      g.globalAlpha = clamp(a);
      if (p.kind === 'dot') { g.fillStyle = p.color; ellipse(g, p.x, p.y, p.size, p.size); g.fill(); }
      else if (p.kind === 'puff') {
        // a comic cloud: solid, outlined, grows then shrinks away instead of going murky
        const s = p.size * (0.55 + ease.outCubic(k) * 0.9) * (1 - k * k);
        if (s > 0.3) {
          g.globalAlpha = clamp(a * 1.5) * 0.95; g.fillStyle = p.color;
          ellipse(g, p.x, p.y, s, s * 0.82); g.fill();
          g.lineWidth = Math.max(1, s * 0.14); g.strokeStyle = 'rgba(40,34,70,0.28)'; g.stroke();
        }
      }
      else if (p.kind === 'spark') {
        const e = ease.outCubic(k);
        const ra = lerp(p.r0, p.r1, e), rb = lerp(p.r0, p.r1, Math.min(1, e * 1.6 + 0.2));
        g.globalAlpha = 1 - k; g.strokeStyle = p.color; g.lineWidth = p.size * (1 - k * 0.5); g.lineCap = 'round';
        g.beginPath(); g.moveTo(p.x + Math.cos(p.a) * ra, p.y + Math.sin(p.a) * ra); g.lineTo(p.x + Math.cos(p.a) * rb, p.y + Math.sin(p.a) * rb); g.stroke();
      } else if (p.kind === 'petal') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, 0.55 + 0.45 * Math.sin(p.t * 3 + p.wob));
        g.fillStyle = p.color; g.beginPath(); g.moveTo(0, -p.size); g.quadraticCurveTo(p.size * 0.9, -p.size * 0.2, 0, p.size); g.quadraticCurveTo(-p.size * 0.9, -p.size * 0.2, 0, -p.size); g.fill();
        g.restore();
      }
      else if (p.kind === 'star') { drawStar(g, p.x, p.y, p.size, p.rot, p.color); }
      else if (p.kind === 'conf') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color; g.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9); g.restore();
      } else if (p.kind === 'tear') {
        g.fillStyle = p.color;
        g.beginPath(); g.moveTo(p.x, p.y - p.size * 1.6); g.quadraticCurveTo(p.x + p.size, p.y, p.x, p.y + p.size); g.quadraticCurveTo(p.x - p.size, p.y, p.x, p.y - p.size * 1.6); g.fill();
      } else if (p.kind === 'z') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); const s = p.size * (0.7 + k * 0.6);
        g.font = `700 ${s}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = s * 0.16; g.strokeStyle = 'rgba(40,30,70,0.55)'; g.strokeText('z', 0, 0);
        g.fillStyle = p.color; g.fillText('z', 0, 0); g.restore();
      }
    }
    g.globalAlpha = 1;
  }

  drawOver(g, W, H) {
    for (const o of this.orbs) {
      if (o.t < 0) continue;
      const k = clamp(o.t / o.dur), e = ease.inOutCubic(k);
      const tg = typeof o.target === 'function' ? o.target() : o.target;
      const dx = tg.x - o.x0, dy = tg.y - o.y0;
      const cx = o.x0 + dx * 0.5 - dy * o.bend - 0, cy = o.y0 + dy * 0.5 + dx * o.bend - Math.abs(dx) * 0.25;
      const x = (1 - e) * (1 - e) * o.x0 + 2 * (1 - e) * e * cx + e * e * tg.x;
      const y = (1 - e) * (1 - e) * o.y0 + 2 * (1 - e) * e * cy + e * e * tg.y;
      const s = o.size * (1 + Math.sin(k * Math.PI) * 0.5);
      const gr = g.createRadialGradient(x, y, 0, x, y, s * 2.4);
      gr.addColorStop(0, rgba(o.color, 0.75)); gr.addColorStop(1, rgba(o.color, 0));
      g.fillStyle = gr; ellipse(g, x, y, s * 2.4, s * 2.4); g.fill();
      g.fillStyle = '#ffffff'; ellipse(g, x, y, s * 0.72, s * 0.72); g.fill();
      g.font = `700 ${s * 1.35}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = o.color; g.fillText(o.glyph, x, y + s * 0.05);
    }
    for (const s of this.texts) {
      if (s.t < 0) continue;
      const k = clamp(s.t / s.dur);
      const pin = s.stamp ? ease.outBack(clamp(s.t / 0.22), 2.6) : ease.outBack(clamp(s.t / 0.3));
      const sc = s.stamp ? lerp(2.2, 1, clamp(pin)) * (pin > 1 ? pin : 1) : pin;
      const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : clamp(s.t / 0.08);
      const y = s.y - ease.outCubic(k) * s.rise;
      g.font = `${s.weight} ${s.size}px ${s.font}`;
      // a shout next to a big close-up would hang off the edge of a phone: keep it on screen
      if (s.hw == null) {
        s.hw = g.measureText(s.str).width / 2 + s.size * 0.11;
        if (s.sub) { g.font = `700 ${s.size * 0.42}px ${FONT}`; s.hw = Math.max(s.hw, g.measureText(s.sub).width / 2 + s.size * 0.07); g.font = `${s.weight} ${s.size}px ${s.font}`; }
      }
      const m = s.hw + 6, x = W > 2 * m ? Math.min(W - m, Math.max(m, s.x)) : W / 2;
      g.save(); g.globalAlpha = clamp(a); g.translate(x, y); g.rotate(s.rot); g.scale(sc, sc);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = s.size * 0.22; g.strokeStyle = s.outline; g.strokeText(s.str, 0, 0);
      g.fillStyle = s.color; g.fillText(s.str, 0, 0);
      if (s.sub) {
        const ss = s.size * 0.42;
        g.font = `700 ${ss}px ${FONT}`; g.lineWidth = ss * 0.3; g.strokeText(s.sub, 0, s.size * 0.72); g.fillText(s.sub, 0, s.size * 0.72);
      }
      g.restore();
    }
    if (this.flashA > 0.001) { g.fillStyle = rgba(this.flashColor, this.flashA); g.fillRect(0, 0, W, H); }
  }
}

export function drawStar(g, x, y, r, rot = 0, color = '#ffd35a') {
  g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.46 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath(); g.fill(); g.restore();
}
