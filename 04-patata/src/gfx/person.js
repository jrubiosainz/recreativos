// One person in the photo, put together: hair and veil behind, then the body, then the head, which
// turns, tilts and nods on its own. Nobody stands still: they sway a little, breathe, lean their head
// towards the group when they pose, talk with their hands, fan themselves, nod off. "You" runs in from
// the right after setting the timer, skids into place, and stands there out of breath.
import { INK, LW, TAU, clamp, lerp, mix, shade, ell, dot, smooth, limb } from './ink.js';
import { damp, noise1, hashStr, ease } from '../util.js';
import { drawEars, drawSkull, drawFace, ageOf } from './face.js';
import { drawHairBack, drawHairFront } from './hair.js';
import { drawHatBack, drawHatFront } from './hats.js';
import { drawBody, drawArmsFront, levels } from './body.js';

const fillInk = (g, c, lw = LW) => { g.fillStyle = c; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); };

// per-person animation state, smoothed from the sim's instantaneous view
export function animState(st, L, v, t, dt) {
  if (!st.init) { Object.assign(st, { init: 1, phone: v.phone ? 1 : 0, gest: 0, fan: v.att === 'pose' ? 0 : 1, pose: v.att === 'pose' ? 1 : 0, run: 0, rph: 0, arrive: -9, left: -9, ph: (hashStr(L.id) % 1000) / 159 }); }
  st.phone = damp(st.phone, v.phone ? 1 : 0, 7, dt);
  st.gest = damp(st.gest, v.talk && v.att !== 'pose' ? 1 : 0, v.talk ? 5 : 3, dt);
  st.fan = damp(st.fan, v.att === 'pose' ? 0 : 1, 5, dt);
  st.pose = damp(st.pose, v.att === 'pose' ? 1 : 0, 6, dt);
  const r = v.run, running = r && (r.dir > 0 ? r.k < 1 : r.k > 0);
  st.run = damp(st.run, running ? 1 : 0, running ? 10 : 7, dt);
  st.rph += dt * 15 * st.run;
  if (r && r.dir > 0 && r.k >= 1 && st.arrive < st.left) st.arrive = t;
  if (r && r.dir < 0) st.left = t;
  return st;
}
// where the whole figure is and how it leans, in its own head units
function pose(L, v, o, st, D) {
  const t = o.t, ph = st.ph, posing = st.pose;
  let dx = 0, dy = 0, lean = 0;
  if (v.run) {
    const span = ((1.25 - v.x) * o.W) / D, { k, dir } = v.run;
    dx = dir > 0 ? (1 - ease.outCubic(k)) * span : ease.inCubic(k) * span;
    dy = -Math.abs(Math.sin(st.rph)) * 0.08 * st.run;
    lean = -Math.sign(dir) * 0.1 * st.run;
  }
  const since = t - st.arrive, settle = since > 0 && since < 2 ? Math.exp(-6 * since) : 0;
  dy += -0.04 * Math.sin(since * 14) * settle;
  lean += 0.05 * settle * Math.cos(since * 11);
  const pant = since > 0 && since < 6 ? Math.exp(-since / 1.6) : 0;
  const breath = Math.sin(t * (1.7 + 4 * pant) + ph) * (0.006 + 0.022 * pant);
  const sway = noise1(t * 0.35 + ph * 10, 3) * lerp(0.025, 0.012, posing) + lean;
  const towards = clamp((0.5 - v.x) * 4, -1, 1);
  const tilt = noise1(t * 0.3 + ph * 7, 5) * 0.05 + 0.06 * posing * towards + 0.18 * (v.sleep || 0) + (v.quiver || 0) * Math.sin(t * 31) * 0.006;
  const nod = Math.sin(t * 9 + ph) * 0.012 * (v.mouth || 0) + 0.05 * (v.sleep || 0);
  return { dx, dy, sway, breath, tilt, nod };
}
function head(g, L, v, o, P, back) {
  g.translate(0, 0.45 - P.breath + P.nod); g.rotate(P.tilt); g.translate(0, -0.45);
  const hv = v.sleep ? { ...v, pitch: v.pitch + 0.25 * v.sleep } : v;
  if (back) { drawHairBack(g, L, hv, o.t); drawHatBack(g, L, hv, o.t); return; }
  drawEars(g, L, hv.yaw); drawSkull(g, L, hv.yaw);
  const F = drawFace(g, L, hv, o);
  drawHairFront(g, L, hv); drawHatFront(g, L, hv, o.t);
  return F;
}
function place(g, X, Y, D, P, lv) {
  g.translate(X, Y); g.scale(D, D); g.translate(P.dx, P.dy);
  g.translate(0, lv.yH); g.rotate(P.sway); g.translate(0, -lv.yH);
}
export function drawPerson(g, L, v, X, Y, D, o) {
  if (!v.present && L.id === 'you') return null;
  if (L.dog) return drawDog(g, L, v, X, Y, D, o);
  if (L.body === 'baby') return drawBaby(g, L, v, X, Y, D, o);
  if (L.body === 'toddler') return drawToddler(g, L, v, X, Y, D, o);
  const st = animState(o.st, L, v, o.t, o.dt), P = pose(L, v, o, st, D), lv = levels(L, o.G);
  const oo = { ...o, st, ph: st.ph, rph: st.rph, gs: st.ph > 3 ? 1 : -1 };
  st.P = P; st.lv = lv;
  g.save(); place(g, X, Y, D, P, lv);
  g.save(); head(g, L, v, oo, P, true); g.restore();
  g.save(); g.translate(0, -P.breath * 0.5); drawBody(g, L, v, oo, lv); g.restore();
  g.save(); const F = head(g, L, v, oo, P, false); g.restore();
  g.restore();
  return F;
}
// the forearms of someone carrying a baby, a toddler or a dog, drawn over what they carry
export function drawHolderFront(g, L, v, X, Y, D, o) {
  const st = o.st; if (!st.P) return;
  g.save(); place(g, X, Y, D, st.P, st.lv); g.translate(0, -st.P.breath * 0.5);
  drawArmsFront(g, L, v, { ...o, st, ph: st.ph, rph: st.rph }, st.lv);
  g.restore();
}
function babyHead(g, L, v, o, rot) {
  g.save(); g.rotate(rot);
  drawHatBack(g, L, v, o.t);
  if (L.hat !== 'bonnet') drawEars(g, L, v.yaw);
  drawSkull(g, L, v.yaw);
  const F = drawFace(g, L, v, o);
  drawHairFront(g, L, v); drawHatFront(g, L, v, o.t);
  g.restore();
  return F;
}
// a baby in a christening gown, lying across the chest of whoever holds it; head towards o.side
export function drawBaby(g, L, v, X, Y, D, o) {
  const st = animState(o.st, L, v, o.t, o.dt), side = o.side || 1, s = -side, t = o.t, W = '#fbf7f0';
  const wig = Math.sin(t * 1.3 + st.ph) * 0.03;
  g.save(); g.translate(X, Y); g.scale(D, D);
  smooth(g, [[s * 0.2, 0.6], [s * 0.9, 0.56], [s * 1.5, 0.62], [s * 1.6, 1.1], [s * 1.52 + wig, 1.66], [s * 0.95, 1.76], [s * 0.38 + wig, 1.7], [s * 0.26, 1.1]]);
  fillInk(g, W);
  g.save(); g.clip();
  g.fillStyle = 'rgba(200,185,160,0.5)'; for (let i = 0; i < 14; i++) { dot(g, s * (0.4 + i * 0.08), 1.44 + (i % 2) * 0.05, 0.022); g.fill(); }
  g.strokeStyle = 'rgba(160,140,120,0.35)'; g.lineWidth = 0.02; g.beginPath();
  for (const k of [0.55, 0.85, 1.2]) { g.moveTo(s * k, 0.75); g.quadraticCurveTo(s * (k + 0.05), 1.2, s * (k + wig), 1.7); }
  g.stroke(); g.restore();
  for (let i = 0; i < 9; i++) { const x = s * (0.42 + i * 0.13) + wig; dot(g, x, 1.72 + Math.sin(i) * 0.02, 0.07); fillInk(g, '#fffdf9', LW * 0.5); }
  ell(g, s * 0.74, 0.44, 0.7, 0.36, s * 0.08); fillInk(g, W);
  g.save(); g.clip(); g.fillStyle = 'rgba(150,130,110,0.18)'; ell(g, s * 0.8, 0.62, 0.7, 0.2); g.fill(); g.restore();
  ell(g, s * 0.5, 0.3, 0.1, 0.06, 0.3); fillInk(g, '#bcd6ee', LW * 0.5); ell(g, s * 0.66, 0.3, 0.1, 0.06, -0.3); fillInk(g, '#bcd6ee', LW * 0.5);
  const fist = 0.02 * Math.sin(t * 2.2 + st.ph);
  dot(g, s * 0.34, 0.46 + fist, 0.085); fillInk(g, L.skin, LW * 0.7);
  const F = babyHead(g, L, v, o, side * 0.55);
  dot(g, s * 0.16, 0.56 - fist, 0.08); fillInk(g, L.skin, LW * 0.7);
  g.restore();
  return F;
}
// a toddler sitting on a hip in a yellow romper and a sun hat, kicking its legs, waving at the camera
export function drawToddler(g, L, v, X, Y, D, o) {
  const st = animState(o.st, L, v, o.t, o.dt), side = o.side || 1, t = o.t, c = L.top.c || '#f2d64a', posing = st.pose;
  g.save(); g.translate(X, Y); g.scale(D, D);
  for (const k of [-1, 1]) {
    const kick = Math.sin(t * 2.4 + k * 1.3 + st.ph) * 0.09 * (1 - posing);
    const hip = [k * 0.2, 1.15], foot = [k * 0.26 + kick, 1.86];
    limb(g, hip, [k * 0.3, 1.5], foot, 0.2, c, L.skin, 0.3);
    g.beginPath(); g.rect(foot[0] - 0.08, foot[1] - 0.08, 0.16, 0.08); fillInk(g, '#f8f6f0', LW * 0.5);
    ell(g, foot[0], foot[1] + 0.03, 0.11, 0.06); fillInk(g, '#d8483a', LW * 0.6);
  }
  const wave = (1 - posing) * (v.pigeon ? 0.3 : 1);
  limb(g, [-side * 0.34, 0.6], [-side * 0.6, 0.62], [-side * 0.72, 0.4], 0.16, '#f8f6f0', L.skin, 0.35);
  smooth(g, [[-0.38, 0.5], [0.38, 0.5], [0.46, 0.9], [0.5, 1.2], [0.3, 1.32], [0, 1.34], [-0.3, 1.32], [-0.5, 1.2], [-0.46, 0.9]]);
  fillInk(g, '#f8f6f0');
  g.beginPath(); g.moveTo(-0.34, 0.8); g.lineTo(-0.3, 0.62); g.lineTo(-0.2, 0.62); g.lineTo(-0.16, 0.8); g.lineTo(0.16, 0.8); g.lineTo(0.2, 0.62); g.lineTo(0.3, 0.62); g.lineTo(0.34, 0.8);
  g.quadraticCurveTo(0.5, 1.0, 0.48, 1.22); g.quadraticCurveTo(0, 1.4, -0.48, 1.22); g.quadraticCurveTo(-0.5, 1.0, -0.34, 0.8); g.closePath();
  g.fillStyle = c; g.fill(); g.fillStyle = 'rgba(52,22,10,0.12)'; ell(g, 0.3, 1.1, 0.25, 0.25); g.fill();
  g.beginPath(); g.moveTo(-0.34, 0.8); g.lineTo(-0.3, 0.62); g.lineTo(-0.2, 0.62); g.lineTo(-0.16, 0.8); g.lineTo(0.16, 0.8); g.lineTo(0.2, 0.62); g.lineTo(0.3, 0.62); g.lineTo(0.34, 0.8);
  g.quadraticCurveTo(0.5, 1.0, 0.48, 1.22); g.quadraticCurveTo(0, 1.4, -0.48, 1.22); g.quadraticCurveTo(-0.5, 1.0, -0.34, 0.8);
  g.lineWidth = LW; g.strokeStyle = INK; g.stroke();
  for (const k of [-1, 1]) { dot(g, k * 0.25, 0.68, 0.03); fillInk(g, '#f8f6f0', LW * 0.4); }
  ell(g, 0, 1.0, 0.12, 0.08); fillInk(g, shade(c, -0.08), LW * 0.5);
  const hb = wave > 0.05 ? [side * 0.62, 0.18 + Math.sin(t * 8) * 0.06 * wave] : [side * 0.3, 1.02];
  const hc = wave > 0.05 ? [side * 0.72, 0.55] : [side * 0.52, 0.9];
  const pt = v.pigeon ? [side * 0.5, -0.3] : null;
  const b = pt ? [lerp(hb[0], pt[0], 0.6), lerp(hb[1], pt[1], 0.6)] : [lerp(side * 0.3, hb[0], wave), lerp(1.02, hb[1], wave)];
  limb(g, [side * 0.36, 0.6], hc, b, 0.16, '#f8f6f0', L.skin, 0.35);
  dot(g, b[0], b[1], 0.075); fillInk(g, L.skin, LW * 0.7);
  g.save(); const F = (() => { drawEars(g, L, v.yaw); drawSkull(g, L, v.yaw); const f = drawFace(g, L, v, o); drawHairFront(g, L, v); drawHatFront(g, L, v, t); return f; })(); g.restore();
  g.restore();
  return F;
}

