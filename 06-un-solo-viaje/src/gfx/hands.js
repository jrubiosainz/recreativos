// Your hands, as you see them with the shopping in them: two fists low in the view, each hooked
// through the handles of its bags, the bags swinging under them like the pendulums they are. A fist
// is drawn, not pasted: as the grip gives, its fingers uncurl, the handles slide toward the
// fingertips and the bags sink; it goes red with the load and purple at the fingertips with the
// fatigue. The free hand reaches for the doors, the buttons and the keys; when neither is free, your
// nose, your elbow, your foot and your head come into the picture instead.
import { PAL, TAU, rgba, ell, rrect, poly, tone, darker, lighter } from './paint.js';
import { drawHung, drawStanding, lookOf } from './bags.js';
import { clamp, lerp, smooth, damp, Spring, noise1, mulberry32 } from '../util.js';
import { BAG } from '../levels.js';
import { T_PASS, T_PICK } from '../sim.js';
import { ROAD } from './world.js';

const INK = '#7a4630', LW = 0.024, PI = Math.PI;
// index … little finger: centre height, half thickness, knuckle x, middle joint x, the joint's rise
const FING = [
  [-0.9, 0.125, 0.28, -0.38, 0.02],
  [-0.66, 0.13, 0.3, -0.44, 0],
  [-0.43, 0.12, 0.28, -0.41, -0.02],
  [-0.22, 0.1, 0.22, -0.32, -0.05],
];
const PHAL = [[0.3, 0.24], [0.33, 0.26], [0.31, 0.25], [0.25, 0.2]];   // the middle and end bones
const TIP = [-0.92, -0.88];     // the index fingertip when it points

// the skin, reddened by the load and purpled at the tips by the fatigue
const inkC = new Map();
function inks(red, numb) {
  const qr = Math.round(clamp(red) * 12), qn = Math.round(clamp(numb) * 12), key = qr * 16 + qn;
  let C = inkC.get(key);
  if (C) return C;
  const k = (qr / 12) * 0.55, n = (qn / 12) * 0.6, skin = tone(PAL.skin, PAL.press, k);
  C = {
    skin, dk: tone(PAL.skinDk, PAL.press, k * 0.7), lt: tone(PAL.skinLt, PAL.press, k * 0.45),
    knuckle: tone(PAL.knuckle, PAL.press, k * 0.9), tip: tone(skin, PAL.numb, n), nail: tone(PAL.nail, PAL.numb, n * 1.1),
  };
  inkC.set(key, C);
  return C;
}
const seg = (g, ax, ay, bx, by) => { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); };

// a finger's middle and end bones from its middle joint: outlines first, so the joints melt together
function finger(g, C, px, py, a1, a2, l1, l2, r1, r2, nail) {
  const mx = px + Math.cos(a1) * l1, my = py + Math.sin(a1) * l1, tx = mx + Math.cos(a2) * l2, ty = my + Math.sin(a2) * l2;
  g.lineCap = 'round'; g.strokeStyle = INK;
  g.lineWidth = r1 * 2 + LW * 2; seg(g, px, py, mx, my);
  g.lineWidth = r2 * 2 + LW * 2; seg(g, mx, my, tx, ty);
  g.strokeStyle = C.skin; g.lineWidth = r1 * 2; seg(g, px, py, mx, my);
  g.strokeStyle = C.tip; g.lineWidth = r2 * 2; seg(g, mx, my, tx, ty);
  if (nail) {
    const nx = -Math.sin(a2), ny = Math.cos(a2), cx = tx - Math.cos(a2) * l2 * 0.2 + nx * r2 * 0.42, cy = ty - Math.sin(a2) * l2 * 0.2 + ny * r2 * 0.42;
    g.fillStyle = C.nail; ell(g, cx, cy, l2 * 0.3, r2 * 0.55, a2); g.fill();
    g.strokeStyle = rgba(INK, 0.7); g.lineWidth = LW * 0.6; g.stroke();
  }
  return [tx, ty];
}
// the hooked end of finger i: curled away under the fist when it grips (e 0), hanging as a hook
// when it just carries (e .55), nearly straight when it lets go (e 1)
function hook(g, C, i, e, a1 = lerp(0.36, 0.95, e) * PI, curl = lerp(0.42, 0.04, e) * PI, k = lerp(0.35, 1, e)) {
  const [cy, hh, , x1, dy] = FING[i], [l1, l2] = PHAL[i];
  return finger(g, C, x1 + hh * 0.2, cy + dy, a1, a1 - curl, l1 * k, l2 * k, hh * 0.86, hh * 0.78, e > 0.3);
}
// its first bone, seen from the side: the fist's front is the row of middle joints
function band(g, C, i) {
  const [cy, hh, x0, x1, dy] = FING[i], y1 = cy + dy;
  g.beginPath(); g.moveTo(x0 + 0.1, cy - hh); g.lineTo(x1, y1 - hh); g.arc(x1, y1, hh, -PI / 2, PI / 2, true); g.lineTo(x0 + 0.1, cy + hh); g.closePath();
  g.fillStyle = C.skin; g.fill();
  g.save(); g.clip();
  g.fillStyle = rgba(C.dk, 0.6); ell(g, (x0 + x1) / 2, cy + hh * 0.95, (x0 - x1) * 0.62, hh * 0.55); g.fill();
  g.fillStyle = rgba(C.lt, 0.75); ell(g, (x0 + x1) / 2 - 0.06, cy - hh * 0.5, (x0 - x1) * 0.36, hh * 0.26); g.fill();
  g.fillStyle = rgba(C.tip, 0.45); ell(g, x1 - hh * 0.3, y1, hh * 0.6, hh * 0.85); g.fill();
  g.restore();
  g.strokeStyle = INK; g.lineWidth = LW;
  g.beginPath(); g.moveTo(x0 - 0.02, cy - hh); g.lineTo(x1, y1 - hh); g.arc(x1, y1, hh, -PI / 2, PI / 2, true); g.lineTo(x0 - 0.06, cy + hh); g.stroke();
}
// the back of the hand, from the knuckles to the wrist
function back(g, C) {
  g.lineJoin = 'round'; g.lineCap = 'round';
  const top = () => { g.moveTo(0.12, -1.02); g.bezierCurveTo(0.42, -1.1, 0.72, -0.94, 0.88, -0.64); };
  const under = () => { g.moveTo(0.74, 0.14); g.bezierCurveTo(0.5, 0.1, 0.24, 0.04, 0.04, -0.1); };
  g.beginPath(); top(); g.lineTo(0.74, 0.14); g.bezierCurveTo(0.5, 0.1, 0.24, 0.04, 0.04, -0.1); g.closePath();
  g.fillStyle = C.skin; g.fill();
  g.save(); g.clip();
  g.fillStyle = rgba(C.dk, 0.55); ell(g, 0.5, 0.04, 0.52, 0.28, -0.3); g.fill();
  g.fillStyle = rgba(C.lt, 0.7); ell(g, 0.52, -0.84, 0.32, 0.1, 0.45); g.fill();
  g.strokeStyle = rgba(INK, 0.14); g.lineWidth = 0.02;
  for (const [a, b] of [[-0.74, -0.52], [-0.48, -0.3], [-0.24, -0.08]]) { g.beginPath(); g.moveTo(0.36, a); g.quadraticCurveTo(0.56, (a + b) / 2 - 0.05, 0.8, b); g.stroke(); }
  g.restore();
  g.strokeStyle = INK; g.lineWidth = LW;
  g.beginPath(); top(); g.stroke();
  g.beginPath(); under(); g.stroke();
}
function knuckles(g, C, from = 0) {
  for (let i = from; i < 4; i++) { const [cy, hh, x0] = FING[i]; g.fillStyle = rgba(C.knuckle, 0.85); ell(g, x0 + 0.02, cy - hh * 0.25, 0.075, hh * 0.55, 0.2); g.fill(); }
}
// the thumb, laid over the top of the fist, its tip on the index finger's middle joint
function thumb(g, C, tuck = 0) {
  const ax = 0.5, ay = -1.0, bx = 0.1, by = -1.08, tx = -0.24 + tuck * 0.16, ty = -1.0 + tuck * 0.04;
  g.lineCap = 'round'; g.strokeStyle = INK;
  g.lineWidth = 0.27 + LW * 2; seg(g, ax, ay, bx, by);
  g.lineWidth = 0.22 + LW * 2; seg(g, bx, by, tx, ty);
  g.strokeStyle = C.skin; g.lineWidth = 0.27; seg(g, ax, ay, bx, by);
  g.lineWidth = 0.22; seg(g, bx, by, tx, ty);
  g.strokeStyle = rgba(C.lt, 0.8); g.lineWidth = 0.05;
  g.beginPath(); g.moveTo(0.42, -1.08); g.quadraticCurveTo(0.12, -1.17, -0.1, -1.1); g.stroke();
  g.strokeStyle = rgba(INK, 0.45); g.lineWidth = 0.016;
  g.beginPath(); g.moveTo(bx + 0.02, by + 0.1); g.quadraticCurveTo(bx - 0.03, by + 0.02, bx + 0.01, by - 0.08); g.stroke();
  g.fillStyle = C.nail; ell(g, tx + 0.02, ty - 0.05, 0.075, 0.05, -0.25); g.fill();
  g.strokeStyle = rgba(INK, 0.7); g.lineWidth = LW * 0.6; g.stroke();
}

