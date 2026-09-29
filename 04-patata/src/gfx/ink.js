// The album's drawing kit: warm brown ink, gouache-flat fills, fabric patterns and cached
// gradients, all in head units (a head is 1 wide) so every García can be drawn at any size.
import { clamp, lerp, mix, shade } from '../util.js';
export { clamp, lerp, mix, shade };

export const INK = '#3b2417';
export const LW = 0.03;
export const TAU = Math.PI * 2;
export const K = 0.5523;

// gradients and patterns belong to a context; built once, reused by every head of that colour
const perCtx = new WeakMap();
export function memo(g, key, make) {
  let m = perCtx.get(g);
  if (!m) perCtx.set(g, (m = new Map()));
  let v = m.get(key);
  if (v === undefined) m.set(key, (v = make()));
  return v;
}

export const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, Math.abs(rx) + 1e-6, Math.abs(ry) + 1e-6, rot, 0, TAU); };
export const dot = (g, x, y, r) => { g.beginPath(); g.arc(x, y, Math.abs(r) + 1e-6, 0, TAU); };
export function ink(g, fill, lw = LW) {
  if (fill) { g.fillStyle = fill; g.fill(); }
  g.lineWidth = lw; g.strokeStyle = INK; g.stroke();
}
export function poly(g, pts, close = false) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (close) g.closePath();
}
// a smooth curve through the midpoints of the given points (closed by default)
export function smooth(g, pts, close = true) {
  const n = pts.length;
  g.beginPath();
  if (close) {
    g.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    g.closePath();
  } else {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) { const p = pts[i], q = pts[i + 1]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    g.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
}
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// an arm: shoulder a, elbow c (as the curve's control), hand b, with an ink edge; the first f of it
// in cloth (a sleeve) and the rest bare skin, with a cuff line where the sleeve ends
export function limb(g, a, c, b, w, cloth, skin, f = 1, lw = LW) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(c[0], c[1], b[0], b[1]);
  g.strokeStyle = INK; g.lineWidth = w + 2 * lw; g.stroke();
  g.strokeStyle = f >= 1 ? cloth : skin; g.lineWidth = w; g.stroke();
  if (f > 0 && f < 1) {
    const q0 = lerp2(a, c, f), q1 = lerp2(c, b, f), m = lerp2(q0, q1, f);
    g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(q0[0], q0[1], m[0], m[1]);
    g.strokeStyle = cloth; g.lineWidth = w * 1.1; g.lineCap = 'butt'; g.stroke();
    g.beginPath(); g.arc(a[0], a[1], w * 0.55, 0, TAU); g.fillStyle = cloth; g.fill();
    const dx = q1[0] - q0[0], dy = q1[1] - q0[1], L = Math.hypot(dx, dy) || 1, nx = (-dy / L) * w * 0.6, ny = (dx / L) * w * 0.6;
    g.beginPath(); g.moveTo(m[0] - nx, m[1] - ny); g.lineTo(m[0] + nx, m[1] + ny);
    g.strokeStyle = INK; g.lineWidth = lw * 0.9; g.stroke();
    g.lineCap = 'round';
  }
}

// skin lit from the upper left, like the afternoon light in the backgrounds
export const skinFill = (g, skin) => memo(g, 'sk' + skin, () => {
  const gr = g.createRadialGradient(-0.17, -0.25, 0.03, 0, 0, 0.68);
  gr.addColorStop(0, shade(skin, 0.1)); gr.addColorStop(0.55, skin); gr.addColorStop(1, shade(skin, -0.14));
  return gr;
});
// the same light across clothes: brighter on the left, a warm shadow on the right
export const clothShade = (g) => memo(g, 'cloth', () => {
  const gr = g.createLinearGradient(-0.75, 0, 0.75, 0);
  gr.addColorStop(0, 'rgba(255,244,225,0.16)'); gr.addColorStop(0.45, 'rgba(255,244,225,0)'); gr.addColorStop(1, 'rgba(52,22,10,0.24)');
  return gr;
});

