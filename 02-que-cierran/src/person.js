// Procedural passengers. A body is defined in local metres (x from the centre line, y up from the feet),
// deformed (squash, lean, door pinch) and then projected point by point, so a man bulging out of the
// doorway really comes at the camera: his chest and head get bigger than his shoes.
import { TAU, clamp, lerp, shade, rgba } from './util.js';

const INK = '#1c1a27';
const MOUTH = '#7a2837';
const BLUSH = '#ff8a9c';
const WHITE = '#ffffff';
export const HEAD_R = 0.152; // the face is designed at this radius and scaled to the rig's head

// smooth closed curve through points (Catmull-Rom as cubic Béziers)
export function blob(g, pts) {
  const n = pts.length;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    g.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    );
  }
  g.closePath();
}

export function rig(L) {
  const hs = L.h / 1.7, ws = L.sw / 0.46;
  const R = 0.186 * (L.head || 1) * (0.72 + 0.28 * hs);
  return {
    hs, ws, R,
    ankle: 0.07 * hs, knee: 0.45 * hs, hip: 0.84 * hs, waist: 0.99 * hs, chest: 1.19 * hs, shoulder: 1.37 * hs,
    headY: 1.37 * hs + R * 1.02,
    hipW: 0.165 * ws, waistW: 0.175 * ws, chestW: 0.212 * ws, shW: 0.222 * ws,
    arm1: 0.27 * hs, arm2: 0.25 * hs, armW: 0.092 * Math.sqrt(ws), legW: 0.118 * Math.pow(ws, 0.6),
  };
}

// local body point -> screen [x, y, px per metre]
function projector(cam, st, r) {
  const sq = st.sq || 0;
  const sx = 1 + sq * 0.85, sy = 1 - sq;
  const top = r.headY, nod = st.nod || 0, sway = st.sway || 0, pinch = st.pinch || 0;
  return (lx, ly) => {
    const y = ly * sy;
    let z;
    if (y <= r.chest) { const f = clamp(y / r.chest); z = lerp(st.zf, st.zb, f * f * (3 - 2 * f)); }
    else z = lerp(st.zb, st.zh, clamp((y - r.chest) / (top - r.chest)));
    const h = y / top;
    let x = lx * sx;
    if (pinch) x *= 1 - pinch * 0.2 * Math.exp(-((y - r.chest) * (y - r.chest)) / 0.09);
    const yy = y > r.shoulder ? y - nod * (y - r.shoulder) / (top - r.shoulder) : y;
    return [cam.X(st.x + x + sway * h * h, z), cam.Y(yy, z), cam.s(z)];
  };
}

const line = (g, pts, w, color, cap = 'round') => {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.lineWidth = w; g.strokeStyle = color; g.lineCap = cap; g.lineJoin = 'round';
  g.stroke();
};
const dot = (g, p, r, color) => { g.beginPath(); g.arc(p[0], p[1], Math.max(0.3, r), 0, TAU); g.fillStyle = color; g.fill(); };

// ---------------------------------------------------------------- face and hair (head-local metres, y down)
function eye(g, x, y, kind, side, f) {
  const lx = (f.look || 0) * 0.012, ly = (f.lookY || 0) * 0.01;
  g.fillStyle = INK; g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
  switch (kind) {
    case 'wide':
    case 'shock': {
      const big = kind === 'shock' ? 1.18 : 1;
      g.fillStyle = WHITE;
      g.beginPath(); g.ellipse(x, y, 0.032 * big, 0.038 * big, 0, 0, TAU); g.fill();
      g.fillStyle = INK;
      g.beginPath(); g.arc(x + lx, y + ly, kind === 'shock' ? 0.008 : 0.016, 0, TAU); g.fill();
      if (kind === 'wide') { g.fillStyle = WHITE; g.beginPath(); g.arc(x + lx + 0.006, y + ly - 0.006, 0.005, 0, TAU); g.fill(); }
      break;
    }
    case 'squeeze':
      g.lineWidth = 0.013;
      g.beginPath();
      g.moveTo(x - 0.022 * side, y - 0.019); g.lineTo(x + 0.016 * side, y); g.lineTo(x - 0.022 * side, y + 0.019);
      g.stroke();
      break;
    case 'closed':
      g.lineWidth = 0.011;
      g.beginPath(); g.moveTo(x - 0.024, y); g.quadraticCurveTo(x, y + 0.014, x + 0.024, y); g.stroke();
      break;
    case 'happy':
      g.lineWidth = 0.012;
      g.beginPath(); g.moveTo(x - 0.024, y + 0.008); g.quadraticCurveTo(x, y - 0.022, x + 0.024, y + 0.008); g.stroke();
      break;
    case 'dizzy':
      g.lineWidth = 0.01;
      g.beginPath();
      g.moveTo(x - 0.018, y - 0.018); g.lineTo(x + 0.018, y + 0.018);
      g.moveTo(x + 0.018, y - 0.018); g.lineTo(x - 0.018, y + 0.018);
      g.stroke();
      break;
    case 'half':
      g.beginPath(); g.ellipse(x + lx, y + 0.004, 0.017, 0.016, 0, 0, TAU); g.fill();
      g.lineWidth = 0.009;
      g.beginPath(); g.moveTo(x - 0.024, y - 0.004); g.lineTo(x + 0.024, y - 0.004); g.stroke();
      break;
    default: // dot
      g.beginPath(); g.ellipse(x + lx, y + ly, 0.017, 0.023, 0, 0, TAU); g.fill();
      g.fillStyle = WHITE; g.globalAlpha *= 0.9;
      g.beginPath(); g.arc(x + lx + 0.005, y + ly - 0.008, 0.0055, 0, TAU); g.fill();
      g.globalAlpha /= 0.9;
  }
}

function mouth(g, kind, w, y, f) {
  g.fillStyle = MOUTH; g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
  const k = f.mouthK ?? 1;
  switch (kind) {
    case 'o':
      g.beginPath(); g.ellipse(0, y + 0.004, 0.016 * w * k, 0.02 * k, 0, 0, TAU); g.fill();
      break;
    case 'open': {
      g.beginPath(); g.ellipse(0, y + 0.01, 0.03 * w, 0.03 * k, 0, 0, TAU); g.fill();
      g.fillStyle = '#e8657a';
      g.beginPath(); g.ellipse(0, y + 0.026 * k, 0.018 * w, 0.01 * k, 0, 0, TAU); g.fill();
      break;
    }
    case 'grit':
      g.fillStyle = WHITE;
      g.beginPath(); g.roundRect(-0.036 * w, y - 0.012, 0.072 * w, 0.026, 0.01); g.fill();
      g.lineWidth = 0.006; g.strokeStyle = shade('#7a2837', 0.2);
      g.beginPath(); g.moveTo(-0.034 * w, y + 0.001); g.lineTo(0.034 * w, y + 0.001); g.stroke();
      break;
    case 'smile':
      g.lineWidth = 0.011;
      g.beginPath(); g.moveTo(-0.026 * w, y - 0.004); g.quadraticCurveTo(0, y + 0.024, 0.026 * w, y - 0.004); g.stroke();
      break;
    case 'grin':
      g.beginPath(); g.moveTo(-0.032 * w, y - 0.006); g.quadraticCurveTo(0, y + 0.05, 0.032 * w, y - 0.006); g.closePath(); g.fill();
      break;
    case 'wavy':
      g.lineWidth = 0.009;
      g.beginPath();
      g.moveTo(-0.03 * w, y);
      for (let i = 1; i <= 4; i++) g.lineTo(-0.03 * w + i * 0.015 * w, y + (i % 2 ? -0.008 : 0.008));
      g.stroke();
      break;
    case 'cat':
      g.lineWidth = 0.009;
      g.beginPath();
      g.moveTo(-0.022, y - 0.004); g.quadraticCurveTo(-0.011, y + 0.012, 0, y - 0.002); g.quadraticCurveTo(0.011, y + 0.012, 0.022, y - 0.004);
      g.stroke();
      break;
    default: // flat
      g.lineWidth = 0.01;
      g.beginPath(); g.moveTo(-0.018 * w, y); g.lineTo(0.018 * w, y); g.stroke();
  }
}