// the fist, right hand, in fist widths: origin where the handles leave it, x outward, y down.
// e: how open (0 tight … .55 just carrying … 1 letting go); point: the index finger out (0 … 1)
function fist(g, C, e, point = 0) {
  back(g, C);
  for (let i = 3; i >= 0; i--) if (!(i === 0 && point > 0)) hook(g, C, i, e);
  for (let i = 3; i >= 0; i--) band(g, C, i);
  if (point > 0) hook(g, C, 0, 1, lerp(0.4, 1.02, point) * PI, lerp(0.4, 0, point) * PI, lerp(0.4, 1, point));
  knuckles(g, C);
  thumb(g, C, point);
}
// the back of an open hand, fingers up, pressed against something: origin mid-palm
const FLAT = [[-0.3, 0.8, 0.1, -0.08], [-0.1, 0.88, 0.105, -0.02], [0.11, 0.82, 0.1, 0.03], [0.31, 0.64, 0.085, 0.1]];
function flat(g, C) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [x, l, r, lean] of FLAT) {
    const tx = x + lean * l, ty = -0.58 - l;
    g.strokeStyle = INK; g.lineWidth = r * 2 + LW * 2; seg(g, x, -0.5, tx, ty);
    g.strokeStyle = C.skin; g.lineWidth = r * 2; seg(g, x, -0.5, tx, ty);
    g.strokeStyle = rgba(INK, 0.35); g.lineWidth = 0.014;
    for (const f of [0.42, 0.72]) { const cx = lerp(x, tx, f), cy = lerp(-0.5, ty, f); seg(g, cx - r * 0.5, cy, cx + r * 0.5, cy); }
    g.fillStyle = C.nail; ell(g, tx, ty + r * 0.5, r * 0.62, r * 0.8, lean); g.fill();
    g.strokeStyle = rgba(INK, 0.6); g.lineWidth = LW * 0.6; g.stroke();
  }
  g.strokeStyle = INK; g.lineWidth = 0.24 + LW * 2; seg(g, -0.36, -0.06, -0.7, -0.46);
  g.strokeStyle = C.skin; g.lineWidth = 0.24; seg(g, -0.36, -0.06, -0.7, -0.46);
  g.fillStyle = C.nail; ell(g, -0.72, -0.44, 0.06, 0.08, -0.7); g.fill();
  g.beginPath(); g.moveTo(-0.44, -0.66); g.quadraticCurveTo(0, -0.74, 0.44, -0.62);
  g.lineTo(0.4, 0.36); g.lineTo(-0.3, 0.36); g.quadraticCurveTo(-0.5, -0.1, -0.44, -0.66); g.closePath();
  g.fillStyle = C.skin; g.fill();
  g.save(); g.clip();
  g.fillStyle = rgba(C.dk, 0.5); ell(g, 0.3, 0.1, 0.3, 0.5); g.fill();
  g.strokeStyle = rgba(INK, 0.14); g.lineWidth = 0.02;
  for (const x of [-0.26, -0.06, 0.14]) { g.beginPath(); g.moveTo(x, -0.56); g.lineTo(x * 0.5 + 0.04, 0.3); g.stroke(); }
  g.restore();
  for (const [x] of FLAT) { g.fillStyle = rgba(C.knuckle, 0.85); ell(g, x, -0.6, 0.08, 0.06); g.fill(); }
  g.strokeStyle = INK; g.lineWidth = LW;
  g.beginPath(); g.moveTo(0.44, -0.62); g.lineTo(0.4, 0.36); g.moveTo(-0.3, 0.36); g.quadraticCurveTo(-0.5, -0.1, -0.44, -0.66); g.stroke();
}
// your palm, turned up to look at it while you rest: fingers up, thumb out, and across the fingers
// the red welts the handles pressed in (mk 0 … 1), fading as the grip comes back. Origin mid-palm
const PALM = [[0.3, 0.78, 0.1, 0.07], [0.1, 0.88, 0.105, 0.02], [-0.11, 0.82, 0.1, -0.03], [-0.31, 0.64, 0.085, -0.1]];
function palm(g, C, mk) {
  const pad = tone(C.lt, '#f4b7a4', 0.35);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [x, l, r, lean] of PALM) {
    const tx = x + lean * l, ty = -0.58 - l;
    g.strokeStyle = INK; g.lineWidth = r * 2 + LW * 2; seg(g, x, -0.46, tx, ty);
    g.strokeStyle = pad; g.lineWidth = r * 2; seg(g, x, -0.46, tx, ty);
    g.fillStyle = rgba(C.tip, 0.8); ell(g, tx, ty + r * 0.55, r * 0.8, r * 1.05, lean); g.fill();
    g.strokeStyle = rgba(INK, 0.3); g.lineWidth = 0.014;
    for (const f of [0.4, 0.7]) { const cx = lerp(x, tx, f), cy = lerp(-0.5, ty, f); seg(g, cx - r * 0.6, cy, cx + r * 0.6, cy); }
    if (mk > 0.02) {
      // the welt: a red band a third of the way up, pale where the handle bit deepest
      const cx = lerp(x, tx, 0.24), cy = lerp(-0.5, ty, 0.24);
      g.strokeStyle = rgba(PAL.press, 0.75 * mk); g.lineWidth = 0.085; seg(g, cx - r * 0.82, cy + 0.01, cx + r * 0.82, cy - 0.01);
      g.strokeStyle = rgba('#fff4ee', 0.55 * mk); g.lineWidth = 0.022; seg(g, cx - r * 0.7, cy + 0.005, cx + r * 0.7, cy - 0.005);
    }
  }
  g.strokeStyle = INK; g.lineWidth = 0.25 + LW * 2; seg(g, 0.36, 0.02, 0.74, -0.4);
  g.strokeStyle = pad; g.lineWidth = 0.25; seg(g, 0.36, 0.02, 0.74, -0.4);
  g.fillStyle = rgba(C.tip, 0.8); ell(g, 0.74, -0.38, 0.1, 0.12, 0.7); g.fill();
  g.beginPath(); g.moveTo(0.46, -0.62); g.quadraticCurveTo(0, -0.72, -0.44, -0.6);
  g.quadraticCurveTo(-0.52, -0.1, -0.32, 0.36); g.lineTo(0.36, 0.36); g.quadraticCurveTo(0.56, -0.1, 0.46, -0.62); g.closePath();
  g.fillStyle = pad; g.fill();
  g.save(); g.clip();
  g.fillStyle = rgba(C.skin, 0.8); ell(g, 0.28, 0.12, 0.26, 0.34, -0.2); g.fill();
  g.fillStyle = rgba(C.dk, 0.28); ell(g, -0.44, 0, 0.14, 0.5); g.fill();
  g.strokeStyle = rgba(INK, 0.32); g.lineWidth = 0.02;
  g.beginPath(); g.moveTo(-0.44, -0.4); g.quadraticCurveTo(-0.05, -0.34, 0.2, -0.52); g.stroke();
  g.beginPath(); g.moveTo(0.4, -0.3); g.quadraticCurveTo(0.02, -0.2, -0.34, -0.06); g.stroke();
  g.beginPath(); g.moveTo(0.36, -0.36); g.quadraticCurveTo(0.02, -0.04, 0.14, 0.34); g.stroke();
  if (mk > 0.02) { g.strokeStyle = rgba(PAL.press, 0.4 * mk); g.lineWidth = 0.05; g.beginPath(); g.moveTo(-0.42, -0.56); g.quadraticCurveTo(0, -0.64, 0.42, -0.58); g.stroke(); }
  g.restore();
  g.strokeStyle = INK; g.lineWidth = LW;
  g.beginPath(); g.moveTo(-0.32, 0.36); g.quadraticCurveTo(-0.52, -0.1, -0.44, -0.6); g.moveTo(0.36, 0.36); g.quadraticCurveTo(0.5, 0.1, 0.4, -0.08); g.stroke();
}
// the key, pinched between the thumb and the index finger, the rest of the bunch hanging below
function keys(g, sw) {
  g.lineCap = 'round';
  g.fillStyle = PAL.brass; g.strokeStyle = PAL.brassDk; g.lineWidth = 0.02;
  g.save(); g.translate(-0.3, -1.08); g.rotate(-0.5);
  g.beginPath(); g.moveTo(0, -0.05); g.lineTo(-0.5, -0.05); g.lineTo(-0.56, 0); g.lineTo(-0.5, 0.05);
  for (let k = 0; k < 4; k++) { g.lineTo(-0.42 + k * 0.09, 0.05); g.lineTo(-0.38 + k * 0.09, 0.1); }
  g.lineTo(0, 0.05); g.closePath(); g.fill(); g.stroke();
  g.restore();
  g.save(); g.translate(-0.22, 0.02); g.rotate(sw);
  g.strokeStyle = PAL.steelDk; g.lineWidth = 0.035; ell(g, 0, 0.1, 0.1, 0.1); g.stroke();
  for (const [a, col, l] of [[-0.25, PAL.steel, 0.46], [0.3, PAL.brassLt, 0.38]]) {
    g.save(); g.translate(Math.sin(a) * 0.1, 0.2); g.rotate(-a);
    g.fillStyle = col; g.strokeStyle = PAL.steelDk; g.lineWidth = 0.015;
    ell(g, 0, 0.06, 0.07, 0.07); g.fill(); g.stroke();
    g.fillRect(-0.025, 0.12, 0.05, l); g.strokeRect(-0.025, 0.12, 0.05, l);
    g.restore();
  }
  g.restore();
}