// ---- fabrics: 64 px seamless tiles painted once, used as patterns in head units ----
const tiles = new Map();
function tileCanvas() {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = c.height = 64; return c; }
  return new OffscreenCanvas(64, 64);
}
function wrap(q, f) { for (const dx of [-64, 0, 64]) for (const dy of [-64, 0, 64]) { q.save(); q.translate(dx, dy); f(); q.restore(); } }
const E = (q, x, y, a, b, r = 0) => { q.beginPath(); q.ellipse(x, y, a, b, r, 0, TAU); q.fill(); };
const PAINT = {
  hawaii(q, c, c2) {
    const leaf = mix(c, '#1f5a3a', 0.6);
    wrap(q, () => {
      for (const [x, y, r, a] of [[15, 17, 10, 0.3], [47, 47, 11, 1.2]]) {
        q.fillStyle = leaf;
        for (let k = 0; k < 3; k++) { const b = a + k * 2.1 + 0.9; E(q, x + Math.cos(b) * r * 1.25, y + Math.sin(b) * r * 1.25, r * 0.95, r * 0.36, b); }
        q.fillStyle = c2;
        for (let k = 0; k < 5; k++) { const b = a + (k * TAU) / 5; E(q, x + Math.cos(b) * r * 0.55, y + Math.sin(b) * r * 0.55, r * 0.62, r * 0.46, b); }
        q.fillStyle = shade(c2, -0.4); E(q, x, y, r * 0.2, r * 0.2);
        q.fillStyle = '#fff4c8'; E(q, x + r * 0.28, y - r * 0.2, r * 0.1, r * 0.1);
      }
    });
  },
  floral(q, c, c2) {
    wrap(q, () => {
      q.fillStyle = mix(c, '#3f7a3a', 0.45);
      for (const [x, y, b] of [[18, 20, 0.6], [50, 30, 2.4], [34, 54, 4.1], [6, 44, 1.2]]) E(q, x, y, 4.5, 1.8, b);
      for (const [x, y, r] of [[10, 12, 5], [42, 20, 4.5], [26, 44, 5.5], [56, 54, 4]]) {
        q.fillStyle = c2;
        for (let k = 0; k < 5; k++) { const b = (k * TAU) / 5 + x; E(q, x + Math.cos(b) * r * 0.62, y + Math.sin(b) * r * 0.62, r * 0.52, r * 0.52); }
        q.fillStyle = '#f7d65a'; E(q, x, y, r * 0.34, r * 0.34);
      }
    });
  },
  check(q, c, c2) {
    q.globalAlpha = 0.5; q.fillStyle = c2;
    for (let i = 0; i < 64; i += 16) { q.fillRect(i, 0, 8, 64); q.fillRect(0, i, 64, 8); }
    q.globalAlpha = 0.35; q.fillStyle = shade(c2, -0.35);
    for (let i = 0; i < 64; i += 16) for (let j = 0; j < 64; j += 16) q.fillRect(i, j, 8, 8);
    q.globalAlpha = 1;
  },
  dots(q, c, c2) { q.fillStyle = c2; wrap(q, () => { for (const [x, y] of [[8, 8], [40, 8], [24, 40], [56, 40]]) E(q, x, y, 5.2, 5.2); }); },
  stripes(q, c, c2) { q.fillStyle = c2; for (let y = 0; y < 64; y += 16) q.fillRect(0, y, 64, 7); },
  sequin(q, c, c2) {
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const x = i * 8 + (j % 2) * 4, y = j * 8, h = (i * 7 + j * 13) % 5;
      q.fillStyle = h === 0 ? c2 : h < 3 ? shade(c, 0.18) : shade(c, -0.16);
      E(q, x, y, 3.4, 3.4); if (x < 4) E(q, x + 64, y, 3.4, 3.4); if (y < 4) E(q, x, y + 64, 3.4, 3.4);
      if (h === 1) { q.fillStyle = 'rgba(255,255,240,0.8)'; E(q, x - 1, y - 1, 1.1, 1.1); }
    }
  },
  argyle(q, c, c2) {
    q.fillStyle = c2; q.beginPath(); q.moveTo(32, 0); q.lineTo(64, 32); q.lineTo(32, 64); q.lineTo(0, 32); q.closePath(); q.fill();
    q.strokeStyle = 'rgba(245,230,200,0.55)'; q.lineWidth = 1.4;
    q.beginPath(); q.moveTo(16, 0); q.lineTo(64, 48); q.moveTo(0, 48); q.lineTo(16, 64); q.moveTo(48, 0); q.lineTo(0, 48); q.moveTo(64, 16); q.lineTo(16, 64); q.stroke();
  },
};
const SCALE = { hawaii: 1 / 150, floral: 1 / 170, check: 1 / 190, dots: 1 / 210, stripes: 1 / 150, sequin: 1 / 240, argyle: 1 / 140 };
export function fabric(g, pat, c, c2) {
  if (!pat || !PAINT[pat]) return c;
  return memo(g, 'f' + pat + c + c2, () => {
    const key = pat + c + c2;
    let cv = tiles.get(key);
    if (!cv) {
      cv = tileCanvas(); const q = cv.getContext('2d');
      q.fillStyle = c; q.fillRect(0, 0, 64, 64); PAINT[pat](q, c, c2 || '#ffffff');
      tiles.set(key, cv);
    }
    const p = g.createPattern(cv, 'repeat');
    p.setTransform(new DOMMatrix().scale(SCALE[pat]));
    return p;
  });
}

// the knitted motifs on a Christmas jumper's chest band, s is the motif's height
export function motif(g, kind, x, y, s, col) {
  g.fillStyle = col; g.strokeStyle = col;
  if (kind === 'tree') {
    g.beginPath();
    for (const [w, y0] of [[0.5, 0.1], [0.38, -0.12], [0.26, -0.32]]) { g.moveTo(x - w * s, y + (y0 + 0.2) * s); g.lineTo(x, y + (y0 - 0.2) * s); g.lineTo(x + w * s, y + (y0 + 0.2) * s); }
    g.fill(); g.fillRect(x - 0.07 * s, y + 0.3 * s, 0.14 * s, 0.16 * s);
  } else if (kind === 'snow') {
    g.lineWidth = 0.09 * s; g.lineCap = 'round'; g.beginPath();
    for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3; g.moveTo(x - Math.cos(a) * 0.42 * s, y - Math.sin(a) * 0.42 * s); g.lineTo(x + Math.cos(a) * 0.42 * s, y + Math.sin(a) * 0.42 * s); }
    g.stroke();
  } else if (kind === 'deer') {
    g.beginPath(); g.ellipse(x, y + 0.08 * s, 0.32 * s, 0.14 * s, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(x + 0.34 * s, y - 0.12 * s, 0.1 * s, 0.08 * s, -0.4, 0, TAU); g.fill();
    g.lineWidth = 0.07 * s; g.lineCap = 'round'; g.beginPath();
    for (const lx of [-0.24, -0.1, 0.12, 0.24]) { g.moveTo(x + lx * s, y + 0.15 * s); g.lineTo(x + lx * s, y + 0.44 * s); }
    g.moveTo(x + 0.3 * s, y - 0.18 * s); g.lineTo(x + 0.24 * s, y - 0.42 * s); g.lineTo(x + 0.14 * s, y - 0.5 * s);
    g.moveTo(x + 0.25 * s, y - 0.34 * s); g.lineTo(x + 0.38 * s, y - 0.46 * s);
    g.stroke();
  }
}