function hairFront(g, L, R) {
  const c = L.hair;
  g.fillStyle = c;
  switch (L.style) {
    case 'bald':
      g.beginPath(); g.ellipse(-R * 0.93, -R * 0.02, R * 0.14, R * 0.3, 0.2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(R * 0.93, -R * 0.02, R * 0.14, R * 0.3, -0.2, 0, TAU); g.fill();
      g.fillStyle = rgba('#ffffff', 0.28);
      g.beginPath(); g.ellipse(-R * 0.25, -R * 0.62, R * 0.28, R * 0.12, -0.35, 0, TAU); g.fill();
      return;
    case 'spiky': {
      g.beginPath();
      g.moveTo(-R * 1.0, R * 0.05);
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI + (i / n) * Math.PI;
        const rr = i % 2 ? R * 1.24 : R * 1.02;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr - R * 0.02);
      }
      g.lineTo(R * 1.0, R * 0.05);
      g.lineTo(R * 0.92, -R * 0.2);
      for (let i = 0; i <= 4; i++) g.lineTo(R * 0.92 - i * R * 0.46, -R * (i % 2 ? 0.36 : 0.52));
      g.closePath(); g.fill();
      return;
    }
    case 'side':
      g.beginPath();
      g.arc(0, 0, R * 1.05, Math.PI * 1.02, Math.PI * 1.98);
      g.lineTo(R * 0.99, -R * 0.1);
      g.quadraticCurveTo(R * 0.7, -R * 0.66, R * 0.1, -R * 0.62);
      g.quadraticCurveTo(-R * 0.55, -R * 0.52, -R * 0.99, -R * 0.12);
      g.closePath(); g.fill();
      g.fillStyle = rgba('#ffffff', 0.12);
      g.beginPath(); g.ellipse(R * 0.18, -R * 0.78, R * 0.4, R * 0.09, 0.15, 0, TAU); g.fill();
      return;
    case 'bob':
    case 'long':
    case 'bun':
      g.beginPath();
      g.arc(0, 0, R * 1.1, Math.PI * 0.98, Math.PI * 2.02);
      g.lineTo(R * 1.1, R * 0.62);
      g.quadraticCurveTo(R * 1.02, R * 0.75, R * 0.82, R * 0.66);
      g.lineTo(R * 0.8, -R * 0.2);
      g.quadraticCurveTo(R * 0.4, -R * 0.36, 0, -R * 0.34);
      g.quadraticCurveTo(-R * 0.4, -R * 0.36, -R * 0.8, -R * 0.2);
      g.lineTo(-R * 0.82, R * 0.66);
      g.quadraticCurveTo(-R * 1.02, R * 0.75, -R * 1.1, R * 0.62);
      g.closePath(); g.fill();
      if (L.style === 'bun') { g.beginPath(); g.arc(0, -R * 1.12, R * 0.36, 0, TAU); g.fill(); }
      g.fillStyle = rgba('#ffffff', 0.13);
      g.beginPath(); g.ellipse(-R * 0.3, -R * 0.78, R * 0.34, R * 0.08, -0.3, 0, TAU); g.fill();
      return;
    case 'pony':
      g.beginPath();
      g.arc(0, 0, R * 1.05, Math.PI * 1.0, Math.PI * 2.0);
      g.lineTo(R * 0.98, -R * 0.12);
      g.quadraticCurveTo(R * 0.4, -R * 0.52, 0, -R * 0.44);
      g.quadraticCurveTo(-R * 0.5, -R * 0.4, -R * 0.98, -R * 0.1);
      g.closePath(); g.fill();
      return;
    case 'perm':
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.95 + (i / 8) * 1.1);
        g.beginPath(); g.arc(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.86 - R * 0.06, R * 0.34, 0, TAU); g.fill();
      }
      g.beginPath(); g.arc(0, -R * 0.62, R * 0.52, 0, TAU); g.fill();
      return;
    case 'cap': {
      const cc = L.hat || '#e0564f';
      g.fillStyle = L.hair;
      g.beginPath(); g.ellipse(-R * 0.92, R * 0.02, R * 0.14, R * 0.26, 0.2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(R * 0.92, R * 0.02, R * 0.14, R * 0.26, -0.2, 0, TAU); g.fill();
      g.fillStyle = cc;
      g.beginPath(); g.arc(0, -R * 0.12, R * 1.06, Math.PI, TAU); g.closePath(); g.fill();
      g.fillStyle = shade(cc, -0.2);
      g.beginPath(); g.ellipse(0, -R * 0.14, R * 1.15, R * 0.2, 0, 0, TAU); g.fill();
      g.fillStyle = WHITE; g.beginPath(); g.arc(0, -R * 0.62, R * 0.16, 0, TAU); g.fill();
      return;
    }
    case 'topknot':
      g.beginPath();
      g.arc(0, 0, R * 1.03, Math.PI * 1.05, Math.PI * 1.95);
      g.quadraticCurveTo(0, -R * 0.62, -R * 1.0, -R * 0.33);
      g.closePath(); g.fill();
      g.beginPath(); g.ellipse(0, -R * 1.08, R * 0.2, R * 0.14, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(0, -R * 1.2, R * 0.12, R * 0.2, 0, 0, TAU); g.fill();
      g.fillStyle = '#f2efe8'; g.fillRect(-R * 0.12, -R * 1.02, R * 0.24, R * 0.05);
      return;
    case 'none':
      return;
    default: // short
      g.beginPath();
      g.arc(0, 0, R * 1.04, Math.PI * 1.02, Math.PI * 1.98);
      g.lineTo(R * 0.99, -R * 0.14);
      g.quadraticCurveTo(R * 0.5, -R * 0.62, 0, -R * 0.52);
      g.quadraticCurveTo(-R * 0.5, -R * 0.62, -R * 0.99, -R * 0.14);
      g.closePath(); g.fill();
  }
}

// the layer of hair behind the head (and behind the body, for long hair)
function hairBehind(g, L, R) {
  g.fillStyle = shade(L.hair, -0.12);
  if (L.style === 'long') {
    g.beginPath();
    g.moveTo(-R * 1.1, -R * 0.1);
    g.quadraticCurveTo(-R * 1.25, R * 1.5, -R * 0.9, R * 2.1);
    g.lineTo(R * 0.9, R * 2.1);
    g.quadraticCurveTo(R * 1.25, R * 1.5, R * 1.1, -R * 0.1);
    g.closePath(); g.fill();
  } else if (L.style === 'bob' || L.style === 'bun') {
    g.beginPath(); g.ellipse(0, R * 0.12, R * 1.12, R * 0.95, 0, 0, TAU); g.fill();
  } else if (L.style === 'pony') {
    g.beginPath();
    g.moveTo(R * 0.6, -R * 0.7);
    g.quadraticCurveTo(R * 1.7, -R * 0.4, R * 1.25, R * 1.1);
    g.quadraticCurveTo(R * 1.05, R * 0.4, R * 0.7, -R * 0.2);
    g.closePath(); g.fill();
  }
}

