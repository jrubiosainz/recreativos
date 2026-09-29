// What the viewfinder shows: the place, the light, the family, clouds and pigeons, the flash.
// The print (print.js) calls the same functions, so what you judged is what gets developed.
import { drawGroup } from './gfx/group.js';
import { layout, ASPECT } from './layout.js';
import { clamp, lerp } from './util.js';

export const bgSrc = (ev, mode) => `assets/img/bg_${ev.bg || ev.id}_${mode}.jpg`;

// cover-fit an image into a rect
export function cover(g, im, R) {
  if (!im) { g.fillStyle = '#8a7a62'; g.fillRect(R.x, R.y, R.w, R.h); return; }
  const k = Math.max(R.w / im.width, R.h / im.height), w = im.width * k, h = im.height * k;
  g.drawImage(im, R.x + (R.w - w) / 2, R.y + (R.h - h) / 2, w, h);
}

// grain tile, made once
let GRAIN = null;
function grain() {
  if (GRAIN || typeof document === 'undefined') return GRAIN;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), d = x.createImageData(128, 128);
  let s = 12345;
  for (let i = 0; i < d.data.length; i += 4) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const v = 128 + ((s >> 8) % 90) - 45;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return (GRAIN = c);
}
export function drawGrain(g, R, a, t = 0) {
  const c = grain(); if (!c || a <= 0) return;
  g.save(); g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip();
  g.globalAlpha = a; g.globalCompositeOperation = 'overlay';
  const ox = ((t * 997) % 128) | 0, oy = ((t * 613) % 128) | 0, s = Math.max(1, R.w / 700);
  g.translate(R.x - ox * s, R.y - oy * s); g.scale(s, s);
  g.fillStyle = g.createPattern(c, 'repeat'); g.fillRect(0, 0, R.w / s + 256, R.h / s + 256);
  g.restore();
}

