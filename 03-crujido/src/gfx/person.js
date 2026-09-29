// One member of the audience, seen from the row behind: a head that really turns (every feature
// sits at a longitude on the skull and is projected for the current yaw), hair, hats, shoulders,
// the hand that comes up for "¡chsst!" and the hands a scared friend hides behind. Lit from the
// screen in front of them, so from behind they are silhouettes with a rim of film light; a face
// turned towards you catches the faint light of the aisle, and so do its eyes.
import { clamp, lerp, mix } from './paint.js';

const AMB = '#0b0f1c';
const TAU = Math.PI * 2;

// yaw 0: facing the screen (their back to you). Positive yaw turns the face to your right.
function proj(X, Yh, rx, ry, yaw, lam, lat) {
  const a = yaw + lam, c = Math.cos(lat);
  return { x: X + rx * Math.sin(a) * c, y: Yh + ry * Math.sin(lat), vis: -Math.cos(a) * c };
}
// the stretch of the head's outline covered by the face (longitudes ±74°) that faces you, as x-range
function faceSpan(yaw) {
  const L = 1.29;
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k <= 16; k++) {
    const a = yaw - L + (2 * L * k) / 16;
    if (Math.cos(a) < 0.02) { const s = Math.sin(a); lo = Math.min(lo, s); hi = Math.max(hi, s); }
  }
  return lo <= hi ? [lo, hi] : null;
}

function hairMass(g, st, X, Yh, rx, ry) {
  const E = (x, y, a, b2) => { g.beginPath(); g.ellipse(x, y, a, b2, 0, 0, TAU); g.fill(); };
  switch (st) {
    case 'long':
      E(X, Yh - ry * 0.04, rx * 1.06, ry * 1.04);
      g.beginPath(); g.moveTo(X - rx * 1.04, Yh - ry * 0.1); g.quadraticCurveTo(X - rx * 1.16, Yh + ry * 1.2, X - rx * 1.0, Yh + ry * 1.95);
      g.lineTo(X + rx * 1.0, Yh + ry * 1.95); g.quadraticCurveTo(X + rx * 1.16, Yh + ry * 1.2, X + rx * 1.04, Yh - ry * 0.1); g.closePath(); g.fill();
      break;
    case 'pony': E(X, Yh - ry * 0.05, rx * 1.04, ry * 1.0); break;
    case 'bob':
      E(X, Yh - ry * 0.02, rx * 1.12, ry * 1.04);
      g.beginPath(); g.moveTo(X - rx * 1.12, Yh - ry * 0.05); g.lineTo(X - rx * 1.08, Yh + ry * 0.72); g.quadraticCurveTo(X, Yh + ry * 0.86, X + rx * 1.08, Yh + ry * 0.72); g.lineTo(X + rx * 1.12, Yh - ry * 0.05); g.closePath(); g.fill();
      break;
    case 'curly': case 'perm': {
      const k = st === 'perm' ? 1.26 : 1.08, n = st === 'perm' ? 13 : 11, r = rx * (st === 'perm' ? 0.36 : 0.3);
      E(X, Yh - ry * 0.08, rx * k * 0.92, ry * k * 0.9);
      for (let i = 0; i < n; i++) {
        const a2 = -Math.PI * 1.08 + (i / (n - 1)) * Math.PI * 1.16;
        E(X + Math.cos(a2) * rx * k, Yh - ry * 0.08 + Math.sin(a2) * ry * k * 0.95, r, r);
      }
      break;
    }
    case 'bald':
      g.beginPath(); g.ellipse(X, Yh + ry * 0.3, rx * 1.02, ry * 0.4, 0, 0, Math.PI); g.fill();
      break;
    default: E(X, Yh - ry * 0.06, rx * 1.04, ry * 0.98);
  }
}
// the face: between two meridians of the head (x = X + k·rx·cos(lat)), from the hairline to the chin
function facePath(g, X, Yh, rx, ry, lo, hi, top) {
  const N = 12;
  g.beginPath();
  for (let k = 0; k <= N; k++) { const lat = top + ((Math.PI / 2 - top) * k) / N; g.lineTo(X + hi * rx * Math.cos(lat), Yh + ry * Math.sin(lat)); }
  for (let k = N; k >= 0; k--) { const lat = top + ((Math.PI / 2 - top) * k) / N; g.lineTo(X + lo * rx * Math.cos(lat), Yh + ry * Math.sin(lat)); }
  const c = Math.cos(top);
  g.quadraticCurveTo(X + (lo + hi) * 0.5 * rx * c, Yh + ry * Math.sin(top) - ry * 0.14, X + hi * rx * c, Yh + ry * Math.sin(top));
  g.closePath();
}