// head-local drawing: origin at the head centre, 1 unit = 1 metre, y down
export function drawHead(g, L, f, R, t = 0, opts = {}) {
  const lod = opts.lod ?? 2;
  if (lod > 0) hairBehind(g, L, R);
  // ears
  g.fillStyle = shade(L.skin, -0.06);
  if (lod > 0 && L.style !== 'bob' && L.style !== 'long' && L.style !== 'bun') {
    g.beginPath(); g.ellipse(-R * 0.98, R * 0.08, R * 0.16, R * 0.21, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(R * 0.98, R * 0.08, R * 0.16, R * 0.21, 0, 0, TAU); g.fill();
  }
  const press = f.press || 0;
  // face
  g.fillStyle = L.skin;
  g.beginPath(); g.ellipse(0, 0, R * (1 + press * 0.1), R * (1.03 - press * 0.05), 0, 0, TAU); g.fill();
  if (press > 0) {
    g.fillStyle = rgba('#fff3ec', 0.42 * press);
    g.beginPath(); g.ellipse(0, R * 0.12, R * 0.72, R * 0.62, 0, 0, TAU); g.fill();
  }
  // jaw shade
  if (lod > 0) {
    g.fillStyle = rgba(shade(L.skin, -0.35), 0.12);
    g.beginPath(); g.ellipse(0, R * 0.62, R * 0.7, R * 0.34, 0, 0, Math.PI); g.fill();
  }
  if (L.beard && lod > 1) {
    g.fillStyle = rgba('#3a302c', 0.18);
    g.beginPath(); g.ellipse(0, R * 0.55, R * 0.62, R * 0.36, 0, 0, Math.PI); g.fill();
  }
  const gap = 0.056 * (L.eyeGap || 1) * (R / 0.152);
  const ey = R * 0.06 + (f.eyeY || 0);
  const kind = f.eyes || 'dot';
  // blush under the eyes
  const bl = clamp((L.blush || 0.4) * 0.5 + (f.blush || 0));
  if (bl > 0.05 && !L.mask) {
    g.fillStyle = rgba(BLUSH, 0.42 * bl);
    g.beginPath(); g.ellipse(-gap * 1.52, ey + R * 0.3, R * 0.2, R * 0.11, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(gap * 1.52, ey + R * 0.3, R * 0.2, R * 0.11, 0, 0, TAU); g.fill();
  }
  eye(g, -gap, ey, kind, 1, f);
  eye(g, gap, ey, kind, -1, f);
  if (L.lash && lod > 1 && (kind === 'dot' || kind === 'wide')) {
    g.strokeStyle = INK; g.lineWidth = 0.008;
    g.beginPath(); g.moveTo(-gap - 0.02, ey - 0.02); g.lineTo(-gap - 0.034, ey - 0.03); g.stroke();
    g.beginPath(); g.moveTo(gap + 0.02, ey - 0.02); g.lineTo(gap + 0.034, ey - 0.03); g.stroke();
  }
  // brows
  if (lod > 0) {
    const b = f.brow || 0, raise = (f.browUp || 0) * 0.02;
    g.strokeStyle = shade(L.hair === '#d9d6d2' || L.hair === '#e8e4de' ? '#9a948f' : L.hair, -0.1);
    g.lineWidth = 0.012 * (L.brow || 0.7); g.lineCap = 'round';
    const by = ey - R * 0.36 - raise;
    g.beginPath(); g.moveTo(-gap - 0.024, by - b * 0.006); g.lineTo(-gap + 0.02, by + b * 0.014); g.stroke();
    g.beginPath(); g.moveTo(gap + 0.024, by - b * 0.006); g.lineTo(gap - 0.02, by + b * 0.014); g.stroke();
  }
  // nose
  if (lod > 1 && !L.mask) {
    g.strokeStyle = rgba(shade(L.skin, -0.4), 0.45); g.lineWidth = 0.008;
    g.beginPath(); g.moveTo(-0.008, ey + R * 0.26); g.quadraticCurveTo(0, ey + R * 0.31 + press * 0.01, 0.008 + press * 0.012, ey + R * 0.26); g.stroke();
  }
  if (L.mask) {
    const mw = R * 0.82, mt = ey + R * 0.2, mb = R * 0.86;
    g.fillStyle = L.maskColor || '#f4f6f8';
    g.beginPath();
    g.moveTo(-mw, mt + R * 0.06); g.quadraticCurveTo(0, mt - R * 0.08, mw, mt + R * 0.06);
    g.lineTo(mw * 0.86, mb - R * 0.1); g.quadraticCurveTo(0, mb + R * 0.08, -mw * 0.86, mb - R * 0.1);
    g.closePath(); g.fill();
    if (lod > 1) {
      g.strokeStyle = rgba('#9aa4b2', 0.55); g.lineWidth = 0.005;
      for (let i = 1; i <= 2; i++) {
        const yy = lerp(mt, mb, i / 3.1);
        g.beginPath(); g.moveTo(-mw * 0.8, yy); g.quadraticCurveTo(0, yy + R * 0.05, mw * 0.8, yy); g.stroke();
      }
      g.strokeStyle = rgba('#dfe4ea', 0.9); g.lineWidth = 0.006;
      g.beginPath(); g.moveTo(-mw, mt + R * 0.06); g.lineTo(-R * 0.97, R * 0.02); g.stroke();
      g.beginPath(); g.moveTo(mw, mt + R * 0.06); g.lineTo(R * 0.97, R * 0.02); g.stroke();
    }
  } else {
    mouth(g, f.mouth || 'flat', L.mouthW || 1, ey + R * 0.5, f);
  }
  hairFront(g, L, R);
  if (L.glasses && lod > 0) {
    g.save();
    g.rotate(f.glassTilt || 0);
    g.strokeStyle = '#2b2a35'; g.lineWidth = 0.009;
    const gr = 0.04;
    if (L.glasses === 'round') {
      g.beginPath(); g.arc(-gap, ey, gr, 0, TAU); g.stroke();
      g.beginPath(); g.arc(gap, ey, gr, 0, TAU); g.stroke();
    } else {
      g.beginPath(); g.roundRect(-gap - gr * 1.15, ey - gr * 0.78, gr * 2.3, gr * 1.56, 0.012); g.stroke();
      g.beginPath(); g.roundRect(gap - gr * 1.15, ey - gr * 0.78, gr * 2.3, gr * 1.56, 0.012); g.stroke();
    }
    g.beginPath(); g.moveTo(-gap + gr, ey - 0.006); g.quadraticCurveTo(0, ey - 0.02, gap - gr, ey - 0.006); g.stroke();
    if (lod > 1) {
      g.strokeStyle = rgba('#ffffff', 0.55); g.lineWidth = 0.006;
      g.beginPath(); g.moveTo(-gap + 0.008, ey - 0.026); g.lineTo(-gap + 0.024, ey - 0.012); g.stroke();
      g.beginPath(); g.moveTo(gap + 0.008, ey - 0.026); g.lineTo(gap + 0.024, ey - 0.012); g.stroke();
    }
    g.restore();
  }
  if (L.hat && L.style !== 'cap' && lod > 0) {
    // the yellow school hat
    g.fillStyle = L.hat;
    g.beginPath(); g.arc(0, -R * 0.2, R * 1.08, Math.PI, TAU); g.closePath(); g.fill();
    g.fillStyle = shade(L.hat, -0.12);
    g.beginPath(); g.ellipse(0, -R * 0.2, R * 1.34, R * 0.2, 0, 0, TAU); g.fill();
  }
  if (L.headphones && lod > 0) {
    g.strokeStyle = shade(L.headphones, -0.25); g.lineWidth = 0.022;
    g.beginPath(); g.arc(0, -R * 0.05, R * 1.12, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    g.fillStyle = L.headphones;
    g.beginPath(); g.roundRect(-R * 1.18, -R * 0.12, R * 0.28, R * 0.44, R * 0.1); g.fill();
    g.beginPath(); g.roundRect(R * 0.9, -R * 0.12, R * 0.28, R * 0.44, R * 0.1); g.fill();
  }
  if ((f.sweat || 0) > 0.05 && lod > 0) {
    g.fillStyle = rgba('#bfe6ff', 0.9 * clamp(f.sweat));
    const sy = -R * 0.2 + ((t * 0.9) % 1) * R * 0.3;
    g.beginPath();
    g.moveTo(R * 0.72, sy - R * 0.2);
    g.quadraticCurveTo(R * 0.86, sy, R * 0.72, sy + R * 0.05);
    g.quadraticCurveTo(R * 0.58, sy, R * 0.72, sy - R * 0.2);
    g.fill();
  }
}

// ---------------------------------------------------------------- the body
function arm(P, r, side, a, b) {
  const [sx0, sy0] = [side * r.shW * 0.9, r.shoulder - 0.04 * r.hs];
  const ex = sx0 + side * Math.sin(a) * r.arm1, ey = sy0 - Math.cos(a) * r.arm1;
  const hx = ex + side * Math.sin(a + b) * r.arm2, hy = ey - Math.cos(a + b) * r.arm2;
  return { s: P(sx0, sy0), e: P(ex, ey), h: P(hx, hy), local: [hx, hy] };
}

function torsoPts(P, r, L, belly, back) {
  const hem = L.outfit === 'suit' || L.outfit === 'suitW' ? r.hip - 0.1 * r.hs : L.outfit === 'yukata' ? r.ankle + 0.1 : r.hip - 0.02;
  const bw = belly * 0.1 * r.ws;
  const pts = [
    [-r.hipW - 0.01, hem], [-r.waistW - bw, r.waist - 0.02 + belly * 0.02], [-r.chestW - bw * 0.35, r.chest],
    [-r.shW, r.shoulder - 0.07 * r.hs], [-r.shW + 0.06, r.shoulder + 0.005], [-0.07, r.shoulder + 0.03],
    [0.07, r.shoulder + 0.03], [r.shW - 0.06, r.shoulder + 0.005], [r.shW, r.shoulder - 0.07 * r.hs],
    [r.chestW + bw * 0.35, r.chest], [r.waistW + bw, r.waist - 0.02 + belly * 0.02], [r.hipW + 0.01, hem],
    [0, hem - (back ? 0 : 0.015)],
  ];
  if (L.outfit === 'yukata') { pts[0][0] -= 0.05; pts[11][0] += 0.05; }
  return pts.map(([x, y]) => P(x, y));
}

function drawLegs(g, P, r, L, st) {
  const legC = L.legs || shade(L.top, -0.1);
  const run = st.run || 0;
  for (const side of [-1, 1]) {
    const ph = Math.sin((st.t || 0) * 13 + (side > 0 ? Math.PI : 0)) * run;
    const hip = P(side * 0.085 * r.ws, r.hip);
    const knee = P(side * (0.092 * r.ws) + ph * 0.05, r.knee + Math.max(0, ph) * 0.1);
    const ank = P(side * 0.098 * r.ws - ph * 0.03, r.ankle + Math.max(0, ph) * 0.14);
    const w = r.legW * hip[2];
    if (L.skirt || L.shorts) {
      line(g, [knee, ank], w * 0.72, L.stockings || (L.skirt ? L.skin : L.skin));
    } else line(g, [hip, knee, ank], w, legC);
    if (L.shorts) line(g, [hip, P(side * 0.095 * r.ws, r.knee + 0.1)], w * 1.12, legC, 'butt');
    // shoe
    const sh = L.geta ? '#8a6a45' : L.shoes;
    g.fillStyle = sh;
    g.beginPath(); g.ellipse(ank[0], ank[1] + ank[2] * 0.02, ank[2] * 0.07 * Math.sqrt(r.ws), ank[2] * 0.042, 0, 0, TAU); g.fill();
    if (L.geta) { g.fillStyle = '#5c432b'; g.fillRect(ank[0] - ank[2] * 0.06, ank[1] + ank[2] * 0.05, ank[2] * 0.12, ank[2] * 0.03); }
  }
  if (L.skirt) {
    g.fillStyle = L.legs;
    blob(g, [P(-r.hipW - 0.01, r.waist), P(r.hipW + 0.01, r.waist), P(r.hipW + 0.07, r.knee + 0.05), P(0, r.knee + 0.03), P(-r.hipW - 0.07, r.knee + 0.05)]);
    g.fill();
  }
}

function drawBigPack(g, P, r, L, back) {
  const c = L.pack.color;
  const top = r.headY + r.R * 1.25, wd = r.shW * 1.22;
  const a = P(-wd, top), b = P(wd, r.hip - 0.02);
  g.fillStyle = back ? c : shade(c, -0.18);
  g.beginPath(); g.roundRect(a[0], a[1], b[0] - a[0], b[1] - a[1], a[2] * 0.09); g.fill();
  // side pockets
  g.fillStyle = back ? shade(c, -0.12) : shade(c, -0.3);
  const p1 = P(-wd - 0.05, r.chest + 0.02), p2 = P(-wd + 0.06, r.waist - 0.08);
  g.beginPath(); g.roundRect(p1[0], p1[1], p2[0] - p1[0], p2[1] - p1[1], p1[2] * 0.04); g.fill();
  const q1 = P(wd - 0.06, r.chest + 0.02), q2 = P(wd + 0.05, r.waist - 0.08);
  g.beginPath(); g.roundRect(q1[0], q1[1], q2[0] - q1[0], q2[1] - q1[1], q1[2] * 0.04); g.fill();
  // top flap
  g.fillStyle = back ? shade(c, 0.12) : shade(c, -0.08);
  const f1 = P(-wd * 0.92, top + 0.01), f2 = P(wd * 0.92, top - 0.16);
  g.beginPath(); g.roundRect(f1[0], f1[1], f2[0] - f1[0], f2[1] - f1[1], f1[2] * 0.06); g.fill();
  const roll = [P(-wd * 0.85, top + 0.07), P(wd * 0.85, top + 0.07)];
  line(g, roll, roll[0][2] * 0.13, back ? '#4b6fa8' : shade('#4b6fa8', -0.2));
  line(g, [P(-wd * 0.3, top + 0.12), P(-wd * 0.3, top + 0.01)], roll[0][2] * 0.02, '#2b2b30');
  line(g, [P(wd * 0.3, top + 0.12), P(wd * 0.3, top + 0.01)], roll[0][2] * 0.02, '#2b2b30');
  if (back) {
    g.fillStyle = shade(c, -0.14);
    blob(g, [P(-r.shW * 0.7, r.hip + 0.12), P(-r.shW * 0.75, r.chest - 0.02), P(r.shW * 0.75, r.chest - 0.02), P(r.shW * 0.7, r.hip + 0.12)]); g.fill();
    line(g, [P(-r.shW * 0.5, r.chest + 0.06), P(r.shW * 0.5, r.chest + 0.06)], P(0, r.chest)[2] * 0.02, shade(c, 0.3));
  }
}

function drawTorsoDetail(g, P, r, L, st) {
  const s = P(0, r.chest)[2];
  switch (L.outfit) {
    case 'suit':
    case 'suitW': {
      // shirt V and tie
      g.fillStyle = L.shirt;
      blob(g, [P(-0.075 * r.ws, r.shoulder + 0.025), P(0.075 * r.ws, r.shoulder + 0.025), P(0.02, r.chest - 0.02), P(0, r.chest - 0.08), P(-0.02, r.chest - 0.02)]);
      g.fill();
      if (L.outfit === 'suit' && L.tie) {
        const fly = (st.tieFly || 0);
        const k = P(0, r.shoulder + 0.005), tip = P(fly * 0.1, r.chest - 0.07 - Math.abs(fly) * 0.02);
        g.fillStyle = L.tie;
        g.beginPath();
        g.moveTo(k[0] - s * 0.018, k[1]); g.lineTo(k[0] + s * 0.018, k[1]);
        g.lineTo(tip[0] + s * 0.028, tip[1] - s * 0.03); g.lineTo(tip[0], tip[1]); g.lineTo(tip[0] - s * 0.028, tip[1] - s * 0.03);
        g.closePath(); g.fill();
        if (L.tieLoose) { g.fillStyle = shade(L.tie, -0.2); g.beginPath(); g.arc(k[0] + s * 0.02, k[1] + s * 0.03, s * 0.022, 0, TAU); g.fill(); }
      }
      // lapels
      g.fillStyle = shade(L.top, -0.14);
      for (const side of [-1, 1]) {
        blob(g, [P(side * 0.075 * r.ws, r.shoulder + 0.02), P(side * 0.12 * r.ws, r.shoulder - 0.02), P(side * 0.05, r.chest - 0.05), P(side * 0.02, r.chest - 0.02)]);
        g.fill();
      }
      dot(g, P(0.035, r.waist + 0.05), s * 0.011, shade(L.top, -0.3));
      break;
    }
    case 'blouse': {
      g.fillStyle = shade(L.top, 0.25);
      blob(g, [P(-0.07, r.shoulder + 0.02), P(0.07, r.shoulder + 0.02), P(0.05, r.shoulder - 0.05), P(0, r.shoulder - 0.08), P(-0.05, r.shoulder - 0.05)]); g.fill();
      for (let i = 0; i < 3; i++) dot(g, P(0, r.chest + 0.08 - i * 0.1), s * 0.009, shade(L.top, -0.25));
      break;
    }
    case 'gakuran': {
      g.fillStyle = shade(L.top, 0.1);
      blob(g, [P(-0.06, r.shoulder + 0.03), P(0.06, r.shoulder + 0.03), P(0.055, r.shoulder - 0.02), P(-0.055, r.shoulder - 0.02)]); g.fill();
      for (let i = 0; i < 4; i++) dot(g, P(0, r.shoulder - 0.07 - i * 0.12), s * 0.012, '#e7bf52');
      break;
    }
    case 'sailor': {
      g.fillStyle = L.legs;
      blob(g, [P(-r.shW + 0.02, r.shoulder - 0.02), P(-0.07, r.shoulder + 0.03), P(0.07, r.shoulder + 0.03), P(r.shW - 0.02, r.shoulder - 0.02), P(0.05, r.chest), P(0, r.chest - 0.04), P(-0.05, r.chest)]); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = s * 0.007;
      g.beginPath(); const a = P(-r.shW + 0.05, r.shoulder - 0.03), b = P(0, r.chest + 0.02), c = P(r.shW - 0.05, r.shoulder - 0.03);
      g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke();
      g.fillStyle = L.tie;
      const k = P(0, r.chest + 0.01);
      g.beginPath(); g.moveTo(k[0] - s * 0.05, k[1] - s * 0.02); g.lineTo(k[0] + s * 0.05, k[1] - s * 0.02); g.lineTo(k[0] + s * 0.02, k[1] + s * 0.07); g.lineTo(k[0], k[1] + s * 0.03); g.lineTo(k[0] - s * 0.02, k[1] + s * 0.07); g.closePath(); g.fill();
      break;
    }
    case 'aloha': {
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 7; i++) {
        const fx = ((i * 0.37) % 1) * 2 - 1, fy = r.waist + ((i * 0.61) % 1) * (r.shoulder - r.waist - 0.04);
        const p = P(fx * r.chestW * 0.8, fy);
        g.globalAlpha = 0.55;
        for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; dot(g, [p[0] + Math.cos(a) * s * 0.018, p[1] + Math.sin(a) * s * 0.018], s * 0.013, '#fff4d6'); }
        dot(g, p, s * 0.009, '#f2c14e');
        g.globalAlpha = 1;
      }
      g.fillStyle = shade(L.top, -0.18);
      blob(g, [P(-0.08, r.shoulder + 0.02), P(0.08, r.shoulder + 0.02), P(0, r.chest + 0.05)]); g.fill();
      g.fillStyle = L.skin;
      blob(g, [P(-0.05, r.shoulder + 0.03), P(0.05, r.shoulder + 0.03), P(0, r.chest + 0.09)]); g.fill();
      break;
    }
    case 'yukata': {
      g.fillStyle = L.pattern;
      for (let i = 0; i < 16; i++) {
        const fx = ((i * 0.618) % 1) * 2 - 1, fy = r.hip - 0.4 + ((i * 0.377) % 1) * 0.95;
        const p = P(fx * r.chestW * 0.9, fy);
        g.globalAlpha = 0.35;
        g.beginPath(); g.arc(p[0], p[1], s * 0.03, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
      // crossed collar
      g.fillStyle = shade(L.top, -0.3);
      blob(g, [P(-0.1, r.shoulder + 0.02), P(-0.03, r.shoulder + 0.03), P(0.12, r.waist + 0.1), P(0.06, r.waist + 0.06)]); g.fill();
      g.fillStyle = L.skin;
      blob(g, [P(-0.07, r.shoulder + 0.03), P(0.06, r.shoulder + 0.03), P(0.03, r.chest - 0.05)]); g.fill();
      // obi under the belly
      const o1 = P(-r.waistW - 0.1, r.hip + 0.02), o2 = P(r.waistW + 0.1, r.hip + 0.02);
      line(g, [o1, o2], s * 0.075, '#3b2f4a', 'butt');
      break;
    }
    case 'cardigan': {
      g.fillStyle = L.shirt;
      blob(g, [P(-0.065, r.shoulder + 0.02), P(0.065, r.shoulder + 0.02), P(0.03, r.chest - 0.02), P(-0.03, r.chest - 0.02)]); g.fill();
      for (let i = 0; i < 3; i++) dot(g, P(0.02, r.chest - 0.06 - i * 0.09), s * 0.01, '#f4e7c6');
      if (L.pearls) for (let i = 0; i < 9; i++) { const a = Math.PI * (0.15 + (i / 8) * 0.7); dot(g, P(Math.cos(a) * 0.065, r.shoulder + 0.02 - Math.sin(a) * 0.07), s * 0.008, '#fbf6ea'); }
      break;
    }
    case 'kid': {
      const p = P(0, r.chest - 0.02);
      g.fillStyle = shade(L.top, 0.35);
      g.beginPath(); g.arc(p[0], p[1], s * 0.05, 0, TAU); g.fill();
      g.fillStyle = shade(L.top, -0.3);
      g.beginPath(); g.arc(p[0] - s * 0.015, p[1] - s * 0.008, s * 0.008, 0, TAU); g.arc(p[0] + s * 0.015, p[1] - s * 0.008, s * 0.008, 0, TAU); g.fill();
      break;
    }
    default:
  }
}

function drawBrief(g, h, s, L, swing, kind) {
  g.save();
  g.translate(h[0], h[1]);
  g.rotate(swing);
  if (kind === 'brief') {
    g.fillStyle = '#3a2c25';
    g.beginPath(); g.roundRect(-s * 0.19, s * 0.035, s * 0.38, s * 0.27, s * 0.025); g.fill();
    g.fillStyle = '#2a1f1a'; g.fillRect(-s * 0.19, s * 0.1, s * 0.38, s * 0.015);
    g.strokeStyle = '#2a1f1a'; g.lineWidth = s * 0.016;
    g.beginPath(); g.arc(0, s * 0.035, s * 0.05, Math.PI, TAU); g.stroke();
    g.fillStyle = '#c9a35a'; g.fillRect(-s * 0.02, s * 0.09, s * 0.04, s * 0.03);
  } else {
    g.fillStyle = L.bagColor || '#c9b28e';
    g.beginPath(); g.moveTo(-s * 0.15, s * 0.1); g.lineTo(s * 0.15, s * 0.1); g.lineTo(s * 0.17, s * 0.4); g.lineTo(-s * 0.17, s * 0.4); g.closePath(); g.fill();
    g.strokeStyle = shade(L.bagColor || '#c9b28e', -0.3); g.lineWidth = s * 0.014;
    g.beginPath(); g.moveTo(-s * 0.09, s * 0.1); g.quadraticCurveTo(0, -s * 0.03, s * 0.09, s * 0.1); g.stroke();
  }
  g.restore();
}

function drawCake(g, P, r, hands, st) {
  const c = P(0, r.waist + 0.08), s = c[2];
  const ruin = st.ruined || 0;
  const w = s * 0.3, h = s * 0.2;
  g.save();
  g.translate(c[0], c[1]);
  if (ruin > 0) {
    g.fillStyle = '#fbf7f2';
    for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3; g.beginPath(); g.arc(Math.cos(a) * w * 0.55, -h * 0.5 + Math.sin(a) * h * 0.2 + i * s * 0.01, s * (0.035 + (i % 2) * 0.012), 0, TAU); g.fill(); }
  }
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(-w / 2, -h / 2 + ruin * h * 0.3); g.lineTo(w / 2, -h / 2 - ruin * h * 0.1); g.lineTo(w / 2 + ruin * s * 0.02, h / 2); g.lineTo(-w / 2 - ruin * s * 0.02, h / 2); g.closePath();
  g.fill();
  g.fillStyle = rgba('#b4a8a0', 0.25); g.fillRect(-w / 2, h * 0.2, w, h * 0.3);
  g.fillStyle = '#ff6f91';
  g.fillRect(-s * 0.018, -h / 2 + ruin * h * 0.1, s * 0.036, h);
  g.fillRect(-w / 2, -s * 0.01, w, s * 0.028);
  g.beginPath(); g.ellipse(-s * 0.03, -h / 2 - s * 0.012, s * 0.035, s * 0.02, -0.5, 0, TAU); g.ellipse(s * 0.03, -h / 2 - s * 0.012, s * 0.035, s * 0.02, 0.5, 0, TAU); g.fill();
  if (ruin > 0) {
    g.fillStyle = '#fffdf8';
    g.beginPath(); g.ellipse(w * 0.3, h * 0.55, s * 0.03, s * 0.05 * ruin, 0, 0, TAU); g.fill();
    g.fillStyle = '#e53950'; g.beginPath(); g.arc(w * 0.3, h * 0.55 + s * 0.05 * ruin, s * 0.02, 0, TAU); g.fill();
  }
  g.restore();
}

// the whole passenger
export function drawPerson(g, cam, L, st) {
  if (L.outfit === 'mascot') { drawMascot(g, cam, L, st); return; }
  const r = rig(L);
  const P = projector(cam, st, r);
  const back = st.view === 'back';
  const f = st.face || {};
  const armL = st.arms?.[0] || { a: 0.12, b: 0 }, armR = st.arms?.[1] || { a: 0.12, b: 0 };
  const belly = (L.belly || 0) * (1 + (st.jiggle || 0));
  g.save();
  if (st.alpha != null && st.alpha < 1) g.globalAlpha = st.alpha;

  // things behind the body
  const headP = P(0, r.headY);
  if (!back && L.style === 'long') { g.save(); g.translate(headP[0], headP[1]); g.scale(headP[2] * r.R / HEAD_R, headP[2] * r.R / HEAD_R); hairBehind(g, L, HEAD_R); g.restore(); }
  if (L.pack && !L.pack.front && !back && L.pack.big) drawBigPack(g, P, r, L, false);
  if (L.pack?.randoseru && !back) {
    const a = P(-r.shW * 0.95, r.shoulder + 0.05), b = P(r.shW * 0.95, r.chest - 0.1);
    g.fillStyle = shade(L.pack.color, -0.2);
    g.beginPath(); g.roundRect(a[0], a[1], b[0] - a[0], b[1] - a[1], a[2] * 0.05); g.fill();
  }
  if (L.bag === 'cart') drawCart(g, P, r, st);

  drawLegs(g, P, r, L, st);

  // torso
  g.fillStyle = L.top;
  blob(g, torsoPts(P, r, L, belly, back));
  g.fill();
  // side shade
  g.save();
  blob(g, torsoPts(P, r, L, belly, back)); g.clip();
  g.fillStyle = rgba('#1a1330', 0.1);
  const sh0 = P(r.chestW * 0.55, r.chest);
  g.fillRect(sh0[0], 0, cam.W, cam.H);
  if (st.dent > 0.01 && !back) {
    const d = P(0, st.dentY ?? r.chest);
    g.fillStyle = rgba('#1a1330', 0.18 * st.dent);
    g.beginPath(); g.ellipse(d[0], d[1], d[2] * 0.16, d[2] * 0.11, 0, 0, TAU); g.fill();
  }
  g.restore();
  if (!back) drawTorsoDetail(g, P, r, L, st);
  else if (L.style === 'long') { g.save(); g.translate(headP[0], headP[1]); g.scale(headP[2] * r.R / HEAD_R, headP[2] * r.R / HEAD_R); hairBehind(g, L, HEAD_R); g.restore(); }

  // front props
  if (!back && L.camera) {
    const c = P(0.06, r.chest - 0.02), s = c[2];
    g.strokeStyle = '#2b2b30'; g.lineWidth = s * 0.012;
    const n1 = P(-0.07, r.shoulder + 0.02), n2 = P(0.07, r.shoulder + 0.02);
    g.beginPath(); g.moveTo(n1[0], n1[1]); g.lineTo(c[0] - s * 0.05, c[1]); g.moveTo(n2[0], n2[1]); g.lineTo(c[0] + s * 0.05, c[1]); g.stroke();
    g.fillStyle = '#2b2b30'; g.beginPath(); g.roundRect(c[0] - s * 0.07, c[1] - s * 0.035, s * 0.14, s * 0.08, s * 0.012); g.fill();
    g.fillStyle = '#51607a'; g.beginPath(); g.arc(c[0], c[1] + s * 0.005, s * 0.025, 0, TAU); g.fill();
    g.fillStyle = '#9fb3d4'; g.beginPath(); g.arc(c[0] - s * 0.007, c[1] - s * 0.003, s * 0.008, 0, TAU); g.fill();
  }
  if (L.pack && !back) {
    if (L.pack.front) {
      const c = L.pack.color;
      const a = P(-r.chestW * 0.78, r.shoulder - 0.06), b = P(r.chestW * 0.78, r.waist - 0.08);
      const s = a[2];
      // straps
      line(g, [P(-r.shW * 0.62, r.shoulder + 0.01), P(-r.chestW * 0.6, r.shoulder - 0.08)], s * 0.035, shade(c, -0.25));
      line(g, [P(r.shW * 0.62, r.shoulder + 0.01), P(r.chestW * 0.6, r.shoulder - 0.08)], s * 0.035, shade(c, -0.25));
      g.fillStyle = c;
      g.beginPath(); g.roundRect(a[0], a[1], b[0] - a[0], b[1] - a[1], s * 0.06); g.fill();
      g.fillStyle = shade(c, -0.12);
      g.beginPath(); g.roundRect(lerp(a[0], b[0], 0.18), lerp(a[1], b[1], 0.45), (b[0] - a[0]) * 0.64, (b[1] - a[1]) * 0.45, s * 0.035); g.fill();
      g.strokeStyle = shade(c, 0.3); g.lineWidth = s * 0.008;
      g.beginPath(); g.moveTo(lerp(a[0], b[0], 0.22), lerp(a[1], b[1], 0.5)); g.lineTo(lerp(a[0], b[0], 0.78), lerp(a[1], b[1], 0.5)); g.stroke();
      // the keychain charm swings
      const k0 = [lerp(a[0], b[0], 0.8), lerp(a[1], b[1], 0.5)];
      const sw = st.charm || 0;
      const k1 = [k0[0] + Math.sin(sw) * s * 0.07, k0[1] + Math.cos(sw) * s * 0.07];
      g.strokeStyle = '#d8d2c4'; g.lineWidth = s * 0.005;
      g.beginPath(); g.moveTo(k0[0], k0[1]); g.lineTo(k1[0], k1[1]); g.stroke();
      dot(g, k1, s * 0.022, '#fff4f6');
      dot(g, [k1[0] - s * 0.007, k1[1] - s * 0.003], s * 0.004, INK);
      dot(g, [k1[0] + s * 0.007, k1[1] - s * 0.003], s * 0.004, INK);
    } else if (L.pack.big) {
      const s = P(0, r.chest)[2];
      for (const side of [-1, 1]) line(g, [P(side * r.shW * 0.6, r.shoulder + 0.01), P(side * r.chestW * 0.62, r.waist)], s * 0.04, shade(L.pack.color, -0.3));
    }
  }

  // arms
  const sleeve = L.outfit === 'sailor' ? '#f4f6fb' : L.outfit === 'aloha' || L.outfit === 'kid' ? L.top : L.outfit === 'yukata' ? L.top : L.top;
  const AL = arm(P, r, -1, armL.a, armL.b), AR = arm(P, r, 1, armR.a, armR.b);
  const bare = L.outfit === 'aloha' || L.outfit === 'kid';
  for (const A of [AL, AR]) {
    const w = r.armW * A.s[2];
    if (bare) {
      line(g, [A.s, A.e], w * 1.05, sleeve);
      line(g, [A.e, A.h], w * 0.8, L.skin);
    } else line(g, [A.s, A.e, A.h], w, sleeve);
    if (L.outfit === 'suit' || L.outfit === 'suitW') {
      const cuff = [lerp(A.e[0], A.h[0], 0.86), lerp(A.e[1], A.h[1], 0.86)];
      dot(g, cuff, w * 0.42, L.shirt);
    }
    dot(g, A.h, r.armW * 0.55 * A.h[2], L.skin);
  }
  if (L.prop === 'cake') drawCake(g, P, r, [AL.h, AR.h], st);
  if (L.bag === 'brief' || L.bag === 'tote') {
    const A = armL.a < armR.a - 0.05 ? AL : armR.a < armL.a - 0.05 ? AR : L.bag === 'brief' ? AR : AL;
    drawBrief(g, A.h, A.h[2], L, st.bagSwing || 0, L.bag);
  } else if (L.bag === 'shoulder') {
    const a = P(-r.shW * 0.7, r.shoulder), b = P(r.hipW + 0.08, r.hip + 0.06), s = a[2];
    g.strokeStyle = shade(L.bagColor || '#8a5a44', -0.2); g.lineWidth = s * 0.018;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1] - s * 0.06); g.stroke();
    g.fillStyle = L.bagColor || '#8a5a44';
    g.beginPath(); g.roundRect(b[0] - s * 0.09, b[1] - s * 0.08, s * 0.2, s * 0.15, s * 0.03); g.fill();
  }

  if (back && L.pack && !L.pack.front) {
    if (L.pack.big) drawBigPack(g, P, r, L, true);
    else if (L.pack.randoseru) {
      const a = P(-r.shW * 0.9, r.shoulder + 0.02), b = P(r.shW * 0.9, r.waist - 0.05);
      g.fillStyle = L.pack.color;
      g.beginPath(); g.roundRect(a[0], a[1], b[0] - a[0], b[1] - a[1], a[2] * 0.06); g.fill();
      g.fillStyle = shade(L.pack.color, -0.15);
      g.beginPath(); g.roundRect(a[0], a[1], b[0] - a[0], (b[1] - a[1]) * 0.55, a[2] * 0.06); g.fill();
      dot(g, [(a[0] + b[0]) / 2, lerp(a[1], b[1], 0.55)], a[2] * 0.018, '#e7bf52');
    }
  }
  // head
  const hp = P((st.headX || 0), r.headY);
  g.save();
  g.translate(hp[0], hp[1]);
  const hk = hp[2] * r.R / HEAD_R;
  g.scale(hk, hk);
  g.rotate(st.tilt || 0);
  const hsq = st.headSq || 0;
  g.scale(1 + hsq * 0.6, 1 - hsq * 0.5);
  if (back) drawHeadBack(g, L, HEAD_R);
  else drawHead(g, L, f, HEAD_R, st.t || 0, { lod: st.lod ?? 2 });
  g.restore();

  if (L.balloon && st.balloon) {
    const h = AL.h, b = [cam.X(st.x + st.balloon[0], st.zb), cam.Y(st.balloon[1], st.zb), cam.s(st.zb)];
    g.strokeStyle = rgba('#ffffff', 0.8); g.lineWidth = Math.max(1, b[2] * 0.004);
    g.beginPath(); g.moveTo(h[0], h[1]); g.quadraticCurveTo(lerp(h[0], b[0], 0.3) + b[2] * 0.05, lerp(h[1], b[1], 0.6), b[0], b[1] + b[2] * 0.13); g.stroke();
    g.fillStyle = L.balloon;
    g.beginPath(); g.ellipse(b[0], b[1], b[2] * 0.11, b[2] * 0.13, 0, 0, TAU); g.fill();
    g.fillStyle = rgba('#ffffff', 0.35);
    g.beginPath(); g.ellipse(b[0] - b[2] * 0.035, b[1] - b[2] * 0.05, b[2] * 0.025, b[2] * 0.04, -0.4, 0, TAU); g.fill();
  }
  g.restore();
  return { head: hp, hands: [AL.h, AR.h], chest: P(0, r.chest), rig: r };
}

