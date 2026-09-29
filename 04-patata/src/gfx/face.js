// Faces. The whole game is read in the eyes, so the lids are exact: the aperture the simulation
// judges (ap) is the opening you see. Features sit on a sphere and turn with the head (yaw), drop
// when they look down at a phone (pitch). A lid closing from above is a blink (∪); pushed up from
// below by a smile or the sun it becomes a squint (∩). Tells before a blink: lids that flutter,
// eyes that go glossy, then pink, a tear that wells up and rolls.
import { INK, LW, TAU, K, clamp, mix, shade, ell, dot, skinFill } from './ink.js';

const AGE = {
  adult: { ry: 0.54, ey: -0.02, lam: 0.42, ew: 0.088, eh: 0.07, ny: 0.15, my: 0.3, ns: 1 },
  teen: { ry: 0.535, ey: 0, lam: 0.43, ew: 0.09, eh: 0.075, ny: 0.15, my: 0.295, ns: 0.88 },
  old: { ry: 0.55, ey: -0.02, lam: 0.42, ew: 0.078, eh: 0.058, ny: 0.16, my: 0.31, ns: 1.08 },
  kid: { ry: 0.52, ey: 0.03, lam: 0.44, ew: 0.095, eh: 0.085, ny: 0.16, my: 0.29, ns: 0.8 },
  toddler: { ry: 0.51, ey: 0.07, lam: 0.45, ew: 0.09, eh: 0.086, ny: 0.19, my: 0.31, ns: 0.66 },
  baby: { ry: 0.5, ey: 0.09, lam: 0.46, ew: 0.085, eh: 0.085, ny: 0.2, my: 0.32, ns: 0.6 },
};
export const ageOf = (L) => AGE[L.age] || AGE.adult;
const R = (L) => 0.46 * (L.w || 1);

export function headPath(g, L, yaw) {
  const A = ageOf(L), rx = 0.5 * (L.w || 1), ry = A.ry;
  const round = L.age === 'baby' || L.age === 'toddler' ? 1.3 : L.age === 'kid' ? 1.12 : 1;
  const jw = (L.jaw || (L.sex === 'f' ? 0.9 : 1)) * round, cx = Math.sin(yaw) * 0.05;
  g.beginPath();
  g.moveTo(-rx, 0);
  g.bezierCurveTo(-rx, -ry * K, -rx * K, -ry, 0, -ry);
  g.bezierCurveTo(rx * K, -ry, rx, -ry * K, rx, 0);
  g.bezierCurveTo(rx, ry * 0.6, cx + rx * 0.5 * jw, ry, cx, ry);
  g.bezierCurveTo(cx - rx * 0.5 * jw, ry, -rx, ry * 0.6, -rx, 0);
  g.closePath();
}

// ears peek out on each side; the one the face turns towards slides behind the head
export function drawEars(g, L, yaw) {
  const rx = 0.5 * (L.w || 1), s = L.ears || 1, col = mix(L.skin, '#d07a64', 0.18), sy = Math.sin(yaw);
  for (const side of [-1, 1]) {
    const hide = Math.max(0, side * sy), show = Math.max(0, -side * sy);
    const x = side * rx * (0.96 - 0.35 * hide + 0.06 * show), w = 0.085 * s * (1 - 0.6 * hide + 0.25 * show);
    if (w < 0.02) continue;
    ell(g, x, 0.06, w, 0.12 * s, side * 0.12);
    g.fillStyle = col; g.fill(); g.lineWidth = LW; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.arc(x + side * w * 0.1, 0.06, w * 0.5, side > 0 ? -1.2 : Math.PI - 1.9, side > 0 ? 1.9 : Math.PI + 1.2);
    g.lineWidth = LW * 0.6; g.stroke();
    if (L.earring && show + 0.5 > hide) {
      const ex = x + side * w * 0.15, ey = 0.06 + 0.12 * s;
      if (L.earring === 'hoop') { g.beginPath(); g.arc(ex, ey + 0.05, 0.045, 0, TAU); g.lineWidth = 0.014; g.strokeStyle = '#d9a93a'; g.stroke(); }
      else { dot(g, ex, ey + 0.012, 0.022); g.fillStyle = L.earring === 'pearl' ? '#fbf6ea' : '#e0b448'; g.fill(); g.lineWidth = 0.008; g.strokeStyle = INK; g.stroke(); }
    }
  }
}