export function drawPerson(g, look, pose, X, Y, S, light, o = {}) {
  const yaw = pose.yaw || 0, tilt = pose.tilt || 0, lift = pose.lift || 0, kid = look.v === 'kid';
  const rx = S * 0.8, ry = S, Yh = Y - lift, st = look.hair;
  const face = mix(look.skin, AMB, 0.34), skinD = mix(look.skin, AMB, 0.7), hair = mix(look.hc, AMB, 0.58);
  const top = mix(look.top, AMB, 0.66), rim = light.rim, rw = Math.max(1, S * 0.075) * (0.55 + 0.7 * light.a);
  const tw = yaw * 0.3 + (pose.torso || 0), sw = S * 1.5 * (0.8 + 0.2 * Math.abs(Math.cos(tw))), sy = Y + S * 0.95 - lift * 0.6;

  // ---- rim: the whole silhouette in film light, nudged up and out; the figure covers all but the edge
  const shape = (dx, dy) => {
    g.beginPath();
    g.ellipse(X + dx, Yh + dy, rx * (st === 'perm' ? 1.3 : st === 'curly' ? 1.15 : 1.06), ry * (st === 'perm' ? 1.22 : 1.04), tilt, 0, TAU);
    g.moveTo(X - sw + dx, sy + S * 1.6 + dy);
    g.quadraticCurveTo(X - sw + dx, sy - S * 0.2 + dy, X - S * 0.35 + dx, sy - S * 0.35 + dy);
    g.lineTo(X + S * 0.35 + dx, sy - S * 0.35 + dy);
    g.quadraticCurveTo(X + sw + dx, sy - S * 0.2 + dy, X + sw + dx, sy + S * 1.6 + dy);
    g.closePath();
    g.fill();
  };
  if (light.a > 0.02) {
    g.fillStyle = rim;
    shape(0, -rw * 1.1);
    g.globalAlpha = 0.55; shape(-rw * 0.7, -rw * 0.45); shape(rw * 0.7, -rw * 0.45); g.globalAlpha = 1;
  }

  // ---- body: shoulders, neck, scarf
  g.fillStyle = top;
  g.beginPath();
  g.moveTo(X - sw, sy + S * 1.6);
  g.quadraticCurveTo(X - sw, sy - S * 0.2, X - S * 0.35, sy - S * 0.35);
  g.lineTo(X + S * 0.35, sy - S * 0.35);
  g.quadraticCurveTo(X + sw, sy - S * 0.2, X + sw, sy + S * 1.6);
  g.closePath(); g.fill();
  g.fillStyle = skinD; g.fillRect(X - rx * 0.32, Yh + ry * 0.6, rx * 0.64, sy - Yh - ry * 0.45);
  if (look.acc === 'scarf') {
    g.fillStyle = mix('#9a2b2b', AMB, 0.5);
    g.beginPath(); g.ellipse(X, sy - S * 0.28, rx * 0.72, S * 0.2, 0, 0, TAU); g.fill();
    g.fillRect(X + rx * 0.2 * Math.cos(tw), sy - S * 0.2, S * 0.24, S * 0.9);
  }

  g.save();
  if (tilt) { g.translate(X, Yh + ry * 0.8); g.rotate(tilt); g.translate(-X, -(Yh + ry * 0.8)); }
  // ---- head: skin, hair mass, then the part of the face that looks at you
  g.fillStyle = skinD; g.beginPath(); g.ellipse(X, Yh, rx, ry, 0, 0, TAU); g.fill();
  const span = faceSpan(yaw);
  if (st === 'pony' || st === 'bun') {
    const q = proj(X, Yh, rx, ry, yaw, Math.PI, st === 'bun' ? -0.95 : 0.1);
    g.fillStyle = hair; g.beginPath();
    if (st === 'bun') g.arc(q.x, q.y - ry * 0.1, rx * 0.42, 0, TAU);
    else { g.ellipse(q.x + Math.sin(yaw) * rx * 0.25, q.y + ry * 0.55, rx * 0.26, ry * 0.7, -Math.sin(yaw) * 0.4, 0, TAU); }
    g.fill();
  }
  const hatted = st === 'cap' || st === 'beanie' || st === 'fedora' || st === 'beret';
  g.fillStyle = hair;
  hairMass(g, hatted ? 'short' : st, X, Yh, rx, ry);
  if (hatted || st === 'short' || st === 'side' || st === 'spiky' || st === 'bun') {
    // nape: skin below the hairline at the back
    g.save(); g.beginPath(); g.ellipse(X, Yh, rx, ry, 0, 0, TAU); g.clip();
    g.fillStyle = skinD; g.beginPath(); g.ellipse(X - Math.sin(yaw) * rx * 0.3, Yh + ry * 0.98, rx * 0.62, ry * 0.42, 0, 0, TAU); g.fill();
    g.restore();
  }
  if (span) {
    const [lo, hi] = span, hl = st === 'bald' ? -0.75 : st === 'perm' || st === 'curly' ? -0.32 : st === 'bob' || st === 'long' ? -0.36 : -0.44;
    const lit = clamp(-Math.cos(yaw));
    g.fillStyle = mix(look.skin, AMB, lerp(0.58, 0.3, lit));
    facePath(g, X, Yh, rx, ry, lo, hi, hl); g.fill();
    if (st === 'long' || st === 'bob' || st === 'pony') {
      // hair falls either side of a face that looks at you
      g.fillStyle = hair;
      // (only the curtain at the back of the head once the face is in profile, so the nose stays clear)
      const sN = Math.sin(yaw), frontal = lit > 0.75;
      for (const e of [lo, hi]) if (Math.abs(e) > 0.55 && (frontal || Math.sign(e) !== Math.sign(sN))) { g.beginPath(); g.ellipse(X + e * rx * 0.94, Yh + ry * 0.12, rx * 0.2, ry * (st === 'bob' ? 0.72 : 0.95), 0, 0, TAU); g.fill(); }
    }
    features(g, look, pose, X, Yh, rx, ry, yaw, hair, face);
  }
  // ears, at ±96°
  for (const s of [-1, 1]) {
    const q = proj(X, Yh, rx, ry, yaw, s * 1.68, 0.08);
    if (q.vis > -0.55 && Math.abs(q.x - X) > rx * 0.55) {
      g.fillStyle = skinD; g.beginPath(); g.ellipse(q.x + Math.sign(q.x - X) * rx * 0.06, q.y, rx * 0.14, ry * 0.2, 0, 0, TAU); g.fill();
      if (look.acc === 'aid' && s === -1) { g.fillStyle = mix('#d9b98a', AMB, 0.35); g.beginPath(); g.ellipse(q.x + Math.sign(q.x - X) * rx * 0.13, q.y - ry * 0.05, rx * 0.1, ry * 0.15, 0.3, 0, TAU); g.fill(); }
    }
  }
  hats(g, st, look, X, Yh, rx, ry, yaw, hair);
  // volume: film light spilling over the crown, the jaw falling into shadow
  if (light.a > 0.02) {
    const vg = g.createLinearGradient(0, Yh - ry * 1.2, 0, Yh + ry);
    vg.addColorStop(0, light.sheen); vg.addColorStop(0.45, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = vg; g.beginPath(); g.ellipse(X, Yh - ry * 0.04, rx * (st === 'perm' ? 1.3 : 1.06), ry * (st === 'perm' ? 1.2 : 1.04), 0, 0, TAU); g.fill();
  }
  g.restore();

  // ---- hands: the finger to the lips, the hands over the eyes
  if (pose.shush > 0.01) hand(g, look, X, Yh, rx, ry, yaw, pose.shush, 'shush', sy);
  if (pose.cover > 0.01) { hand(g, look, X, Yh, rx, ry, yaw, pose.cover, 'coverL', sy); hand(g, look, X, Yh, rx, ry, yaw, pose.cover, 'coverR', sy); }
  if (pose.ear > 0.01) hand(g, look, X, Yh, rx, ry, yaw, pose.ear, 'ear', sy);
}

function features(g, look, pose, X, Yh, rx, ry, yaw, hair, face) {
  const eyeOpen = pose.eyes ?? 1, brow = pose.brow ?? 0, glare = pose.glare || 0;
  for (const s of [-1, 1]) {
    const q = proj(X, Yh, rx, ry, yaw, s * 0.56, -0.02);
    if (q.vis < 0.12) continue;
    const w = rx * 0.2 * Math.sqrt(q.vis), h = ry * 0.075 * eyeOpen * (1 + 0.35 * glare * 0) + 0.3;
    if (eyeOpen > 0.1) {
      g.fillStyle = `rgba(236,230,214,${0.55 + 0.45 * q.vis})`;
      g.beginPath(); g.ellipse(q.x, q.y, w, Math.max(0.6, h), 0, 0, TAU); g.fill();
      g.fillStyle = '#120c0a';
      const px = q.x + clamp(pose.look ?? -Math.sin(yaw) * 0.4, -1, 1) * w * 0.35;
      g.beginPath(); g.arc(px, q.y + h * 0.1, Math.min(w * 0.5, Math.max(0.8, h * 1.05)), 0, TAU); g.fill();
    } else { g.strokeStyle = '#1a100c'; g.lineWidth = Math.max(0.8, ry * 0.03); g.beginPath(); g.moveTo(q.x - w, q.y); g.lineTo(q.x + w, q.y); g.stroke(); }
    if (look.acc === 'glasses') {
      g.strokeStyle = 'rgba(30,24,20,0.95)'; g.lineWidth = Math.max(0.8, ry * 0.045);
      g.beginPath(); g.ellipse(q.x, q.y, w * 1.45, ry * 0.15, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = Math.max(0.6, ry * 0.025);
      g.beginPath(); g.moveTo(q.x - w * 0.6, q.y - ry * 0.07); g.lineTo(q.x + w * 0.1, q.y - ry * 0.11); g.stroke();
    }
    // brows: down at the middle when angry (brow < 0), up when startled
    const by = q.y - ry * (0.17 + 0.05 * brow), inner = s * -1;
    g.strokeStyle = hair; g.lineWidth = Math.max(1, ry * 0.07); g.lineCap = 'round';
    g.beginPath(); g.moveTo(q.x - inner * w * 1.1, by - ry * 0.02 * brow); g.lineTo(q.x + inner * w * 1.1, by + ry * 0.09 * -brow); g.stroke();
  }
  // nose: shading when you see the face, a profile tip at the silhouette
  const n = proj(X, Yh, rx, ry, yaw, 0, 0.2), sN = Math.sin(yaw);
  if (n.vis > -0.1) {
    g.fillStyle = face;
    if (Math.abs(sN) > 0.35) {
      const ex = X + rx * 0.97 * sN, tip = X + rx * (1.22 * sN);
      g.beginPath(); g.moveTo(ex, n.y - ry * 0.16); g.lineTo(tip, n.y + ry * 0.06); g.lineTo(ex, n.y + ry * 0.14); g.closePath(); g.fill();
    } else { g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(n.x + rx * 0.05, n.y + ry * 0.04, rx * 0.08, ry * 0.05, 0, 0, TAU); g.fill(); }
  }
  // mouth
  const m = proj(X, Yh, rx, ry, yaw, 0, 0.5);
  if (m.vis > 0.1) {
    const w = rx * 0.24 * Math.sqrt(m.vis), mo = pose.mo || 0;
    g.fillStyle = '#2a1210'; g.strokeStyle = '#2a1210'; g.lineWidth = Math.max(0.8, ry * 0.045);
    if (mo > 0.05) { g.beginPath(); g.ellipse(m.x, m.y + ry * 0.04 * mo, w * (pose.round ? 0.55 : 0.9), ry * 0.16 * mo + 0.5, 0, 0, TAU); g.fill(); }
    else { g.beginPath(); g.moveTo(m.x - w, m.y + ry * 0.03 * glare); g.quadraticCurveTo(m.x, m.y - ry * 0.06 * (glare - 0.3), m.x + w, m.y + ry * 0.03 * glare); g.stroke(); }
  }
  if (look.acc === 'bow') {
    const b = proj(X, Yh, rx, ry, yaw, 0, 1.25);
    if (b.vis > 0) { g.fillStyle = mix('#b01e2e', AMB, 0.3); g.beginPath(); g.moveTo(b.x, b.y + ry * 0.25); g.lineTo(b.x - rx * 0.32, b.y + ry * 0.12); g.lineTo(b.x - rx * 0.32, b.y + ry * 0.4); g.lineTo(b.x + rx * 0.32, b.y + ry * 0.12); g.lineTo(b.x + rx * 0.32, b.y + ry * 0.4); g.closePath(); g.fill(); }
  }
}

function hats(g, st, look, X, Yh, rx, ry, yaw, hair) {
  const c = mix(look.hc, AMB, 0.42), sN = Math.sin(yaw), front = -Math.cos(yaw);
  if (st === 'cap') {
    g.fillStyle = c; g.beginPath(); g.ellipse(X, Yh - ry * 0.28, rx * 1.06, ry * 0.8, 0, Math.PI, TAU); g.fill();
    g.fillRect(X - rx * 1.06, Yh - ry * 0.3, rx * 2.12, ry * 0.12);
    // the peak sits at the front: hidden from behind, a short wedge in profile, a wide shade from the front
    if (front > -0.55) {
      const px = X + rx * 0.92 * sN, len = rx * 0.62 * Math.abs(sN), wid = rx * (0.5 + 0.55 * clamp(front));
      g.beginPath(); g.ellipse(px + Math.sign(sN) * len * 0.55, Yh - ry * 0.24, Math.max(wid * (1 - Math.abs(sN) * 0.6), len), ry * (0.07 + 0.1 * clamp(front)), 0, 0, TAU); g.fill();
    }
    if (front < -0.3) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(X - sN * rx * 0.4, Yh - ry * 0.12, rx * 0.26, ry * 0.12, 0, Math.PI, TAU); g.fill(); }
  } else if (st === 'beanie') {
    g.fillStyle = c; g.beginPath(); g.ellipse(X, Yh - ry * 0.24, rx * 1.08, ry * 0.86, 0, Math.PI, TAU); g.fill();
    g.fillStyle = mix(look.hc, AMB, 0.3); g.fillRect(X - rx * 1.08, Yh - ry * 0.32, rx * 2.16, ry * 0.3);
    g.beginPath(); g.arc(X, Yh - ry * 1.12, rx * 0.2, 0, TAU); g.fill();
  } else if (st === 'fedora') {
    g.fillStyle = c;
    g.beginPath(); g.ellipse(X, Yh - ry * 0.42, rx * 1.55, ry * 0.2, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(X - rx * 0.9, Yh - ry * 0.42); g.quadraticCurveTo(X - rx * 0.95, Yh - ry * 1.28, X, Yh - ry * 1.18); g.quadraticCurveTo(X + rx * 0.95, Yh - ry * 1.28, X + rx * 0.9, Yh - ry * 0.42); g.closePath(); g.fill();
    g.fillStyle = mix('#1a1414', AMB, 0.2); g.fillRect(X - rx * 0.9, Yh - ry * 0.62, rx * 1.8, ry * 0.16);
  } else if (st === 'beret') {
    g.fillStyle = c; g.beginPath(); g.ellipse(X - rx * 0.1, Yh - ry * 0.5, rx * 1.2, ry * 0.42, -0.16, Math.PI * 0.92, Math.PI * 2.08); g.fill();
    g.beginPath(); g.ellipse(X - rx * 0.12, Yh - ry * 0.5, rx * 1.2, ry * 0.16, -0.16, 0, TAU); g.fill();
    g.beginPath(); g.arc(X - rx * 0.05, Yh - ry * 0.95, rx * 0.08, 0, TAU); g.fill();
  } else if (st === 'spiky') {
    g.fillStyle = hair; g.beginPath();
    for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.9 + i * Math.PI * 0.8 / 6, x0 = X + Math.cos(a) * rx, y0 = Yh + Math.sin(a) * ry; g.moveTo(x0 - rx * 0.16, y0 + ry * 0.08); g.lineTo(X + Math.cos(a) * rx * 1.28, Yh + Math.sin(a) * ry * 1.25); g.lineTo(x0 + rx * 0.16, y0 + ry * 0.08); }
    g.fill();
  } else if (st === 'side') {
    const q = proj(X, Yh, rx, ry, yaw, -0.5, -0.75);
    if (q.vis > -0.6) { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(0.6, rx * 0.04); g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x + rx * 0.15, q.y + ry * 0.2); g.stroke(); }
  }
}

