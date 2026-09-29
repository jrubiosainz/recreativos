// Drawing of a PersonView (see person.js). All drawing happens in "head radius" units with the
// origin at the base of the neck; the caller provides the screen position and radius in pixels.
import { TAU, clamp, lerp, smooth, mix, shade, rgba, ellipse, roundRect } from './util.js';

const HALF_PI = Math.PI / 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const DARK = '#2a1e2a';
const MOUTH_IN = '#3d1622';
const TONGUE = '#d9707a';

// Colors toned towards the room fog for depth; computed once per level.
export function toneLook(L, fog, k) {
  if (!k) return L;
  const t = {};
  for (const key in L) {
    const val = L[key];
    t[key] = typeof val === 'string' && val[0] === '#' && val.length === 7 ? mix(val, fog, k) : val;
  }
  return t;
}

// ---------------------------------------------------------------- hair
const HAIRLINE = {
  short: { hl: -0.5, side: 0.02, nape: 0.55, vol: 1.05 },
  side: { hl: -0.46, side: 0.02, nape: 0.55, vol: 1.06, part: 0.18 },
  quiff: { hl: -0.54, side: 0.0, nape: 0.5, vol: 1.05 },
  messy: { hl: -0.4, side: 0.08, nape: 0.6, vol: 1.08 },
  spiky: { hl: -0.5, side: 0.0, nape: 0.5, vol: 1.04 },
  buzz: { hl: -0.56, side: 0.08, nape: 0.5, vol: 1.01 },
  bob: { hl: -0.3, side: 0.58, nape: 0.62, vol: 1.12 },
  long: { hl: -0.52, side: 0.62, nape: 0.8, vol: 1.08, center: true },
  bun: { hl: -0.56, side: 0.06, nape: 0.45, vol: 1.03 },
  ponytail: { hl: -0.55, side: 0.06, nape: 0.45, vol: 1.03 },
  curly: { hl: -0.44, side: 0.2, nape: 0.6, vol: 1.14 },
  afro: { hl: -0.42, side: 0.24, nape: 0.62, vol: 1.1 },
  bald: null,
};

function hairY(style, u, H) {
  const au = Math.abs(u);
  if (au >= HALF_PI) return H.nape + 0.14 * (au - HALF_PI) / HALF_PI;
  const k = au / HALF_PI;
  let y = H.hl + (H.side - H.hl) * Math.pow(k, 2.4);
  if (H.part) y += H.part * clamp(u * 0.9, -0.4, 0.4);
  if (H.center) y -= 0.1 * Math.max(0, 1 - au * 3);
  if (style === 'bob' || style === 'messy') y += Math.sin(u * 9) * 0.03;
  return y;
}

// geometry shared by the passes
export function headGeom(v, L) {
  const st = clamp(v.stretch.x, 0.85, 1.25);
  const mo = clamp(v.mouth.x, 0, 1.4);
  const rx = L.headW / Math.sqrt(st);
  const ryT = L.headH * st;
  const ryB = L.headH * st + mo * 0.24;
  const pitch = clamp(v.pitch.x, -0.85, 0.85);
  const yaw = v.yaw.x;
  const roll = v.roll.x;
  const hx = Math.sin(v.bodyYaw.x) * 0.25;
  const hy = -1.22 + v.lift.x - v.shoulder.x * 0.8;
  const fy = (y) => y * (1 - Math.abs(pitch) * 0.22) - pitch * 0.82;
  return { st, mo, rx, ryT, ryB, pitch, yaw, roll, hx, hy, fy };
}

// head-local point -> body-local point
export function headToBody(G, x, y) {
  const c = Math.cos(G.roll), s = Math.sin(G.roll);
  // rotate around the neck base (0,0)
  const px = G.hx + x, py = G.hy + y;
  return { x: px * c - py * s, y: px * s + py * c };
}

export function headPath(g, rx, ryT, ryB) {
  g.beginPath();
  g.ellipse(0, 0, rx, ryT, 0, Math.PI, TAU);
  g.ellipse(0, 0, rx * 0.97, ryB, 0, 0, Math.PI);
  g.closePath();
}

// ---------------------------------------------------------------- chair
export function drawChair(g, v, x, y, R, tint) {
  const L = v.look, sh = L.shoulders;
  g.save(); g.translate(x, y); g.scale(R, R);
  const w = sh + 0.28;
  g.fillStyle = tint || '#3a3f4a';
  roundRect(g, -w, -0.55, w * 2, 2.9, 0.55); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(g, -w + 0.18, -0.42, w * 2 - 0.36, 0.35, 0.18); g.fill();
  g.restore();
}

// ---------------------------------------------------------------- body pass
export function drawBody(g, v, x, y, R, opt = {}) {
  const L = opt.look || v.look;
  const G = headGeom(v, L);
  g.save();
  g.translate(x, y); g.scale(R, R);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const by = -v.shoulder.x * 0.5;
  const bx = Math.sin(v.bodyYaw.x) * 0.42;

  // hair falling behind the shoulders / hood
  drawBackLayer(g, v, L, G);
  if (L.topKind === 'hoodie') {
    g.fillStyle = L.topDark;
    ellipse(g, bx * 0.5, 0.1 + by, 0.95, 0.42); g.fill();
  }

  // torso
  const sh = L.shoulders * (0.9 + 0.1 * Math.cos(v.bodyYaw.x));
  g.fillStyle = L.top;
  g.beginPath();
  g.moveTo(-0.34 + bx * 0.4, by);
  g.quadraticCurveTo(-sh + 0.05, 0.02 + by, -sh, 0.55 + by);
  g.lineTo(-sh - 0.12, 3.2);
  g.lineTo(sh + 0.12, 3.2);
  g.lineTo(sh, 0.55 + by);
  g.quadraticCurveTo(sh - 0.05, 0.02 + by, 0.34 + bx * 0.4, by);
  g.closePath(); g.fill();
  // side shade
  g.fillStyle = rgba(L.topDark, 0.55);
  g.beginPath();
  const sd = bx > 0 ? -1 : 1;
  g.moveTo(sd * sh, 0.55 + by); g.lineTo(sd * (sh + 0.12), 3.2); g.lineTo(sd * (sh - 0.32), 3.2); g.quadraticCurveTo(sd * (sh - 0.3), 1.2, sd * (sh - 0.05), 0.5 + by);
  g.closePath(); g.fill();

  if (Math.cos(v.bodyYaw.x) > -0.1) drawCollar(g, v, L, bx, by);
  else {
    g.fillStyle = L.topKind === 'suit' ? L.topDark : rgba(L.topDark, 0.8);
    g.beginPath(); g.ellipse(0, by + 0.02, 0.46, 0.2, 0, 0, Math.PI); g.fill();
    if (L.topKind === 'suit') { g.strokeStyle = rgba(L.topDark, 0.9); g.lineWidth = 0.05; g.beginPath(); g.moveTo(0, 0.3 + by); g.lineTo(0, 3.2); g.stroke(); }
  }

  // neck
  g.fillStyle = L.skinDark;
  const nb = headToBody(G, 0, 0.55);
  g.beginPath();
  g.moveTo(-0.27 + bx * 0.35, 0.12 + by);
  g.lineTo(nb.x - 0.25, nb.y); g.lineTo(nb.x + 0.25, nb.y);
  g.lineTo(0.27 + bx * 0.35, 0.12 + by);
  g.closePath(); g.fill();
  g.fillStyle = rgba(DARK, 0.18);
  ellipse(g, bx * 0.35, 0.06 + by, 0.3, 0.1); g.fill();

  drawHead(g, v, L, G, opt);
  g.restore();
}

