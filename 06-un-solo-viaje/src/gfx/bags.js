// The bags, as a fruit shop's scale sees them: every one weighed and labelled. Most are the
// supermarket's own (thin white plastic, a green and an orange stripe up the side, stretched into
// fans of creases by what is in them), some are their own thing: a red net of oranges, a six-pack
// of water in shrink film, a paper bag with the bread sticking out, a cold bag, a gift bag.
// Each is painted once into a sprite (body, what peeks out of it, its label) and hung live: the
// handles are drawn every frame from the fist down to the bag's shoulders, so it can swing.
import { BAG } from '../levels.js';
import { PAL, BAGS, FACE, TAU, rgba, ell, rrect, poly, canvas, tone, darker, lighter } from './paint.js';
import { mulberry32 } from '../util.js';

// per look: the style, the mouth's half width and how far below the fist it hangs (in fist widths),
// and the body's half width and height below the mouth
export const LOOKS = {
  leche: { st: 'white', mw: 0.6, sl: 0.9, bw: 1.02, bh: 3.1 },
  fruta: { st: 'mesh', mw: 0.1, sl: 0.62, bw: 0.86, bh: 2.7 },
  verdura: { st: 'white', mw: 0.6, sl: 0.92, bw: 0.98, bh: 3.2 },
  agua: { st: 'wrap', mw: 0.24, sl: 0.42, bw: 0.84, bh: 3.5 },
  huevos: { st: 'paper', mw: 0.52, sl: 0.78, bw: 0.78, bh: 2.7 },
  limpieza: { st: 'white', mw: 0.6, sl: 0.9, bw: 1.0, bh: 3.1, band: 'orange' },
  botellas: { st: 'white', mw: 0.6, sl: 0.92, bw: 0.98, bh: 3.3 },
  latas: { st: 'white', mw: 0.6, sl: 0.88, bw: 1.02, bh: 2.9 },
  papel: { st: 'wrap', mw: 0.24, sl: 0.4, bw: 0.92, bh: 2.6 },
  carne: { st: 'white', mw: 0.6, sl: 0.9, bw: 1.0, bh: 2.9 },
  congelados: { st: 'cold', mw: 0.52, sl: 0.72, bw: 0.9, bh: 2.5 },
  pavo: { st: 'white', mw: 0.66, sl: 0.95, bw: 1.18, bh: 3.2 },
  cava: { st: 'gift', mw: 0.44, sl: 0.78, bw: 0.72, bh: 2.8 },
  turron: { st: 'paper', mw: 0.5, sl: 0.76, bw: 0.76, bh: 2.5, band: 'xmas' },
};
export const lookOf = (k) => LOOKS[k] || LOOKS.leche;
export const kgText = (kg) => kg.toFixed(1).replace('.', ',') + ' kg';

// the sprite frame, in fist widths around the mouth's centre
const TOP = 1.7, BOT = 3.7, SIDE = 1.35;
const cache = new Map();
export const clearBags = () => cache.clear();
// sprites are painted at the screen's own resolution, in quarter-octave sizes, so a bag seen at any
// distance reuses one of a few pictures, never scaled up
let RES = 1;
export const setBagRes = (r) => { if (r !== RES) { RES = r; cache.clear(); } };
const qu = (px) => Math.min(200, 2 ** (Math.ceil(Math.log2(Math.max(8, px * RES)) * 4 - 1e-6) / 4));

// a sack: shoulders at ±w0 on the mouth line, bulging to ±w1, bottom at h; the front's neckline sags by `sag`
function sackPath(g, w0, w1, h, sag = 0.3, neck = true) {
  g.beginPath();
  g.moveTo(-w0, 0);
  g.bezierCurveTo(-w0 - (w1 - w0) * 0.9, h * 0.18, -w1 * 1.04, h * 0.55, -w1 * 0.97, h * 0.93);
  g.quadraticCurveTo(-w1 * 0.9, h * 1.02, -w1 * 0.55, h * 1.01);
  g.quadraticCurveTo(0, h * 1.05, w1 * 0.55, h * 1.01);
  g.quadraticCurveTo(w1 * 0.9, h * 1.02, w1 * 0.97, h * 0.93);
  g.bezierCurveTo(w1 * 1.04, h * 0.55, w0 + (w1 - w0) * 0.9, h * 0.18, w0, 0);
  if (neck) g.bezierCurveTo(w0 * 0.55, sag * 0.9, -w0 * 0.55, sag * 0.9, -w0, 0);
  g.closePath();
}
// the creases a load pulls into thin plastic: fans from each shoulder, deeper the heavier it is
function creases(g, L, kg, rnd, col, hi) {
  const n = 2 + Math.round(Math.min(4, kg / 1.8));
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n, x0 = s * L.mw * (0.95 - a * 0.25), y0 = 0.05 + a * 0.08;
      const x1 = s * (L.mw * 0.2 + a * L.bw * 0.95) + (rnd() - 0.5) * 0.12, y1 = 0.9 + a * 1.3 + rnd() * 0.4;
      const cx = (x0 + x1) / 2 + s * (0.18 + rnd() * 0.1), cy = (y0 + y1) / 2 - 0.1;
      g.strokeStyle = col; g.lineWidth = 0.028 + kg * 0.003;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke();
      g.strokeStyle = hi; g.lineWidth = 0.03;
      g.beginPath(); g.moveTo(x0 + s * 0.05, y0 + 0.03); g.quadraticCurveTo(cx + s * 0.06, cy + 0.03, x1 + s * 0.06, y1); g.stroke();
    }
  }
}
// the scale's label: white thermal paper, the shop's green band, the weight in heavy condensed type
function label(g, x, y, kg, rot = 0, w = 0.74, h = 0.4) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = 'rgba(40,30,20,0.18)'; rrect(g, -w / 2 + 0.02, -h / 2 + 0.03, w, h, 0.03); g.fill();
  g.fillStyle = PAL.label; rrect(g, -w / 2, -h / 2, w, h, 0.03); g.fill();
  g.fillStyle = PAL.brand; g.fillRect(-w / 2, -h / 2, w, h * 0.2);
  g.fillStyle = PAL.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.scale(0.01, 0.01); g.font = `800 ${h * 50}px ${FACE}`;
  g.fillText(kgText(kg), 0, h * 10, w * 90); g.restore();
  // a scrap of barcode under it
  const r = mulberry32(Math.round(kg * 100));
  let bx = -w * 0.36;
  while (bx < w * 0.36) { const bw = 0.008 + r() * 0.02; if (r() > 0.4) g.fillRect(bx, h * 0.34, bw, h * 0.1); bx += bw + 0.008; }
  g.restore();
}