// fluffy outline: bumps round an ellipse
function fluff(g, x, y, rx, ry, n, r, seed = 0) {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, j = 1 + 0.08 * Math.sin(i * 2.7 + seed), px = x + Math.cos(a) * rx * j, py = y + Math.sin(a) * ry * j;
    const a2 = ((i - 0.5) / n) * TAU, cx = x + Math.cos(a2) * (rx + r), cy = y + Math.sin(a2) * (ry + r);
    i ? g.quadraticCurveTo(cx, cy, px, py) : g.moveTo(px, py);
  }
  g.closePath();
}
// Bolita: a white bichon carried in someone's arms. She looks where the pigeons are, pants in the heat,
// and when she blinks her furry lids come down
export function drawDog(g, L, v, X, Y, D, o) {
  const st = animState(o.st, L, v, o.t, o.dt), side = o.side || 1, t = o.t, fur = L.fur, fur2 = L.fur2;
  const d = Math.sin(v.yaw) * 0.14, look = v.gy < -0.3 ? 1 : 0;
  st.cock = damp(st.cock || 0, look ? side * 0.28 : Math.sin(t * 0.7 + st.ph) * 0.05, 4, o.dt || 0.016);
  g.save(); g.translate(X, Y); g.scale(D, D);
  fluff(g, -side * 0.12, 0.8, 0.62, 0.5, 16, 0.07, 1); fillInk(g, fur);
  g.save(); g.clip(); ell(g, -side * 0.3, 1.0, 0.5, 0.3); g.fillStyle = shade(fur2, -0.06); g.globalAlpha = 0.6; g.fill(); g.restore();
  g.save(); g.translate(0, 0.35); g.rotate(st.cock); g.translate(0, -0.35);
  const flop = Math.sin(t * 3.1 + st.ph) * 0.06;
  for (const s of [-1, 1]) {
    g.save(); g.translate(s * 0.4 + d * 0.5, -0.12); g.rotate(s * (0.22 + flop));
    fluff(g, 0, 0.26, 0.15, 0.3, 9, 0.05, s); fillInk(g, fur2); g.restore();
  }
  fluff(g, d * 0.3, 0, 0.47, 0.44, 18, 0.06, 2); fillInk(g, fur);
  g.save(); g.clip(); ell(g, 0.2, 0.25, 0.4, 0.3); g.fillStyle = fur2; g.globalAlpha = 0.45; g.fill(); g.restore();
  fluff(g, d * 0.3 - 0.05, -0.36, 0.2, 0.1, 8, 0.04, 3); g.fillStyle = mix(fur, '#ffffff', 0.4); g.fill();
  ell(g, d, 0.2, 0.25, 0.17); g.fillStyle = mix(fur, '#ffffff', 0.5); g.fill();
  const ap = clamp(v.ap), ex = v.gx * 0.03, ey = v.gy * 0.02;
  for (const s of [-1, 1]) {
    const x = s * 0.17 + d, y = -0.04;
    dot(g, x, y, 0.082); g.fillStyle = '#f6f2ea'; g.fill();
    dot(g, x + ex * 1.2, y + ey, 0.068); g.fillStyle = '#1c1310'; g.fill();
    dot(g, x + ex - 0.022, y + ey - 0.024, 0.02); g.fillStyle = '#ffffff'; g.fill();
    if (ap < 0.98) {
      g.save(); dot(g, x, y, 0.09); g.clip();
      g.fillStyle = fur2; g.fillRect(x - 0.1, y - 0.1, 0.2, 0.2 * (1 - ap));
      g.beginPath(); g.moveTo(x - 0.1, y - 0.1 + 0.2 * (1 - ap)); g.lineTo(x + 0.1, y - 0.1 + 0.2 * (1 - ap)); g.lineWidth = LW * 0.7; g.strokeStyle = INK; g.stroke();
      g.restore();
    }
    dot(g, x, y, 0.084); g.lineWidth = LW * 0.6; g.strokeStyle = INK; g.stroke();
  }
  const pant = (1 - st.pose * 0.7) * (0.5 + 0.5 * Math.sin(t * 7.5)) + (v.mouth || 0);
  if (pant > 0.25) {
    ell(g, d, 0.34 + 0.05 * pant, 0.07, 0.07 + 0.05 * pant); fillInk(g, '#f07f94', LW * 0.6);
    g.beginPath(); g.moveTo(d, 0.3); g.lineTo(d, 0.36 + 0.07 * pant); g.lineWidth = 0.01; g.strokeStyle = '#c95a72'; g.stroke();
  }
  g.beginPath(); g.moveTo(d - 0.1, 0.25); g.quadraticCurveTo(d - 0.05, 0.3, d, 0.22); g.quadraticCurveTo(d + 0.05, 0.3, d + 0.1, 0.25);
  g.lineWidth = LW * 0.7; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.moveTo(d - 0.075, 0.1); g.quadraticCurveTo(d, 0.07, d + 0.075, 0.1); g.quadraticCurveTo(d + 0.06, 0.19, d, 0.2); g.quadraticCurveTo(d - 0.06, 0.19, d - 0.075, 0.1); g.closePath();
  g.fillStyle = L.nose; g.fill(); ell(g, d - 0.02, 0.11, 0.025, 0.012); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fill();
  g.restore(); g.restore();
  return null;
}