function drawBackLayer(g, v, L, G) {
  const s = L.hairStyle;
  if (!['long', 'bob', 'afro', 'bun', 'ponytail', 'curly'].includes(s)) return;
  g.save();
  g.translate(G.hx, G.hy); g.rotate(G.roll); g.translate(-G.hx, -G.hy);
  g.fillStyle = L.hairDark;
  const cx = G.hx + Math.sin(G.yaw) * 0.08, cy = G.hy;
  const lag = v.hairLag.x;
  if (s === 'long') {
    g.beginPath();
    g.moveTo(cx - G.rx * 1.02, cy - 0.3);
    g.bezierCurveTo(cx - G.rx * 1.25, cy + 0.8, cx - 1.25 + lag, cy + 1.55, cx - 1.05 + lag, cy + 2.0);
    g.lineTo(cx + 1.05 + lag, cy + 2.0);
    g.bezierCurveTo(cx + 1.25 + lag, cy + 1.55, cx + G.rx * 1.25, cy + 0.8, cx + G.rx * 1.02, cy - 0.3);
    g.closePath(); g.fill();
  } else if (s === 'bob') {
    roundRect(g, cx - G.rx * 1.18, cy - 0.7, G.rx * 2.36, 1.55, 0.55); g.fill();
  } else if (s === 'afro') {
    ellipse(g, cx, cy - 0.3, G.rx * 1.42, 1.3); g.fill();
  } else if (s === 'curly') {
    for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; ellipse(g, cx + Math.cos(a) * G.rx * 1.02, cy + Math.sin(a) * 0.98 + 0.12, 0.3, 0.3); g.fill(); }
  } else {
    // bun / ponytail visible behind the head when facing us
    const th = Math.PI + G.yaw, c = Math.cos(th);
    if (c < 0.25) {
      const bx = Math.sin(th) * G.rx * 0.75;
      if (s === 'bun') { ellipse(g, cx + bx, cy - 0.95 + G.pitch * 0.2, 0.42, 0.4); g.fill(); }
      else {
        g.beginPath(); g.moveTo(cx + bx - 0.22, cy - 0.55);
        g.quadraticCurveTo(cx + bx - 0.45 + lag, cy + 0.6, cx + bx + lag * 2, cy + 1.25);
        g.quadraticCurveTo(cx + bx + 0.4 + lag, cy + 0.6, cx + bx + 0.22, cy - 0.55); g.fill();
      }
    }
  }
  g.restore();
}

function drawCollar(g, v, L, bx, by) {
  const k = L.topKind, cx = bx * 0.5;
  g.save(); g.translate(cx, by);
  switch (k) {
    case 'suit': {
      g.fillStyle = L.shirt;
      g.beginPath(); g.moveTo(-0.36, 0); g.lineTo(0.36, 0); g.lineTo(0.06, 1.35); g.lineTo(-0.06, 1.35); g.closePath(); g.fill();
      g.fillStyle = L.topDark;
      g.beginPath(); g.moveTo(-0.36, 0); g.lineTo(-0.62, 0.15); g.lineTo(-0.3, 0.75); g.lineTo(-0.44, 0.95); g.lineTo(-0.08, 1.5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0.36, 0); g.lineTo(0.62, 0.15); g.lineTo(0.3, 0.75); g.lineTo(0.44, 0.95); g.lineTo(0.08, 1.5); g.closePath(); g.fill();
      break;
    }
    case 'shirt': case 'polo': {
      g.fillStyle = k === 'shirt' ? L.shirt : L.topLight;
      if (k === 'shirt') { g.fillStyle = L.top; }
      g.fillStyle = L.topLight;
      g.beginPath(); g.moveTo(-0.38, -0.02); g.lineTo(-0.02, 0.28); g.lineTo(-0.3, 0.42); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0.38, -0.02); g.lineTo(0.02, 0.28); g.lineTo(0.3, 0.42); g.closePath(); g.fill();
      g.strokeStyle = rgba(L.topDark, 0.7); g.lineWidth = 0.035;
      g.beginPath(); g.moveTo(0, 0.3); g.lineTo(0, k === 'polo' ? 0.8 : 2.4); g.stroke();
      g.fillStyle = L.topDark;
      for (let i = 0; i < (k === 'polo' ? 2 : 4); i++) { ellipse(g, 0.07, 0.5 + i * 0.36, 0.035, 0.035); g.fill(); }
      break;
    }
    case 'sweater': {
      g.strokeStyle = L.topDark; g.lineWidth = 0.14;
      g.beginPath(); g.ellipse(0, -0.02, 0.4, 0.26, 0, 0.1, Math.PI - 0.1); g.stroke();
      g.fillStyle = '#f1ede4';
      g.beginPath(); g.moveTo(-0.3, 0.08); g.lineTo(-0.04, 0.32); g.lineTo(-0.2, 0.36); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0.3, 0.08); g.lineTo(0.04, 0.32); g.lineTo(0.2, 0.36); g.closePath(); g.fill();
      break;
    }
    case 'hoodie': {
      g.strokeStyle = L.topDark; g.lineWidth = 0.12;
      g.beginPath(); g.ellipse(0, 0, 0.44, 0.3, 0, 0.05, Math.PI - 0.05); g.stroke();
      g.strokeStyle = '#efe9dc'; g.lineWidth = 0.04;
      g.beginPath(); g.moveTo(-0.14, 0.28); g.lineTo(-0.17, 0.95); g.moveTo(0.14, 0.28); g.lineTo(0.18, 0.9); g.stroke();
      break;
    }
    case 'blouse': {
      g.fillStyle = L.skinDark;
      g.beginPath(); g.moveTo(-0.36, -0.02); g.lineTo(0.36, -0.02); g.lineTo(0, 0.62); g.closePath(); g.fill();
      g.strokeStyle = L.topLight; g.lineWidth = 0.07;
      g.beginPath(); g.moveTo(-0.38, 0); g.lineTo(0, 0.66); g.lineTo(0.38, 0); g.stroke();
      break;
    }
    default: {
      g.strokeStyle = L.topDark; g.lineWidth = 0.08;
      g.beginPath(); g.ellipse(0, -0.02, 0.36, 0.22, 0, 0.1, Math.PI - 0.1); g.stroke();
    }
  }
  if (L.tie) {
    g.fillStyle = L.tie;
    g.beginPath(); g.moveTo(-0.1, 0.22); g.lineTo(0.1, 0.22); g.lineTo(0.07, 0.38); g.lineTo(-0.07, 0.38); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-0.07, 0.38); g.lineTo(0.07, 0.38); g.lineTo(0.15, 1.35); g.lineTo(0, 1.52); g.lineTo(-0.15, 1.35); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath(); g.moveTo(-0.03, 0.5); g.lineTo(0.02, 0.5); g.lineTo(0.08, 1.3); g.lineTo(0.02, 1.36); g.closePath(); g.fill();
  }
  if (L.lanyard) {
    g.strokeStyle = L.lanyard; g.lineWidth = 0.06;
    g.beginPath(); g.moveTo(-0.3, 0.05); g.quadraticCurveTo(-0.22, 0.8, 0.02, 1.15); g.moveTo(0.3, 0.05); g.quadraticCurveTo(0.26, 0.8, 0.06, 1.15); g.stroke();
    g.fillStyle = '#f7f4ec';
    roundRect(g, -0.2, 1.1, 0.46, 0.56, 0.06); g.fill();
    g.fillStyle = L.lanyard;
    roundRect(g, -0.2, 1.1, 0.46, 0.15, 0.05); g.fill();
    g.fillStyle = 'rgba(40,40,50,0.35)';
    g.fillRect(-0.12, 1.34, 0.3, 0.05); g.fillRect(-0.12, 1.44, 0.22, 0.05);
  }
  g.restore();
}