export function drawHeadBack(g, L, R) {
  if (L.outfit === 'mascot') return;
  g.fillStyle = shade(L.skin, -0.05);
  g.beginPath(); g.ellipse(-R * 0.98, R * 0.1, R * 0.15, R * 0.2, 0, 0, TAU); g.ellipse(R * 0.98, R * 0.1, R * 0.15, R * 0.2, 0, 0, TAU); g.fill();
  g.fillStyle = L.skin;
  g.beginPath(); g.ellipse(0, 0, R, R * 1.03, 0, 0, TAU); g.fill();
  const c = L.hair;
  g.fillStyle = c;
  if (L.style === 'bald') {
    g.beginPath(); g.ellipse(0, R * 0.35, R * 0.95, R * 0.45, 0, 0, Math.PI); g.fill();
    g.fillStyle = rgba('#ffffff', 0.25); g.beginPath(); g.ellipse(R * 0.2, -R * 0.55, R * 0.3, R * 0.14, 0.3, 0, TAU); g.fill();
    return;
  }
  const low = L.style === 'long' ? 2.0 : L.style === 'bob' || L.style === 'bun' ? 0.85 : L.style === 'perm' ? 0.3 : 0.62;
  g.beginPath();
  g.arc(0, 0, R * (L.style === 'perm' ? 1.12 : 1.06), Math.PI * 0.95, Math.PI * 2.05);
  g.lineTo(R * 1.04, R * low);
  g.quadraticCurveTo(0, R * (low + 0.2), -R * 1.04, R * low);
  g.closePath(); g.fill();
  if (L.style === 'spiky') for (let i = 0; i < 5; i++) { const a = Math.PI * (1.1 + i * 0.2); g.beginPath(); g.moveTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9); g.lineTo(Math.cos(a + 0.1) * R * 1.25, Math.sin(a + 0.1) * R * 1.25); g.lineTo(Math.cos(a + 0.2) * R * 0.9, Math.sin(a + 0.2) * R * 0.9); g.fill(); }
  if (L.style === 'bun') { g.beginPath(); g.arc(0, -R * 0.95, R * 0.38, 0, TAU); g.fill(); }
  if (L.style === 'pony') { g.beginPath(); g.ellipse(0, R * 0.9, R * 0.22, R * 0.55, 0, 0, TAU); g.fill(); }
  if (L.style === 'topknot') { g.beginPath(); g.ellipse(0, -R * 1.08, R * 0.2, R * 0.16, 0, 0, TAU); g.fill(); }
  if (L.style === 'perm') for (let i = 0; i < 7; i++) { const a = Math.PI * (1 + i / 6); g.beginPath(); g.arc(Math.cos(a) * R, Math.sin(a) * R * 0.9, R * 0.3, 0, TAU); g.fill(); }
  if (L.hat && L.style !== 'cap') {
    g.fillStyle = L.hat;
    g.beginPath(); g.arc(0, -R * 0.2, R * 1.08, Math.PI, TAU); g.closePath(); g.fill();
    g.fillStyle = shade(L.hat, -0.12); g.beginPath(); g.ellipse(0, -R * 0.2, R * 1.34, R * 0.2, 0, 0, TAU); g.fill();
  }
  if (L.style === 'cap') {
    g.fillStyle = L.hat || '#e0564f';
    g.beginPath(); g.arc(0, -R * 0.12, R * 1.06, Math.PI, TAU); g.closePath(); g.fill();
    g.fillStyle = shade(L.hat || '#e0564f', -0.2); g.fillRect(-R * 0.3, -R * 0.2, R * 0.6, R * 0.1);
  }
  if (L.headphones) {
    g.strokeStyle = shade(L.headphones, -0.25); g.lineWidth = 0.022;
    g.beginPath(); g.arc(0, -R * 0.05, R * 1.12, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
  }
}