// cloud shadows sweeping the beach: dark cool bands with soft edges, a little skewed
function shade(g, R, bands) {
  if (!bands || !bands.length) return;
  g.save(); g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip();
  g.globalCompositeOperation = 'multiply';
  for (const [a, b] of bands) {
    const x0 = R.x + a * R.w, x1 = R.x + b * R.w, soft = R.w * 0.07;
    const gr = g.createLinearGradient(x0 - soft, 0, x1 + soft, 0), w = x1 - x0 + 2 * soft;
    const e = soft / w;
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(clamp(e * 2, 0, 0.5), 'rgb(150,160,190)');
    gr.addColorStop(clamp(1 - e * 2, 0.5, 1), 'rgb(150,160,190)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x0 - soft - R.h * 0.12, R.y + R.h); g.lineTo(x0 - soft, R.y); g.lineTo(x1 + soft, R.y); g.lineTo(x1 + soft - R.h * 0.12, R.y + R.h); g.closePath();
    g.fill();
  }
  g.restore();
}
// sunlight: warm glare over whatever is not in shadow
function glare(g, R, bands, t) {
  g.save(); g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip();
  g.globalCompositeOperation = 'soft-light';
  const gr = g.createRadialGradient(R.x + R.w * 0.5, R.y - R.h * 0.2, 0, R.x + R.w * 0.5, R.y, R.h * 1.3);
  gr.addColorStop(0, 'rgba(255,236,190,0.55)'); gr.addColorStop(1, 'rgba(255,236,190,0)');
  g.fillStyle = gr; g.fillRect(R.x, R.y, R.w, R.h);
  g.restore();
}

// ---- pigeons ----
const INK = '#2a1a14';
function pigeon(g, x, y, s, dir, flap, bob) {
  g.save(); g.translate(x, y); g.scale(s * dir, s);
  g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = 0.06; g.strokeStyle = INK;
  const wing = (up) => {
    g.beginPath(); g.moveTo(-0.1, -0.05);
    g.quadraticCurveTo(-0.2, -0.05 - up * 0.9, -0.62, -0.1 - up * 1.05);
    g.quadraticCurveTo(-0.38, 0.02 - up * 0.3, 0.14, 0.04); g.closePath();
    g.fillStyle = '#7d8596'; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-0.3, -0.06 - up * 0.45); g.lineTo(-0.5, -0.09 - up * 0.8); g.lineWidth = 0.035; g.strokeStyle = '#3c4150'; g.stroke();
    g.lineWidth = 0.06; g.strokeStyle = INK;
  };
  if (flap != null) wing(Math.sin(flap) * -0.9 + 0.1);
  // tail, body, neck, head
  g.beginPath(); g.moveTo(-0.3, 0.02); g.lineTo(-0.62, 0.1); g.lineTo(-0.6, -0.04); g.closePath(); g.fillStyle = '#5e6576'; g.fill(); g.stroke();
  g.beginPath(); g.ellipse(-0.05, 0.02, 0.34, 0.2, -0.1, 0, Math.PI * 2); g.fillStyle = '#9aa2b1'; g.fill(); g.stroke();
  const hy = flap != null ? -0.1 : -0.2 + (bob || 0) * 0.06, hx = flap != null ? 0.32 : 0.24 + (bob || 0) * 0.08;
  g.beginPath(); g.ellipse(hx - 0.06, hy + 0.1, 0.12, 0.14, 0.4, 0, Math.PI * 2); g.fillStyle = '#6f8a86'; g.fill();
  g.beginPath(); g.ellipse(hx, hy, 0.11, 0.1, 0, 0, Math.PI * 2); g.fillStyle = '#6b7282'; g.fill(); g.stroke();
  g.beginPath(); g.moveTo(hx + 0.09, hy - 0.01); g.lineTo(hx + 0.2, hy + 0.02); g.lineTo(hx + 0.09, hy + 0.04); g.fillStyle = '#e8b3a0'; g.fill();
  g.beginPath(); g.arc(hx + 0.03, hy - 0.02, 0.025, 0, Math.PI * 2); g.fillStyle = '#e05a2a'; g.fill();
  if (flap != null) wing(Math.sin(flap + 0.5) * -0.9 + 0.1);
  else { g.beginPath(); g.moveTo(-0.02, 0.2); g.lineTo(-0.04, 0.34); g.moveTo(0.08, 0.2); g.lineTo(0.08, 0.34); g.strokeStyle = '#d0787a'; g.lineWidth = 0.05; g.stroke(); }
  g.restore();
}
function headTop(ev, mode) {
  const L = layout(ev, mode), A = ASPECT[mode];
  return Math.min(...Object.values(L).map((q) => q.y - q.d * A * 0.75));
}
const N_PIG = 9;
function pigeons(g, R, f, ev, mode, t) {
  if (!f) return;
  g.save(); g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip();
  const dir = f.x1 > f.x0 ? 1 : -1, sky = Math.max(0.06, headTop(ev, mode) - 0.08), big = R.w * (mode === 'h' ? 0.05 : 0.08);
  for (let i = 0; i < N_PIG; i++) {
    const r = Math.sin(i * 12.9898) * 43758.5453, fr = r - Math.floor(r), lag = i * 0.045 + fr * 0.05;
    if (f.warn) {
      if (i > 3) continue;
      const w = (t - (f.start - 0.8)) / 0.8, px = f.x0 + (i - 1.5) * 0.045 * (1 + fr), bob = Math.sin(t * 9 + i * 2) > 0.3 ? 1 : 0;
      pigeon(g, R.x + px * R.w, R.y + R.h * (1.0 - 0.02 * i % 2) - big * 0.2, big * (0.9 + fr * 0.2), i % 2 ? 1 : -1, null, bob * Math.min(1, w * 3));
      continue;
    }
    const u = clamp((f.k - lag) * 1.15, 0, 1.4); if (u <= 0) continue;
    const e = 1 - Math.pow(1 - Math.min(u, 1), 2.2);
    const x = lerp(f.x0, f.x1, e) + (u > 1 ? (u - 1) * 0.6 * dir : 0) + Math.sin(u * 7 + i) * 0.02 + (i - 4) * 0.018;
    const rise = Math.min(1, u * 2.6), y = lerp(1.02, sky + (fr - 0.5) * 0.08, 1 - Math.pow(1 - rise, 2)) + Math.sin(u * 9 + i * 1.7) * 0.025 - (u > 1 ? (u - 1) * 0.3 : 0);
    const s = big * lerp(1.05, 0.45, Math.min(1, u * 1.3)) * (0.85 + fr * 0.3);
    pigeon(g, R.x + x * R.w, R.y + y * R.h, s, dir, t * (22 + fr * 8) + i * 1.9);
  }
  g.restore();
}