// ---------------------------------------------------------------- head
function drawHead(g, v, L, G, opt) {
  const { rx, ryT, ryB, yaw } = G;
  g.save();
  g.rotate(G.roll);
  g.translate(G.hx, G.hy);
  const proj = (u) => { const th = wrap(u + yaw); return { x: Math.sin(th), c: Math.cos(th) }; };

  drawEars(g, L, G, proj, false);
  if (L.hairStyle === 'bald') drawBaldSides(g, L, G, proj, false);
  const grad = g.createRadialGradient(Math.sin(yaw) * rx * 0.3, -0.35, 0.05, 0, 0, 1.3);
  grad.addColorStop(0, L.skinLight); grad.addColorStop(0.6, L.skin); grad.addColorStop(1, L.skinDark);
  g.fillStyle = grad;
  headPath(g, rx, ryT, ryB); g.fill();
  if (L.hairStyle === 'bald') drawBaldSides(g, L, G, proj, true);
  drawEars(g, L, G, proj, true);

  const facing = Math.cos(yaw) > -0.2;
  if (facing) drawFace(g, v, L, G, proj, opt);
  drawHairCap(g, v, L, G, proj);
  if (facing) drawBrows(g, v, L, G, proj);
  if (opt.overlay) opt.overlay(g, G);
  g.restore();
}

function drawEars(g, L, G, proj, front) {
  for (const s of [-1, 1]) {
    const e = proj(s * HALF_PI);
    if (e.c < -0.35) continue;
    const isFront = e.c > 0.3;
    if (isFront !== front) continue;
    const ex = e.x * G.rx * (front ? 0.86 : 1.0), ey = G.fy(0.1);
    const w = front ? 0.1 + 0.05 * e.c : 0.15;
    g.fillStyle = front ? L.skin : L.skinDark;
    ellipse(g, ex, ey, w, 0.22); g.fill();
    g.strokeStyle = L.skinDeep; g.lineWidth = 0.035;
    g.beginPath(); g.ellipse(ex + (front ? 0.01 : e.x * 0.03), ey + 0.01, w * 0.5, 0.12, 0, -HALF_PI, HALF_PI, e.x > 0); g.stroke();
    if (L.earring && e.c > -0.2) { g.fillStyle = '#e8c35a'; ellipse(g, ex, ey + 0.26, 0.05, 0.05); g.fill(); }
  }
}

