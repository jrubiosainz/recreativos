// The dance, as a dancing-school diagram: each face-off is a row where your shoes and theirs meet toe
// to toe; a dotted arrow shows you both stepping the same way into the next one. The fourth row turns
// into the rumba. With no dance at all it is one straight line of your footprints. Drawn on a canvas,
// both on the result card and on the image you share, in the validator's violet ink.
import { TAU, clamp } from './util.js';
import { DOTS } from './gfx/station.js';

// one shoe print, toe up (up) or down, centred on (x, y), L long; side mirrors left and right
function shoe(g, x, y, L, up, side) {
  g.save(); g.translate(x, y); if (!up) g.rotate(Math.PI); g.scale(side, 1);
  g.beginPath();
  g.moveTo(0.03 * L, -0.5 * L);
  g.bezierCurveTo(0.27 * L, -0.5 * L, 0.25 * L, -0.1 * L, 0.17 * L, 0.08 * L);
  g.bezierCurveTo(0.12 * L, 0.17 * L, -0.12 * L, 0.17 * L, -0.15 * L, 0.05 * L);
  g.bezierCurveTo(-0.21 * L, -0.18 * L, -0.2 * L, -0.5 * L, 0.03 * L, -0.5 * L);
  g.fill();
  g.beginPath(); g.ellipse(0.01 * L, 0.37 * L, 0.125 * L, 0.13 * L, 0, 0, TAU); g.fill();
  g.restore();
}
function pair(g, x, y, L, up) {
  const dx = 0.2 * L;
  shoe(g, x - dx, y, L, up, up ? -1 : 1);
  shoe(g, x + dx, y, L, up, up ? 1 : -1);
}
function head(g, x, y, an, hl) {
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x - Math.cos(an - 0.5) * hl, y - Math.sin(an - 0.5) * hl);
  g.lineTo(x - Math.cos(an + 0.5) * hl, y - Math.sin(an + 0.5) * hl);
  g.closePath(); g.fill();
}
const dots = (g, lw) => { g.lineWidth = lw; g.lineCap = 'round'; g.setLineDash([0.01, lw * 2.4]); };
// a dotted curve with an arrowhead, from a to b, bowing out by `bow`
function arrow(g, ax, ay, bx, by, bow, lw) {
  const mx = (ax + bx) / 2 + bow, my = (ay + by) / 2;
  g.save(); dots(g, lw);
  g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(mx, my, bx, by); g.stroke();
  g.restore();
  head(g, bx, by, Math.atan2(by - my, bx - mx), lw * 4.2);
}
// a sign-system figure, feet at (x, y), h tall; reach: -1/1 an arm out that way; up: arms raised
export function figure(g, x, y, h, { reach = 0, up = false, hood = false } = {}) {
  const u = h / 10;
  g.save(); g.translate(x, y);
  g.beginPath(); g.arc(0, -9.1 * u, 0.95 * u, 0, TAU); g.fill();
  if (hood) { g.beginPath(); g.arc(0, -9.0 * u, 1.25 * u, Math.PI * 0.95, Math.PI * 2.05); g.lineWidth = 0.5 * u; g.stroke(); }
  // the coat, flaring a little to the hem
  g.beginPath();
  g.moveTo(-1.35 * u, -7.7 * u); g.lineTo(1.35 * u, -7.7 * u); g.lineTo(1.8 * u, -3.6 * u); g.lineTo(-1.8 * u, -3.6 * u); g.closePath(); g.fill();
  g.fillRect(-1.05 * u, -3.8 * u, 0.85 * u, 3.8 * u); g.fillRect(0.2 * u, -3.8 * u, 0.85 * u, 3.8 * u);
  g.lineWidth = 0.78 * u; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(s * 1.3 * u, -7.3 * u);
    if (up) { g.lineTo(s * 2.1 * u, -9.4 * u); g.lineTo(s * 1.5 * u, -11 * u); }
    else if (s === reach) { g.lineTo(s * 2.6 * u, -6.3 * u); g.lineTo(s * 4 * u, -6.9 * u); }
    else { g.lineTo(s * 2.0 * u, -5.4 * u); g.lineTo(s * 1.8 * u, -3.9 * u); }
    g.stroke();
  }
  g.restore();
}