function drawCart(g, P, r, st) {
  const side = 1;
  const a = P(side * (r.shW + 0.22), 0.72), b = P(side * (r.shW + 0.44), 0.18), s = a[2];
  g.fillStyle = '#6a4a7a';
  g.beginPath(); g.roundRect(a[0], a[1], b[0] - a[0], b[1] - a[1], s * 0.05); g.fill();
  g.strokeStyle = rgba('#f0d7ff', 0.5); g.lineWidth = s * 0.012;
  for (let i = 1; i < 4; i++) { const x = lerp(a[0], b[0], i / 4); g.beginPath(); g.moveTo(x, a[1]); g.lineTo(x, b[1]); g.stroke(); }
  for (let i = 1; i < 5; i++) { const y = lerp(a[1], b[1], i / 5); g.beginPath(); g.moveTo(a[0], y); g.lineTo(b[0], y); g.stroke(); }
  const h = P(side * (r.shW + 0.3), 0.98);
  g.strokeStyle = '#b8b8c0'; g.lineWidth = s * 0.018;
  g.beginPath(); g.moveTo(lerp(a[0], b[0], 0.3), a[1]); g.lineTo(h[0], h[1]); g.lineTo(h[0] - s * 0.08, h[1]); g.stroke();
  const w = P(side * (r.shW + 0.33), 0.08);
  dot(g, w, s * 0.05, '#2c2c34');
  dot(g, w, s * 0.02, '#8a8a96');
}