function drawFace(g, v, L, G, proj, opt) {
  const { rx, yaw, fy } = G;
  const fc = Math.cos(yaw);
  const mo = G.mo, sq = clamp(v.squeeze.x), open = clamp(v.eyes.x, 0, 1.35);
  const eo = clamp(open * (1 - sq * 1.45), 0, 1.35);
  const eyeY = fy(0.03);

  // blush (stronger while yawning)
  const blush = (L.blush ? 0.28 : 0.08) + mo * 0.22 + v.cheek.x * 0.25;
  if (blush > 0.05) {
    g.fillStyle = rgba('#e0707a', clamp(blush, 0, 0.55));
    for (const s of [-1, 1]) { const e = proj(s * 0.78); if (e.c > 0.1) { ellipse(g, e.x * rx * 0.9, fy(0.3), 0.17 * Math.pow(e.c, 0.5), 0.1); g.fill(); } }
  }
  if (L.freckles) {
    g.fillStyle = rgba(L.skinDeep, 0.7);
    for (const s of [-1, 1]) { const e = proj(s * 0.6); if (e.c > 0.2) for (let i = 0; i < 3; i++) { ellipse(g, e.x * rx * 0.9 + (i - 1) * 0.07, fy(0.22 + (i % 2) * 0.05), 0.022, 0.022); g.fill(); } }
  }
  // puffed cheeks when stifling
  if (v.cheek.x > 0.05) {
    const c = v.cheek.x;
    g.fillStyle = L.skinLight;
    for (const s of [-1, 1]) { const e = proj(s * 0.7); if (e.c > 0) { ellipse(g, e.x * rx * 0.94 + s * 0.05 * c, fy(0.42), 0.22 + 0.1 * c, 0.2 + 0.08 * c); g.fill(); } }
    g.fillStyle = rgba('#e0707a', 0.35 * c);
    for (const s of [-1, 1]) { const e = proj(s * 0.7); if (e.c > 0) { ellipse(g, e.x * rx * 0.94 + s * 0.05 * c, fy(0.42), 0.14 + 0.06 * c, 0.1); g.fill(); } }
  }

  // eyes
  const wide = clamp((open - 1) / 0.3);
  for (const s of [-1, 1]) {
    const e = proj(s * L.eyeGap);
    if (e.c < 0.12) continue;
    const fs = Math.pow(e.c, 0.6);
    const ex = e.x * rx * 0.93, ew = 0.085 * L.eyeSize * fs, eh = 0.12 * L.eyeSize;
    if (L.bags) { g.strokeStyle = rgba(L.skinDeep, 0.55); g.lineWidth = 0.035; g.beginPath(); g.ellipse(ex, eyeY + eh * 0.7, ew * 1.6, 0.07, 0, 0.3, Math.PI - 0.3); g.stroke(); }
    if (sq > 0.6) {
      g.strokeStyle = DARK; g.lineWidth = 0.06;
      g.beginPath(); g.moveTo(ex - ew * 1.9, eyeY + 0.035); g.quadraticCurveTo(ex, eyeY - 0.11, ex + ew * 1.9, eyeY + 0.035); g.stroke();
      const ox = ex + s * ew * 2.4;
      g.lineWidth = 0.035;
      g.beginPath(); g.moveTo(ox, eyeY - 0.03); g.lineTo(ox + s * 0.08, eyeY - 0.08); g.moveTo(ox + s * 0.01, eyeY + 0.035); g.lineTo(ox + s * 0.085, eyeY + 0.065); g.stroke();
    } else if (eo < 0.13) {
      g.strokeStyle = DARK; g.lineWidth = 0.05;
      g.beginPath(); g.moveTo(ex - ew * 1.6, eyeY); g.quadraticCurveTo(ex, eyeY + 0.07, ex + ew * 1.6, eyeY); g.stroke();
    } else {
      if (wide > 0.02) { g.fillStyle = '#fbfaf5'; ellipse(g, ex, eyeY, ew * (1.4 + 0.6 * wide) + 0.02, eh * (1.1 + 0.3 * wide)); g.fill(); }
      const px = ex + v.lookAt.x * 0.045 * fs, py = eyeY + v.lookAt.y * 0.035;
      const pw = ew * (1 - wide * 0.35), ph = eh * (1 - wide * 0.3);
      const lidY = py - ph + 2 * ph * (1 - clamp(eo));
      g.save();
      if (eo < 0.98) { g.beginPath(); g.rect(px - 1, lidY, 2, 2); g.clip(); }
      g.fillStyle = DARK; ellipse(g, px, py, pw, ph); g.fill();
      if (eo > 0.45) { g.fillStyle = 'rgba(255,255,255,0.92)'; ellipse(g, px - pw * 0.3, py - ph * 0.4, pw * 0.34, pw * 0.34); g.fill(); }
      g.restore();
      if (eo < 0.9) {
        g.strokeStyle = L.skinDeep; g.lineWidth = 0.045;
        g.beginPath(); g.moveTo(px - pw * 1.7, lidY + 0.012); g.quadraticCurveTo(px, lidY - 0.035, px + pw * 1.7, lidY + 0.012); g.stroke();
      }
    }
    if (v.watery > 0.05 || v.tears > 0.05) {
      g.strokeStyle = rgba('#bfe6ff', 0.75 * Math.max(v.watery, v.tears)); g.lineWidth = 0.035;
      g.beginPath(); g.moveTo(ex - ew * 1.3, eyeY + eh * 0.95); g.quadraticCurveTo(ex, eyeY + eh * 1.3, ex + ew * 1.3, eyeY + eh * 0.95); g.stroke();
    }
    if (v.tears > 0.08) {
      const ty = eyeY + 0.06 + v.tears * 0.28, tx = ex + s * ew * 2.2;
      g.fillStyle = rgba('#bfe6ff', 0.9);
      g.beginPath(); g.moveTo(tx, ty - 0.1); g.quadraticCurveTo(tx + 0.06, ty, tx, ty + 0.05); g.quadraticCurveTo(tx - 0.06, ty, tx, ty - 0.1); g.fill();
    }
  }

  // nose
  const nx = Math.sin(yaw) * rx * 1.0, ny = fy(0.25);
  const ns = 0.6 + 0.4 * Math.abs(Math.sin(yaw));
  g.fillStyle = L.skinDark;
  if (L.noseKind === 0) { ellipse(g, nx, ny, 0.085 * ns + 0.02, 0.07); g.fill(); }
  else if (L.noseKind === 1) {
    g.beginPath(); g.moveTo(nx - 0.02 + Math.sin(yaw) * 0.05, ny - 0.2);
    g.quadraticCurveTo(nx + Math.sin(yaw) * 0.16 + 0.06, ny + 0.02, nx + 0.06, ny + 0.07);
    g.quadraticCurveTo(nx - 0.08, ny + 0.09, nx - 0.09, ny + 0.02); g.closePath(); g.fill();
  } else { ellipse(g, nx, ny + 0.02, 0.11 * ns + 0.02, 0.085); g.fill(); }
  g.fillStyle = rgba('#ffffff', 0.35); ellipse(g, nx - 0.03, ny - 0.03, 0.03, 0.025); g.fill();

  // phone glow on the face
  if (v.phoneGlow > 0.02) {
    const pg = g.createRadialGradient(0, 1.2, 0.1, 0, 0.6, 1.2);
    pg.addColorStop(0, rgba('#9fd8ff', 0.55 * v.phoneGlow)); pg.addColorStop(1, 'rgba(159,216,255,0)');
    g.fillStyle = pg; headPath(g, rx, G.ryT, G.ryB); g.fill();
  }

  // facial hair under the mouth
  const mx = Math.sin(yaw) * rx * 0.95, my = fy(L.mouthY);
  if (L.facial === 'beard' || L.facial === 'stubble') {
    g.save(); headPath(g, rx, G.ryT, G.ryB); g.clip();
    const beard = L.facial === 'beard';
    g.fillStyle = beard ? L.hairDark : mix(L.skin, '#4b5468', 0.14);
    if (!beard) g.globalAlpha = clamp(Math.cos(yaw) * 1.25 - 0.25, 0, 1);
    const a = beard ? 1.4 : 1.3, N = 14;
    const yTopF = fy(L.mouthY - (beard ? 0.1 : 0.14)), yTopS = fy(beard ? 0.12 : 0.2);
    g.beginPath();
    for (let k = 0; k <= N; k++) {
      const u = -a + (2 * a * k) / N, t = Math.abs(u) / a;
      const px = rx * Math.sin(clamp(u + yaw, -HALF_PI, HALF_PI));
      const py = lerp(yTopF, yTopS, t * t);
      if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.lineTo(rx * Math.sin(clamp(a + yaw, -HALF_PI, HALF_PI)), G.ryB * 1.4);
    g.lineTo(rx * Math.sin(clamp(-a + yaw, -HALF_PI, HALF_PI)), G.ryB * 1.4);
    g.closePath();
    g.ellipse(mx, my + 0.02 + mo * 0.18, 0.2 + mo * 0.1, 0.1 + mo * 0.22, 0, 0, TAU, true);
    g.fill('evenodd');
    g.restore();
  } else if (L.facial === 'goatee') {
    g.fillStyle = L.hairDark; ellipse(g, mx, my + 0.22 + mo * 0.3, 0.12, 0.1); g.fill();
  }

  // mouth
  if (mo > 0.06) {
    const mw = 0.17 * (0.5 + 0.5 * Math.max(0, fc));
    const ow = mw * (0.9 + 0.55 * mo), oh = 0.05 + 0.36 * mo;
    const top = my - 0.06;
    g.fillStyle = MOUTH_IN;
    ellipse(g, mx, top + oh, ow, oh); g.fill();
    if (mo > 0.28) {
      g.save(); ellipse(g, mx, top + oh, ow, oh); g.clip();
      g.fillStyle = '#26090f'; ellipse(g, mx, top + oh * 0.95, ow * 0.5, oh * 0.5); g.fill();
      g.fillStyle = '#f7f2ea'; g.fillRect(mx - ow, top - 0.02, ow * 2, 0.065 + mo * 0.02);
      g.fillStyle = TONGUE; ellipse(g, mx, top + oh * 2 - 0.01, ow * 0.78, oh * 0.5); g.fill();
      if (opt.uvula && mo > 0.7) { g.fillStyle = '#b8505e'; ellipse(g, mx, top + 0.12, 0.03, 0.05); g.fill(); }
      g.restore();
    }
    g.strokeStyle = L.lip; g.lineWidth = 0.035; ellipse(g, mx, top + oh, ow, oh); g.stroke();
  } else {
    const mw = 0.13 * (0.5 + 0.5 * Math.max(0, fc));
    const sm = clamp(v.smile.x, -0.5, 1), cheek = v.cheek.x, al = v.alarm.x;
    g.strokeStyle = shade(L.lip, -0.25); g.lineWidth = 0.05;
    if (cheek > 0.25) { g.beginPath(); g.moveTo(mx - mw * 0.6, my + 0.02); g.lineTo(mx + mw * 0.6, my + 0.02); g.stroke(); }
    else if (al > 0.45) { g.fillStyle = MOUTH_IN; ellipse(g, mx, my + 0.04, 0.05 + 0.02 * al, 0.06 + 0.03 * al); g.fill(); }
    else if (v.talk > 0.05) { g.fillStyle = MOUTH_IN; ellipse(g, mx, my + 0.03, mw * 0.8, 0.03 + 0.07 * Math.abs(Math.sin(v.t * 14))); g.fill(); }
    else {
      g.beginPath(); g.moveTo(mx - mw, my - sm * 0.02);
      g.quadraticCurveTo(mx, my + 0.015 + sm * 0.1, mx + mw, my - sm * 0.02); g.stroke();
    }
  }
  if (L.facial === 'mustache') {
    g.fillStyle = L.hairDark;
    g.beginPath(); g.moveTo(mx, my - 0.1);
    g.quadraticCurveTo(mx - 0.2, my - 0.14, mx - 0.26, my - 0.0 + mo * 0.02);
    g.quadraticCurveTo(mx - 0.12, my - 0.04, mx, my - 0.06);
    g.quadraticCurveTo(mx + 0.12, my - 0.04, mx + 0.26, my - 0.0 + mo * 0.02);
    g.quadraticCurveTo(mx + 0.2, my - 0.14, mx, my - 0.1); g.fill();
  }

  // glasses (they ride up when the face scrunches)
  if (L.glasses) {
    const gy = eyeY + 0.01 - mo * 0.05 - sq * 0.03;
    const pts = [];
    for (const s of [-1, 1]) {
      const e = proj(s * L.eyeGap);
      if (e.c < 0.1) { pts.push(null); continue; }
      const fs = Math.pow(e.c, 0.8), ex = e.x * rx * 0.93;
      g.fillStyle = 'rgba(235,245,255,0.14)'; g.strokeStyle = '#2b2530'; g.lineWidth = 0.045;
      if (L.glasses === 'round') ellipse(g, ex, gy, 0.19 * fs, 0.17);
      else roundRect(g, ex - 0.2 * fs, gy - 0.13, 0.4 * fs, 0.26, 0.07);
      g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.03;
      g.beginPath(); g.moveTo(ex - 0.1 * fs, gy - 0.02); g.lineTo(ex - 0.03 * fs, gy - 0.09); g.stroke();
      pts.push({ x: ex, fs });
    }
    if (pts[0] && pts[1]) { g.strokeStyle = '#2b2530'; g.lineWidth = 0.04; g.beginPath(); g.moveTo(pts[0].x + 0.19 * pts[0].fs, gy - 0.03); g.quadraticCurveTo((pts[0].x + pts[1].x) / 2, gy - 0.08, pts[1].x - 0.19 * pts[1].fs, gy - 0.03); g.stroke(); }
  }
  if (v.sweat > 0.05) {
    const e = proj(0.95);
    if (e.c > 0) {
      const k = (v.t * 0.8) % 1, sx = e.x * rx * 0.9, sy = fy(-0.45) + k * 0.4;
      g.fillStyle = rgba('#bfe6ff', 0.85 * v.sweat * (1 - k * 0.6));
      g.beginPath(); g.moveTo(sx, sy - 0.13); g.quadraticCurveTo(sx + 0.08, sy, sx, sy + 0.06); g.quadraticCurveTo(sx - 0.08, sy, sx, sy - 0.13); g.fill();
    }
  }
}

function drawBrows(g, v, L, G, proj) {
  const b = v.brow.x, sq = clamp(v.squeeze.x);
  const by = G.fy(-0.32) - b * 0.09 + sq * 0.05;
  g.strokeStyle = L.hairStyle === 'bald' ? shade(L.hair, -0.2) : L.hairDark; g.lineWidth = 0.075;
  for (const s of [-1, 1]) {
    const e = proj(s * (L.eyeGap + 0.03));
    if (e.c < 0.1) continue;
    const bx = e.x * G.rx * 0.92, bw = 0.13 * L.browW * Math.pow(e.c, 0.7);
    const tilt = b * 0.07 + sq * 0.04;
    g.beginPath();
    g.moveTo(bx - s * bw, by - tilt);
    g.quadraticCurveTo(bx, by - 0.04 - tilt * 0.3, bx + s * bw, by + tilt * 0.4);
    g.stroke();
  }
}

function drawHairCap(g, v, L, G, proj) {
  const style = L.hairStyle, H = HAIRLINE[style];
  const col = style === 'buzz' ? mix(L.hair, L.skin, 0.35) : L.hair;
  if (!H) { drawBald(g, v, L, G, proj); return; }
  g.save();
  const vol = H.vol;
  g.beginPath(); g.ellipse(0, -0.05 * vol, G.rx * vol, G.ryT * vol + 0.02, 0, 0, TAU); g.clip();
  g.beginPath();
  const N = 20;
  for (let i = 0; i <= N; i++) {
    const th = -HALF_PI + (i / N) * Math.PI;
    const u = wrap(th - G.yaw);
    const au = Math.abs(u);
    let y = hairY(style, u, H);
    if (au > HALF_PI - 0.3 && au < HALF_PI + 0.3) { const t = smooth((au - (HALF_PI - 0.3)) / 0.6); y = lerp(hairY(style, Math.sign(u) * (HALF_PI - 0.31), H), H.nape, t); }
    const x = Math.sin(th) * G.rx * vol * 1.02;
    i ? g.lineTo(x, G.fy(y)) : g.moveTo(x, G.fy(y));
  }
  g.lineTo(G.rx * 2, -3); g.lineTo(-G.rx * 2, -3); g.closePath();
  g.fillStyle = col; g.fill();
  // soft sheen
  g.fillStyle = rgba(L.hairLight, 0.35);
  ellipse(g, Math.sin(G.yaw) * -0.25 - 0.2, -0.85, 0.35, 0.14, -0.4); g.fill();
  g.restore();

  // extras
  g.fillStyle = col;
  const top = -G.ryT * vol;
  const lag = v.hairLag.x;
  if (style === 'spiky') {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.85 + i * (Math.PI * 0.7 / 4), r = G.rx * 0.98;
      const x0 = Math.cos(a) * r, y0 = Math.sin(a) * G.ryT * 0.98 - 0.04;
      g.beginPath(); g.moveTo(x0 - 0.16, y0 + 0.08); g.lineTo(x0 + Math.cos(a) * 0.32 + lag, y0 + Math.sin(a) * 0.34); g.lineTo(x0 + 0.16, y0 + 0.08); g.fill();
    }
  } else if (style === 'quiff') {
    ellipse(g, Math.sin(G.yaw) * 0.3 + 0.1 + lag, top + 0.05 - G.pitch * 0.3, 0.52, 0.26, -0.25); g.fill();
  } else if (style === 'messy') {
    const tufts = [[-0.35, -0.12, 0.3], [0.05, -0.2, 0.36], [0.42, -0.1, 0.28], [-0.72, 0.18, 0.2], [0.75, 0.2, 0.2]];
    for (const [tx, ty, s] of tufts) {
      const x = tx + Math.sin(G.yaw) * 0.25, y = top + 0.12 + ty - G.pitch * 0.3;
      g.beginPath(); g.moveTo(x - s * 0.6, y + s * 0.6); g.quadraticCurveTo(x + lag * 1.5, y - s * 0.7, x + s * 0.7 + lag, y - s * 0.4); g.quadraticCurveTo(x + s * 0.2, y + s * 0.2, x + s * 0.6, y + s * 0.6); g.fill();
    }
  } else if (style === 'curly' || style === 'afro') {
    for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.92 + (i / 6) * Math.PI * 0.84; ellipse(g, Math.cos(a) * G.rx * 0.95, Math.sin(a) * G.ryT * 0.95 - 0.02, 0.24, 0.22); g.fill(); }
  } else if (style === 'bun' || style === 'ponytail') {
    const th = Math.PI + G.yaw, c = Math.cos(th);
    if (c >= 0.25) { const bx = Math.sin(th) * G.rx * 0.75; ellipse(g, bx, -0.95 + G.pitch * 0.2, 0.42, 0.4); g.fill(); }
  } else if (style === 'side') {
    g.beginPath();
    const s = Math.sin(G.yaw) * 0.3;
    g.moveTo(-G.rx * 0.9 + s, G.fy(-0.42)); g.quadraticCurveTo(s + 0.1, G.fy(-0.75), G.rx * 0.95 + s, G.fy(-0.2)); g.quadraticCurveTo(s + 0.3, G.fy(-0.55), -G.rx * 0.9 + s, G.fy(-0.42)); g.fill();
  }
}