// dance: sim.longestDance() (or null); box in the canvas's current units
export function drawSteps(g, x, y, w, h, dance, { ink = '#643991', rumba = '¡RUMBA!', figures = true } = {}) {
  g.save();
  g.fillStyle = ink; g.strokeStyle = ink;
  const fw = figures ? Math.min(w * 0.2, h * 0.26) : 0, mx0 = x + fw, mw = w - 2 * fw;
  const log = dance?.log?.slice(0, 4) || [];
  if (!log.length) {
    // nobody in your way: a straight walk up the middle
    const n = 5, L = Math.min(h / (n + 0.6), mw * 0.2), cx = mx0 + mw / 2;
    for (let i = 0; i < n; i++) shoe(g, cx + (i % 2 ? 0.28 : -0.28) * L, y + h - L * 0.55 - i * L * 1.02, L * 0.9, true, i % 2 ? 1 : -1);
    if (figures) figure(g, x + fw * 0.5, y + h, Math.min(h * 0.62, fw * 2.3), { hood: true });
    g.restore();
    return;
  }
  const n = log.length, rh = h / n, L = Math.min(rh * 0.36, mw * 0.16);
  const lanes = log.flatMap((r) => [r.p, r.n]);
  let lo = Math.min(...lanes), hi = Math.max(...lanes);
  while (hi - lo < 2) { lo -= 0.5; hi += 0.5; }
  const lx = (l) => mx0 + mw * (0.16 + 0.68 * (l - lo) / (hi - lo));
  const rows = log.map((r, i) => ({ x: lx(r.p), xn: lx(r.n), y: y + rh * (i + 0.5) }));
  const lw = Math.max(1.2, L * 0.085), fs = Math.round(clamp(L * 0.72, 9, 44));
  for (let i = 0; i < n; i++) {
    const r = rows[i];
    pair(g, r.xn, r.y - L * 0.56, L, false);       // theirs, coming down
    pair(g, r.x, r.y + L * 0.56, L, true);         // yours, going up
    g.font = `800 ${fs}px ${DOTS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const side = r.x > mx0 + mw / 2 ? -1 : 1;
    g.fillText(String(i + 1), r.x + side * L * 1.05, r.y + L * 0.1);
    if (i + 1 < n) {
      const q = rows[i + 1], s = Math.sign(q.x - r.x) || 1;
      arrow(g, r.x + s * L * 0.55, r.y + L * 0.95, q.x - s * L * 0.55, q.y + L * 0.3, s * L * 0.2, lw);
      arrow(g, r.xn + s * L * 0.55, r.y - L * 0.95, q.xn - s * L * 0.55, q.y - L * 1.35, s * L * 0.2, lw);
    }
  }
  const last = rows[n - 1];
  if (dance.rumba) {
    // round each other once: a dotted ring about the last face-off, and the word
    const cx = (last.x + last.xn) / 2, cy = last.y, rx = L * 1.25, ry = L * 1.45, a1 = TAU - 1.1;
    g.save(); dots(g, lw);
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, -0.6, a1); g.stroke(); g.restore();
    head(g, cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry, Math.atan2(ry * Math.cos(a1), -rx * Math.sin(a1)), lw * 4.2);
    g.font = `900 ${Math.round(clamp(L * 0.62, 9, 40))}px ${DOTS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const tx = clamp(cx, mx0 + mw * 0.26, mx0 + mw * 0.74);
    g.fillText(rumba, tx, Math.min(y + h - fs * 0.4, cy + ry + fs * 0.75));
  }
  if (figures) {
    const fh = Math.min(h * 0.6, fw * 2.4);
    figure(g, x + fw * 0.5, y + h * 0.5 + fh * 0.5, fh, dance.rumba ? { up: true, hood: true } : { reach: 1, hood: true });
    figure(g, x + w - fw * 0.5, y + h * 0.5 + fh * 0.5, fh, dance.rumba ? { up: true } : { reach: -1 });
  }
  g.restore();
}