// ---------- what peeks out: drawn around the mouth's centre, fist widths, y down ----------
function brick(g, x, y, a, band = '#2d6fb7') {
  g.save(); g.translate(x, y); g.rotate(a);
  const w = 0.44, h = 1.6, d = 0.12;
  g.fillStyle = '#e2e4df'; poly(g, [-w / 2, 0, w / 2, 0, w / 2 + d * 0.7, -d, -w / 2 + d * 0.7, -d]); g.fill();
  g.fillStyle = '#f8f8f4'; g.fillRect(-w / 2, 0, w, h);
  g.fillStyle = '#d3d7d0'; poly(g, [w / 2, 0, w / 2 + d * 0.7, -d, w / 2 + d * 0.7, h - d, w / 2, h]); g.fill();
  g.fillStyle = band; g.fillRect(-w / 2, 0.2, w, 0.36);
  g.fillStyle = '#f8f8f4'; g.beginPath(); g.moveTo(-w / 2, 0.5); g.quadraticCurveTo(0, 0.3, w / 2, 0.44); g.lineTo(w / 2, 0.56); g.lineTo(-w / 2, 0.56); g.fill();
  g.fillStyle = band; ell(g, -w * 0.12 + d * 0.35, -d * 0.55, 0.075, 0.032); g.fill();
  g.fillRect(-w * 0.12 + d * 0.35 - 0.075, -d * 0.55 - 0.06, 0.15, 0.06);
  g.fillStyle = lighter(band, 0.3); ell(g, -w * 0.12 + d * 0.35, -d * 0.55 - 0.06, 0.075, 0.03); g.fill();
  g.strokeStyle = 'rgba(60,60,55,0.35)'; g.lineWidth = 0.018; g.strokeRect(-w / 2, 0, w, h);
  g.restore();
}
function glassBottle(g, x, y, a, len, w, glass, top, cap = false) {
  g.save(); g.translate(x, y); g.rotate(a);
  const nw = w * 0.36, nl = len * 0.34, sh = len * 0.14;
  g.fillStyle = glass;
  g.beginPath(); g.moveTo(-nw / 2, 0); g.lineTo(nw / 2, 0); g.lineTo(nw / 2, nl);
  g.quadraticCurveTo(w / 2, nl + sh * 0.3, w / 2, nl + sh); g.lineTo(w / 2, len); g.lineTo(-w / 2, len);
  g.lineTo(-w / 2, nl + sh); g.quadraticCurveTo(-w / 2, nl + sh * 0.3, -nw / 2, nl); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(-w * 0.3, nl + sh * 0.8, w * 0.1, len * 0.5);
  g.fillRect(-nw * 0.3, 0.05, nw * 0.16, nl * 0.9);
  g.fillStyle = top;
  if (cap) { rrect(g, -nw * 0.62, -0.1, nw * 1.24, 0.14, 0.02); g.fill(); }
  else { g.fillRect(-nw * 0.56, -0.02, nw * 1.12, nl * 0.62); g.fillStyle = darker(top, 0.25); g.fillRect(-nw * 0.56, nl * 0.5, nw * 1.12, 0.03); }
  g.restore();
}
function leek(g, x, y, a, len) {
  g.save(); g.translate(x, y); g.rotate(a);
  const w = 0.3, gr = g.createLinearGradient(0, len, 0, 0);
  gr.addColorStop(0, '#f4f1e4'); gr.addColorStop(0.45, '#eef0d6'); gr.addColorStop(0.62, '#b9cf7c'); gr.addColorStop(1, '#6f9a3c');
  g.fillStyle = gr; rrect(g, -w / 2, len * 0.3, w, len * 0.7, 0.1); g.fill();
  const blades = [[-0.34, -0.2], [-0.08, 0.05], [0.2, 0.3], [0.05, -0.02]];
  for (const [dx, tilt] of blades) {
    g.fillStyle = tilt > 0.1 ? '#3f6e2a' : '#4f7f31';
    g.beginPath(); g.moveTo(-w * 0.45, len * 0.38); g.quadraticCurveTo(dx - 0.1, len * 0.1, dx + tilt * 0.4 - 0.12, -0.02);
    g.lineTo(dx + tilt * 0.4 + 0.1, -0.06); g.quadraticCurveTo(dx + 0.12, len * 0.14, w * 0.45, len * 0.38); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(210,230,170,0.5)'; g.lineWidth = 0.02;
    g.beginPath(); g.moveTo(0, len * 0.36); g.quadraticCurveTo(dx, len * 0.12, dx + tilt * 0.4, -0.02); g.stroke();
  }
  g.strokeStyle = 'rgba(150,170,110,0.45)'; g.lineWidth = 0.015;
  for (const k of [-0.25, 0.25]) { g.beginPath(); g.moveTo(k * w, len * 0.45); g.lineTo(k * w, len); g.stroke(); }
  g.restore();
}
function round(g, x, y, r, col, hi = 0.35) {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  gr.addColorStop(0, lighter(col, hi)); gr.addColorStop(0.7, col); gr.addColorStop(1, darker(col, 0.25));
  g.fillStyle = gr; ell(g, x, y, r, r * 0.96); g.fill();
}
function tray(g, x, y, a, meat, fat) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = '#f1f0ea'; rrect(g, -0.55, -0.3, 1.1, 0.62, 0.1); g.fill();
  g.fillStyle = '#dcdbd3'; rrect(g, -0.47, -0.22, 0.94, 0.46, 0.08); g.fill();
  for (const [mx, my, rx, ry] of [[-0.2, 0.0, 0.26, 0.18], [0.18, 0.02, 0.24, 0.17]]) {
    g.fillStyle = meat; ell(g, mx, my, rx, ry, 0.3); g.fill();
    g.strokeStyle = fat; g.lineWidth = 0.035; g.beginPath(); g.ellipse(mx, my, rx * 0.95, ry * 0.9, 0.3, 3.4, 5.6); g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.moveTo(-0.5, -0.24); g.lineTo(-0.1, -0.24); g.lineTo(-0.35, 0.22); g.lineTo(-0.5, 0.22); g.fill();
  g.fillStyle = PAL.label; g.fillRect(0.12, -0.26, 0.34, 0.2);
  g.fillStyle = PAL.ink; for (let i = 0; i < 9; i++) g.fillRect(0.15 + i * 0.03, -0.16, 0.012, 0.08);
  g.restore();
}
const WHITE_IN = {
  leche(g) { brick(g, -0.4, -0.38, -0.1); brick(g, 0.42, -0.3, 0.12); brick(g, 0.02, -0.52, 0.02); },
  verdura(g) {
    leek(g, -0.18, -1.55, -0.2, 2.4); leek(g, 0.2, -1.4, 0.16, 2.3);
    round(g, -0.42, 0.02, 0.22, '#d9382a'); round(g, 0.38, 0.06, 0.2, '#cf3326');
    for (const [x, y] of [[-0.42, -0.18], [0.38, -0.12]]) {
      g.fillStyle = '#3f7a2c'; g.beginPath();
      for (let k = 0; k < 5; k++) { const t = (k / 5) * TAU; g.lineTo(x + Math.cos(t) * 0.09, y + Math.sin(t) * 0.04); g.lineTo(x + Math.cos(t + 0.6) * 0.03, y + Math.sin(t + 0.6) * 0.015); }
      g.fill();
    }
  },
  limpieza(g) {
    g.save(); g.translate(0.05, -0.62); g.rotate(0.06);
    g.fillStyle = '#1f9bb0';
    g.beginPath(); g.moveTo(-0.46, 2.2); g.lineTo(-0.46, 0.42); g.quadraticCurveTo(-0.44, 0.12, -0.18, 0.08);
    g.lineTo(0.3, 0.08); g.quadraticCurveTo(0.5, 0.1, 0.5, 0.4); g.lineTo(0.5, 2.2); g.closePath(); g.fill();
    g.fillStyle = '#157a8c'; rrect(g, 0.06, 0.2, 0.3, 0.42, 0.12); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-0.38, 0.45, 0.07, 1.2);
    g.fillStyle = '#f4f6f6'; rrect(g, -0.34, -0.12, 0.28, 0.22, 0.04); g.fill();
    g.fillStyle = '#d4dadb'; g.fillRect(-0.34, 0.02, 0.28, 0.03);
    g.fillStyle = '#f7f3e6'; rrect(g, -0.4, 0.78, 0.82, 0.5, 0.04); g.fill();
    g.fillStyle = '#e8762a'; g.fillRect(-0.4, 0.86, 0.82, 0.12);
    g.restore();
  },
  botellas(g) {
    glassBottle(g, -0.22, -1.3, -0.2, 3.0, 0.46, '#1d3a29', '#6d1a2a');
    glassBottle(g, 0.3, -1.08, 0.16, 2.8, 0.42, '#9a9a32', '#2f5b2a', true);
  },
  latas(g) {
    for (const [x, y, col] of [[-0.42, 0.02, '#c8372d'], [0.08, -0.06, '#e9b52c'], [0.5, 0.06, '#3a7d44']]) {
      g.fillStyle = col; g.fillRect(x - 0.24, y, 0.48, 0.8);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x - 0.18, y + 0.1, 0.06, 0.6);
      g.fillStyle = '#c9ccce'; ell(g, x, y, 0.24, 0.08); g.fill();
      g.strokeStyle = '#8e9396'; g.lineWidth = 0.02; ell(g, x, y, 0.19, 0.055); g.stroke();
    }
    g.save(); g.translate(0.22, -0.42); g.rotate(0.12);
    g.fillStyle = 'rgba(214,226,214,0.75)'; rrect(g, -0.24, 0.05, 0.48, 0.7, 0.08); g.fill();
    g.fillStyle = '#d9b46a';
    for (let i = 0; i < 16; i++) { ell(g, -0.16 + (i % 4) * 0.105, 0.16 + Math.floor(i / 4) * 0.13 + (i % 2) * 0.03, 0.05, 0.045); g.fill(); }
    g.fillStyle = '#c99a2a'; rrect(g, -0.26, -0.05, 0.52, 0.14, 0.03); g.fill();
    g.fillStyle = '#e7c35a'; g.fillRect(-0.24, -0.04, 0.48, 0.03);
    g.restore();
  },
  carne(g) { tray(g, 0.18, -0.2, 0.42, '#b73b3b', '#f1ddd0'); tray(g, -0.25, -0.34, -0.36, '#e7b08e', '#f5d9c4'); },
  pavo(g) {
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * 0.28, -0.1); g.rotate(s * 0.32);
      const gr = g.createLinearGradient(-0.3, 0, 0.3, 0); gr.addColorStop(0, '#dfb996'); gr.addColorStop(0.5, '#f4d7bc'); gr.addColorStop(1, '#d4a888');
      g.fillStyle = gr; g.beginPath(); g.moveTo(-0.3, 0.6); g.quadraticCurveTo(-0.34, -0.1, -0.1, -0.5);
      g.lineTo(-0.07, -0.95); g.quadraticCurveTo(0, -1.05, 0.07, -0.95); g.lineTo(0.1, -0.5); g.quadraticCurveTo(0.34, -0.1, 0.3, 0.6); g.fill();
      g.fillStyle = '#f7efe4'; ell(g, 0, -0.97, 0.1, 0.07); g.fill();
      g.strokeStyle = '#faf7f0'; g.lineWidth = 0.035; g.beginPath(); g.moveTo(-0.11, -0.6); g.lineTo(0.11, -0.64); g.stroke();
      g.fillStyle = 'rgba(190,120,100,0.25)'; for (let i = 0; i < 7; i++) { ell(g, -0.15 + (i % 3) * 0.14, -0.2 + i * 0.1, 0.015, 0.015); g.fill(); }
      g.restore();
    }
  },
};

