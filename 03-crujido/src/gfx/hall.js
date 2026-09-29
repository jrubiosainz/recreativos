// The hall, seen from your seat: the screen in its gilt frame and the glow it throws on the walls,
// the rows in front of you (this film's cast, the only people near enough to hear you), the far
// rows of strangers, the neighbours at your elbows. One perspective places everybody: someone
// z metres ahead is f / (z + Z0) px per metre, with their head `drop` metres under your eyes.
import { clamp, lerp, mix, hash, canvas, giltFrame, velvet } from './paint.js';

export const Z0 = 1.2, HEAD = 0.13, COL = 0.55, ROWZ = 0.95;
const NAVY = '#0b1020';

export function layout(W, H) {
  const port = H > W * 1.1, m = Math.round(clamp(Math.min(W, H) * 0.028, 8, 28));
  let L;
  if (port) {
    const sw = W - m * 2, sh = Math.round(sw * 9 / 16), sy = Math.round(clamp(H * 0.064, 36, 84));
    const mh = Math.round(clamp(W * 0.082, 26, 60));
    L = { screen: { x: m, y: sy, w: sw, h: sh }, meter: { x: m, y: sy + sh + Math.round(m * 1.1), w: sw, h: mh, dir: 'h' } };
    const top = L.meter.y + mh;
    persp(L, lerp(top, H, 0.21), lerp(top, H, 0.41), Math.min(W * 0.078, H * 0.036), 0.8);
  } else {
    const mw = Math.round(clamp(H * 0.115, 46, 104));
    const sh = Math.round(Math.min(H * 0.58, (W - 2 * (mw + m * 2.5)) * 9 / 16)), sw = Math.round(sh * 16 / 9);
    L = { screen: { x: Math.round((W - sw) / 2), y: Math.round(H * 0.045), w: sw, h: sh }, meter: { x: W - mw - m, y: Math.round(H * 0.035), w: mw, h: Math.round(H * 0.74), dir: 'v' } };
    persp(L, H * 0.655, H * 0.8, H * 0.058, 0.75);
    L.floor = L.screen.y + L.screen.h * 0.99;
  }
  return Object.assign(L, { W, H, m, port, cx: W / 2 });
}
// head height on screen for a row at depth z: past row 3 the floor flattens out toward the screen (landscape),
// so the far rows pile up just under the picture instead of climbing into it
export function headY(L, z) {
  const k = L.f / (z + Z0), z3 = 3 * ROWZ;
  if (L.floor == null || z <= z3) return L.hz + L.drop * k;
  const k3 = L.f / (z3 + Z0), y3 = L.hz + L.drop * k3;
  return L.floor + (y3 - L.floor) * k / k3;
}
// the camera, from where rows 3 and 1 should sit (head centres y3, y1) and how big row 1 is (S1)
function persp(L, y3, y1, S1, kx) {
  const k1 = S1 / HEAD, f = k1 * (ROWZ + Z0), k3 = f / (3 * ROWZ + Z0), drop = (y1 - y3) / (k1 - k3);
  Object.assign(L, { f, kx, drop, hz: y1 - drop * k1 });
}

// where someone sitting at (x, z) appears: head centre (X, Y) and head half-height S, in px
export function place(L, x, z) {
  if (z < 0.3) {
    // beside you: at the edge of your view, near your eye level, big
    const k1 = L.f / (ROWZ + Z0), S = HEAD * k1 * 1.45;
    const X = L.cx + Math.sign(x) * (L.W / 2 - S * (L.port ? 0.25 : 1.1));
    return { X, Y: L.hz + L.drop * k1 + S * 0.55, S, k: k1 * 1.45 };
  }
  const k = L.f / (z + Z0);
  return { X: L.cx + x * k * L.kx, Y: L.hz + L.drop * k, S: HEAD * k, k };
}