// the forearm, from the wrist (its two sides A and B, screen px) to the elbow E off the screen; the
// sleeve starts `cuff` fist widths up it. U: fist width at the wrist, u0: at the elbow
function arm(g, A, B, E, U, u0, cuff = 1.7) {
  const wx = (A[0] + B[0]) / 2, wy = (A[1] + B[1]) / 2;
  let dx = E[0] - wx, dy = E[1] - wy;
  const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  let nx = -dy, ny = dx;
  if ((A[0] - wx) * nx + (A[1] - wy) * ny < 0) { nx = -nx; ny = -ny; }
  const hw0 = Math.max(Math.hypot(A[0] - B[0], A[1] - B[1]) / 2, 0.3 * U), hw1 = 0.62 * u0, hm = (hw0 + hw1) / 2;
  const mx = (wx + E[0]) / 2, my = (wy + E[1]) / 2;
  g.beginPath(); g.moveTo(A[0], A[1]);
  g.quadraticCurveTo(mx + nx * hm * 1.14, my + ny * hm * 1.14, E[0] + nx * hw1, E[1] + ny * hw1);
  g.lineTo(E[0] - nx * hw1, E[1] - ny * hw1);
  g.quadraticCurveTo(mx - nx * hm * 1.04, my - ny * hm * 1.04, B[0], B[1]);
  g.closePath();
  const gr = g.createLinearGradient(wx + nx * hw0, wy + ny * hw0, wx - nx * hw0, wy - ny * hw0);
  gr.addColorStop(0, PAL.skinLt); gr.addColorStop(0.35, PAL.skin); gr.addColorStop(1, PAL.skinDk);
  g.fillStyle = gr; g.fill();
  g.strokeStyle = INK; g.lineWidth = LW * U; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(A[0], A[1]); g.quadraticCurveTo(mx + nx * hm * 1.14, my + ny * hm * 1.14, E[0] + nx * hw1, E[1] + ny * hw1);
  g.moveTo(B[0], B[1]); g.quadraticCurveTo(mx - nx * hm * 1.04, my - ny * hm * 1.04, E[0] - nx * hw1, E[1] - ny * hw1); g.stroke();
  // the sleeve of the jumper, pushed up the arm, its ribbed cuff
  const t0 = (cuff * U) / L;
  if (t0 > 0.92) return;
  const cx = wx + dx * cuff * U, cy = wy + dy * cuff * U, hc = lerp(hw0, hw1, t0) * 1.22, he = hw1 * 1.26;
  g.beginPath(); g.moveTo(cx + nx * hc, cy + ny * hc); g.lineTo(E[0] + nx * he, E[1] + ny * he);
  g.lineTo(E[0] - nx * he, E[1] - ny * he); g.lineTo(cx - nx * hc, cy - ny * hc);
  g.quadraticCurveTo(cx - dx * 0.08 * U, cy - dy * 0.08 * U, cx + nx * hc, cy + ny * hc); g.closePath();
  const gs = g.createLinearGradient(cx + nx * hc, cy + ny * hc, cx - nx * hc, cy - ny * hc);
  gs.addColorStop(0, PAL.sleeveLt); gs.addColorStop(0.4, PAL.sleeve); gs.addColorStop(1, PAL.sleeveDk);
  g.fillStyle = gs; g.fill();
  g.strokeStyle = '#17261d'; g.lineWidth = LW * U; g.stroke();
  g.strokeStyle = rgba(PAL.sleeveDk, 0.9); g.lineWidth = 0.022 * U;
  for (let k = 1; k <= 5; k++) {
    const f = k / 6, px = cx + dx * (0.05 + f * 0.3) * U, py = cy + dy * (0.05 + f * 0.3) * U;
    seg(g, px + nx * hc * 0.92, py + ny * hc * 0.92, px - nx * hc * 0.92, py - ny * hc * 0.92);
  }
  g.strokeStyle = rgba('#0f1a13', 0.5); g.lineWidth = 0.03 * U;
  g.beginPath(); g.moveTo(cx + dx * 0.55 * U + nx * hc * 0.4, cy + dy * 0.55 * U + ny * hc * 0.4);
  g.quadraticCurveTo(cx + dx * 0.9 * U, cy + dy * 0.9 * U, cx + dx * 1.3 * U - nx * hc * 0.3, cy + dy * 1.3 * U - ny * hc * 0.3); g.stroke();
}

