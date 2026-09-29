// The poster's inks and the few drawing habits everything shares: airbrushed blobs with a hard white
// highlight, a thin navy key line, and paper that has been in the sun since August 1986.
import { TAU, clamp } from '../util.js';

export const INK = {
  navy: '#1D2F6F', blue: '#2B4FA3', sky: '#9FD3E8', pool: '#3BB7D8', poolDeep: '#1F7FB0', foam: '#F4FBFF',
  yellow: '#F6D34A', pink: '#F06A8E', red: '#D8322A', paper: '#F3E6C4', paperDark: '#E4D0A2',
  tile: '#A9C6DA', white: '#FBF7EE', key: '#2A2150', green: '#4F8A3A', grass: '#7DB854', orange: '#F29A3A',
};

export function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(1e-4, rx), Math.max(1e-4, ry), rot, 0, TAU); }
export const hash2 = (a, b, s = 0) => { let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// an airbrushed fill: light from the top left, a hard highlight, the key line
export function airbrush(ctx, pathFn, { base, hi, lo, key = INK.key, lw = 0.05, gx = 0, gy = 0, r = 1, gloss = true, keyAlpha = 1 } = {}) {
  ctx.beginPath(); pathFn(ctx);
  const g = ctx.createRadialGradient(gx - 0.35 * r, gy - 0.4 * r, 0.02, gx, gy, 1.25 * r);
  g.addColorStop(0, hi || base); g.addColorStop(0.45, base); g.addColorStop(1, lo || base);
  ctx.fillStyle = g;
  if (key && lw) { ctx.lineWidth = lw; ctx.strokeStyle = key; ctx.globalAlpha = keyAlpha; ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.fill();
}

// paper: grain + faint halftone + a warm sun-fade, made once and laid over the whole frame
export function paperCanvas(size = 256, seed = 7) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < size * size; i++) {
    const n = rnd(), fib = rnd() < 0.012 ? 0.5 : 0;
    const v = 128 + (n - 0.5) * 70 - fib * 60;
    d[i * 4] = v + 6; d[i * 4 + 1] = v; d[i * 4 + 2] = v - 10; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // a few long fibres
  g.globalAlpha = 0.12; g.strokeStyle = '#5a4a30'; g.lineWidth = 0.6;
  for (let i = 0; i < 14; i++) { g.beginPath(); const x = rnd() * size, y = rnd() * size; g.moveTo(x, y); g.quadraticCurveTo(x + (rnd() - 0.5) * 30, y + (rnd() - 0.5) * 30, x + (rnd() - 0.5) * 50, y + (rnd() - 0.5) * 50); g.stroke(); }
  return c;
}

// the comic pops («¡HIP!», «¡PRIII!») in the poster lettering: yellow face, red 3D extrude, navy key
export function popText(ctx, text, x, y, px, { face = INK.yellow, side = INK.red, key = INK.navy, rot = -0.08, depth = 0.09, font } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.font = font || `850 ${px}px Gluten, "Arial Rounded MT Bold", system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const d = px * depth;
  ctx.lineWidth = px * 0.2; ctx.strokeStyle = key;
  for (let i = 0; i <= 4; i++) ctx.strokeText(text, d * i / 4, d * i / 4);
  ctx.fillStyle = side;
  for (let i = 1; i <= 4; i++) ctx.fillText(text, d * i / 4, d * i / 4);
  ctx.fillStyle = face; ctx.fillText(text, 0, 0);
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; ctx.save(); ctx.beginPath(); ctx.rect(-px * 6, -px * 0.6, px * 12, px * 0.42); ctx.clip(); ctx.fillText(text, 0, 0); ctx.restore();
  ctx.restore();
}

export function star5(ctx, x, y, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  ctx.closePath();
}
export const fade = (t, a, b) => clamp((t - a) / (b - a));