// ---- the room: wall, the screen's glow on it, curtains, frame ----
export function room(g, L, light, dpr) {
  const { W, H, screen: s } = L;
  g.fillStyle = NAVY; g.fillRect(0, 0, W, H);
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2, a = light.a, fl = light.flash || 0;
  const col = (al) => `rgba(${light.r | 0},${light.g | 0},${light.b | 0},${al})`;
  // the picture lights the wall, the ceiling and the first rows' shoulders
  let gr = g.createRadialGradient(cx, cy, s.h * 0.2, cx, cy + s.h * 0.2, Math.max(W, H) * 0.85);
  gr.addColorStop(0, col(0.34 * a + 0.3 * fl)); gr.addColorStop(0.45, col(0.1 * a + 0.12 * fl)); gr.addColorStop(1, col(0));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // curtains either side of the screen, their inner folds catching the light
  const cw = L.port ? L.m * 0.9 : Math.min(s.x * 0.55, s.w * 0.12), ch = L.hz - s.y + s.h * 0.1;
  if (cw > 3) {
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? s.x - cw - L.m * 0.25 : s.x + s.w + L.m * 0.25;
      g.fillStyle = velvet(g, '#5a0c16', Math.max(6, cw / 3.2), dpr); g.fillRect(x0, s.y - L.m, cw, ch + L.m);
      gr = g.createLinearGradient(side < 0 ? x0 + cw : x0, 0, side < 0 ? x0 : x0 + cw, 0);
      gr.addColorStop(0, col(0.3 * a + 0.25 * fl)); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
      g.fillStyle = gr; g.fillRect(x0, s.y - L.m, cw, ch + L.m);
    }
  }
  if (!L.port) {
    // the pelmet over the screen
    const py = s.y - L.m * 1.6, pw = s.w + cw * 2 + L.m * 2;
    g.fillStyle = velvet(g, '#4a0a12', Math.max(6, pw / 60), dpr); g.fillRect(cx - pw / 2, 0, pw, py + L.m * 0.6);
    gr = g.createLinearGradient(0, 0, 0, py + L.m * 0.6); gr.addColorStop(0, 'rgba(0,0,0,0.65)'); gr.addColorStop(1, col(0.22 * a + 0.2 * fl));
    g.fillStyle = gr; g.fillRect(cx - pw / 2, 0, pw, py + L.m * 0.6);
    g.fillStyle = 'rgba(214,168,82,0.55)'; g.fillRect(cx - pw / 2, py + L.m * 0.45, pw, Math.max(1, L.m * 0.12));
  }
  giltFrame(g, s.x, s.y, s.w, s.h, Math.max(2, L.m * 0.32), { glow: a * 0.6 });
}

// the dim light from the screen that reaches the room, for things that are not people
export const roomLit = (light) => clamp(0.28 + 0.62 * light.a + 0.5 * (light.flash || 0));

// ---- seats: the velvet backs of the row in front, as sprites darkened by distance and light ----
const dark = new WeakMap();
function silhouette(img) {
  let c = dark.get(img);
  if (!c) {
    c = canvas(img.width, img.height); const x = c.getContext('2d');
    x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = NAVY; x.fillRect(0, 0, c.width, c.height);
    dark.set(img, c);
  }
  return c;
}
export function seatRow(g, L, row, img, lit, taken) {
  const kh = L.f / (row * ROWZ + Z0), z = row * ROWZ - 0.22, k = L.f / (z + Z0), w = 0.52 * k * L.kx, h = w * (img ? img.height / img.width : 1.02);
  const top = L.hz + L.drop * kh + HEAD * kh * 1.55, sil = img && silhouette(img), fade = clamp(1 - lit * (1.05 - row * 0.12));
  const n = Math.ceil((L.W / 2) / (COL * kh * L.kx)) + 1;
  for (let c = -n; c <= n; c++) {
    const X = L.cx + c * COL * kh * L.kx;
    if (X + w / 2 < 0 || X - w / 2 > L.W) continue;
    if (img) {
      g.drawImage(img, X - w / 2, top, w, h);
      g.globalAlpha = fade; g.drawImage(sil, X - w / 2, top, w, h); g.globalAlpha = 1;
    } else { g.fillStyle = '#2a0a10'; g.beginPath(); g.roundRect?.(X - w / 2, top, w, h, w * 0.18); g.fill(); }
  }
  // under the backs: the dark between the rows (in front of you, the lower half of the seat back)
  const y0 = top + h * 0.97;
  if (row === 1) { const gr = g.createLinearGradient(0, y0, 0, L.H); gr.addColorStop(0, '#1c060c'); gr.addColorStop(0.5, NAVY); gr.addColorStop(1, '#05070e'); g.fillStyle = gr; }
  else g.fillStyle = NAVY;
  g.fillRect(0, y0, L.W, L.H);
  return top;
}