// ---------- when there is no free hand ----------
// your own nose, pressed to a button: big, pink, out of focus, at the bottom of the view
function nose(g, W, H, u, k, boop) {
  if (k <= 0.01) return;
  const r = 1.55 * u, cx = W / 2, cy = lerp(H + 1.5 * r, H - 0.12 * r, smooth(k)), sy = 1 - boop * 0.12;
  g.save(); g.translate(cx, cy); g.scale(1 + boop * 0.08, sy);
  for (const s of [-1, 1]) {
    const gw = g.createRadialGradient(s * 0.62 * r, 0.3 * r, 0, s * 0.62 * r, 0.3 * r, 0.62 * r);
    gw.addColorStop(0, rgba(PAL.skinDk, 0.85)); gw.addColorStop(0.7, rgba(PAL.skinDk, 0.55)); gw.addColorStop(1, rgba(PAL.skinDk, 0));
    g.fillStyle = gw; ell(g, s * 0.62 * r, 0.3 * r, 0.62 * r, 0.62 * r); g.fill();
  }
  const gr = g.createRadialGradient(0, -0.3 * r, 0.05 * r, 0, 0, r);
  gr.addColorStop(0, rgba(PAL.skinLt, 0.97)); gr.addColorStop(0.5, rgba('#eba48a', 0.95)); gr.addColorStop(0.82, rgba(PAL.skinDk, 0.6)); gr.addColorStop(1, rgba(PAL.skinDk, 0));
  g.fillStyle = gr; ell(g, 0, 0, r, r * 0.96); g.fill();
  const gh = g.createRadialGradient(-0.18 * r, -0.42 * r, 0, -0.18 * r, -0.42 * r, 0.34 * r);
  gh.addColorStop(0, 'rgba(255,245,236,0.55)'); gh.addColorStop(1, 'rgba(255,245,236,0)');
  g.fillStyle = gh; ell(g, -0.18 * r, -0.42 * r, 0.34 * r, 0.3 * r); g.fill();
  g.restore();
}
// your elbow, swung up at a light switch: a sleeve coming in from the side, bent
function elbow(g, W, H, u, k, sd, tx, ty) {
  if (k <= 0.01) return;
  const e = smooth(k), ex = lerp(W / 2 + sd * (W / 2 + 2.2 * u), tx, e), ey = lerp(ty + 1.5 * u, ty, e), w = 1.25 * u;
  const up = [W / 2 + sd * (W / 2 + 3.5 * u), ey + 2.6 * u], fore = [lerp(ex, W / 2, 0.35), H + 2 * u];
  for (const [px, py] of [up, fore]) {
    g.strokeStyle = '#17261d'; g.lineCap = 'round'; g.lineWidth = w * 2 + 3; seg(g, ex, ey, px, py);
    g.strokeStyle = PAL.sleeve; g.lineWidth = w * 2; seg(g, ex, ey, px, py);
  }
  const gr = g.createRadialGradient(ex - sd * 0.3 * w, ey - 0.3 * w, 0, ex, ey, w * 1.1);
  gr.addColorStop(0, PAL.sleeveLt); gr.addColorStop(1, rgba(PAL.sleeve, 0));
  g.fillStyle = gr; ell(g, ex, ey, w * 1.05, w * 1.05); g.fill();
  g.strokeStyle = rgba(PAL.sleeveDk, 0.9); g.lineWidth = 0.05 * u;
  for (let i = 0; i < 3; i++) {
    const a = -0.5 + i * 0.35;
    g.beginPath(); g.arc(ex + sd * 0.55 * w, ey + 0.6 * w, w * (0.45 + i * 0.16), -PI / 2 - sd * (0.6 + a), -PI / 2 - sd * (0.1 + a), sd > 0); g.stroke();
  }
}
// your foot, hooked round the edge of a door to pull it open: a trainer from the bottom of the view
function foot(g, W, H, u, k, tx, ty) {
  if (k <= 0.01) return;
  const e = smooth(k), x = lerp(tx + 0.6 * u, tx, e), y = lerp(H + 3.4 * u, Math.max(ty, H * 0.55), e), s = 1.2 * u;
  g.save(); g.translate(x, y); g.rotate(-0.12);
  g.fillStyle = '#f2f0ea'; g.strokeStyle = '#3a3a38'; g.lineWidth = 0.04 * s;
  g.beginPath(); g.moveTo(-0.5 * s, 3 * s); g.bezierCurveTo(-0.62 * s, 1.2 * s, -0.5 * s, 0.1 * s, 0, 0);
  g.bezierCurveTo(0.5 * s, 0.1 * s, 0.66 * s, 1.2 * s, 0.56 * s, 3 * s); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#2f4a6b';
  g.beginPath(); g.moveTo(-0.44 * s, 3 * s); g.bezierCurveTo(-0.52 * s, 1.3 * s, -0.42 * s, 0.24 * s, 0, 0.14 * s);
  g.bezierCurveTo(0.42 * s, 0.24 * s, 0.56 * s, 1.3 * s, 0.5 * s, 3 * s); g.closePath(); g.fill();
  g.fillStyle = '#f2f0ea'; g.beginPath(); g.moveTo(-0.46 * s, 1.7 * s); g.quadraticCurveTo(0, 0.9 * s, 0.5 * s, 1.3 * s); g.lineTo(0.52 * s, 1.55 * s); g.quadraticCurveTo(0, 1.2 * s, -0.47 * s, 1.95 * s); g.fill();
  g.fillStyle = '#243a55'; rrect(g, -0.26 * s, 0.9 * s, 0.52 * s, 1.6 * s, 0.2 * s); g.fill();
  g.strokeStyle = '#f2f0ea'; g.lineWidth = 0.06 * s;
  for (let i = 0; i < 5; i++) { const yy = (1.05 + i * 0.3) * s; seg(g, -0.2 * s, yy, 0.2 * s, yy + 0.1 * s); seg(g, -0.2 * s, yy + 0.1 * s, 0.2 * s, yy); }
  g.restore();
}
// your fringe, over your eyes as you shut the boot with your forehead
function hair(g, W, H, u, k, t) {
  if (k <= 0.01) return;
  const gr = g.createLinearGradient(0, 0, 0, 1.6 * u);
  gr.addColorStop(0, rgba('#1b1310', 0.55 * k)); gr.addColorStop(1, 'rgba(27,19,16,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, 1.6 * u);
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const f = i / 25, x0 = lerp(-0.05, 1.05, f) * W, n = noise1(i * 1.7, 3), L = k * (1.7 + 0.7 * n) * u, sw = noise1(t * 1.3 + i, 5) * 0.15 * u;
    const x1 = x0 + (f - 0.5) * 0.9 * u + sw, y1 = L;
    g.strokeStyle = i % 3 ? '#2e211a' : '#4a3426'; g.lineWidth = (0.3 + 0.15 * ((i * 7) % 3)) * u;
    g.beginPath(); g.moveTo(x0, -0.3 * u); g.quadraticCurveTo(x0 + sw, y1 * 0.5, x1, y1); g.stroke();
  }
}

// a fragile bag giving way: yolk and shell, or wine and glass, or cava and glass
const SPLASH = { huevos: ['#f2c230', '#fbf6ea'], botellas: ['#6d1a2a', '#2c4a33'], cava: ['#eadfa6', '#2c4a33'] };
function burst(fx, x, y, look, u, rnd) {
  const [wet, bit] = SPLASH[look] || ['#8a6d4a', '#dddddd'];
  for (let i = 0; i < 30; i++) {
    const shard = i % 3 === 0, a = -PI / 2 + (rnd() - 0.5) * 2.2, v = (4 + rnd() * 7) * u;
    fx.push({ k: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: (shard ? 0.07 : 0.05 + rnd() * 0.07) * u, col: shard ? bit : wet, shard, rot: rnd() * TAU, t: 0, life: 0.55 + rnd() * 0.35 });
  }
}