// the tofu mascot: a block of silken tofu with a spring onion sprout. Wobbles like it should.
function drawMascot(g, cam, L, st) {
  const P = projector(cam, st, { chest: 1.1, headY: 1.9, shoulder: 1.4 });
  const wob = st.wobble || 0, sq = st.sq || 0;
  const back = st.view === 'back';
  const base = L.top, acc = L.accent;
  g.save();
  if (st.alpha != null && st.alpha < 1) g.globalAlpha = st.alpha;
  // legs
  for (const side of [-1, 1]) {
    const h = P(side * 0.18, 0.32), a = P(side * 0.2, 0.05);
    line(g, [h, a], h[2] * 0.14, shade(base, -0.08));
    g.fillStyle = acc; g.beginPath(); g.ellipse(a[0], a[1], a[2] * 0.09, a[2] * 0.05, 0, 0, TAU); g.fill();
  }
  const w = 0.42 * (1 + sq * 0.5), top = 1.72 * (1 - sq * 0.6), bot = 0.26;
  const wv = (x) => Math.sin(x * 5 + (st.t || 0) * 11) * wob * 0.05;
  const pts = [[-w, bot + 0.02], [-w - 0.02, (bot + top) / 2], [-w + 0.05 + wv(0), top + wv(1)], [0, top + 0.02 + wv(2)], [w - 0.05 + wv(3), top + wv(4)], [w + 0.02, (bot + top) / 2], [w, bot + 0.02], [0, bot - 0.01]];
  g.fillStyle = shade(base, -0.06);
  blob(g, pts.map(([x, y]) => P(x, y))); g.fill();
  // the top face of the block, catching the light
  g.fillStyle = shade(base, 0.35);
  blob(g, [P(-w + 0.08, top - 0.04), P(0, top + 0.03 + wv(2)), P(w - 0.08, top - 0.04), P(0, top - 0.1)]); g.fill();
  // arms
  for (const side of [-1, 1]) {
    const A = st.arms?.[side < 0 ? 0 : 1] || { a: 0.5 };
    const s0 = P(side * (w - 0.02), 1.0), e = P(side * (w + 0.1 + Math.sin(A.a) * 0.18), 1.0 - Math.cos(A.a) * 0.18);
    line(g, [s0, e], s0[2] * 0.12, shade(base, -0.08));
    dot(g, e, e[2] * 0.07, WHITE);
  }
  if (!back) {
    const f = st.face || {};
    const c = P(0, top - 0.46);
    g.save(); g.translate(c[0], c[1]); g.scale(c[2] * 1.7, c[2] * 1.7);
    const kind = f.eyes || 'dot';
    const E = (x) => {
      if (kind === 'squeeze' || kind === 'closed' || kind === 'happy' || kind === 'dizzy') { eye(g, x, 0, kind, x < 0 ? 1 : -1, f); return; }
      g.fillStyle = INK; g.beginPath(); g.ellipse(x + (f.look || 0) * 0.01, 0, 0.034, 0.042, 0, 0, TAU); g.fill();
      g.fillStyle = WHITE; g.beginPath(); g.arc(x - 0.01, -0.014, 0.012, 0, TAU); g.fill();
    };
    E(-0.1); E(0.1);
    g.fillStyle = rgba(BLUSH, 0.6);
    g.beginPath(); g.ellipse(-0.165, 0.05, 0.045, 0.026, 0, 0, TAU); g.ellipse(0.165, 0.05, 0.045, 0.026, 0, 0, TAU); g.fill();
    mouth(g, f.mouth === 'flat' || !f.mouth ? 'cat' : f.mouth, 1.1, 0.045, f);
    g.restore();
    // a drop of soy sauce on the belly, like a badge
    const b = P(0.2, 0.62);
    g.fillStyle = '#5a2e1c';
    g.beginPath(); g.moveTo(b[0], b[1] - b[2] * 0.07); g.quadraticCurveTo(b[0] + b[2] * 0.05, b[1], b[0], b[1] + b[2] * 0.035); g.quadraticCurveTo(b[0] - b[2] * 0.05, b[1], b[0], b[1] - b[2] * 0.07); g.fill();
  }
  // spring onion sprout
  const s0 = P(0.05, top), s1 = P(0.05 + Math.sin((st.t || 0) * 3) * 0.03 + (st.sway || 0) * 0.4, top + 0.24);
  line(g, [s0, s1], s0[2] * 0.035, '#5fbf5a');
  line(g, [s0, P(0.14 + (st.sway || 0) * 0.3, top + 0.18)], s0[2] * 0.03, '#79d06a');
  g.restore();
  return { head: P(0, top - 0.42), hands: [], chest: P(0, 1.1), rig: { chest: 1.1, headY: top - 0.42, R: 0.3 } };
}

