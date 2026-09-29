// Drawing helpers shared by the cinema, the facade and the cards: colour maths, easing, springs,
// marquee bulbs (pre-lit sprites, so sixty of them cost sixty drawImage calls), gilded frames,
// velvet, outlined text and film grain.
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const backOut = (t, s = 1.7) => { t = clamp(t) - 1; return 1 + (s + 1) * t * t * t + s * t * t; };
// a damped wobble that settles on 1: signs popping onto a board
export const pop = (t, f = 3.2, d = 5) => (t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(f * Math.PI * t));

export function rgb(hex) {
  const h = hex.replace('#', ''), n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (hex, a = 1) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
export function mix(a, b, t, al = 1) {
  const A = rgb(a), B = rgb(b);
  return `rgba(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))},${al})`;
}
export const lum = (hex) => { const [r, g, b] = rgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };

// A damped spring towards a target: heads turning, hands moving, signs settling.
export class Spring {
  constructor(v = 0, k = 90, z = 1) { this.v = v; this.to = v; this.vel = 0; this.k = k; this.z = z; }
  step(dt) {
    const c = 2 * Math.sqrt(this.k) * this.z, n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
    for (let i = 0; i < n; i++) { this.vel += (this.k * (this.to - this.v) - c * this.vel) * h; this.v += this.vel * h; }
    return this.v;
  }
  set(v) { this.v = this.to = v; this.vel = 0; return this; }
  kick(dv) { this.vel += dv; return this; }
}

export function rr(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

export function canvas(w, h) {
  const W = Math.max(1, Math.ceil(w)), H = Math.max(1, Math.ceil(h));
  if (typeof document !== 'undefined') return Object.assign(document.createElement('canvas'), { width: W, height: H });
  return new OffscreenCanvas(W, H);
}

// ---- marquee bulbs ----
// A bulb is a brass socket, a glass envelope and, when lit, a filament core and a halo. Sprites
// are cached per pixel radius and 12 brightness steps; the halo is drawn separately, additively.
const bulbCache = new Map();
const STEPS = 12;
function bulbSprite(rpx, lv, tint) {
  const key = `${rpx}|${lv}|${tint}`;
  let c = bulbCache.get(key);
  if (c) return c;
  const s = rpx * 2 + 4, x = canvas(s, s).getContext('2d'), m = s / 2, on = lv / (STEPS - 1);
  const [tr, tg, tb] = rgb(tint);
  let gr = x.createRadialGradient(m - rpx * 0.3, m - rpx * 0.3, rpx * 0.1, m, m, rpx * 1.08);
  gr.addColorStop(0, '#6b5a3a'); gr.addColorStop(0.7, '#2a2114'); gr.addColorStop(1, '#0c0906');
  x.fillStyle = gr; x.beginPath(); x.arc(m, m, rpx, 0, Math.PI * 2); x.fill();
  const R = rpx * 0.78;
  gr = x.createRadialGradient(m - R * 0.25, m - R * 0.3, R * 0.05, m, m, R);
  const core = `rgb(${Math.round(lerp(70, 255, on))},${Math.round(lerp(58, 250, on))},${Math.round(lerp(40, 225, on))})`;
  gr.addColorStop(0, on > 0.05 ? core : '#8c7a5c');
  gr.addColorStop(0.45, `rgb(${Math.round(lerp(58, tr, on))},${Math.round(lerp(44, tg, on))},${Math.round(lerp(30, tb * 0.6, on))})`);
  gr.addColorStop(1, `rgb(${Math.round(lerp(26, tr * 0.7, on))},${Math.round(lerp(20, tg * 0.45, on))},${Math.round(lerp(14, tb * 0.2, on))})`);
  x.fillStyle = gr; x.beginPath(); x.arc(m, m, R, 0, Math.PI * 2); x.fill();
  x.fillStyle = `rgba(255,255,255,${0.18 + 0.4 * on})`;
  x.beginPath(); x.ellipse(m - R * 0.32, m - R * 0.36, R * 0.22, R * 0.14, -0.7, 0, Math.PI * 2); x.fill();
  bulbCache.set(key, c = x.canvas);
  return c;
}
const haloCache = new Map();
function haloSprite(rpx, tint) {
  const key = `${rpx}|${tint}`;
  let c = haloCache.get(key);
  if (c) return c;
  const s = rpx * 8, x = canvas(s, s).getContext('2d'), m = s / 2, [r, g, b] = rgb(tint);
  const gr = x.createRadialGradient(m, m, 0, m, m, m);
  gr.addColorStop(0, 'rgba(255,248,225,0.9)'); gr.addColorStop(0.12, `rgba(${r},${g},${b},0.55)`);
  gr.addColorStop(0.4, `rgba(${r},${g},${b},0.14)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, s, s);
  haloCache.set(key, c = x.canvas);
  return c;
}
// on: 0..1 filament brightness. dpr: device pixels per CSS pixel, so sprites stay sharp.
export function bulb(g, x, y, r, on, { dpr = 1, tint = '#ffb347', halo = true } = {}) {
  const rpx = Math.max(2, Math.round(r * dpr)), lv = Math.round(clamp(on) * (STEPS - 1));
  const sp = bulbSprite(rpx, lv, tint), s = sp.width / dpr;
  g.drawImage(sp, x - s / 2, y - s / 2, s, s);
  if (halo && on > 0.04) {
    const h = haloSprite(rpx, tint), hs = h.width / dpr, op = g.globalCompositeOperation, a = g.globalAlpha;
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * clamp(on) * 0.9;
    g.drawImage(h, x - hs / 2, y - hs / 2, hs, hs);
    g.globalCompositeOperation = op; g.globalAlpha = a;
  }
}

// ---- gilt, brass, velvet ----
export function gilt(g, x0, y0, x1, y1, a = 1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, `rgba(92,62,22,${a})`); gr.addColorStop(0.18, `rgba(214,168,82,${a})`);
  gr.addColorStop(0.32, `rgba(255,228,150,${a})`); gr.addColorStop(0.5, `rgba(170,118,44,${a})`);
  gr.addColorStop(0.72, `rgba(236,196,108,${a})`); gr.addColorStop(1, `rgba(84,56,20,${a})`);
  return gr;
}
// a moulded gilded frame of width fw around (x, y, w, h), lit from above
export function giltFrame(g, x, y, w, h, fw, { glow = 0, a = 1 } = {}) {
  g.save();
  g.fillStyle = gilt(g, x, y - fw, x, y + h + fw, a);
  g.beginPath(); g.rect(x - fw, y - fw, w + fw * 2, h + fw * 2); g.rect(x, y, w, h); g.fill('evenodd');
  g.lineWidth = Math.max(0.75, fw * 0.14);
  g.strokeStyle = `rgba(255,236,180,${0.55 * a})`; g.strokeRect(x - fw * 0.55, y - fw * 0.55, w + fw * 1.1, h + fw * 1.1);
  g.strokeStyle = `rgba(40,24,6,${0.8 * a})`; g.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  if (glow > 0) {
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(255,200,120,${0.25 * glow * a})`; g.lineWidth = fw * 0.5; g.strokeRect(x - fw * 0.75, y - fw * 0.75, w + fw * 1.5, h + fw * 1.5);
  }
  g.restore();
}
// vertical velvet folds (a curtain): a pattern per colour and fold width
const velvetCache = new Map();
export function velvet(g, base, fold, dpr = 1) {
  const w = Math.max(4, Math.round(fold * dpr)), key = `${base}|${w}`;
  let p = velvetCache.get(key);
  if (!p) {
    const c = canvas(w, 4), x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, mix(base, '#000000', 0.55)); gr.addColorStop(0.3, mix(base, '#ffffff', 0.08));
    gr.addColorStop(0.55, base); gr.addColorStop(1, mix(base, '#000000', 0.62));
    x.fillStyle = gr; x.fillRect(0, 0, w, 4);
    p = { c, w };
    velvetCache.set(key, p);
  }
  const pat = g.createPattern(p.c, 'repeat');
  pat.setTransform?.(new DOMMatrix().scale(1 / dpr, 1));
  return pat;
}

// ---- text ----
export function text(g, s, x, y, { font, fill = '#fff', stroke = null, lw = 0, align = 'center', base = 'middle', shadow = null, blur = 0, sx = 0, sy = 0 } = {}) {
  g.save();
  if (font) g.font = font;
  g.textAlign = align; g.textBaseline = base;
  if (shadow) { g.shadowColor = shadow; g.shadowBlur = blur; g.shadowOffsetX = sx; g.shadowOffsetY = sy; }
  if (stroke && lw) { g.lineJoin = 'round'; g.miterLimit = 2; g.strokeStyle = stroke; g.lineWidth = lw; g.strokeText(s, x, y); g.shadowColor = 'transparent'; }
  g.fillStyle = fill; g.fillText(s, x, y);
  g.restore();
}
// the largest size (<= size) at which s fits in maxW, for font(size) -> css font string
export function fit(g, s, maxW, size, font) {
  g.save(); g.font = font(size);
  const w = g.measureText(s).width; g.restore();
  return w > maxW ? Math.max(6, Math.floor(size * maxW / w)) : size;
}
// greedy word wrap into at most `max` lines (g.font must be set)
export function wrap(g, s, maxW, max = 3) {
  const words = String(s).split(/\s+/), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > max) { const rest = lines.splice(max - 1).join(' '); lines.push(rest); }
  return lines;
}

// ---- film grain, pre-rendered once ----
let grainTiles = null;
export function grain(n = 4, size = 160) {
  if (grainTiles) return grainTiles;
  grainTiles = [];
  for (let k = 0; k < n; k++) {
    const c = canvas(size, size), x = c.getContext('2d'), im = x.createImageData(size, size);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    x.putImageData(im, 0, 0);
    grainTiles.push(c);
  }
  return grainTiles;
}

// a five-pointed star path centred on (x, y)
export function starPath(g, x, y, r, inner = 0.45, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5, q = i % 2 ? r * inner : r;
    if (i) g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); else g.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  g.closePath();
}

// deterministic hash noise for per-seat and per-bulb variety
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