// ---------- the pair of them ----------
const G = 109, PL = 3.4;    // gravity, and a bag's length as a pendulum, in fist widths
// where the handles sit in the fist as it opens: under the fingers, then sliding to their tips
const pivotAt = (e) => (e < 0.55 ? [lerp(-0.1, -0.26, e / 0.55), lerp(-0.2, -0.1, e / 0.55)] : [lerp(-0.26, -0.62, (e - 0.55) / 0.45), lerp(-0.1, 0.06, (e - 0.55) / 0.45)]);
const KEY_TIP = [-0.79, -0.81];
const lookKey = (sim, b) => BAG[sim.bags[b].k].look;
// out to something, a while there, and back: 0 … 1 … 0 over an act's time
// a hand turning over: its width through nothing and back
const flip = (pf) => Math.max(0.06, Math.abs(Math.cos(PI * clamp(pf))));
const reach3 = (p, a = 0.35, b = 0.75) => (p < a ? smooth(p / a) : p < b ? 1 : 1 - smooth((p - b) / (1 - b)));

function mkHand(h) {
  return {
    h, sd: h ? 1 : -1, x: new Spring(0, 900), y: new Spring(0, 900), rot: new Spring(0, 320), S: new Spring(1, 420), o: new Spring(0.55, 240),
    pose: 'grip', pk: 0, keys: 0, ax: 0, ay: 0, red: 0, numb: 0, shake: 0, nope: 0, pf: 0, mark: 0, swing: new Map(),
  };
}

export class Hands {
  constructor() {
    this.hd = [mkHand(0), mkHand(1)];
    this.fx = []; this.t = 0; this.tr = new Map(); this.last = new Map(); this.land = new Map(); this.crouched = null;
    this.ov = { nose: 0, boop: 0, elbow: 0, foot: 0, hair: 0, sd: 1, tx: 0, ty: 0 };
    this.rnd = mulberry32(7);
    this.resize(390, 844);
  }
  resize(W, H) {
    this.W = W; this.H = H;
    this.u = Math.min(W * 0.18, H * 0.13); this.bu = this.u * 1.28;
    this.spread = Math.min(W * 0.3, H * 0.36);
    this.baseY = H - Math.max(2.3 * this.u, 0.29 * H);
    this.fresh = true;
  }
  home(h) { return [this.W / 2 + (h ? 1 : -1) * this.spread, this.baseY]; }
  elbowAt(h) { return [this.W / 2 + (h ? 1 : -1) * (this.W * 0.5 + 2.5 * this.u), this.H + 1.5 * this.u]; }
  lowY() { return this.H - 0.55 * this.u - 0.85 * this.bu; }
  // a point of a hand's drawing (fist widths, right-hand frame) on the screen
  pt(Hd, lx, ly, rot = Hd.rot.x, S = Hd.S.x, x = Hd.x.x, y = Hd.y.x) {
    const r = Hd.sd * rot, c = Math.cos(r), s = Math.sin(r), U = S * this.u, X = Hd.sd * lx * U, Y = ly * U;
    return [x + c * X - s * Y, y + s * X + c * Y];
  }
  // where a hand's readout goes: just over its fist
  anchor(h) { return this.pt(this.hd[h], 0.22, -1.5); }

  // what the simulation said happened this tick
  events(evs, sim) {
    for (const e of evs) {
      switch (e.type) {
        case 'slip': {
          const H = this.hd[e.hand], L = this.last.get(e.bag);
          H.o.snap(1); H.y.v -= 6 * this.u;
          if (L) this.fx.push({ k: 'fall', bag: e.bag, look: L.look, x: L.x, y: L.y, a: L.a, s: L.s, vx: H.x.v * 0.5, vy: this.u, va: H.sd * (1.2 + this.rnd()), broken: sim.bags[e.bag].broken, burst: false, t: 0 });
          H.swing.delete(e.bag);
          break;
        }
        case 'break': {
          const f = this.fx.find((q) => q.k === 'fall' && q.bag === e.bag);
          if (f) { f.burst = true; f.broken = true; } else burst(this.fx, this.W / 2, this.H - 0.3 * this.u, lookKey(sim, e.bag), this.u, this.rnd);
          break;
        }
        case 'empty': this.hd[e.hand].nope = 0.4; break;
        case 'passed': {
          const F = this.hd[e.from], T = this.hd[e.to], s = F.swing.get(e.bag) || { a: 0, v: 0 };
          F.swing.delete(e.bag); s.v += T.sd * 1.2; T.swing.set(e.bag, s);
          break;
        }
        case 'grabbed': { const T = this.hd[e.to]; if (!T.swing.has(e.bag)) T.swing.set(e.bag, { a: 0, v: -T.sd * 1.5 }); break; }
        case 'rested': {
          for (const H of this.hd) H.shake = 0.9;
          // what was hanging slumps onto the floor and settles into its row
          const R = sim.rest;
          if (R) for (const L of R.prev) for (const b of L) { const q = this.last.get(b); if (q && q.hung) { q.hung = false; this.land.set(b, this.t); } }
          break;
        }
      }
    }
  }