export function drawSkull(g, L, yaw) {
  headPath(g, L, yaw);
  g.fillStyle = skinFill(g, L.skin); g.fill();
  g.lineWidth = LW; g.strokeStyle = INK; g.stroke();
}

function eyeCurve(g, x, y, ew, eh, oU, oL) {
  g.moveTo(x - ew, y);
  g.bezierCurveTo(x - ew * 0.5, y - 1.333 * eh * oU, x + ew * 0.55, y - 1.333 * eh * oU, x + ew, y);
  g.bezierCurveTo(x + ew * 0.55, y + 1.333 * eh * oL, x - ew * 0.5, y + 1.333 * eh * oL, x - ew, y);
}

// one eye; returns where it is so brows, glasses and tears can find it
export function drawEye(g, L, v, o, side) {
  const A = ageOf(L), a = v.yaw + side * A.lam, sc = 0.35 + 0.65 * Math.cos(a);
  const x = R(L) * Math.sin(a) * 1.02, y = A.ey + v.pitch * 0.2;
  const wide = v.wide || 0, ew = A.ew * sc * (1 + 0.12 * wide), eh0 = A.eh * (1 + 0.25 * wide);
  let c = 1 - v.ap + Math.max(0, v.gy) * 0.12;
  if (v.quiver > 0) c += v.quiver * 0.09 * (0.5 + 0.5 * Math.sin(o.t * 47 + side * 1.7));
  c = clamp(c);
  const low = c > 0.001 ? clamp(Math.min(0.65 * v.squint + 0.18 * v.smile, c) / c) * 0.7 : 0;
  const oU = 1 - 2 * c * (1 - low), oL = 1 - 2 * c * low, eh = eh0;
  const E = { x, y, ew, eh, sc, side, c };
  const fem = L.sex === 'f';
  if (c < 0.94) {
    g.beginPath(); eyeCurve(g, x, y, ew, eh, oU, oL); g.closePath();
    g.fillStyle = v.pink > 0 ? mix('#fbf5ec', '#f0b2a8', v.pink * 0.6) : '#fbf5ec'; g.fill();
    g.save(); g.clip();
    const ir = Math.min(0.86 * A.eh, 0.64 * A.ew) * (1 - 0.1 * wide);
    const ix = x + clamp(1.35 * v.gx - 0.55 * v.yaw, -1, 1) * ew * 0.55, iy = y + clamp(1.2 * v.gy - 0.5 * v.pitch, -1, 1) * eh0 * 0.45;
    const irx = ir * (0.55 + 0.45 * sc);
    ell(g, ix, iy, irx, ir); g.fillStyle = L.eye; g.fill();
    g.lineWidth = ir * 0.2; g.strokeStyle = shade(L.eye, -0.45); g.stroke();
    ell(g, ix, iy, irx * 0.5 * (1 - 0.25 * wide), ir * 0.5 * (1 - 0.25 * wide));
    g.fillStyle = o.redeye ? '#d8321e' : '#1b1210'; g.fill();
    if (o.redeye) { dot(g, ix, iy, ir * 0.22); g.fillStyle = '#ff8a4a'; g.fill(); }
    const hl = 0.26 + 0.14 * (v.gloss || 0);
    dot(g, ix - irx * 0.32, iy - ir * 0.36, ir * hl); g.fillStyle = '#ffffff'; g.fill();
    dot(g, ix + irx * 0.3, iy + ir * 0.28, ir * 0.11); g.fill();
    // the shadow the upper lid casts on the eyeball
    g.beginPath(); g.moveTo(x - ew, y); g.bezierCurveTo(x - ew * 0.5, y - 1.333 * eh * oU, x + ew * 0.55, y - 1.333 * eh * oU, x + ew, y);
    g.lineWidth = eh * 0.55; g.strokeStyle = 'rgba(70,30,20,0.2)'; g.stroke();
    if (v.gloss > 0.05) {
      g.beginPath(); g.moveTo(x + ew * 0.7, y + 0.2 * eh); g.bezierCurveTo(x + ew * 0.4, y + 1.2 * eh * oL, x - ew * 0.4, y + 1.2 * eh * oL, x - ew * 0.7, y + 0.2 * eh);
      g.lineWidth = eh * 0.16; g.strokeStyle = `rgba(255,255,255,${0.7 * v.gloss})`; g.stroke();
    }
    g.restore();
    // lower lid, then the lash line on top
    g.beginPath(); g.moveTo(x + ew, y); g.bezierCurveTo(x + ew * 0.55, y + 1.333 * eh * oL, x - ew * 0.5, y + 1.333 * eh * oL, x - ew, y);
    g.lineWidth = LW * 0.5; g.strokeStyle = 'rgba(59,36,23,0.45)'; g.stroke();
  }
  g.beginPath(); g.moveTo(x - ew * 1.04, y); g.bezierCurveTo(x - ew * 0.5, y - 1.333 * eh * oU, x + ew * 0.55, y - 1.333 * eh * oU, x + ew * 1.04, y);
  g.lineWidth = fem ? 0.036 : 0.028; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke();
  const ox = x + side * ew, oy = y;
  if (fem && L.age !== 'kid') { g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + side * 0.03, oy - 0.028 * (c < 0.94 ? 1 : -0.4)); g.lineWidth = 0.022; g.stroke(); }
  return E;
}

