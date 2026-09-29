// Hair, in two layers: the mass behind the head (long hair falls behind the shoulders) and the part
// over the scalp and forehead. The hairline slides with the turn of the head, so a face turned to
// one side shows more hair on the other. 1996–2001: perms, curtains, a bowl cut, gel.
import { INK, LW, TAU, shade, mix, ell, dot, smooth } from './ink.js';
import { ageOf } from './face.js';

const hash = (i) => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };

// the scalp grown by e, from angle a0 over the top to a1, then back along the hairline (right → left)
function cap(g, L, e, a0, a1, line, dx) {
  const rx = 0.5 * (L.w || 1), ry = ageOf(L).ry;
  const P = line.map(([x, y]) => [x * (L.w || 1) + dx * (1 - 1.3 * Math.min(0.5, Math.abs(x))), y]);
  g.beginPath();
  g.ellipse(dx * 0.25, 0, rx * (1 + e), ry * (1 + e), 0, a0, a1);
  g.lineTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length - 1; i++) g.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
  g.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
  g.closePath();
}
const fillInk = (g, c, lw = LW) => { g.fillStyle = c; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); };
function strands(g, col, a, pts, lw = 0.012) {
  g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath();
  for (const [x0, y0, cx, cy, x1, y1] of pts) { g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); }
  g.stroke(); g.globalAlpha = 1;
}
function curls(g, L, k, r, n, a0, a1, dy, onlyTop, dx) {
  const rx = 0.5 * (L.w || 1), ry = ageOf(L).ry, hi = mix(L.hc, '#ffffff', 0.35), lo = shade(L.hc, -0.18);
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / (n - 1), x = rx * k * Math.cos(a) + dx * 0.3, y = ry * k * Math.sin(a) + dy;
    if (onlyTop && y > -0.12) continue;
    const rr = r * (0.85 + 0.3 * hash(i + n));
    dot(g, x, y, rr); g.fillStyle = L.hc; g.fill(); g.lineWidth = LW * 0.6; g.strokeStyle = lo; g.stroke();
    g.beginPath(); g.arc(x, y, rr * 0.55, Math.PI * 1.05, Math.PI * 1.6); g.lineWidth = rr * 0.28; g.strokeStyle = hi; g.stroke();
  }
}
const P = Math.PI;

