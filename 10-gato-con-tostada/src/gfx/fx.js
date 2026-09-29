// What the flat shouts (¡MIAU!, ¡CRAS!, ¡GUAU!, ¡PLAF!) in fat fridge-magnet letters, and the bits that fly:
// butter, glass, water, dust, steam, a tuft of fur, and the confetti of a win. Device pixels.
import { t } from '../i18n.js';
import { F } from '../fonts.js';
import { clamp, ease, TAU, mix } from '../util.js';

// moments of a shout's rise where two of them are checked against each other (s)
const RISE = [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1.2];
const BASE = 34; // a shout's size at scale 1 (CSS px)

export class Fx {
  constructor() { this.words = []; this.ps = []; this.d = 1; this.T = 0; this.ems = new Map(); }
  // T: the band along the top that belongs to the HUD, where no shout may sit
  resize(d, W = 1e5, H = 1e5, T = 0) { this.d = d; this.W = W; this.H = H; this.T = T; }
  clear() { this.words.length = 0; this.ps.length = 0; }
  busy() { return this.words.length > 0 || this.ps.length > 0; }
  // half the width a shout takes on screen, outline included (widths measured once, in ems)
  half(text, s) {
    const px = Math.round(BASE * this.d * s);
    let em = this.ems.get(text);
    if (em == null) {
      em = 0.42 * [...text].length;
      if (typeof document !== 'undefined') { const g = (this.mg ||= document.createElement('canvas').getContext('2d')); g.font = F.logo(100); em = g.measureText(text).width / 100; }
      this.ems.set(text, em);
    }
    return (em * px) / 2 + px * 0.3;
  }
  top(s) { const px = BASE * this.d * s; return Math.max(px * 0.75 + 6 * this.d, this.T + px * 0.55); }
  // where a shout really is at a given age: risen, kept inside the frame and under the HUD
  place(x, y, age, s, text) {
    const d = this.d, px = BASE * d * s, m = 6 * d, hw = this.half(text, s);
    return [clamp(x, hw + m, Math.max(hw + m, this.W - hw - m)), clamp(y - ease.outCubic(Math.min(1, age / 1.2)) * 34 * d, this.top(s), this.H - px * 0.75 - m), hw];
  }
  word([x, y], key, color, scale = 1, arg) {
    let text;
    if (arg) text = t(`fx.${key}`, arg);
    else text = t(`fx.${key}`);
    const d = this.d, [nx, ny, hw] = this.place(x, y, 0, scale, text);
    // the same shout next door is the same shout, louder: it swells instead of printing twice
    for (const w of this.words) {
      if (w.text !== text || w.t >= w.life - 0.5) continue;
      const [wx, wy] = this.place(w.x, w.y, w.t, w.scale, w.text);
      if ((Math.abs(w.ox - x) < hw * 1.2 && Math.abs(w.oy - y) < 70 * d) || (Math.abs(wx - nx) < hw * 1.2 && Math.abs(wy - ny) < 70 * d)) {
        w.bump = 0; w.life = Math.max(w.life, w.t + 1.1);
        return;
      }
    }
    // a different one takes the nearest line that stays clear for its whole rise: above, where it
    // climbs away from what's there, or below when the frame runs out. If none is clear, the least bad.
    const cost = (yy) => {
      let c = 0;
      for (const w of this.words) {
        for (const tau of RISE) {
          const age = w.t + tau;
          if (age >= w.life * 0.8) break;
          const [wx, wy, wh] = this.place(w.x, w.y, age, w.scale, w.text), [cx, cy] = this.place(x, yy, tau, scale, text);
          const ox = wh + hw - Math.abs(wx - cx), oy = 15 * d * (w.scale + scale) - Math.abs(wy - cy);
          if (ox > 0 && oy > 0) c += Math.min(ox, oy);
        }
      }
      return c;
    };
    const step = 14 * d * (scale + 1.1), top = this.top(scale), cands = [y];
    for (let k = 1; k <= 6; k++) if (y - k * step >= top) cands.push(y - k * step);
    for (let k = 1; k <= 6; k++) cands.push(y + k * step);
    let best = y, bc = Infinity;
    for (const yy of cands) { const c = cost(yy); if (c < bc) { bc = c; best = yy; } if (!c) break; }
    this.words.push({ text, x, y: best, ox: x, oy: y, color, scale, t: 0, bump: 1, life: 1.5 + scale * 0.2, rot: (Math.random() - 0.5) * 0.12 });
  }
  burst([x, y], color, n = 20, v0 = 1) {
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU + Math.random() * 0.3, v = (120 + Math.random() * 160) * this.d * v0;
      this.ps.push({ k: 0, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60 * this.d * v0, g: 380 * this.d, t: 0, life: 0.7 + Math.random() * 0.4, c: color, r: (1.5 + Math.random() * 2) * this.d });
    }
  }
  // spray: water flicked off a squashed drop, little lenses that fall
  spray([x, y], n = 16, v0 = 1) {
    for (let j = 0; j < n; j++) {
      const a = Math.random() * TAU, v = (60 + Math.random() * 200) * this.d * v0;
      this.ps.push({ k: 2, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40 * this.d, g: 520 * this.d, t: 0, life: 0.5 + Math.random() * 0.35, c: '#ffffff', r: (1.2 + Math.random() * 2.6) * this.d });
    }
  }
  // k 3 butter blobs · 4 shards · 5 dust · 6 fur · 7 steam
  bits([x, y], k, color, n = 10, v0 = 1, up = 0.6) {
    const d = this.d;
    for (let j = 0; j < n; j++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * (k === 5 ? 2 : 1.6), v = (k === 5 ? 40 + Math.random() * 60 : k === 7 ? 20 + Math.random() * 30 : 90 + Math.random() * 180) * d * v0;
      this.ps.push({ k, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * (k === 5 ? 0.35 : 1) - up * 60 * d, g: (k === 5 ? -10 : k === 7 ? -60 : k === 6 ? 120 : 700) * d, t: 0,
        life: k === 5 ? 0.6 + Math.random() * 0.4 : k === 7 ? 0.8 + Math.random() * 0.5 : k === 6 ? 1 + Math.random() * 0.6 : 0.6 + Math.random() * 0.5,
        c: color, r: (k === 5 || k === 7 ? 3 + Math.random() * 4 : k === 4 ? 2 + Math.random() * 2.5 : 1.4 + Math.random() * 2.2) * d, a: Math.random() * TAU, va: (Math.random() - 0.5) * 16 });
    }
  }
  confetti(W, H, win) {
    const cols = win ? ['#ffd84a', '#f08a3c', '#e8453c', '#7cc6e0', '#8fd06f', '#fff8ea'] : ['#8e8e8e', '#bdbdbd', '#6b6b6b'];
    for (let j = 0; j < (win ? 160 : 40); j++) {
      this.ps.push({ k: 1, x: Math.random() * W, y: -Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 60 * this.d, vy: (60 + Math.random() * 120) * this.d, g: 40 * this.d, t: 0, life: 4 + Math.random() * 2, c: cols[j % cols.length], r: (3 + Math.random() * 4) * this.d, a: Math.random() * TAU, va: (Math.random() - 0.5) * 12 });
    }
  }
  update(dt) {
    for (const w of this.words) { w.t += dt; w.bump += dt; }
    this.words = this.words.filter((w) => w.t < w.life);
    for (const p of this.ps) {
      p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 1) { p.vx *= 0.99; p.a += p.va * dt; p.x += Math.sin(p.t * 3 + p.r) * 20 * this.d * dt; }
      else if (p.k >= 4) { p.a += p.va * dt; if (p.k !== 4) { p.vx *= 1 - 2.5 * dt; p.vy *= p.k === 6 ? 1 - 1.5 * dt : 1 - 2.5 * dt; } }
    }
    this.ps = this.ps.filter((p) => p.t < p.life);
  }
  draw(g) {
    for (const p of this.ps) {
      const a = clamp(1 - p.t / p.life) * (p.k ? 1 : 1);
      g.globalAlpha = p.k === 1 ? Math.min(1, a * 3) : a;
      g.fillStyle = p.c;
      if (p.k === 1) { g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9 * Math.abs(Math.cos(p.a * 2))); g.restore(); }
      else if (p.k === 2) {
        g.fillStyle = 'rgba(12,18,30,0.45)'; g.beginPath(); g.arc(p.x, p.y + p.r * 0.2, p.r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(p.x - p.r * 0.3, p.y - p.r * 0.35, p.r * 0.4, 0, TAU); g.fill();
      } else if (p.k === 3) {
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); g.strokeStyle = 'rgba(42,28,20,0.6)'; g.lineWidth = this.d * 0.8; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(p.x - p.r * 0.3, p.y - p.r * 0.35, p.r * 0.35, 0, TAU); g.fill();
      } else if (p.k === 4) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.beginPath(); g.moveTo(-p.r, p.r * 0.5); g.lineTo(0, -p.r); g.lineTo(p.r, p.r * 0.3); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(42,28,20,0.7)'; g.lineWidth = this.d * 0.8; g.stroke(); g.restore();
      } else if (p.k === 5 || p.k === 7) {
        const u = p.t / p.life; g.globalAlpha = (1 - u) * (p.k === 5 ? 0.45 : 0.6); g.beginPath(); g.arc(p.x, p.y, p.r * (1 + u * 1.6), 0, TAU); g.fill();
      } else if (p.k === 6) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.strokeStyle = p.c; g.lineWidth = this.d * 1.4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-p.r * 1.4, 0); g.quadraticCurveTo(0, -p.r, p.r * 1.4, 0); g.stroke(); g.restore();
      } else { g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); }
    }
    g.globalAlpha = 1;
    const d = this.d;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    for (const w of this.words) {
      const u = w.t / w.life, pop = (w.t < 0.18 ? ease.outBack(w.t / 0.18, 2.4) : 1) * (w.bump < 0.3 ? 1 + 0.22 * Math.sin((w.bump / 0.3) * Math.PI) : 1);
      const a = u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
      const px = Math.round(BASE * d * w.scale);
      const [x, y] = this.place(w.x, w.y, w.t, w.scale, w.text);
      g.save();
      g.translate(x, y);
      g.rotate(w.rot); g.scale(pop, pop);
      g.globalAlpha = a;
      g.font = F.logo(px);
      g.lineWidth = px * 0.24; g.strokeStyle = 'rgba(42,28,20,0.55)'; g.strokeText(w.text, px * 0.04, px * 0.1);
      g.strokeStyle = '#2a1c14'; g.strokeText(w.text, 0, 0);
      const gr = g.createLinearGradient(0, -px * 0.45, 0, px * 0.4);
      gr.addColorStop(0, mix(w.color, '#ffffff', 0.45)); gr.addColorStop(0.5, w.color); gr.addColorStop(1, mix(w.color, '#6b3a14', 0.18));
      g.fillStyle = gr; g.fillText(w.text, 0, 0);
      g.restore();
    }
    g.globalAlpha = 1;
  }
}