function drawBaldSides(g, L, G, proj, front) {
  g.fillStyle = L.hair;
  for (const s of [-1, 1]) {
    const e = proj(s * 1.9);
    if (e.c < -0.55) continue;
    if ((e.c > 0.2) !== front) continue;
    const x = e.x * G.rx * (front ? 0.9 : 1.0), y = G.fy(-0.02);
    const w = front ? 0.16 + 0.1 * e.c : 0.17;
    ellipse(g, x, y, w, 0.3, s * 0.2); g.fill();
    ellipse(g, x - s * 0.04, y - 0.18, w * 0.8, 0.16, s * 0.4); g.fill();
  }
}

// horseshoe fringe: a band of hair wrapping around the back of the head from ear to ear.
// Thin sideburn by the ears, reaching down to the nape at the back.
function drawBald(g, v, L, G, proj) {
  const U0 = 1.42, N = 30, top = [], bot = [];
  let any = false;
  for (let i = 0; i <= N; i++) {
    const th = -HALF_PI + (i / N) * Math.PI, u = wrap(th - G.yaw), au = Math.abs(u);
    const x = Math.sin(th) * G.rx * 1.02;
    let yt = 0.2, yb = 0.2;
    if (au > U0 - 0.1) {
      const k = smooth((au - U0) / (Math.PI - U0)), kb = smooth((au - U0) / 0.9);
      yt = lerp(-0.13, 0.1, k) + 0.03 * Math.sin(u * 9.5) + 0.018 * Math.sin(u * 23);
      yb = lerp(0.36, 1.25, kb);
      if (au < U0) { const f = smooth((au - (U0 - 0.1)) / 0.1); yt = lerp(0.12, yt, f); yb = lerp(0.12, yb, f); }
      any = true;
    }
    top.push(x, G.fy(yt)); bot.push(x, G.fy(yb));
  }
  if (any) {
    g.save(); headPath(g, G.rx, G.ryT, G.ryB); g.clip();
    g.beginPath();
    g.moveTo(top[0], top[1]);
    for (let i = 2; i < top.length; i += 2) g.lineTo(top[i], top[i + 1]);
    for (let i = bot.length - 2; i >= 0; i -= 2) g.lineTo(bot[i], bot[i + 1]);
    g.closePath();
    g.fillStyle = L.hair; g.fill();
    const gr = g.createLinearGradient(0, G.fy(0.1), 0, G.fy(0.95));
    gr.addColorStop(0, rgba(L.hairDark, 0)); gr.addColorStop(1, rgba(L.hairDark, 0.5));
    g.fillStyle = gr; g.fill();
    g.restore();
  }
  if (any) drawEars(g, L, G, proj, true);
  const sheen = clamp(0.35 + Math.cos(G.yaw) * 0.25, 0.1, 0.6);
  g.fillStyle = rgba('#ffffff', 0.28 * sheen / 0.6);
  ellipse(g, -0.25 + Math.sin(G.yaw) * 0.2, -0.72 + G.pitch * 0.2, 0.3, 0.14, -0.3); g.fill();
}