const BACK = {
  waves(g, L, s) { smooth(g, [[-0.62, 0.66], [-0.72, 0.3], [-0.66, -0.2], [-0.5, -0.56], [0, -0.7], [0.5, -0.56], [0.66, -0.2], [0.72, 0.3], [0.62, 0.66], [0.4, 0.74], [0.2, 0.6], [-0.2, 0.6], [-0.4, 0.74]].map(([x, y]) => [x - s * 0.05, y])); fillInk(g, shade(L.hc, -0.12)); },
  kidlong(g, L, s) { smooth(g, [[-0.56, 0.98], [-0.62, 0.3], [-0.6, -0.3], [-0.4, -0.62], [0, -0.66], [0.4, -0.62], [0.6, -0.3], [0.62, 0.3], [0.56, 0.98], [0.3, 1.02], [-0.3, 1.02]].map(([x, y]) => [x - s * 0.05, y])); fillInk(g, shade(L.hc, -0.12)); },
  long(g, L, s) {
    smooth(g, [[-0.62, 1.28], [-0.7, 0.5], [-0.65, -0.25], [-0.45, -0.6], [0, -0.68], [0.45, -0.6], [0.65, -0.25], [0.7, 0.5], [0.62, 1.28], [0.3, 1.34], [-0.3, 1.34]].map(([x, y]) => [x - s * 0.05, y]));
    fillInk(g, shade(L.hc, -0.1));
    strands(g, L.hc2 || shade(L.hc, 0.3), 0.7, [[-0.55, 0.2, -0.62, 0.7, -0.5, 1.2], [0.55, 0.2, 0.62, 0.7, 0.5, 1.2], [-0.45, 0.4, -0.5, 0.8, -0.4, 1.25], [0.45, 0.4, 0.5, 0.8, 0.4, 1.25]], 0.03);
  },
  curtains(g, L, s) { smooth(g, [[-0.55, 0.32], [-0.6, -0.2], [-0.42, -0.58], [0, -0.64], [0.42, -0.58], [0.6, -0.2], [0.55, 0.32], [0, 0.4]].map(([x, y]) => [x - s * 0.05, y])); fillInk(g, shade(L.hc, -0.15)); },
  bigperm(g, L, s) { ell(g, -s * 0.04, -0.06, 0.78 * (L.w || 1), 0.74); g.fillStyle = shade(L.hc, -0.22); g.fill(); curls(g, L, 1.34, 0.17, 18, P - 1.05, 2 * P + 1.05, -0.02, false, -s * 0.1); },
  perm(g, L, s) { ell(g, -s * 0.03, -0.1, 0.6, 0.56); g.fillStyle = shade(L.hc, -0.2); g.fill(); curls(g, L, 1.14, 0.13, 14, P - 0.4, 2 * P + 0.4, -0.04, false, -s * 0.08); },
  curly(g, L, s) { curls(g, L, 1.04, 0.1, 14, P - 0.15, 2 * P + 0.15, -0.02, false, -s * 0.06); },
  pony(g, L, s, t) {
    const sw = Math.sin(t * 2.1) * 0.03;
    smooth(g, [[0.2, -0.46], [0.46, -0.36], [0.64 + sw * 0.5, 0.0], [0.68 + sw, 0.4], [0.58 + sw, 0.64], [0.52 + sw, 0.3], [0.42, -0.05], [0.22, -0.26]].map(([x, y]) => [x - s * 0.06, y]));
    fillInk(g, shade(L.hc, -0.08));
    ell(g, 0.34 - s * 0.06, -0.42, 0.075, 0.06, 0.6); fillInk(g, '#e0589a', LW * 0.7);
  },
};