// what sits around an eye: brow, bags, creases, crow's feet and the tear that gives a blink away
function eyeFrame(g, L, v, E) {
  const { x, y, ew, eh, side } = E, A = ageOf(L);
  const lift = -0.015 * v.smile - 0.05 * (v.wide || 0) - 0.03 * v.drowsy + 0.035 * v.squint;
  const inner = -0.055 * (v.strain || 0) + 0.02 * v.squint;
  const by = y - A.eh * 1.25 - 0.05 + lift, xi = x - side * ew * 0.95, xo = x + side * ew * 1.2;
  g.beginPath(); g.moveTo(xi, by + 0.012 + inner); g.quadraticCurveTo(x + side * ew * 0.15, by - 0.04 - 0.012 * (v.wide || 0), xo, by + 0.022);
  g.lineCap = 'round'; g.lineWidth = 0.032 * (L.browW || 1) * (L.sex === 'f' ? 0.78 : 1);
  g.strokeStyle = L.brow || (L.old ? shade(L.hc, -0.2) : shade(L.hc, -0.15)); g.stroke();
  g.strokeStyle = INK; g.lineWidth = LW * 0.5;
  if (L.old || v.drowsy > 0.1) {
    g.globalAlpha = L.old ? 0.4 : 0.4 * v.drowsy;
    g.beginPath(); g.moveTo(x - ew * 0.75, y + eh * 1.35); g.quadraticCurveTo(x, y + eh * 2.05, x + ew * 0.75, y + eh * 1.35); g.stroke();
    if (L.old) { g.beginPath(); g.moveTo(x - ew * 0.8, y - eh * 1.4); g.quadraticCurveTo(x, y - eh * 2.2, x + ew * 0.85, y - eh * 1.3); g.stroke(); }
    g.globalAlpha = 1;
  }
  const crow = Math.max(v.squint, L.old ? v.smile * 0.8 : v.smile > 0.8 ? (v.smile - 0.8) * 2 : 0);
  if (crow > 0.15) {
    g.globalAlpha = Math.min(0.6, crow * 0.7);
    g.beginPath();
    for (const k of [-0.5, 0, 0.5]) { g.moveTo(x + side * ew * 1.15, y + k * 0.02); g.lineTo(x + side * (ew * 1.15 + 0.035), y + k * 0.045); }
    g.stroke(); g.globalAlpha = 1;
  }
  if (v.strain > 0.2 && side > 0) {
    g.globalAlpha = 0.5 * v.strain; g.beginPath(); g.moveTo(-0.02 + v.yaw * 0.2, by + 0.01); g.lineTo(-0.012 + v.yaw * 0.2, by + 0.05); g.stroke(); g.globalAlpha = 1;
  }
  if (v.tear > 0.02 && side > 0) {
    const tx = x + side * ew * 0.72, ty = y + eh * 0.75, r = 0.012 + 0.02 * v.tear;
    if (v.roll >= 0) {
      const k = v.roll, dy = k * 0.3;
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + side * 0.01 * k, ty + dy);
      g.lineWidth = 0.014; g.strokeStyle = 'rgba(190,225,245,0.55)'; g.stroke();
      drop(g, tx + side * 0.01 * k, ty + dy, 0.016 + 0.012 * (1 - k));
    } else drop(g, tx, ty, r);
  }
}
function drop(g, x, y, r) {
  g.beginPath(); g.moveTo(x, y - r * 1.5); g.quadraticCurveTo(x + r * 1.1, y, x, y + r); g.quadraticCurveTo(x - r * 1.1, y, x, y - r * 1.5);
  g.fillStyle = 'rgba(214,238,250,0.92)'; g.fill(); g.lineWidth = 0.008; g.strokeStyle = 'rgba(59,36,23,0.5)'; g.stroke();
  dot(g, x - r * 0.3, y - r * 0.2, r * 0.3); g.fillStyle = '#ffffff'; g.fill();
}