// ---------------------------------------------------------------- front pass (arms + props)
const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function drawFront(g, v, x, y, R, opt = {}) {
  const L = opt.look || v.look;
  const G = headGeom(v, L);
  const deskY = opt.deskY ?? 1.7;
  g.save(); g.translate(x, y); g.scale(R, R);
  g.lineCap = 'round'; g.lineJoin = 'round';
  drawProps(g, v, L, deskY, false);
  const order = (L.coverSide || 1) === 1 ? [-1, 1] : [1, -1];
  for (const side of order) drawArm(g, v, L, G, side, deskY);
  drawProps(g, v, L, deskY, true);
  g.restore();
}

function mouthPoint(v, L, G, dx = 0, dy = 0) {
  return headToBody(G, Math.sin(G.yaw) * G.rx * 0.95 + dx, G.fy(L.mouthY) + 0.12 + G.mo * 0.25 + dy);
}

function drawArm(g, v, L, G, side, deskY) {
  const p = v.p, sh = L.shoulders;
  const by = -v.shoulder.x * 0.5, bx = Math.sin(v.bodyYaw.x) * 0.42;
  const S = { x: side * (sh - 0.26) + bx * 0.25, y: 0.46 + by };
  const cs = L.coverSide || 1;
  const up = clamp(v.up.x, -0.25, 1.25), cov = clamp(v.cover.x, -0.2, 1.2);
  const style = p.kind === 'pelota' ? 'none' : L.yawnStyle;
  const wCover = side === cs ? cov : 0;
  const wUp = style === 'stretch' ? up : style === 'oneArm' && side !== cs ? up : 0;
  const wRaise = side === 1 ? clamp(v.raise.x, -0.15, 1.15) : 0;
  const wSip = side === 1 ? clamp(v.sip.x, 0, 1) : 0;

  let E, H, hand = 'rest';
  const pose = L.pose;
  if (pose === 'chin' && side === (L.chinSide || 1)) {
    E = { x: side * 0.92, y: deskY + 0.08 };
    H = headToBody(G, Math.sin(G.yaw) * G.rx * 0.6 + side * 0.12, G.ryB * 0.92);
    hand = 'fist';
  } else if (pose === 'crossed') {
    E = { x: side * (sh + 0.08), y: deskY - 0.12 }; H = { x: -side * 0.52, y: deskY + 0.12 };
  } else if (pose === 'phone') {
    E = { x: side * (sh - 0.08), y: 1.3 }; H = { x: side * 0.22, y: 0.92 - G.pitch * 0.25 }; hand = 'hold';
  } else if (pose === 'boss') {
    if (side === -1) { E = { x: -(sh + 0.02), y: 1.45 }; H = { x: -0.42, y: 1.95 }; hand = 'clicker'; }
    else { E = { x: sh + 0.12, y: 1.55 }; H = { x: sh + 0.02, y: 2.9 }; }
  } else if (pose === 'pelota') {
    E = { x: side * (sh + 0.04), y: deskY - 0.14 }; H = { x: side * 0.24, y: deskY + 0.18 };
  } else {
    E = { x: side * (sh + 0.2), y: deskY - 0.2 }; H = { x: side * 0.74, y: deskY + 0.24 };
    if (pose === 'pen' && side === 1) H.y += Math.sin(v.penT * 10) * 0.035;
  }
  let e = E, h = H;
  if (wCover > 0.001) {
    e = lerpP(e, { x: side * (sh - 0.02), y: 0.9 }, wCover);
    h = lerpP(h, mouthPoint(v, L, G, side * 0.2, -0.05), wCover); if (wCover > 0.5) hand = 'back';
  }
  if (wUp > 0.001) {
    const tr = v.p.yp === 3 ? Math.sin(v.t * 24 + side) * 0.03 : 0;
    e = lerpP(e, { x: side * (sh + 0.32), y: -1.35 + by }, wUp);
    h = lerpP(h, { x: side * (0.6 + tr), y: -2.9 + by + tr }, wUp); if (wUp > 0.5) hand = 'fist';
  }
  if (wRaise > 0.001) {
    e = lerpP(e, { x: side * (sh + 0.34), y: -0.95 }, wRaise);
    h = lerpP(h, { x: side * (sh + 0.34) + Math.sin(v.t * 9) * 0.04, y: -2.6 }, wRaise); if (wRaise > 0.5) hand = 'open';
  }
  if (wSip > 0.001) {
    e = lerpP(e, { x: side * (sh + 0.1), y: 0.8 }, wSip);
    h = lerpP(h, mouthPoint(v, L, G, side * 0.1, 0.22), wSip); if (wSip > 0.4) hand = 'mug';
  }

  const wPoint = side === 1 && v.point ? clamp(v.point.x, 0, 1.1) : 0;
  if (wPoint > 0.001) {
    const d = v.pointDir || { x: 1, y: -0.3 }, dl = Math.hypot(d.x, d.y) || 1, ux = d.x / dl, uy = d.y / dl;
    e = lerpP(e, { x: S.x + ux * 1.15 - uy * 0.12, y: S.y + uy * 1.15 + ux * 0.12 }, wPoint);
    h = lerpP(h, { x: S.x + ux * 2.35, y: S.y + uy * 2.35 }, wPoint); if (wPoint > 0.5) hand = 'point';
  }
  const C = { x: 2 * e.x - (S.x + h.x) / 2, y: 2 * e.y - (S.y + h.y) / 2 };
  const short = L.topKind === 'tee' || L.topKind === 'polo';
  const w = L.topKind === 'suit' ? 0.44 : 0.4;
  g.strokeStyle = L.topDark; g.lineWidth = w + 0.08;
  g.beginPath(); g.moveTo(S.x, S.y); g.quadraticCurveTo(C.x, C.y, h.x, h.y); g.stroke();
  if (short) {
    g.strokeStyle = L.skinDark; g.lineWidth = w * 0.86 + 0.06;
    g.beginPath(); g.moveTo(S.x, S.y); g.quadraticCurveTo(C.x, C.y, h.x, h.y); g.stroke();
    g.strokeStyle = L.skin; g.lineWidth = w * 0.86;
    g.beginPath(); g.moveTo(S.x, S.y); g.quadraticCurveTo(C.x, C.y, h.x, h.y); g.stroke();
    const t = 0.38, q1 = { x: S.x + (C.x - S.x) * t, y: S.y + (C.y - S.y) * t };
    const q2 = { x: C.x + (h.x - C.x) * t, y: C.y + (h.y - C.y) * t }, m = lerpP(q1, q2, t);
    g.strokeStyle = L.top; g.lineWidth = w + 0.02;
    g.beginPath(); g.moveTo(S.x, S.y); g.quadraticCurveTo(q1.x, q1.y, m.x, m.y); g.stroke();
  } else {
    g.strokeStyle = L.top; g.lineWidth = w;
    g.beginPath(); g.moveTo(S.x, S.y); g.quadraticCurveTo(C.x, C.y, h.x, h.y); g.stroke();
    const dx = h.x - C.x, dy = h.y - C.y, dl = Math.hypot(dx, dy) || 1;
    g.strokeStyle = L.topKind === 'suit' ? L.shirt : L.topDark; g.lineWidth = w * 0.95;
    g.beginPath(); g.moveTo(h.x - (dx / dl) * 0.16, h.y - (dy / dl) * 0.16); g.lineTo(h.x - (dx / dl) * 0.06, h.y - (dy / dl) * 0.06); g.stroke();
  }
  drawHand(g, L, h, hand, side, v, C);
}