const FRONT = {
  dad(g, L, d) {
    cap(g, L, 0.045, P - 0.14, 2 * P + 0.14, [[0.48, 0.07], [0.45, -0.12], [0.4, -0.25], [0.22, -0.32], [0, -0.34], [-0.15, -0.38], [-0.2, -0.3], [-0.36, -0.26], [-0.46, -0.12], [-0.48, 0.07]], d);
    fillInk(g, L.hc);
    strands(g, shade(L.hc, 0.28), 0.8, [[-0.18 + d, -0.4, -0.1 + d, -0.5, 0.25 + d, -0.46], [-0.2 + d, -0.33, -0.3 + d, -0.46, -0.42, -0.3]], 0.018);
  },
  quiff(g, L, d) {
    FRONT.dad(g, L, d);
    ell(g, 0.04 + d * 0.8, -0.55, 0.3, 0.13, -0.15); fillInk(g, L.hc);
    strands(g, shade(L.hc, 0.3), 0.8, [[-0.18 + d, -0.56, 0.02 + d, -0.66, 0.28 + d, -0.58]], 0.02);
  },
  gel(g, L, d) {
    cap(g, L, 0.035, P - 0.06, 2 * P + 0.06, [[0.48, 0.0], [0.44, -0.2], [0.3, -0.32], [0.1, -0.39], [-0.12, -0.39], [-0.32, -0.31], [-0.45, -0.18], [-0.48, 0.0]], d);
    fillInk(g, L.hc);
    strands(g, '#fffaf0', 0.45, [[-0.26 + d, -0.44, 0 + d, -0.56, 0.28 + d, -0.44], [-0.18 + d, -0.36, 0.02 + d, -0.46, 0.2 + d, -0.37]], 0.022);
    strands(g, shade(L.hc, 0.2), 0.7, [[-0.4, -0.25, -0.35, -0.45, -0.1, -0.52], [0.4, -0.25, 0.35, -0.45, 0.1, -0.52]], 0.012);
  },
  waves(g, L, d) {
    cap(g, L, 0.08, P - 0.4, 2 * P + 0.4, [[0.52, 0.22], [0.47, -0.02], [0.4, -0.18], [0.2, -0.27], [0.02, -0.22], [-0.18, -0.2], [-0.32, -0.3], [-0.44, -0.14], [-0.5, 0.1], [-0.52, 0.24]], d);
    fillInk(g, L.hc);
    strands(g, shade(L.hc, 0.3), 0.75, [[0.35 + d, -0.24, 0.05 + d, -0.5, -0.3 + d, -0.35], [0.4 + d, -0.1, 0.2 + d, -0.35, -0.1 + d, -0.3], [-0.45, 0.0, -0.58, -0.3, -0.35, -0.48]], 0.02);
  },
  kidlong(g, L, d) {
    cap(g, L, 0.05, P - 0.5, 2 * P + 0.5, [[0.5, 0.3], [0.46, 0.0], [0.42, -0.16], [0.3, -0.21], [0.15, -0.18], [0, -0.21], [-0.15, -0.18], [-0.3, -0.21], [-0.42, -0.16], [-0.46, 0], [-0.5, 0.3]], d);
    fillInk(g, L.hc);
    strands(g, shade(L.hc, 0.3), 0.7, [[-0.2 + d, -0.5, -0.1 + d, -0.35, -0.12 + d, -0.22], [0.1 + d, -0.52, 0.16 + d, -0.35, 0.14 + d, -0.22], [-0.3, -0.45, -0.5, -0.1, -0.47, 0.25]], 0.016);
  },
  pony(g, L, d) {
    cap(g, L, 0.03, P - 0.1, 2 * P + 0.1, [[0.47, 0.02], [0.42, -0.18], [0.28, -0.3], [0.1, -0.36], [0, -0.3], [-0.1, -0.36], [-0.28, -0.3], [-0.42, -0.18], [-0.47, 0.02]], d);
    fillInk(g, L.hc);
    strands(g, L.hc, 1, [[-0.4, -0.2, -0.47, 0.02, -0.42, 0.26], [0.4, -0.2, 0.47, 0.02, 0.42, 0.26]], 0.03);
    strands(g, shade(L.hc, 0.3), 0.7, [[-0.1 + d, -0.38, 0.1 + d, -0.52, 0.34, -0.42]], 0.016);
  },
  perm(g, L, d) {
    cap(g, L, 0.1, P - 0.3, 2 * P + 0.3, [[0.5, 0.05], [0.45, -0.16], [0.32, -0.3], [0.12, -0.34], [-0.1, -0.34], [-0.3, -0.3], [-0.45, -0.16], [-0.5, 0.05]], d);
    fillInk(g, L.hc, LW * 0.8);
    curls(g, L, 1.1, 0.12, 12, P - 0.1, 2 * P + 0.1, -0.04, true, d);
    curls(g, L, 0.72, 0.1, 5, P + 0.55, 2 * P - 0.55, -0.06, true, d);
  },
  bigperm(g, L, d) {
    cap(g, L, 0.14, P - 0.5, 2 * P + 0.5, [[0.52, 0.2], [0.46, -0.1], [0.3, -0.26], [0.1, -0.3], [-0.12, -0.28], [-0.3, -0.26], [-0.46, -0.1], [-0.52, 0.2]], d);
    fillInk(g, L.hc, LW * 0.8);
    curls(g, L, 1.18, 0.15, 13, P - 0.2, 2 * P + 0.2, -0.05, true, d);
    curls(g, L, 0.78, 0.12, 6, P + 0.45, 2 * P - 0.45, -0.06, true, d);
  },
  curly(g, L, d) {
    cap(g, L, 0.06, P - 0.1, 2 * P + 0.1, [[0.49, 0.02], [0.45, -0.18], [0.3, -0.3], [0.1, -0.34], [-0.1, -0.34], [-0.3, -0.3], [-0.45, -0.18], [-0.49, 0.02]], d);
    fillInk(g, L.hc, LW * 0.8);
    curls(g, L, 1.02, 0.09, 12, P - 0.05, 2 * P + 0.05, -0.03, true, d);
    curls(g, L, 0.7, 0.08, 6, P + 0.5, 2 * P - 0.5, -0.05, true, d);
  },
  bald(g, L, d) {
    for (const s of [-1, 1]) {
      const x = s * 0.47 * (L.w || 1) + d * 0.2;
      ell(g, x, -0.06, 0.075, 0.13, s * 0.2); fillInk(g, L.hc, LW * 0.7);
      dot(g, x + s * 0.03, -0.17, 0.045); fillInk(g, L.hc, LW * 0.6);
    }
    ell(g, -0.13 + d * 0.5, -0.37, 0.13, 0.05, -0.45); g.fillStyle = 'rgba(255,250,240,0.42)'; g.fill();
  },
  long(g, L, d) {
    cap(g, L, 0.06, P - 0.65, 2 * P + 0.65, [[0.55, 0.46], [0.46, 0.2], [0.42, -0.08], [0.3, -0.26], [0.12, -0.36], [0.02, -0.43], [-0.02, -0.43], [-0.12, -0.36], [-0.3, -0.26], [-0.42, -0.08], [-0.46, 0.2], [-0.55, 0.46]], d);
    fillInk(g, L.hc);
    strands(g, L.hc2 || shade(L.hc, 0.3), 0.8, [[0.02 + d, -0.46, 0.3 + d, -0.4, 0.44, 0.1], [-0.02 + d, -0.46, -0.3 + d, -0.4, -0.44, 0.1], [0.1 + d, -0.5, 0.42, -0.3, 0.5, 0.35]], 0.024);
  },
  curtains(g, L, d) {
    cap(g, L, 0.05, P - 0.28, 2 * P + 0.28, [[0.5, 0.12], [0.44, -0.05], [0.3, -0.12], [0.14, -0.2], [0.03, -0.37], [-0.03, -0.37], [-0.14, -0.2], [-0.3, -0.12], [-0.44, -0.05], [-0.5, 0.12]], d);
    fillInk(g, L.hc);
    strands(g, shade(L.hc, 0.3), 0.7, [[0.03 + d, -0.44, 0.2 + d, -0.35, 0.34, -0.14], [-0.03 + d, -0.44, -0.2 + d, -0.35, -0.34, -0.14]], 0.018);
  },
  bowl(g, L, d) {
    cap(g, L, 0.07, P - 0.32, 2 * P + 0.32, [[0.53, 0.13], [0.5, -0.12], [0.36, -0.17], [0.12, -0.19], [-0.12, -0.19], [-0.36, -0.17], [-0.5, -0.12], [-0.53, 0.13]], d);
    fillInk(g, L.hc);
    g.strokeStyle = shade(L.hc, -0.3); g.lineWidth = 0.01; g.beginPath();
    for (let i = -4; i <= 4; i++) { const x = i * 0.1 + d * 0.7; g.moveTo(x, -0.19); g.lineTo(x - 0.01, -0.28); }
    g.stroke();
    strands(g, shade(L.hc, 0.3), 0.7, [[-0.3 + d, -0.46, 0 + d, -0.58, 0.3 + d, -0.46]], 0.02);
  },
  tuft(g, L, d) {
    ell(g, d * 0.3, -0.34, 0.3, 0.14); g.fillStyle = mix(L.hc, L.skin, 0.55); g.globalAlpha = 0.5; g.fill(); g.globalAlpha = 1;
    g.beginPath(); g.moveTo(-0.04 + d, -0.46); g.bezierCurveTo(-0.08 + d, -0.68, 0.18 + d, -0.68, 0.12 + d, -0.53); g.bezierCurveTo(0.08 + d, -0.46, 0.02 + d, -0.54, 0.07 + d, -0.58);
    g.lineCap = 'round'; g.lineWidth = 0.06; g.strokeStyle = INK; g.stroke(); g.lineWidth = 0.035; g.strokeStyle = L.hc; g.stroke();
  },
};

export function drawHairBack(g, L, v, t) { const f = BACK[L.hair]; if (f) f(g, L, Math.sin(v.yaw), t); }
export function drawHairFront(g, L, v) { const f = FRONT[L.hair]; if (f) f(g, L, Math.sin(v.yaw) * 0.12); }