// c: { ev, mode, bg, view, S, t, dt, bands, flock, flash (live burst 0..1), lit (a flash photo 0..1),
//      redeye, scratch (a spare canvas: needed to light only the people in a flash photo) }
export function drawScene(g, R, c) {
  const { ev, mode } = c, poor = ev.light === 'poor';
  g.save(); g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip();
  cover(g, c.bg, R);
  if (c.lit) { g.fillStyle = `rgba(12,8,22,${0.5 * c.lit})`; g.fillRect(R.x, R.y, R.w, R.h); }
  else if (poor) { g.fillStyle = 'rgba(26,14,34,0.14)'; g.fillRect(R.x, R.y, R.w, R.h); }
  if (ev.sun) glare(g, R, c.bands, c.t);
  const fx = { flash: !!c.lit, redeye: !!(c.lit && c.redeye) };
  let faces;
  if (c.lit && c.scratch) {
    const s = c.scratch, x = s.getContext('2d');
    if (s.width !== Math.ceil(R.w) || s.height !== Math.ceil(R.h)) { s.width = Math.ceil(R.w); s.height = Math.ceil(R.h); }
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, s.width, s.height);
    faces = drawGroup(x, ev, mode, c.view, { x: 0, y: 0, w: R.w, h: R.h }, c.S, c.t, c.dt || 0, fx);
    x.globalCompositeOperation = 'source-atop';
    const gr = x.createRadialGradient(R.w * 0.5, R.h * 0.45, 0, R.w * 0.5, R.h * 0.45, Math.max(R.w, R.h) * 0.75);
    gr.addColorStop(0, `rgba(255,252,246,${0.3 * c.lit})`); gr.addColorStop(1, `rgba(40,30,60,${0.3 * c.lit})`);
    x.fillStyle = gr; x.fillRect(0, 0, R.w, R.h);
    x.globalCompositeOperation = 'source-over';
    g.drawImage(s, R.x, R.y, R.w, R.h);
  } else faces = drawGroup(g, ev, mode, c.view, R, c.S, c.t, c.dt || 0, fx);
  if (ev.sun) shade(g, R, c.bands);
  pigeons(g, R, c.flock, ev, mode, c.t);
  drawGrain(g, R, poor && !c.lit ? 0.16 : 0.08, c.grainT ?? c.t);
  if (c.flash > 0) { g.fillStyle = `rgba(255,253,248,${clamp(c.flash) * 0.92})`; g.fillRect(R.x, R.y, R.w, R.h); }
  g.restore();
  return faces;
}

// the optical finder: bright-line frame, focus brackets, a soft vignette. k: shutter blink 0..1
export function drawFinder(g, R, o = {}) {
  const u = Math.min(R.w, R.h);
  g.save(); g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip();
  const vg = g.createRadialGradient(R.x + R.w / 2, R.y + R.h / 2, u * 0.35, R.x + R.w / 2, R.y + R.h / 2, Math.hypot(R.w, R.h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = vg; g.fillRect(R.x, R.y, R.w, R.h);
  const i = u * 0.05, L = u * 0.07, lw = Math.max(1.5, u * 0.004);
  g.strokeStyle = 'rgba(255,255,255,0.78)'; g.lineWidth = lw; g.lineCap = 'square';
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = lw * 2;
  g.beginPath();
  for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const x = R.x + (sx ? R.w - i : i), y = R.y + (sy ? R.h - i : i), dx = sx ? -L : L, dy = sy ? -L : L;
    g.moveTo(x + dx, y); g.lineTo(x, y); g.lineTo(x, y + dy);
  }
  const cx = R.x + R.w / 2, cy = R.y + R.h * 0.42, b = u * 0.045;
  g.moveTo(cx - b, cy - b * 0.6); g.lineTo(cx - b, cy - b); g.lineTo(cx - b * 0.4, cy - b);
  g.moveTo(cx + b * 0.4, cy - b); g.lineTo(cx + b, cy - b); g.lineTo(cx + b, cy - b * 0.6);
  g.moveTo(cx - b, cy + b * 0.6); g.lineTo(cx - b, cy + b); g.lineTo(cx - b * 0.4, cy + b);
  g.moveTo(cx + b * 0.4, cy + b); g.lineTo(cx + b, cy + b); g.lineTo(cx + b, cy + b * 0.6);
  g.stroke();
  g.shadowBlur = 0;
  if (o.shutter > 0) {
    const k = clamp(o.shutter), r = Math.hypot(R.w, R.h) * 0.5;
    const ig = g.createRadialGradient(cx, R.y + R.h / 2, r * (1 - k) * 0.9, cx, R.y + R.h / 2, r * (1.05 - k * 0.6));
    ig.addColorStop(0, 'rgba(0,0,0,0)'); ig.addColorStop(1, `rgba(0,0,0,${0.85 * k})`);
    g.fillStyle = ig; g.fillRect(R.x, R.y, R.w, R.h);
  }
  g.restore();
}