// a hand: skin blob with fingers; 'shush' raises one finger to the lips, 'cover' spreads over an eye
function hand(g, look, X, Yh, rx, ry, yaw, k, kind, sy) {
  const skin = mix(look.skin, AMB, 0.32);
  let tx, ty, from;
  if (kind === 'shush') { const m = proj(X, Yh, rx, ry, yaw, 0, 0.5); if (m.vis < -0.2) return; tx = m.x; ty = m.y + ry * 0.12; from = [X + rx * 0.9, sy + ry * 1.6]; }
  else if (kind === 'ear') {
    // fiddling with the hearing aid (left ear): the hand stays beside the head, at the ear
    const e = proj(X, Yh, rx, ry, yaw, -1.68, 0.08), o = Math.sign(e.x - X) || -1;
    tx = e.x + o * rx * 0.2; ty = e.y - ry * 0.1; from = [X + o * rx * 1.5, sy + ry * 1.6];
  } else { const s = kind === 'coverL' ? -1 : 1, e = proj(X, Yh, rx, ry, yaw, s * 0.5, 0); tx = e.x; ty = e.y + ry * 0.05; from = [X + s * rx * 1.5, sy + ry * 1.6]; }
  const u = 1 - Math.pow(1 - clamp(k), 3), hx = lerp(from[0], tx, u), hy = lerp(from[1], ty, u);
  g.strokeStyle = mix(look.top, AMB, 0.55); g.lineWidth = rx * 0.55; g.lineCap = 'round';
  g.beginPath(); g.moveTo(from[0], from[1] + ry); g.quadraticCurveTo(lerp(from[0], hx, 0.5) + rx * 0.4, lerp(from[1], hy, 0.4) + ry * 0.4, hx, hy + ry * 0.35); g.stroke();
  g.fillStyle = skin;
  if (kind === 'shush') {
    g.strokeStyle = 'rgba(10,6,6,0.55)'; g.lineWidth = Math.max(0.8, rx * 0.05);
    g.beginPath(); g.ellipse(hx, hy + ry * 0.42, rx * 0.26, ry * 0.22, 0, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(hx, hy - ry * 0.02, rx * 0.085, ry * 0.36, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,235,215,0.5)'; g.beginPath(); g.ellipse(hx - rx * 0.02, hy - ry * 0.28, rx * 0.04, ry * 0.07, 0, 0, TAU); g.fill();
  } else if (kind === 'ear') {
    g.strokeStyle = 'rgba(10,6,6,0.5)'; g.lineWidth = Math.max(0.8, rx * 0.05);
    g.beginPath(); g.ellipse(hx, hy + ry * 0.3, rx * 0.24, ry * 0.26, 0, 0, TAU); g.fill(); g.stroke();
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(hx + (i - 1) * rx * 0.13, hy - ry * 0.04, rx * 0.065, ry * 0.2, (i - 1) * 0.2, 0, TAU); g.fill(); }
  } else {
    g.beginPath(); g.ellipse(hx, hy + ry * 0.28, rx * 0.34, ry * 0.3, 0, 0, TAU); g.fill();
    for (let i = -1; i <= 1; i++) { g.beginPath(); g.ellipse(hx + i * rx * 0.15, hy - ry * 0.02, rx * 0.075, ry * 0.26, i * 0.15, 0, TAU); g.fill(); }
  }
}

// the light a person receives from the screen, computed once per frame
export function personLight(L) {
  const k = 0.45 + 1.3 * L.a, r = Math.min(255, L.r * k + 30), gg = Math.min(255, L.g * k + 26), b = Math.min(255, L.b * k + 30);
  return { a: L.a, rim: `rgba(${r | 0},${gg | 0},${b | 0},${clamp(0.25 + 0.75 * L.a + 0.3 * L.flash)})`, sheen: `rgba(${r | 0},${gg | 0},${b | 0},${clamp(0.08 + 0.3 * L.a)})` };
}