// ---------- the ones that are not the supermarket's bag ----------
function paperBag(g, L, band, band2) {
  const w0 = L.mw + 0.2, w1 = L.bw, h = L.bh;
  g.fillStyle = '#e6e0d2'; g.fillRect(-w0 + 0.04, -0.1, w0 * 2 - 0.08, 0.3);
  return () => {
    g.fillStyle = '#f3eee2';
    g.beginPath(); g.moveTo(-w0, 0); g.lineTo(w0, 0); g.lineTo(w1, h); g.lineTo(-w1, h); g.closePath(); g.fill();
    g.fillStyle = 'rgba(120,100,70,0.12)'; poly(g, [w0 * 0.72, 0, w0, 0, w1, h, w1 * 0.8, h]); g.fill();
    g.fillStyle = '#ebe5d6'; g.fillRect(-w0, 0, w0 * 2, 0.16);
    g.strokeStyle = 'rgba(120,100,70,0.3)'; g.lineWidth = 0.02;
    g.beginPath(); g.moveTo(-w0, 0.16); g.lineTo(w0, 0.16); g.moveTo(w0 * 0.72, 0.16); g.lineTo(w1 * 0.8, h); g.stroke();
    g.fillStyle = band; g.fillRect(-w0 * 1.02, 0.55, (w0 + w1) * 1.02, 0.3);
    if (band2) { g.fillStyle = band2; g.fillRect(-w0 * 1.02, 0.88, (w0 + w1) * 1.02, 0.07); }
    for (const s of [-1, 1]) { g.fillStyle = '#cfc6b1'; ell(g, s * L.mw, 0.22, 0.05, 0.05); g.fill(); }
  };
}
const OWN = {
  agua(g, L) {
    // six bottles of a litre and a half in shrink film: the back row, then the front
    for (const [row, dy, dk] of [[1, -0.16, 0.22], [0, 0, 0]]) {
      for (let k = -1; k <= 1; k++) {
        const x = k * 0.56 + row * 0.12, y = dy;
        g.fillStyle = tone('#cfe3ee', '#5b7482', dk);
        g.beginPath(); g.moveTo(x - 0.08, y - 0.26); g.lineTo(x + 0.08, y - 0.26); g.quadraticCurveTo(x + 0.27, y + 0.02, x + 0.27, y + 0.32);
        g.lineTo(x + 0.27, y + 3.3); g.lineTo(x - 0.27, y + 3.3); g.lineTo(x - 0.27, y + 0.32); g.quadraticCurveTo(x - 0.27, y + 0.02, x - 0.08, y - 0.26); g.fill();
        g.fillStyle = tone('#2f6fb5', '#1c3552', dk); rrect(g, x - 0.1, y - 0.4, 0.2, 0.15, 0.03); g.fill();
        g.fillStyle = tone('#5d93cf', '#1c3552', dk); g.fillRect(x - 0.1, y - 0.4, 0.2, 0.04);
        g.fillStyle = tone('#2f6fb5', '#1c3552', dk); g.fillRect(x - 0.27, y + 1.0, 0.54, 0.55);
        g.fillStyle = tone('#f4f8fb', '#5b7482', dk); g.beginPath(); g.moveTo(x - 0.27, y + 1.32); g.quadraticCurveTo(x, y + 1.12, x + 0.27, y + 1.3); g.lineTo(x + 0.27, y + 1.4); g.quadraticCurveTo(x, y + 1.22, x - 0.27, y + 1.42); g.fill();
        if (!row) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 0.19, y + 0.3, 0.05, 0.62); g.fillRect(x - 0.19, y + 1.65, 0.05, 1.2); }
      }
    }
    g.fillStyle = 'rgba(225,238,246,0.22)'; rrect(g, -0.9, 0.05, 1.92, 3.3, 0.16); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.03;
    for (const x of [-0.72, 0.3]) { g.beginPath(); g.moveTo(x, 0.2); g.quadraticCurveTo(x + 0.1, 1.2, x - 0.02, 2.6); g.stroke(); }
  },
  papel(g, L) {
    const w = L.bw, h = L.bh;
    for (let k = 0; k < 3; k++) {
      const x = -w + (k + 0.5) * (2 * w / 3), gr = g.createLinearGradient(x - w / 3, 0, x + w / 3, 0);
      gr.addColorStop(0, '#dcdcd6'); gr.addColorStop(0.45, '#fbfbf8'); gr.addColorStop(1, '#d4d4ce');
      g.fillStyle = gr; rrect(g, x - w / 3 + 0.01, 0.02, 2 * w / 3 - 0.02, h, 0.12); g.fill();
    }
    g.strokeStyle = 'rgba(150,150,140,0.5)'; g.lineWidth = 0.02; g.beginPath(); g.moveTo(-w, h / 2); g.lineTo(w, h / 2); g.stroke();
    g.fillStyle = '#3f7fc4'; g.fillRect(-w, 0.5, 2 * w, 0.52);
    g.fillStyle = '#f4f8fb'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.scale(0.01, 0.01); g.font = `800 30px ${FACE}`; g.fillText('SUAVE ×12', 0, 77, 160); g.restore();
    g.fillStyle = 'rgba(255,255,255,0.35)'; rrect(g, -w - 0.02, -0.02, 2 * w + 0.04, h + 0.04, 0.16); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-w * 0.8, 0.12, 0.05, h * 0.8);
  },
  fruta(g, L) {
    const P = [];
    const rows = [[2, 0.62, 0.3], [3, 1.08, 0.31], [3, 1.6, 0.32], [3, 2.12, 0.31], [2, 2.55, 0.29]];
    for (const [n, y, r] of rows) for (let k = 0; k < n; k++) P.push([(k - (n - 1) / 2) * r * 1.9 + (n === 2 ? 0 : (y > 1.5 ? 0.04 : -0.04)), y, r]);
    for (const [x, y, r] of P) {
      round(g, x, y, r, '#ee8a1f', 0.3);
      g.fillStyle = 'rgba(160,80,10,0.25)'; for (let i = 0; i < 5; i++) { ell(g, x + Math.cos(i * 1.7) * r * 0.5, y + Math.sin(i * 2.3) * r * 0.5, 0.012, 0.012); g.fill(); }
    }
    round(g, -0.28, 0.22, 0.24, '#c3322a'); round(g, 0.22, 0.18, 0.23, '#b8c93a', 0.25);
    g.save(); g.beginPath();
    g.moveTo(-0.12, 0.08); g.bezierCurveTo(-0.9, 0.3, -1.05, 2.4, -0.55, 2.9); g.quadraticCurveTo(0, 3.05, 0.55, 2.9);
    g.bezierCurveTo(1.05, 2.4, 0.9, 0.3, 0.12, 0.08); g.closePath(); g.clip();
    g.strokeStyle = '#d23a26'; g.lineWidth = 0.035;
    for (let k = -8; k <= 8; k++) { g.beginPath(); g.moveTo(k * 0.2 - 1.5, 0); g.lineTo(k * 0.2 + 1.5, 3); g.moveTo(k * 0.2 + 1.5, 0); g.lineTo(k * 0.2 - 1.5, 3); g.stroke(); }
    g.restore();
    g.fillStyle = '#c3301f'; poly(g, [-0.1, -0.04, 0.1, -0.04, 0.2, 0.2, -0.2, 0.2]); g.fill();
    g.fillStyle = PAL.label; rrect(g, -0.2, 0.12, 0.4, 0.16, 0.03); g.fill();
    g.fillStyle = PAL.brand; g.fillRect(-0.2, 0.12, 0.4, 0.04);
  },
  huevos(g, L) {
    const front = paperBag(g, L, '#7aa6c9');
    g.save(); g.translate(0.3, -1.1); g.rotate(0.24);
    const gr = g.createLinearGradient(-0.2, 0, 0.2, 0); gr.addColorStop(0, '#b8742f'); gr.addColorStop(0.5, '#e0a55a'); gr.addColorStop(1, '#a8652a');
    g.fillStyle = gr; rrect(g, -0.2, -0.3, 0.4, 3.2, 0.2); g.fill();
    g.strokeStyle = '#f1d49a'; g.lineWidth = 0.05; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-0.1, -0.05 + i * 0.36); g.lineTo(0.1, 0.2 + i * 0.36); g.stroke(); }
    g.restore();
    g.save(); g.translate(-0.24, -0.12); g.rotate(-0.08);
    g.fillStyle = '#b9b4a8'; rrect(g, -0.46, 0, 0.92, 0.5, 0.05); g.fill();
    g.fillStyle = '#cfcabe'; for (let i = 0; i < 3; i++) { ell(g, -0.3 + i * 0.3, 0.02, 0.13, 0.08); g.fill(); }
    g.fillStyle = '#f4efe4'; g.fillRect(-0.3, 0.14, 0.4, 0.18);
    g.restore();
    front();
  },
  turron(g, L) {
    const front = paperBag(g, L, '#b3262d', '#d8b14a');
    const box = (x, y, a, col, band, w = 0.36, h = 1.6) => {
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = col; g.fillRect(-w / 2, 0, w, h);
      g.fillStyle = band; g.fillRect(-w / 2, 0.22, w, 0.22);
      g.fillStyle = darker(col, 0.2); g.fillRect(w / 2 - 0.06, 0, 0.06, h);
      g.restore();
    };
    box(-0.25, -0.72, -0.12, '#d8b14a', '#b3262d'); box(0.18, -0.52, 0.1, '#b3262d', '#d8b14a');
    for (const [x, y] of [[0.46, -0.05], [-0.5, 0.0]]) {
      g.fillStyle = '#f6f2ea'; ell(g, x, y, 0.16, 0.1); g.fill();
      g.fillStyle = '#e4ddcf'; poly(g, [x - 0.14, y, x - 0.26, y - 0.08, x - 0.26, y + 0.08]); g.fill(); poly(g, [x + 0.14, y, x + 0.26, y - 0.08, x + 0.26, y + 0.08]); g.fill();
    }
    front();
  },
  cava(g, L) {
    const w0 = L.mw + 0.22, w1 = L.bw, h = L.bh;
    for (let i = 0; i < 6; i++) {
      const a = -1.1 + i * 0.44;
      g.fillStyle = i % 2 ? '#e9d9a6' : '#f6efd9';
      poly(g, [Math.sin(a) * 0.2, 0.1, Math.sin(a - 0.25) * 0.75, -0.3 - Math.cos(a) * 0.35, Math.sin(a + 0.25) * 0.75, -0.3 - Math.cos(a) * 0.35]); g.fill();
    }
    glassBottle(g, -0.05, -1.2, -0.05, 3.0, 0.5, '#1f3324', '#d8b14a');
    g.fillStyle = '#b3262d'; ell(g, -0.07, -0.72, 0.09, 0.07); g.fill();
    g.fillStyle = '#8c1f2a'; g.fillRect(-w0, 0, w0 * 2, h);
    g.fillStyle = '#a3283a'; g.fillRect(-w0, 0, w0 * 2, 0.24);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(-w0 + 0.1, 0.3, 0.12, h - 0.4);
    g.fillStyle = '#d8b14a'; g.fillRect(-w0, 0.9, w0 * 2, 0.08);
    g.save(); g.translate(0.18, 1.45); g.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.08 : 0.2, t = (k / 10) * TAU - Math.PI / 2; g.lineTo(Math.cos(t) * r, Math.sin(t) * r); }
    g.fill(); g.restore();
    for (const s of [-1, 1]) { g.fillStyle = '#65131c'; ell(g, s * L.mw, 0.12, 0.045, 0.045); g.fill(); }
  },
  congelados(g, L) {
    const w = L.bw, h = L.bh;
    g.fillStyle = '#b9c7d3'; rrect(g, -w, 0, 2 * w, h, 0.22); g.fill();
    g.fillStyle = 'rgba(80,100,120,0.18)'; for (let i = 1; i < 6; i++) g.fillRect(-w, i * h / 6, 2 * w, 0.02);
    g.fillStyle = '#2d5f9a'; g.fillRect(-w, 0.55, 2 * w, 0.5);
    g.strokeStyle = '#f4f8fb'; g.lineWidth = 0.05; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const t = (k / 3) * Math.PI; g.beginPath(); g.moveTo(Math.cos(t) * 0.18, 0.8 + Math.sin(t) * 0.18); g.lineTo(-Math.cos(t) * 0.18, 0.8 - Math.sin(t) * 0.18); g.stroke(); }
    g.fillStyle = '#8fa0b0'; g.fillRect(-w + 0.1, -0.04, 2 * w - 0.2, 0.1);
    g.fillStyle = '#5e6f7e'; for (let x = -w + 0.14; x < w - 0.12; x += 0.05) g.fillRect(x, -0.02, 0.025, 0.06);
    g.fillStyle = '#d6dde3'; rrect(g, 0.3, -0.06, 0.1, 0.28, 0.03); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(-w + 0.12, 0.2, 0.08, h - 0.5);
  },
};

