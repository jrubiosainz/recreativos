// The pusher's white gloves, first person, and the navy sleeves they come out of. Screen space.
// We see the backs of the gloves (the palms face the passenger): three stitched lines, a flared cuff.
import { TAU, clamp, lerp, rgba, shade } from './util.js';

const GLOVE = '#fbfbf7', GLOVE_S = '#dcdcd6', STITCH = 'rgba(120,120,140,0.55)', INK = '#1c1a27';
const SLEEVE = '#23305a', SLEEVE_D = '#172142', BRAID = '#e7c35a';

// one glove centred on its palm. side -1 left hand, 1 right hand. pose: open | point | beckon | fist
export function drawGlove(g, x, y, s, rot, side, pose = 'open', k = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(side, 1); // draw a right hand; the left one is its mirror
  g.lineJoin = 'round'; g.lineCap = 'round';
  const out = (w) => { g.lineWidth = w; g.strokeStyle = rgba(INK, 0.55); g.stroke(); };
  const finger = (fx, fy, len, w, ang, curl) => {
    // a capsule that can bend at the middle knuckle toward the palm
    const a2 = ang + curl * 1.9;
    const mx = fx + Math.sin(ang) * len * 0.52, my = fy - Math.cos(ang) * len * 0.52;
    const ex = mx + Math.sin(a2) * len * 0.48, ey = my - Math.cos(a2) * len * 0.48;
    g.beginPath(); g.moveTo(fx, fy); g.lineTo(mx, my); g.lineTo(ex, ey);
    g.lineWidth = w + s * 0.05; g.strokeStyle = rgba(INK, 0.55); g.stroke();
    g.lineWidth = w; g.strokeStyle = GLOVE; g.stroke();
    return [ex, ey];
  };
  // cuff
  g.beginPath();
  g.moveTo(-s * 0.42, s * 0.46); g.lineTo(s * 0.42, s * 0.46); g.lineTo(s * 0.52, s * 0.86); g.quadraticCurveTo(0, s * 0.98, -s * 0.52, s * 0.86); g.closePath();
  g.fillStyle = GLOVE_S; g.fill(); out(s * 0.035);
  g.strokeStyle = rgba('#8a8a96', 0.5); g.lineWidth = s * 0.02;
  g.beginPath(); g.moveTo(-s * 0.46, s * 0.62); g.quadraticCurveTo(0, s * 0.7, s * 0.46, s * 0.62); g.stroke();

  const fw = s * 0.21;
  const curlAll = pose === 'fist' ? 1 : pose === 'point' ? 1 : pose === 'beckon' ? 0.35 + 0.65 * k : 0;
  // fingers: index (inner, toward the thumb) .. little
  const F = [[-0.2, 0.64, -0.07], [0.02, 0.7, 0], [0.22, 0.64, 0.07], [0.4, 0.5, 0.16]];
  const tips = [];
  F.forEach(([fx, len, ang], i) => {
    const c = pose === 'point' && i === 0 ? 0 : curlAll;
    tips.push(finger(fx * s, -s * 0.22, len * s, i === 3 ? fw * 0.86 : fw, ang, c));
  });
  // palm (back of the hand)
  g.beginPath();
  g.moveTo(-s * 0.36, -s * 0.28);
  g.quadraticCurveTo(0, -s * 0.4, s * 0.5, -s * 0.24);
  g.quadraticCurveTo(s * 0.54, s * 0.2, s * 0.4, s * 0.5);
  g.lineTo(-s * 0.4, s * 0.5);
  g.quadraticCurveTo(-s * 0.5, s * 0.1, -s * 0.36, -s * 0.28);
  g.closePath();
  g.fillStyle = GLOVE; g.fill(); out(s * 0.04);
  // thumb, on the inner side
  g.save();
  g.beginPath();
  const tc = pose === 'point' || pose === 'fist' ? 0.7 : 0;
  g.ellipse(-s * (0.46 - tc * 0.12), s * (0.06 - tc * 0.08), s * 0.13, s * 0.3, -0.5 + tc * 0.9, 0, TAU);
  g.fillStyle = GLOVE; g.fill(); out(s * 0.035);
  g.restore();
  // redraw the palm edge over the thumb's root so it tucks in
  g.fillStyle = GLOVE;
  g.beginPath(); g.ellipse(-s * 0.28, s * 0.12, s * 0.12, s * 0.26, 0, 0, TAU); g.fill();
  // stitches
  g.strokeStyle = STITCH; g.lineWidth = s * 0.028;
  for (const dx of [-0.13, 0.05, 0.23]) {
    g.beginPath(); g.moveTo(dx * s, -s * 0.2); g.lineTo(dx * s * 1.1, s * 0.22); g.stroke();
  }
  // soft shade on the outer edge
  g.fillStyle = 'rgba(40,40,70,0.08)';
  g.beginPath(); g.ellipse(s * 0.34, s * 0.12, s * 0.14, s * 0.34, 0, 0, TAU); g.fill();
  g.restore();
  return tips;
}