function drawHand(g, L, h, kind, side, v, C) {
  const ang = Math.atan2(h.y - C.y, h.x - C.x);
  g.fillStyle = L.skin; g.strokeStyle = L.skinDark; g.lineWidth = 0.045;
  if (kind === 'open') {
    g.save(); g.translate(h.x, h.y); g.rotate(ang + HALF_PI);
    roundRect(g, -0.17, -0.2, 0.34, 0.36, 0.12); g.fill(); g.stroke();
    for (let i = 0; i < 4; i++) { roundRect(g, -0.16 + i * 0.085, -0.42 + Math.abs(i - 1.5) * 0.04, 0.075, 0.26, 0.04); g.fill(); g.stroke(); }
    ellipse(g, side * 0.2, 0.02, 0.07, 0.12, side * 0.6); g.fill(); g.stroke();
    g.restore();
    return;
  }
  if (kind === 'mug') {
    g.save(); g.translate(h.x, h.y); g.rotate(side * -0.5);
    drawMug(g, v, 0, -0.05, 1, true);
    g.restore();
    g.fillStyle = L.skin; g.strokeStyle = L.skinDark; g.lineWidth = 0.045;
  }
  if (kind === 'point') {
    g.save(); g.translate(h.x, h.y); g.rotate(ang);
    roundRect(g, 0.05, -0.06, 0.34, 0.12, 0.06); g.fill(); g.stroke();
    roundRect(g, -0.2, -0.17, 0.34, 0.34, 0.13); g.fill(); g.stroke();
    g.restore();
    return;
  }
  if (kind === 'clicker') {
    g.save(); g.translate(h.x, h.y); g.rotate(-0.5);
    g.fillStyle = '#2a2d36'; roundRect(g, -0.07, -0.34, 0.14, 0.42, 0.05); g.fill();
    g.fillStyle = v.clickFlash > 0 ? '#ff4d4d' : '#8a2b2b'; ellipse(g, 0, -0.26, 0.035, 0.035); g.fill();
    g.restore();
    g.fillStyle = L.skin; g.strokeStyle = L.skinDark; g.lineWidth = 0.045;
    kind = 'fist';
  }
  if (kind === 'fist') {
    roundRect(g, h.x - 0.19, h.y - 0.17, 0.38, 0.34, 0.14); g.fill(); g.stroke();
    ellipse(g, h.x - side * 0.15, h.y + 0.06, 0.08, 0.11, side * 0.5); g.fill(); g.stroke();
    return;
  }
  ellipse(g, h.x, h.y, 0.19, 0.18, ang); g.fill(); g.stroke();
}