function drawNose(g, L, v) {
  const A = ageOf(L), s = (L.nose || 1) * A.ns, sy = Math.sin(v.yaw);
  const x = R(L) * sy * 1.12, y = A.ny + v.pitch * 0.2;
  ell(g, x, y, 0.05 * s, 0.04 * s); g.fillStyle = mix(L.skin, '#d06a52', 0.2); g.fill();
  g.strokeStyle = INK; g.lineCap = 'round'; g.lineWidth = LW * 0.8;
  g.beginPath(); g.moveTo(x - 0.04 * s, y + 0.012 * s); g.quadraticCurveTo(x, y + 0.05 * s, x + 0.04 * s, y + 0.012 * s); g.stroke();
  const side = sy >= 0 ? -1 : 1, k = Math.min(1, Math.abs(sy) * 3);
  if (k > 0.05) {
    g.globalAlpha = k; g.beginPath(); g.moveTo(x + side * 0.012 * s, y - 0.12 * s); g.quadraticCurveTo(x + side * 0.05 * s, y - 0.03 * s, x + side * 0.04 * s, y + 0.012 * s); g.stroke(); g.globalAlpha = 1;
  }
  dot(g, x - 0.012 * s, y - 0.012 * s, 0.012 * s); g.fillStyle = 'rgba(255,245,230,0.55)'; g.fill();
}