// ---- the far rows: strangers too far away to hear you, cheap silhouettes rimmed by the screen ----
const LOOKS = ['short', 'long', 'curly', 'bun', 'cap', 'bald', 'bob', 'short', 'side', 'pony', 'short', 'long'];
export function makeCrowd(seed = 1, rows = [4, 5, 6, 7, 8, 9, 10, 11, 12]) {
  const out = [];
  for (const r of rows) for (let c = -8; c <= 8; c++) {
    const h = hash(seed * 31.7 + r * 13.1 + c * 7.7);
    if (h < 0.34 + (r - 4) * 0.03) continue;
    out.push({ r, x: (c + (hash(h * 9.1) - 0.5) * 0.5) * COL, st: LOOKS[Math.floor(hash(h * 5.3) * LOOKS.length)], h,
      dy: (hash(h * 3.7) - 0.5) * 0.1, sc: 0.84 + hash(h * 2.1) * 0.3, tilt: (hash(h * 8.3) - 0.5) * 0.3, tone: hash(h * 6.9) });
  }
  return out;
}
function blob(g, p, X, Y, S, off) {
  const w = S * (p.st === 'curly' ? 0.98 : p.st === 'long' || p.st === 'bob' ? 0.9 : 0.8), hh = S * (p.st === 'curly' ? 1.05 : 1);
  g.beginPath();
  g.ellipse(X, Y + off, w, hh, p.tilt, 0, Math.PI * 2);
  if (p.st === 'bun') g.ellipse(X + p.tilt * S, Y - S * 0.95 + off, S * 0.38, S * 0.34, 0, 0, Math.PI * 2);
  if (p.st === 'pony') g.ellipse(X + S * 0.1, Y + S * 0.6 + off, S * 0.24, S * 0.6, 0.2, 0, Math.PI * 2);
  if (p.st === 'cap') g.ellipse(X, Y - S * 0.25 + off, S * 0.95, S * 0.62, 0, Math.PI, Math.PI * 2);
  g.moveTo(X - S * 1.5, Y + S * 3.2);
  g.quadraticCurveTo(X - S * 1.5, Y + S * 0.8 + off, X - S * 0.32, Y + S * 0.66 + off);
  g.lineTo(X + S * 0.32, Y + S * 0.66 + off);
  g.quadraticCurveTo(X + S * 1.5, Y + S * 0.8 + off, X + S * 1.5, Y + S * 3.2);
  g.fill();
  if (p.st === 'long') { g.beginPath(); g.ellipse(X, Y + S * 0.6 + off, w * 0.95, S * 0.9, 0, 0, Math.PI * 2); g.fill(); }
}
export function drawCrowd(g, L, crowd, light, t, jolt) {
  const r0 = Math.min(255, light.r * 1.05 + 24) | 0, g0 = Math.min(255, light.g * 1.05 + 22) | 0, b0 = Math.min(255, light.b * 1.05 + 30) | 0;
  const rowsDesc = [...new Set(crowd.map((p) => p.r))].sort((a, b) => b - a);
  for (const r of rowsDesc) {
    const z = r * ROWZ, k = L.f / (z + Z0), S0 = HEAD * k, depth = clamp((r - 4) / 6);
    const rim = `rgba(${r0},${g0},${b0},${clamp((0.1 + 0.42 * light.a + 0.35 * (light.flash || 0)) * (1 - depth * 0.55))})`;
    for (const p of crowd) {
      if (p.r !== r) continue;
      const X = L.cx + p.x * k * L.kx, S = S0 * p.sc, j = jolt ? jolt(p.h) : 0;
      if (X < -S * 2 || X > L.W + S * 2) continue;
      const Y = headY(L, z) + p.dy * k - j * S + Math.sin(t * 0.6 + p.h * 40) * S * 0.03;
      g.fillStyle = rim; blob(g, p, X, Y, S, -Math.max(0.8, S * 0.09));
      g.fillStyle = mix(p.tone > 0.5 ? '#161a2a' : '#1b1622', NAVY, 0.25 + depth * 0.6); blob(g, p, X, Y, S, 0);
    }
    // the tops of their seat backs, a dark band with a line of light
    const kh = k, top = headY(L, z) + HEAD * kh * 1.5, sw = 0.52 * kh * L.kx;
    g.fillStyle = mix('#2c0a12', NAVY, 0.35 + depth * 0.55);
    const n = Math.ceil(L.W / 2 / (COL * kh * L.kx)) + 1;
    for (let c = -n; c <= n; c++) { const X = L.cx + c * COL * kh * L.kx; g.beginPath(); g.ellipse(X, top + sw * 0.35, sw * 0.5, sw * 0.35, 0, Math.PI, Math.PI * 2); g.fill(); }
    g.fillRect(0, top + sw * 0.35 - 0.5, L.W, sw * 0.9);
  }
}

// the aisle lights: a dotted line of amber steps down each side
export function aisle(g, L, lit) {
  for (const side of [-1, 1]) for (let r = 1; r <= 8; r++) {
    const k = L.f / (r * ROWZ + Z0), X = L.cx + side * 3.2 * COL * k * L.kx * (L.port ? 1.25 : 1.9), Y = L.hz + (L.drop + 0.62) * k;
    if (X < 2 || X > L.W - 2) continue;
    const rad = Math.max(1, k * 0.012);
    g.fillStyle = `rgba(255,170,80,${0.55 + 0.2 * (1 - lit)})`; g.beginPath(); g.arc(X, Y, rad, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,150,60,0.12)'; g.beginPath(); g.arc(X, Y, rad * 5, 0, Math.PI * 2); g.fill();
  }
}

// film grain and a vignette over the whole view, so the flat shapes sit in the painted film
export function finish(g, L, t, dpr, tiles) {
  const { W, H } = L;
  const vg = g.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  if (tiles) {
    const tile = tiles[Math.floor(t * 24) % tiles.length], p = g.createPattern(tile, 'repeat');
    p.setTransform?.(new DOMMatrix().translate(hash(Math.floor(t * 24)) * 160, hash(Math.floor(t * 24) + 7) * 160).scale(1 / dpr, 1 / dpr));
    g.globalAlpha = 0.05; g.globalCompositeOperation = 'overlay'; g.fillStyle = p; g.fillRect(0, 0, W, H);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
}