  // where a hand wants to be this frame
  aim(Hd, sim, cam, world) {
    const u = this.u, h = Hd.h, sd = Hd.sd, X = sim.H[h], t = this.t;
    let [hx, hy] = this.home(h);
    const kg = sim.load(h), n = X.bags.length, cap = Math.max(0.05, 1 - X.MF), strain = clamp((X.TL / cap - 0.55) / 0.45);
    hy += u * (0.38 * clamp(kg / 20) + 0.2 * X.MF + (n ? 0 : 0.3));
    if (sim.step && sim.step.k === 'walk' && !sim.rest && !sim.end) {
      const st = sim.onStairs(), ph = (sim.s / (st ? 0.64 : 0.75)) * PI, amp = st ? 1.5 : 1;
      hx += Math.sin(ph + h * PI) * 0.06 * u * amp;
      hy += (1 - Math.cos(2 * ph)) * 0.035 * u * amp;
    }
    const tr = u * (0.004 + 0.05 * strain * strain);
    hx += noise1(t * 9, h * 7) * tr; hy += noise1(t * 11, h * 7 + 3) * tr;
    const T = { x: hx, y: hy, rot: n ? 0.1 - 0.2 * clamp(kg / 18) : 0.28, S: 1, o: n ? lerp(0.04, 0.85, strain) : 0.55, pose: 'grip', pk: 0, keys: 0, pal: 0 };
    if (Hd.shake > 0) { const k = Hd.shake / 0.9; T.rot += Math.sin(t * 30) * 0.3 * k; T.x += Math.sin(t * 26 + h) * 0.08 * u * k; T.o = 0.7; }
    if (Hd.nope > 0) { const k = Hd.nope / 0.4; T.rot += Math.sin(t * 45) * 0.22 * k; T.o = 0.75; }
    const R = sim.rest, P = sim.pass, Gb = sim.grab, A = sim.act;
    if (R && R.phase === 'down') { const k = smooth(R.t / R.T); T.y = lerp(T.y, this.lowY(), k); T.x += sd * 0.2 * u * k; }
    // shaken out, the empty hands turn over and you look at your palms
    if (R && R.phase === 'idle' && !n && Hd.shake < (h ? 0.38 : 0.5)) {
      T.pal = 1; T.x -= sd * 0.3 * u; T.y -= (0.55 + 0.04 * Math.sin(t * 1.7 + h * 2)) * u; T.rot = -0.12; T.S = 1.06;
    }
    if (P) {
      const k = clamp(P.t / T_PASS), m = Math.sin(PI * k);
      T.x = lerp(T.x, this.W / 2 + sd * 0.85 * u, m * 0.7); T.y -= m * 0.35 * u;
      if (h === P.from && k > 0.55) T.o = lerp(T.o, 0.8, (k - 0.55) / 0.45);
      if (h === P.to) T.o = k < 0.5 ? lerp(T.o, 0.7, k * 2) : lerp(0.7, T.o, (k - 0.5) * 2);
    }
    if (Gb && Gb.to === h) {
      const k = clamp(Gb.t / T_PICK), src = this.src(Gb.bag, sim, sd);
      if (src) {
        const r = k < 0.5 ? smooth(k * 2) : 1 - smooth((k - 0.5) * 2);
        T.x = lerp(T.x, src[0], r); T.y = lerp(T.y, src[1], r); T.S = lerp(1, src[2], r); T.o = k < 0.45 ? 0.72 : 0.06;
      }
    }
    if (A) this.acting(T, Hd, A, sim, cam, world);
    return T;
  }
  acting(T, Hd, A, sim, cam, world) {
    const u = this.u, h = Hd.h, sd = Hd.sd, p = clamp(A.t / A.T);
    if (A.how === 'fast' || A.how === 'cross') { if (A.hand === h) this.reach(T, Hd, A.type, p, sim, cam, world); return; }
    const r = reach3(p, 0.3, 0.75);
    switch (A.how) {
      case 'nose': T.y -= 0.25 * u * r; T.x += sd * 0.35 * u * r; break;
      case 'foot': T.y -= 0.3 * u * r; T.x += sd * 0.45 * u * r; break;
      case 'head': T.y += 0.2 * u * r; T.x += sd * 0.3 * u * r; T.rot -= 0.1 * r; break;
      case 'bum': T.y -= 0.45 * u * r; T.x -= sd * 0.55 * u * r; break;
      case 'elbow':
        if (h === (A.side === 'L' ? 0 : 1)) { T.y -= 1.2 * u * r; T.x -= sd * 1.0 * u * r; T.rot += 0.5 * r; } else T.x += sd * 0.2 * u * r;
        break;
      case 'crouch': {
        // everything down to the floor; one hand lets go of its bags for the keys and takes them again
        const t = A.t, up0 = A.b + 0.3 * (A.T - A.b), low = this.lowY(), idle = this.baseY + 0.45 * u, hx = this.home(h)[0] + sd * 0.2 * u;
        if (t < A.a || t >= up0 || A.hand !== h) {
          const k = t < up0 ? smooth(t / A.a) : 1 - smooth((t - up0) / (A.T - up0));
          T.x = lerp(T.x, hx, k); T.y = lerp(T.y, low, k); T.o = lerp(T.o, 0.2, k);
        } else if (t < A.b) {
          T.x = hx; T.y = idle; T.o = 0.55; T.rot = 0.28;
          this.reach(T, Hd, A.type, (t - A.a) / (A.b - A.a), sim, cam, world);
        } else { const k = smooth((t - A.b) / (up0 - A.b)); T.x = hx; T.y = lerp(idle, low, k); T.o = lerp(0.55, 0.2, k); T.rot = lerp(0.28, T.rot, k); }
      }
    }
  }
  // the free hand does the act itself: out to the thing, the gesture, back
  reach(T, Hd, type, p, sim, cam, world) {
    const u = this.u, sd = Hd.sd;
    const tg = this.target(sim, cam, world) || [this.W / 2 + sd * this.W * 0.16, this.H * 0.4, 0];
    const S0 = tg[2] ? clamp((0.085 * tg[2]) / u, 0.42, 1) : 0.7;
    if (type === 'keys' || type === 'keys2') return this.turnKey(T, Hd, type, p, tg, S0);
    const r = reach3(p), d = clamp((p - 0.35) / 0.4);
    let rot = T.rot, off = [-0.25, -0.55], S = S0, dx = 0, dy = 0;
    if (type === 'button' || type === 'switch') { rot = 0.8; off = TIP; S = S0 * (1 - 0.1 * Math.sin(PI * d)); T.pk = smooth(r); }
    else if (type === 'push') { rot = 0; off = [0, -0.35]; S = S0 * (1 - 0.12 * smooth(d)); if (r > 0.5) T.pose = 'flat'; }
    else if (type === 'pull') { rot = -0.35; const k = smooth((d - 0.25) / 0.75); dx = -sd * 0.5 * u * k; dy = 0.35 * u * k; S = S0 * (1 + 0.3 * k); }
    else if (type === 'trunk') rot = -0.2;
    const [ox, oy] = this.pt(Hd, off[0], off[1], rot, S, 0, 0);
    T.x = lerp(T.x, tg[0] - ox + dx, r); T.y = lerp(T.y, tg[1] - oy + dy, r);
    T.rot = lerp(T.rot, rot, r); T.S = lerp(T.S, S, r); T.o = lerp(T.o, 0.06, r);
  }
  // to the pocket, to the lock, a turn (two for the old door), back
  turnKey(T, Hd, type, p, tg, S) {
    const u = this.u, sd = Hd.sd, [hx] = this.home(Hd.h), pocket = [hx + sd * 0.8 * u, this.H + 1.4 * u], n = type === 'keys2' ? 2 : 1;
    const rot = -0.3 + (p > 0.45 && p < 0.85 ? Math.abs(Math.sin((PI * n * (p - 0.45)) / 0.4)) * 1.15 : 0);
    const [ox, oy] = this.pt(Hd, KEY_TIP[0], KEY_TIP[1], rot, S, 0, 0), lx = tg[0] - ox, ly = tg[1] - oy;
    let x = lx, y = ly, s = S, rr = rot;
    if (p < 0.2) { const k = smooth(p / 0.2); x = lerp(T.x, pocket[0], k); y = lerp(T.y, pocket[1], k); s = 1; rr = T.rot; }
    else if (p < 0.45) { const k = smooth((p - 0.2) / 0.25); x = lerp(pocket[0], lx, k); y = lerp(pocket[1], ly, k); s = lerp(1, S, k); rr = lerp(T.rot, rot, k); }
    else if (p >= 0.85) { const k = smooth((p - 0.85) / 0.15); x = lerp(lx, T.x, k); y = lerp(ly, T.y, k); s = lerp(S, 1, k); rr = lerp(rot, T.rot, k); }
    T.x = x; T.y = y; T.S = s; T.rot = rr; T.o = 0.06; T.keys = p > 0.18 && p < 0.93 ? 1 : 0;
  }
  // an act's target in the world (step i, the current one by default), in the frame of its room's
  // leg (y absolute): [x, y, z] tagged with .leg, or null
  targetW(sim, world, i = sim.si) {
    const st = sim.steps[i];
    if (!st || st.k !== 'act' || !world) return null;
    const R = world.W.rooms[st.room];
    let P = null;
    if (st.type === 'trunk') {
      // the boot lid's edge, wherever it has swung to
      const A = i === sim.si ? sim.act : null, cp = A ? smooth(A.t / A.T) : 0, be = -(lerp(0.607, -0.477, cp) + 0.477), cb = Math.cos(be), sb = Math.sin(be);
      P = [0, 1.45 - 0.88 * sb - 0.73 * cb + ROAD, 1.35 - 0.88 * cb + 0.73 * sb];
      P.leg = R.leg;
      return P;
    }
    // rooms keep their targets over their own floor, like everything drawn in them
    const O = R.out, a = R.targets.get(i), b = !a && O && O.targets && O.targets.get(i);
    if (a) { P = [a[0], R.y0 + a[1], a[2]]; P.leg = R.leg; }
    else if (b) { P = [b[0], O.y0 + b[1], b[2]]; P.leg = O.leg; }
    return P;
  }
  // the same on the screen: [x, y, px per metre], or null
  target(sim, cam, world) {
    const P = cam && this.targetW(sim, world), q = P && cam.p(P[0], P[1], P[2]);
    return q ? [q[0], q[1], q[2]] : null;
  }
  // where a bag set down stands: [mouth x, mouth y, px per fist width], or null. On the floor for a
  // rest, in a row under each hand; for the keys, just where it was let go
  stand(b, sim) {
    const R = sim.rest;
    if (R) for (let h = 0; h < 2; h++) {
      const L = R.prev[h], k = L.indexOf(b);
      if (k < 0) continue;
      const n = L.length, sd = h ? 1 : -1, sp = Math.min(0.95 * this.bu, (this.W * 0.42) / Math.max(1, n - 1));
      return [this.home(h)[0] + sd * (0.2 * this.u - (k - (n - 1) / 2) * sp), this.H - 0.55 * this.u, this.bu];
    }
    if (this.putDown(sim.act)) { const q = this.last.get(b); if (q) return [q.mx, q.my, q.s * this.bu]; }
    return null;
  }
  // where a hand goes to take a bag: its fist over the handles, [x, y, scale]
  src(b, sim, sd) {
    let m = null;
    if (sim.loading()) m = this.tr.get(b) || null;
    else { const q = this.stand(b, sim); if (q) m = [q[0], q[1], q[2] / this.bu]; }
    if (!m) return null;
    const U = this.bu * m[2];
    return [m[0] + sd * 0.09 * U, m[1] - (lookOf(lookKey(sim, b)).sl - 0.15) * U, m[2]];
  }
  putDown(A) { return !!A && A.how === 'crouch' && A.t >= A.a && A.t < A.b + 0.3 * (A.T - A.b); }
  pivotOf(Hd, k, n) {
    const [px, py] = pivotAt(clamp(Hd.o.x));
    return this.pt(Hd, px + (k - (n - 1) / 2) * -0.13, py);
  }