// serious: closed lips. Smiling: teeth. Talking: an open mouth that moves with the voice
function drawMouth(g, L, v, sleepOpen) {
  const A = ageOf(L), sy = Math.sin(v.yaw), ms = 0.3 + 0.7 * Math.cos(v.yaw);
  const s = v.smile, m = Math.max(v.mouth, sleepOpen), small = L.age === 'kid' ? 0.9 : L.age === 'baby' || L.age === 'toddler' ? 0.75 : 1;
  const mx = R(L) * sy, my = A.my + v.pitch * 0.18;
  const hw = (0.075 + 0.085 * s + 0.02 * m) * ms * small, lift = 0.028 * s - 0.01;
  const gap = clamp((s - 0.38) / 0.4) * 0.062 * small, open = m * 0.17 * small + gap;
  const xl = mx - hw, xr = mx + hw, yc = my - lift;
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (open < 0.012) {
    g.beginPath(); g.moveTo(xl, yc); g.quadraticCurveTo(mx, my + 0.03 * s - 0.006, xr, yc);
    if (L.lips) { g.lineWidth = 0.05; g.strokeStyle = L.lips; g.stroke(); }
    g.lineWidth = 0.024; g.strokeStyle = INK; g.stroke();
    g.globalAlpha = 0.28; g.beginPath(); g.moveTo(mx - hw * 0.35, my + 0.045); g.quadraticCurveTo(mx, my + 0.058, mx + hw * 0.35, my + 0.045);
    g.lineWidth = 0.014; g.stroke(); g.globalAlpha = 1;
  } else {
    const top = my - 0.004 - lift * 0.3 - m * 0.03, bot = my + open;
    g.beginPath(); g.moveTo(xl, yc); g.quadraticCurveTo(mx, 2 * top - yc, xr, yc); g.quadraticCurveTo(mx, 2 * bot - yc, xl, yc); g.closePath();
    g.fillStyle = '#5a1b1d'; g.fill();
    g.save(); g.clip();
    g.fillStyle = '#fbf7ee';
    if (L.age !== 'baby') g.fillRect(xl, top - 0.1, hw * 2, 0.1 + Math.min(0.03 + gap * 0.25, open * 0.5));
    if (gap > 0.03 && L.age !== 'baby') g.fillRect(xl, bot - 0.018 * (gap / 0.062), hw * 2, 0.1);
    if (m > 0.3) { ell(g, mx, bot - 0.004, hw * 0.55, open * 0.32); g.fillStyle = '#c9585a'; g.fill(); }
    g.restore();
    if (L.lips) { g.lineWidth = 0.04; g.strokeStyle = L.lips; g.stroke(); }
    g.lineWidth = 0.024; g.strokeStyle = INK; g.stroke();
  }
  if (s > 0.55) {
    g.globalAlpha = Math.min(0.5, (s - 0.55) * 1.2); g.lineWidth = 0.016; g.strokeStyle = INK;
    for (const k of [-1, 1]) { const cx = mx + k * (hw + 0.018); g.beginPath(); g.moveTo(cx - k * 0.004, yc - 0.03); g.quadraticCurveTo(cx + k * 0.012, yc, cx - k * 0.002, yc + 0.028); g.stroke(); }
    g.globalAlpha = 1;
  }
  return { mx, my, hw, ms };
}

function drawStache(g, L, v, M) {
  const big = L.stache === 'big', w = (big ? 0.21 : 0.15) * M.ms, h = big ? 0.075 : 0.048;
  const x = M.mx, y = M.my - (big ? 0.058 : 0.048) - v.mouth * 0.028 - 0.008 * v.smile, droop = big ? 0.9 : 0.35;
  g.beginPath();
  g.moveTo(x - w, y + h * droop);
  g.quadraticCurveTo(x - w * 0.8, y - h * 0.45, x - w * 0.35, y - h * 0.4);
  g.quadraticCurveTo(x - w * 0.1, y - h * 0.5, x, y - h * 0.18);
  g.quadraticCurveTo(x + w * 0.1, y - h * 0.5, x + w * 0.35, y - h * 0.4);
  g.quadraticCurveTo(x + w * 0.8, y - h * 0.45, x + w, y + h * droop);
  g.quadraticCurveTo(x + w * 0.45, y + h * 0.55, x, y + h * 0.4);
  g.quadraticCurveTo(x - w * 0.45, y + h * 0.55, x - w, y + h * droop);
  g.closePath();
  g.fillStyle = L.hc; g.fill(); g.lineWidth = LW * 0.7; g.strokeStyle = INK; g.stroke();
  g.strokeStyle = shade(L.hc, 0.25); g.lineWidth = 0.008; g.beginPath();
  for (let k = -3; k <= 3; k++) { if (!k) continue; const px = x + (k / 3.4) * w; g.moveTo(px, y - h * 0.2); g.lineTo(px + k * 0.006, y + h * 0.3); }
  g.stroke();
}