// the supermarket's bag: the inside over the sagging front, what is in it, the front, its stripes and creases
function whiteBag(g, L, kg, rnd, look) {
  const P = BAGS.white, w0 = L.mw, w1 = L.bw, h = L.bh, sag = 0.34;
  g.fillStyle = tone(P.dk, '#6b6a60', 0.35);
  g.beginPath(); g.moveTo(-w0, 0); g.quadraticCurveTo(0, -0.12, w0, 0); g.bezierCurveTo(w0 * 0.55, sag * 0.9, -w0 * 0.55, sag * 0.9, -w0, 0); g.fill();
  WHITE_IN[look](g, rnd);
  sackPath(g, w0, w1, h, sag);
  g.fillStyle = rgba(P.body, 0.9); g.fill();
  g.save(); g.clip();
  const bands = L.band === 'orange' ? [[P.band2, 0.3, 0.2], [P.band, 0.5, 0.08]] : [[P.band, 0.28, 0.2], [P.band2, 0.48, 0.1]];
  for (const [col, x, w] of bands) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x * w0 * 1.6, -0.1); g.quadraticCurveTo(x * w1 * 2.1, h * 0.5, x * w1 * 1.7, h * 1.1);
    g.lineTo((x + w) * w1 * 1.7, h * 1.1); g.quadraticCurveTo((x + w) * w1 * 2.1, h * 0.5, (x + w) * w0 * 1.6, -0.1); g.fill();
  }
  const gr = g.createLinearGradient(-w1, 0, w1, 0);
  gr.addColorStop(0, 'rgba(90,90,80,0.22)'); gr.addColorStop(0.3, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.25)'); gr.addColorStop(0.6, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(90,90,80,0.28)');
  g.fillStyle = gr; g.fillRect(-w1 * 1.2, -0.2, w1 * 2.4, h * 1.2);
  creases(g, L, kg, rnd, 'rgba(120,120,105,0.32)', 'rgba(255,255,255,0.5)');
  g.restore();
  sackPath(g, w0, w1, h, sag);
  g.strokeStyle = 'rgba(95,95,85,0.45)'; g.lineWidth = 0.025; g.stroke();
}
const LABEL_AT = { agua: [0.34, 1.95, 0.04], papel: [0.3, 1.5, -0.05], fruta: [0.05, 1.3, 0.08], cava: [-0.1, 1.6, 0.05], congelados: [-0.2, 1.4, -0.04] };
const STAIN = { huevos: ['#f2c230', '#d9a21a'], botellas: ['#6d1a2a', '#4a0f1b'], cava: ['#e9dca0', '#c9b772'] };
function stain(g, L, look) {
  const [a, b] = STAIN[look] || ['#8a6d4a', '#5e4a33'], h = L.bh, w = L.bw;
  g.save(); sackPath(g, L.mw, w, h, 0.34); g.clip();
  g.globalAlpha = 0.72; g.fillStyle = a;
  g.beginPath(); g.moveTo(-w * 1.1, h * 1.1); g.lineTo(-w * 1.1, h * 0.78);
  for (let i = 0; i <= 8; i++) { const x = -w + (i / 8) * 2 * w; g.quadraticCurveTo(x - 0.1, h * (0.66 + (i % 3) * 0.04), x, h * (0.74 + (i % 2) * 0.05)); }
  g.lineTo(w * 1.1, h * 1.1); g.fill();
  g.fillStyle = b; for (const x of [-0.5, 0.1, 0.55]) { rrect(g, x, h * 0.72, 0.07, 0.4 + Math.abs(x) * 0.3, 0.035); g.fill(); }
  g.restore();
}