function drawMug(g, v, x, y, s, held) {
  const L = v.look;
  g.fillStyle = L.mugColor || '#e9e4d8';
  roundRect(g, x - 0.17 * s, y - 0.2 * s, 0.34 * s, 0.4 * s, 0.06 * s); g.fill();
  g.strokeStyle = L.mugColor || '#e9e4d8'; g.lineWidth = 0.07 * s;
  g.beginPath(); g.arc(x + 0.19 * s, y, 0.1 * s, -HALF_PI, HALF_PI); g.stroke();
  g.fillStyle = '#c0533f'; g.fillRect(x - 0.17 * s, y - 0.06 * s, 0.34 * s, 0.07 * s);
  if (!held && v.p.cup > 0) {
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.035;
    for (let i = 0; i < 2; i++) {
      const k = (v.t * 0.5 + i * 0.5) % 1;
      g.globalAlpha = Math.sin(k * Math.PI) * 0.8;
      g.beginPath(); g.moveTo(x - 0.05 + i * 0.1, y - 0.25 * s - k * 0.4);
      g.quadraticCurveTo(x + 0.06 + i * 0.1, y - 0.35 * s - k * 0.4, x - 0.02 + i * 0.1, y - 0.5 * s - k * 0.4); g.stroke();
    }
    g.globalAlpha = 1;
  }
}

function drawProps(g, v, L, deskY, over) {
  const prop = L.prop, p = v.p;
  if (!over) {
    if (prop === 'notebook') {
      g.fillStyle = '#f4f1e8';
      g.beginPath(); g.moveTo(-0.55, deskY + 0.2); g.lineTo(0.55, deskY + 0.2); g.lineTo(0.62, deskY + 0.72); g.lineTo(-0.62, deskY + 0.72); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(80,110,160,0.35)'; g.lineWidth = 0.02;
      for (let i = 1; i < 4; i++) { const yy = deskY + 0.2 + i * 0.13; g.beginPath(); g.moveTo(-0.5 - i * 0.015, yy); g.lineTo(0.5 + i * 0.015, yy); g.stroke(); }
      if (p.kind === 'pelota') { g.strokeStyle = 'rgba(40,40,60,0.55)'; g.lineWidth = 0.025; for (let i = 1; i < 4; i++) { const yy = deskY + 0.18 + i * 0.13; g.beginPath(); g.moveTo(-0.45, yy); g.lineTo(-0.45 + 0.7 * ((i * 37) % 10) / 10 + 0.2, yy); g.stroke(); } }
    }
    if (p.kind === 'coffee' && v.sip.x < 0.4) {
      if (p.crashed && p.cup <= 0) { g.save(); g.translate(1.0, deskY + 0.42); g.rotate(1.35); drawMug(g, v, 0, 0, 0.9, true); g.restore(); }
      else drawMug(g, v, 1.0, deskY + 0.22, 1, false);
    }
    return;
  }
  if (prop === 'laptop') {
    g.fillStyle = '#b9bec7';
    roundRect(g, -0.92, deskY - 1.18, 1.84, 1.3, 0.08); g.fill();
    g.fillStyle = '#a6abb5'; g.fillRect(-0.92, deskY + 0.02, 1.84, 0.1);
    g.fillStyle = 'rgba(255,255,255,0.5)'; ellipse(g, 0, deskY - 0.55, 0.12, 0.13); g.fill();
    if (v.look.sticker) { g.fillStyle = v.look.sticker; ellipse(g, -0.5, deskY - 0.85, 0.14, 0.14); g.fill(); }
  } else if (prop === 'bottle') {
    const bx = (v.look.coverSide || 1) * -1.05;
    g.fillStyle = 'rgba(170,215,235,0.8)'; roundRect(g, bx - 0.12, deskY - 0.45, 0.24, 0.72, 0.08); g.fill();
    g.fillStyle = '#4f7f9a'; roundRect(g, bx - 0.09, deskY - 0.56, 0.18, 0.14, 0.04); g.fill();
  }
  if (L.pose === 'phone' && p.kind === 'phone') {
    const G = headGeom(v, L);
    const py = 0.84 - G.pitch * 0.25;
    g.fillStyle = '#23252c'; roundRect(g, -0.21, py - 0.34, 0.42, 0.64, 0.07); g.fill();
    g.fillStyle = rgba('#8fd0ff', 0.25 * v.phoneGlow); roundRect(g, -0.25, py - 0.38, 0.5, 0.72, 0.1); g.fill();
    g.fillStyle = L.skin; g.strokeStyle = L.skinDark; g.lineWidth = 0.04;
    ellipse(g, -0.2, py + 0.05, 0.08, 0.13); g.fill(); g.stroke();
    ellipse(g, 0.2, py + 0.05, 0.08, 0.13); g.fill(); g.stroke();
  }
}