// the arm from off-screen to the wrist, foreshortened: fat where it leaves the camera, slim at the cuff.
// A navy uniform sleeve with a highlight along its top and a gold braid ring near the cuff.
export function drawSleeve(g, sx, sy, wx, wy, w0, w1, side, bend = 0.12) {
  const dx = wx - sx, dy = wy - sy, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const cx = sx + dx * 0.5 + nx * L * bend * side, cy = sy + dy * 0.5 + ny * L * bend * side;
  const N = 14, left = [], right = [], mid = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = 1 - t;
    const x = a * a * sx + 2 * a * t * cx + t * t * wx, y = a * a * sy + 2 * a * t * cy + t * t * wy;
    const tx = 2 * a * (cx - sx) + 2 * t * (wx - cx), ty = 2 * a * (cy - sy) + 2 * t * (wy - cy);
    const tl = Math.hypot(tx, ty) || 1, px = -ty / tl, py = tx / tl;
    const w = lerp(w0, w1, Math.pow(t, 0.62)) / 2;
    left.push([x + px * w, y + py * w]); right.push([x - px * w, y - py * w]); mid.push([x, y, px, py, w]);
  }
  const path = (pad) => {
    g.beginPath();
    left.forEach(([x, y], i) => { const m = mid[i]; const X = x + m[2] * pad, Y = y + m[3] * pad; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
    for (let i = right.length - 1; i >= 0; i--) { const m = mid[i]; g.lineTo(right[i][0] - m[2] * pad, right[i][1] - m[3] * pad); }
    g.closePath();
  };
  path(Math.max(1, w1 * 0.05)); g.fillStyle = SLEEVE_D; g.fill();
  path(0); g.fillStyle = SLEEVE; g.fill();
  // light from above: a soft band along the upper edge
  g.save(); path(0); g.clip();
  g.strokeStyle = rgba(shade(SLEEVE, 0.4), 0.45); g.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const m = mid[i], m2 = mid[i + 1], k = side * (m[3] < 0 ? 1 : -1);
    g.lineWidth = m[4] * 0.32;
    g.beginPath(); g.moveTo(m[0] + m[2] * m[4] * 0.55 * k, m[1] + m[3] * m[4] * 0.55 * k); g.lineTo(m2[0] + m2[2] * m2[4] * 0.55 * k, m2[1] + m2[3] * m2[4] * 0.55 * k); g.stroke();
  }
  // gold braid ring near the cuff
  const b = mid[Math.round(N * 0.86)];
  g.strokeStyle = BRAID; g.lineWidth = Math.max(2, b[4] * 0.28); g.lineCap = 'butt';
  g.beginPath(); g.moveTo(b[0] + b[2] * b[4] * 1.1, b[1] + b[3] * b[4] * 1.1); g.lineTo(b[0] - b[2] * b[4] * 1.1, b[1] - b[3] * b[4] * 1.1); g.stroke();
  g.restore();
}