export function bagArt(look, u, broken = false) {
  u = Math.max(8, Math.round(u));
  const key = look + '|' + u + '|' + (broken ? 1 : 0);
  let s = cache.get(key);
  if (s) return s;
  const L = lookOf(look), kg = (BAG[look] || BAG.leche).kg;
  const c = canvas(2 * SIDE * u, (TOP + BOT) * u), g = c.getContext('2d');
  g.translate(SIDE * u, TOP * u); g.scale(u, u);
  const rnd = mulberry32(look.length * 97 + look.charCodeAt(0));
  if (L.st === 'white') whiteBag(g, L, kg, rnd, look);
  else OWN[look](g, L, kg, rnd);
  if (broken) stain(g, L, look);
  const [lx, ly, lr] = LABEL_AT[look] || [-0.3, 1.02, -0.06];
  label(g, lx, ly, kg, lr);
  s = { c, ox: SIDE * u, oy: TOP * u, u, L, kg };
  cache.set(key, s);
  return s;
}

// the bag's shape in one dark tone, made once per sprite: laid over the art to put a bag in the shadow of
// the ones in front of it (the target canvas is opaque, so a source-atop fill would darken a whole box)
function silOf(art) {
  if (art.sil) return art.sil;
  const c = canvas(art.c.width, art.c.height), g = c.getContext('2d');
  g.drawImage(art.c, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#2a241c'; g.fillRect(0, 0, c.width, c.height);
  return (art.sil = c);
}

// the handles, from the bag's shoulders up to the fist at (px, py); the bag's own frame is (mx, my) turned by a
function straps(g, L, px, py, mx, my, a, U, look) {
  const cs = Math.cos(a), sn = Math.sin(a);
  const at = (x, y) => [mx + x * U * cs + y * U * sn, my - x * U * sn + y * U * cs];
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (L.st === 'white' || L.st === 'cold') {
    const P = L.st === 'white' ? BAGS.white : BAGS.cold, half = L.st === 'white' ? 0.17 : 0.07;
    for (const s of [-1, 1]) {
      const [ix, iy] = at(s * (L.mw - half), 0.02), [ox, oy] = at(s * (L.mw + half), 0.02);
      const gx = px + s * 0.03 * U, cx = (ox + gx) / 2 + s * 0.05 * U, cy = (oy + py) / 2;
      g.fillStyle = L.st === 'white' ? P.body : P.handle;
      g.beginPath(); g.moveTo(ix, iy); g.quadraticCurveTo((ix + px) / 2, (iy + py) / 2, px - s * 0.02 * U, py);
      g.lineTo(gx + s * 0.03 * U, py); g.quadraticCurveTo(cx, cy, ox, oy); g.closePath(); g.fill();
      g.strokeStyle = L.st === 'white' ? 'rgba(95,95,85,0.5)' : darker(P.handle, 0.3); g.lineWidth = 0.025 * U; g.stroke();
      if (L.st === 'white') {
        g.strokeStyle = L.band === 'orange' ? P.band2 : P.band; g.lineWidth = 0.05 * U;
        g.beginPath(); g.moveTo(ox - s * 0.04 * U, oy); g.quadraticCurveTo(cx - s * 0.02 * U, cy, gx, py + 0.02 * U); g.stroke();
      }
    }
    return;
  }
  if (L.st === 'paper' || L.st === 'gift') {
    const col = L.st === 'gift' ? BAGS.gift.handle : '#d9cfb8', dk = darker(col, 0.3);
    for (const s of [-1, 1]) {
      const [ax, ay] = at(s * L.mw, 0.18);
      g.strokeStyle = dk; g.lineWidth = 0.075 * U;
      g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + px) / 2 + s * 0.08 * U, (ay + py) / 2, px, py); g.stroke();
      g.strokeStyle = col; g.lineWidth = 0.045 * U; g.stroke();
    }
    return;
  }
  // a strip of film or net: one band from the middle of the top
  const col = L.st === 'mesh' ? '#c3301f' : 'rgba(236,242,246,0.92)', wd = L.st === 'mesh' ? 0.1 : 0.16;
  const [lx, ly] = at(-L.mw, 0), [rx, ry] = at(L.mw, 0);
  g.fillStyle = col;
  g.beginPath(); g.moveTo(lx, ly); g.quadraticCurveTo((lx + px) / 2 - wd * U * 0.4, (ly + py) / 2, px - wd * 0.3 * U, py);
  g.lineTo(px + wd * 0.3 * U, py); g.quadraticCurveTo((rx + px) / 2 + wd * U * 0.4, (ry + py) / 2, rx, ry); g.closePath(); g.fill();
  g.strokeStyle = L.st === 'mesh' ? '#8e1f13' : 'rgba(120,140,150,0.6)'; g.lineWidth = 0.02 * U; g.stroke();
}