function drawGlasses(g, L, v, E1, E2, o) {
  const rx = 0.5 * (L.w || 1), fr = '#8a6a3c';
  g.lineWidth = 0.022; g.strokeStyle = fr;
  for (const E of [E1, E2]) {
    ell(g, E.x, E.y + 0.004, E.ew / E.sc * 1.5 * (0.45 + 0.55 * E.sc), 0.088);
    g.fillStyle = 'rgba(215,232,242,0.16)'; g.fill(); g.stroke();
    g.save(); g.clip();
    g.beginPath(); g.moveTo(E.x - 0.08, E.y + 0.03); g.lineTo(E.x + 0.02, E.y - 0.09);
    g.lineWidth = 0.035; g.strokeStyle = `rgba(255,255,255,${o.flash ? 0.75 : 0.32})`; g.stroke();
    g.restore();
    g.lineWidth = 0.022; g.strokeStyle = fr;
  }
  const [l, r] = E1.x < E2.x ? [E1, E2] : [E2, E1];
  const lw = l.ew / l.sc * 1.5 * (0.45 + 0.55 * l.sc), rw = r.ew / r.sc * 1.5 * (0.45 + 0.55 * r.sc);
  g.beginPath(); g.moveTo(l.x + lw, l.y - 0.01); g.quadraticCurveTo((l.x + r.x) / 2, l.y - 0.04, r.x - rw, r.y - 0.01);
  g.moveTo(l.x - lw, l.y - 0.01); g.lineTo(-rx * 0.98, l.y + 0.02);
  g.moveTo(r.x + rw, r.y - 0.01); g.lineTo(rx * 0.98, r.y + 0.02);
  g.stroke();
}

// all the features, in the order they overlap
export function drawFace(g, L, v, o) {
  const sy = Math.sin(v.yaw), A = ageOf(L);
  const blush = (L.blush || 1) * (L.age === 'kid' || L.age === 'baby' || L.age === 'toddler' ? 0.3 : 0.17) + 0.08 * v.smile;
  for (const side of [-1, 1]) {
    const a = v.yaw + side * 0.66, sc = 0.4 + 0.6 * Math.cos(a);
    ell(g, R(L) * Math.sin(a), 0.19 - 0.02 * v.smile + v.pitch * 0.2 + (A.ey + 0.02), 0.08 * sc, 0.052);
    g.fillStyle = `rgba(232,104,92,${blush})`; g.fill();
  }
  if (L.freckles) {
    g.fillStyle = shade(L.skin, -0.32); g.globalAlpha = 0.55;
    for (const [lx, ly] of [[-0.5, 0.12], [-0.38, 0.16], [-0.46, 0.2], [-0.3, 0.1], [0.5, 0.12], [0.38, 0.16], [0.46, 0.2], [0.3, 0.1]]) {
      const a = v.yaw + lx * 1.1; dot(g, R(L) * Math.sin(a), ly + A.ey + v.pitch * 0.2, 0.008);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  const E1 = drawEye(g, L, v, o, -1), E2 = drawEye(g, L, v, o, 1);
  eyeFrame(g, L, v, E1); eyeFrame(g, L, v, E2);
  drawNose(g, L, v);
  const sleepOpen = L.old && v.sleep > 0.5 ? (v.sleep - 0.5) * 0.3 : 0;
  const M = drawMouth(g, L, v, sleepOpen);
  if (L.stache) drawStache(g, L, v, M);
  if (L.glasses) drawGlasses(g, L, v, E1, E2, o);
  return { E1, E2, M };
}