// a commuter inside the car: shoulders and head only, drawn around a screen anchor
export function drawCrowdHead(g, L, x, y, s, f, opts = {}) {
  const R = 0.15 * (L.head || 1);
  const shW = 0.24 * Math.min(1.5, L.sw / 0.46);
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (opts.rot) g.rotate(opts.rot);
  if (opts.sx) g.scale(opts.sx, opts.sy || 1);
  // standing in a doorway you see the whole of them: coat, then trousers down to the floor
  if (opts.torso) {
    const T = opts.torso, hip = R * 2.2 + (T - R * 2.2) * 0.45;
    g.fillStyle = L.legs || '#2d3040';
    g.fillRect(-shW * 0.62, hip - 0.05, shW * 0.56, T - hip + 0.05);
    g.fillRect(shW * 0.06, hip - 0.05, shW * 0.56, T - hip + 0.05);
    g.fillStyle = shade(L.top, -0.1);
    g.beginPath(); g.roundRect(-shW * 0.9, R * 2.2, shW * 1.8, hip - R * 2.2, 0.05); g.fill();
    g.fillStyle = 'rgba(20,16,32,0.18)'; g.fillRect(-shW * 0.9, hip - 0.06, shW * 1.8, 0.06);
  }
  // shoulders
  g.fillStyle = L.outfit === 'mascot' ? '#fff6de' : L.top;
  g.beginPath();
  g.moveTo(-shW, R * 3.2);
  g.quadraticCurveTo(-shW - 0.02, R * 1.35, -shW * 0.55, R * 1.08);
  g.lineTo(shW * 0.55, R * 1.08);
  g.quadraticCurveTo(shW + 0.02, R * 1.35, shW, R * 3.2);
  g.closePath(); g.fill();
  if (L.outfit === 'suit' || L.outfit === 'suitW') {
    g.fillStyle = L.shirt;
    g.beginPath(); g.moveTo(-0.06, R * 1.05); g.lineTo(0.06, R * 1.05); g.lineTo(0, R * 2.0); g.closePath(); g.fill();
    if (L.tie && L.outfit === 'suit') { g.fillStyle = L.tie; g.beginPath(); g.moveTo(-0.014, R * 1.1); g.lineTo(0.014, R * 1.1); g.lineTo(0.022, R * 2.1); g.lineTo(-0.022, R * 2.1); g.closePath(); g.fill(); }
  }
  if (opts.phone) {
    g.fillStyle = L.skin; g.beginPath(); g.arc(0.08, R * 1.7, 0.035, 0, TAU); g.fill();
    g.fillStyle = '#2a2d3a'; g.beginPath(); g.roundRect(0.05, R * 1.25, 0.06, 0.1, 0.01); g.fill();
    g.fillStyle = '#9fd0ff'; g.globalAlpha *= 0.7; g.fillRect(0.057, R * 1.28, 0.046, 0.075); g.globalAlpha /= 0.7;
  }
  if (opts.back) drawHeadBack(g, L, R);
  else drawHead(g, L, f || {}, R, opts.t || 0, { lod: opts.lod ?? 1 });
  if (opts.hands) {
    // palms flat on the glass
    const hc = L.skin;
    g.fillStyle = rgba('#fff4ee', 0.35);
    for (const side of [-1, 1]) {
      const hx = side * (R * 1.5 + opts.hands * 0.02), hy = R * 0.2;
      g.fillStyle = hc; g.beginPath(); g.ellipse(hx, hy, 0.05, 0.06, side * 0.2, 0, TAU); g.fill();
      for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(hx + (i - 1.5) * 0.022, hy - 0.07, 0.011, 0.03, 0, 0, TAU); g.fill(); }
      g.fillStyle = rgba('#fff4ee', 0.4); g.beginPath(); g.ellipse(hx, hy, 0.035, 0.04, 0, 0, TAU); g.fill();
    }
  }
  g.restore();
}