// a bag hanging from a fist at (px, py): a is its swing (0 straight down, positive toward +x), s its
// scale against the fist (smaller when the arm reaches away), drop how far the handles have slid
export function drawHung(g, look, px, py, a, u, { s = 1, broken = false, shade = 0, drop = 0 } = {}) {
  const art = bagArt(look, qu(u * s), broken), L = art.L, U = u * s, k = U / art.u;
  const cs = Math.cos(a), sn = Math.sin(a), sl = L.sl + drop;
  const mx = px + sn * sl * U, my = py + cs * sl * U;
  g.save(); g.translate(mx, my); g.rotate(-a); g.scale(k, k);
  g.drawImage(art.c, -art.ox, -art.oy);
  if (shade > 0.01) { g.globalAlpha *= Math.min(1, shade); g.drawImage(silOf(art), -art.ox, -art.oy); }
  g.restore();
  straps(g, L, px, py, mx, my, a, U, look);
  return [mx, my];
}

// a bag set down, standing on (x, y) (the middle of its bottom), handles slack; s pixels per fist width,
// lean its tilt about the bottom, sq how much it has slumped (1 upright … 0.9 settled)
// `ink` rings the bag (and its handles) with a solid outline inkW px wide, comic style
export function drawStanding(g, look, x, y, s, { broken = false, lean = 0, alpha = 1, sq = 0.9, ink = null, inkW = 2 } = {}) {
  const art = bagArt(look, qu(s), broken), L = art.L, k = s / art.u;
  const cl = Math.cos(lean), sl = Math.sin(lean), mx = x + sl * L.bh * s * sq, my = y - cl * L.bh * s * sq;
  g.save(); if (alpha < 1) g.globalAlpha = alpha;
  g.translate(x, y); g.rotate(lean); g.scale(k, k * sq);
  if (ink) {
    const sil = silhouette(art, ink), ox = inkW / k, oy = inkW / (k * sq);
    for (let i = 0; i < 8; i++) {
      const an = (i * Math.PI) / 4;
      g.drawImage(sil, -art.ox + Math.cos(an) * ox, -art.oy - L.bh * art.u + Math.sin(an) * oy);
    }
  }
  g.drawImage(art.c, -art.ox, -art.oy - L.bh * art.u);
  g.restore();
  if (L.st === 'wrap' || L.st === 'mesh') return;
  const col = L.st === 'white' ? BAGS.white.body : L.st === 'cold' ? BAGS.cold.handle : L.st === 'gift' ? BAGS.gift.handle : '#d9cfb8';
  const lw = Math.max(1, (L.st === 'white' ? 0.14 : 0.06) * s);
  g.save(); if (alpha < 1) g.globalAlpha = alpha;
  g.lineCap = 'round';
  g.translate(mx, my); g.rotate(lean);
  for (const pass of ink ? [0, 1] : [1]) {
    g.strokeStyle = pass ? col : ink; g.lineWidth = pass ? lw : lw + 2 * inkW;
    for (const sd of [-1, 1]) {
      const ax = sd * L.mw * s;
      g.beginPath(); g.moveTo(ax, 0);
      g.bezierCurveTo(ax, -0.55 * s, ax - sd * 0.5 * s, -0.6 * s, ax - sd * 0.62 * s, -0.1 * s); g.stroke();
    }
  }
  g.restore();
}
// a bag art's solid silhouette in one colour, made once per art
const sils = new WeakMap();
function silhouette(art, ink) {
  let m = sils.get(art);
  if (!m) sils.set(art, (m = new Map()));
  let c = m.get(ink);
  if (!c) {
    c = canvas(art.c.width, art.c.height);
    const g = c.getContext('2d');
    g.drawImage(art.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = ink; g.fillRect(0, 0, c.width, c.height);
    m.set(ink, c);
  }
  return c;
}