  // ---------- motion ----------
  update(sim, dt, cam, world) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1); this.t += dt;
    const u = this.u, n = Math.max(1, Math.ceil(dt * 120)), hh = dt / n, A = sim.act;
    if (this.putDown(A) && this.crouched !== A) {
      this.crouched = A;
      for (const b of sim.H[A.hand].bags) { const q = this.last.get(b); if (q) { q.hung = false; this.land.set(b, this.t); } }
    }
    for (const Hd of this.hd) {
      const T = this.aim(Hd, sim, cam, world), X = sim.H[Hd.h];
      if (this.fresh) { Hd.x.snap(T.x); Hd.y.snap(T.y); Hd.rot.snap(T.rot); Hd.S.snap(T.S); Hd.o.snap(T.o); }
      const vx = Hd.x.v, vy = Hd.y.v;
      for (let i = 0; i < n; i++) { Hd.x.step(T.x, hh); Hd.y.step(T.y, hh); Hd.rot.step(T.rot, hh); Hd.S.step(T.S, hh); Hd.o.step(T.o, hh); }
      Hd.ax = clamp((Hd.x.v - vx) / dt / u, -80, 80); Hd.ay = clamp((Hd.y.v - vy) / dt / u, -80, 80);
      Hd.pose = T.pose; Hd.keys = T.keys; Hd.pk = damp(Hd.pk, T.pk, 16, dt); Hd.pf = damp(Hd.pf, T.pal, 9, dt);
      Hd.red = damp(Hd.red, X.bags.length ? clamp(X.TL / Math.max(0.05, 1 - X.MF)) : 0, 5, dt);
      Hd.numb = damp(Hd.numb, clamp(X.MF * 1.3), 2, dt);
      // the handles' welts: the load presses them in, and what stays is the fatigue
      Hd.mark = damp(Hd.mark, clamp(2.2 * X.MF + (X.bags.length ? 0.45 * Hd.red : 0)), X.bags.length ? 0.6 : 1.5, dt);
      Hd.shake = Math.max(0, Hd.shake - dt); Hd.nope = Math.max(0, Hd.nope - dt);
      this.swingTick(Hd, sim, dt);
    }
    this.fresh = false;
    this.fxTick(sim, dt);
    this.overTick(sim, dt, cam, world);
  }
  // each bag a pendulum hanging from a fist that moves
  swingTick(Hd, sim, dt) {
    const on = sim.H[Hd.h].bags.slice(), Gb = sim.grab, hh = dt / 2;
    if (Gb && Gb.to === Hd.h && Gb.t >= T_PICK / 2) on.push(Gb.bag);
    for (const b of Hd.swing.keys()) if (!on.includes(b)) Hd.swing.delete(b);
    for (const b of on) {
      let s = Hd.swing.get(b);
      if (!s) Hd.swing.set(b, (s = { a: 0, v: 0 }));
      const c = 1.6 + 0.12 * sim.bags[b].kg;
      for (let i = 0; i < 2; i++) {
        s.v += ((-(G - Hd.ay) * Math.sin(s.a) - Hd.ax * Math.cos(s.a)) / PL - c * s.v) * hh;
        s.a = clamp(s.a + s.v * hh, -1.2, 1.2);
      }
    }
  }
  fxTick(sim, dt) {
    const u = this.u, gy = G * u;
    for (const f of this.fx) {
      f.t += dt;
      if (f.k === 'drop') {
        f.vy += gy * 0.8 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += 9 * dt;
        if (f.t > f.life) f.dead = true;
        continue;
      }
      f.vy += gy * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.va * dt;
      const sp = sim.bags[f.bag].at === 'floor' ? this.stand(f.bag, sim) : null;
      if (sp) {
        // it falls onto its place on the floor and stays there
        const L = lookOf(f.look), U = this.bu * f.s, k = 1 - Math.exp(-12 * dt);
        const mx = f.x + Math.sin(f.a) * L.sl * U, my = f.y + Math.cos(f.a) * L.sl * U;
        f.x += (sp[0] - mx) * k; f.s = lerp(f.s, sp[2] / this.bu, k); f.va *= Math.exp(-4 * dt); f.a = lerp(f.a, 0, k * 0.4);
        if (my >= sp[1]) {
          f.dead = true;
          this.last.set(f.bag, { x: f.x, y: f.y, a: f.a, s: f.s, look: f.look, mx, my: sp[1], hung: false });
          this.land.set(f.bag, this.t);
          if (f.burst) burst(this.fx, sp[0], sp[1] + 0.35 * sp[2], f.look, u, this.rnd);
        }
      } else if (f.y > this.H + 8 * u) f.dead = true;
    }
    this.fx = this.fx.filter((f) => !f.dead);
  }
  // no free hand: your nose, an elbow, a foot, the top of your head come into the view
  overTick(sim, dt, cam, world) {
    const o = this.ov, A = sim.act;
    let nose = 0, boop = 0, elbow = 0, foot = 0, hair = 0;
    if (A) {
      const p = clamp(A.t / A.T), r = reach3(p, 0.3, 0.75);
      if (A.how === 'nose') { nose = r; boop = Math.sin(PI * clamp((p - 0.3) / 0.45)); }
      else if (A.how === 'elbow') { elbow = r; o.sd = A.side === 'L' ? -1 : 1; }
      else if (A.how === 'foot') foot = r;
      else if (A.how === 'head') hair = r;
      if (nose + elbow + foot + hair > 0) { const tg = this.target(sim, cam, world); if (tg) { o.tx = tg[0]; o.ty = tg[1]; } }
    }
    const k = 1 - Math.exp(-14 * dt);
    o.nose += (nose - o.nose) * k; o.boop += (boop - o.boop) * k; o.elbow += (elbow - o.elbow) * k;
    o.foot += (foot - o.foot) * k; o.hair += (hair - o.hair) * k;
  }

  // ---------- drawing ----------
  // the hand in front: the one acting, taking or being given a bag
  order(sim) {
    const A = sim.act, P = sim.pass, Gb = sim.grab;
    let top = 1;
    if (A && A.hand != null && (A.how === 'fast' || A.how === 'cross' || A.how === 'crouch')) top = A.hand;
    else if (P) top = P.to;
    else if (Gb) top = Gb.to;
    return top === 0 ? [1, 0] : [0, 1];
  }
  draw(g, sim) {
    const P = sim.pass, m = P ? smooth((clamp(P.t / T_PASS) - 0.3) / 0.5) : 0;
    this.floor(g, sim);
    for (const f of this.fx) if (f.k === 'fall') drawHung(g, f.look, f.x, f.y, f.a, this.bu, { s: f.s, broken: f.broken });
    for (const h of this.order(sim)) {
      const Hd = this.hd[h];
      this.drawArm(g, Hd);
      this.drawBags(g, Hd, sim);
      if (P && ((P.from === h && m < 0.5) || (P.to === h && m >= 0.5))) this.drawPass(g, sim, P, m);
      this.drawHand(g, Hd);
    }
    this.drawDrops(g);
    const o = this.ov, W = this.W, H = this.H, u = this.u;
    hair(g, W, H, u, o.hair, this.t);
    foot(g, W, H, u, o.foot, o.tx, o.ty);
    elbow(g, W, H, u, o.elbow, o.sd, o.tx, o.ty);
    nose(g, W, H, u, o.nose, o.boop);
  }
  floor(g, sim) {
    const R = sim.rest, Gb = sim.grab, A = sim.act, list = [];
    if (R) for (const L of R.prev) for (const b of L) {
      const at = sim.bags[b].at;
      if (at === 'floor' ? !this.fx.some((f) => f.k === 'fall' && f.bag === b) : at === 'air' && Gb && Gb.bag === b && Gb.t < T_PICK / 2) list.push(b);
    }
    if (this.putDown(A)) list.push(...sim.H[A.hand].bags);
    for (const b of list) {
      const sp = this.stand(b, sim);
      if (!sp) continue;
      let [mx, my, s] = sp, lean = 0, sq = 0.9;
      const t0 = this.land.get(b), q = this.last.get(b);
      if (t0 != null && q) {
        // set down: it slumps, and settles into its place in the row
        const k = clamp((this.t - t0) / 0.32), e = 1 - (1 - k) ** 3;
        mx = lerp(q.mx, mx, e); my = lerp(q.my, my, e); s = lerp(q.s * this.bu, s, e);
        lean = lerp(-q.a, 0, e); sq = lerp(1, 0.9, e) - 0.07 * Math.sin(PI * k);
      }
      const look = lookKey(sim, b), bh = lookOf(look).bh * s * sq;
      drawStanding(g, look, mx - Math.sin(lean) * bh, my + Math.cos(lean) * bh, s, { broken: sim.bags[b].broken, lean, sq });
    }
  }
  // the wrist's two sides: a fist's, an open hand's, or on the way from one to the other as it turns
  drawArm(g, Hd) {
    const fl = Hd.pose === 'flat', f = flip(Hd.pf), k = clamp(Hd.pf);
    const A = fl ? [0.4, 0.36] : [lerp(0.88, 0.36, k), lerp(-0.64, 0.36, k)], B = fl ? [-0.3, 0.36] : [lerp(0.74, -0.32, k), lerp(0.14, 0.36, k)];
    arm(g, this.pt(Hd, A[0] * f, A[1]), this.pt(Hd, B[0] * f, B[1]), this.elbowAt(Hd.h), Hd.S.x * this.u, this.u * 1.25);
  }
  drawBags(g, Hd, sim) {
    const h = Hd.h, P = sim.pass, Gb = sim.grab;
    if (this.putDown(sim.act) && sim.act.hand === h) return;
    const list = sim.H[h].bags.slice();
    if (Gb && Gb.to === h && Gb.t >= T_PICK / 2) list.push(Gb.bag);
    const n = list.length;
    for (let k = 0; k < n; k++) if (!(P && P.from === h && P.bag === list[k])) this.hang(g, Hd, sim, list[k], k, n);
  }
  hang(g, Hd, sim, b, k, n, at = null, a1 = null, s1 = null) {
    const e = clamp(Hd.o.x), [x, y] = at || this.pivotOf(Hd, k, n), fromIn = n - 1 - k, sw = Hd.swing.get(b);
    const a = a1 ?? (sw ? sw.a : 0) + Hd.sd * 0.09 * ((n - 1) / 2 - k), s = s1 ?? Hd.S.x * (1 - 0.05 * fromIn), look = lookKey(sim, b);
    const [mx, my] = drawHung(g, look, x, y, a, this.bu, { s, broken: sim.bags[b].broken, shade: 0.1 * fromIn, drop: (0.28 * e * e) / 1.28 });
    this.last.set(b, { x, y, a, s, look, mx, my, hung: true });
    this.land.delete(b);
  }
  // a bag handed across: its handles slide from one fist to the other
  drawPass(g, sim, P, m) {
    const F = this.hd[P.from], T = this.hd[P.to], nf = sim.H[P.from].bags.length, nt = sim.H[P.to].bags.length;
    const p0 = this.pivotOf(F, nf - 1, nf), p1 = this.pivotOf(T, nt, nt + 1), sw = F.swing.get(P.bag);
    const at = [lerp(p0[0], p1[0], m), lerp(p0[1], p1[1], m) - Math.sin(PI * m) * 0.3 * this.u];
    const a = (sw ? sw.a : 0) * (1 - m) - T.sd * 0.25 * Math.sin(PI * m);
    this.hang(g, m < 0.5 ? F : T, sim, P.bag, 0, 1, at, a, lerp(F.S.x, T.S.x, m));
  }
  drawHand(g, Hd) {
    const C = inks(Hd.red, Hd.numb), U = Hd.S.x * this.u;
    g.save();
    g.translate(Hd.x.x, Hd.y.x); g.rotate(Hd.sd * Hd.rot.x); g.scale(Hd.sd * U * flip(Hd.pf), U);
    if (Hd.pf > 0.5) palm(g, C, clamp(Hd.mark));
    else if (Hd.pose === 'flat') flat(g, C);
    else {
      if (Hd.keys) keys(g, Math.sin(this.t * 6.5) * 0.25 - Hd.rot.v * 0.04);
      fist(g, C, clamp(Hd.o.x), Hd.pk);
    }
    g.restore();
  }
  drawDrops(g) {
    for (const f of this.fx) {
      if (f.k !== 'drop') continue;
      const k = clamp(1 - f.t / f.life);
      g.globalAlpha = clamp(k * 2); g.fillStyle = f.col;
      if (f.shard) {
        g.save(); g.translate(f.x, f.y); g.rotate(f.rot);
        g.beginPath(); g.moveTo(-f.r, 0); g.lineTo(0, -f.r * 0.6); g.lineTo(f.r, f.r * 0.3); g.closePath(); g.fill();
        g.restore();
      } else { g.beginPath(); g.arc(f.x, f.y, f.r * (0.5 + 0.5 * k), 0, TAU); g.fill(); }
    }
    g.globalAlpha = 1;
  }

  // the bags still in the boot: the trunk room calls this inside its clip, in its own frame
  trunk(g, cam, sim) {
    const Gb = sim.grab, list = [];
    sim.bags.forEach((b, i) => { if (b.at === 'trunk' || (b.at === 'air' && Gb && Gb.bag === i && Gb.t < T_PICK / 2 && sim.loading())) list.push(i); });
    list.sort((p, q) => Math.floor(q / 3) - Math.floor(p / 3) || p - q);
    for (const i of list) {
      const col = i % 3, row = Math.floor(i / 3), q = cam.p((col - 1) * 0.36 + (row & 1 ? 0.12 : 0) - 0.06, ROAD + 0.58, 0.64 + row * 0.22);
      if (!q) continue;
      const sx = q[0], sy = q[1], s = q[2] * 0.165, look = lookKey(sim, i);
      drawStanding(g, look, sx, sy, s, { broken: sim.bags[i].broken });
      this.tr.set(i, [sx, sy - lookOf(look).bh * s * 0.9, s / this.bu]);
    }
  }
}
