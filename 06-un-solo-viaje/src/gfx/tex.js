// The building's surfaces and fittings, painted once into offscreen pictures and then pasted into
// the rooms in perspective: terrazo, glazed tiles, parquet, the pavement of «tacos», doors and their
// brass, the portal's glass and ironwork, the lift, the mailboxes, the switches with their pilot,
// the entryphone, notices, a window onto the light well. Sizes are in metres; `ppm` is the detail.
import { PAL, FACE, TEXT, canvas, rrect, ell, poly, darker, lighter, tone, rgba } from './paint.js';
import { mulberry32, clamp } from '../util.js';

const cache = new Map();
const memo = (key, fn) => { let c = cache.get(key); if (!c) cache.set(key, (c = fn())); return c; };
export const clearTex = () => cache.clear();

// ---------- floors and walls (tileable, 1 m square unless said) ----------
export const terrazo = (base = PAL.terr, seed = 3) => memo('terr' + base + seed, () => {
  const N = 512, c = canvas(N, N), g = c.getContext('2d'), R = mulberry32(seed);
  g.fillStyle = base; g.fillRect(0, 0, N, N);
  // the cement between the chips is mottled
  for (let i = 0; i < 90; i++) {
    const x = R() * N, y = R() * N, r = 20 + R() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(R() < 0.5 ? '#ffffff' : '#6d4a3c', 0.05)); gr.addColorStop(1, rgba('#ffffff', 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const chip = (x, y, r, col) => {
    const n = 4 + ((R() * 4) | 0), a0 = R() * 6.28, pts = [];
    for (let k = 0; k < n; k++) { const a = a0 + (k / n) * 6.28, rr = r * (0.55 + R() * 0.6); pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * (0.7 + R() * 0.5)); }
    g.fillStyle = col;
    for (const [dx, dy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) { g.save(); g.translate(dx, dy); poly(g, pts); g.fill(); g.restore(); }
  };
  const C = PAL.chips, W = [4, 3, 3, 3, 1, 3, 2, 3];
  const pickC = () => { let t = R() * 22, i = 0; while (t > W[i]) { t -= W[i]; i++; } return C[Math.min(i, C.length - 1)]; };
  for (let i = 0; i < 2600; i++) chip(R() * N, R() * N, 1.2 + Math.pow(R(), 2.2) * 6.5, pickC());
  for (let i = 0; i < 60; i++) chip(R() * N, R() * N, 6 + R() * 7, pickC());
  return c;
});

// glazed 20 cm tiles up to the dado, the moulding on top: 1 m wide, `h` m tall
export const tiles = (h = 1.4, col = PAL.tile, seed = 5) => memo('tile' + h + col + seed, () => {
  const P = 360, w = P, H = Math.round(h * P), c = canvas(w, H), g = c.getContext('2d'), R = mulberry32(seed);
  const T = P * 0.2, gr = 3, band = P * 0.07;
  g.fillStyle = PAL.grout; g.fillRect(0, 0, w, H);
  for (let r = 0; r * T < H - band; r++) {
    for (let k = 0; k < 5; k++) {
      const x = k * T + gr / 2, y = H - (r + 1) * T + gr / 2, s = T - gr;
      const v = (R() - 0.5) * 0.14, base = v > 0 ? lighter(col, v) : darker(col, -v);
      g.fillStyle = base; rrect(g, x, y, s, s, 3); g.fill();
      // the glaze pools at the bottom edge and shines at the top
      const gl = g.createLinearGradient(x, y, x + s * 0.5, y + s);
      gl.addColorStop(0, rgba('#ffffff', 0.2)); gl.addColorStop(0.35, rgba('#ffffff', 0.03)); gl.addColorStop(1, rgba('#20301a', 0.12));
      g.fillStyle = gl; rrect(g, x, y, s, s, 3); g.fill();
      g.fillStyle = rgba('#ffffff', 0.18 + R() * 0.1);
      ell(g, x + s * 0.28, y + s * 0.22, s * 0.16, s * 0.05, -0.5); g.fill();
    }
  }
  // the moulding: a rounded bar in a darker glaze
  const y0 = 0;
  g.fillStyle = darker(col, 0.28); g.fillRect(0, y0, w, band);
  const m = g.createLinearGradient(0, y0, 0, y0 + band);
  m.addColorStop(0, rgba('#ffffff', 0.05)); m.addColorStop(0.35, rgba('#ffffff', 0.32)); m.addColorStop(0.6, rgba('#ffffff', 0.05)); m.addColorStop(1, rgba('#101a0c', 0.3));
  g.fillStyle = m; g.fillRect(0, y0, w, band);
  g.fillStyle = PAL.grout; g.fillRect(0, band - 2, w, 3);
  return c;
});

export const parquet = (seed = 9) => memo('parq' + seed, () => {
  const N = 512, c = canvas(N, N), g = c.getContext('2d'), R = mulberry32(seed);
  const pw = N / 7, pl = N / 2;
  for (let i = 0; i < 7; i++) {
    const off = (i % 2) * pl * 0.5 + R() * 20;
    for (let k = -1; k < 3; k++) {
      const y = off + k * pl, v = (R() - 0.5) * 0.2;
      g.fillStyle = v > 0 ? lighter(PAL.parq, v) : darker(PAL.parq, -v);
      g.fillRect(i * pw, y, pw, pl);
      g.strokeStyle = rgba('#5a3418', 0.18); g.lineWidth = 1;
      for (let j = 0; j < 5; j++) { const x = i * pw + 4 + R() * (pw - 8); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 6, y + pl * 0.3, x - 6, y + pl * 0.6, x + 2, y + pl); g.stroke(); }
      g.fillStyle = rgba('#3b200e', 0.55); g.fillRect(i * pw, y, pw, 2);
    }
    g.fillStyle = rgba('#3b200e', 0.45); g.fillRect(i * pw, 0, 2, N);
  }
  const gl = g.createLinearGradient(0, 0, N, N); gl.addColorStop(0, rgba('#ffffff', 0.08)); gl.addColorStop(1, rgba('#ffffff', 0));
  g.fillStyle = gl; g.fillRect(0, 0, N, N);
  return c;
});

// the pavement: grey 20 cm slabs with sixteen studs each (the «baldosa de tacos»)
export const pavement = (col = PAL.pave, seed = 13) => memo('pave' + col + seed, () => {
  const N = 500, c = canvas(N, N), g = c.getContext('2d'), R = mulberry32(seed), T = N / 5;
  g.fillStyle = darker(col, 0.25); g.fillRect(0, 0, N, N);
  for (let i = 0; i < 5; i++) for (let k = 0; k < 5; k++) {
    const x = i * T + 1.5, y = k * T + 1.5, v = (R() - 0.5) * 0.12;
    g.fillStyle = v > 0 ? lighter(col, v) : darker(col, -v); g.fillRect(x, y, T - 3, T - 3);
    const s = (T - 3) / 4;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      const sx = x + a * s + s * 0.2, sy = y + b * s + s * 0.2, ss = s * 0.6;
      g.fillStyle = rgba('#000000', 0.12); rrect(g, sx + 1.5, sy + 1.5, ss, ss, 3); g.fill();
      g.fillStyle = lighter(col, 0.1 + v); rrect(g, sx, sy, ss, ss, 3); g.fill();
    }
    for (let j = 0; j < 14; j++) { g.fillStyle = rgba(R() < 0.5 ? '#ffffff' : '#000000', 0.07); g.fillRect(x + R() * T, y + R() * T, 2, 2); }
  }
  return c;
});
export const asphalt = (seed = 17) => memo('asph' + seed, () => {
  const N = 256, c = canvas(N, N), g = c.getContext('2d'), R = mulberry32(seed);
  g.fillStyle = PAL.asph; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 2200; i++) { g.fillStyle = rgba(R() < 0.55 ? '#9a9c9c' : '#2a2b2c', 0.35 + R() * 0.3); g.fillRect(R() * N, R() * N, 1 + R() * 1.6, 1 + R() * 1.6); }
  return c;
});
export const kitchenTiles = () => memo('ktile', () => {
  const P = 300, c = canvas(P, P), g = c.getContext('2d'), R = mulberry32(21), T = P / 6.67;
  g.fillStyle = '#c9cfc8'; g.fillRect(0, 0, P, P);
  for (let i = 0; i * T < P; i++) for (let k = 0; k * T < P; k++) {
    g.fillStyle = tone(PAL.kitchen, '#ffffff', R() * 0.5); g.fillRect(i * T + 1, k * T + 1, T - 2, T - 2);
  }
  return c;
});

// ---------- doors ----------
// a flat's front door, 0.9 × 2.1 m: two raised panels, the brass letter, spyhole, knob and one or
// two locks (the second is the security lock people fit after a burglary on the third floor)
export const DOOR = { w: 0.9, h: 2.1, knobY: 1.0, lockY: [1.05, 1.32], lockX: 0.12 };
export const flatDoor = (letter, locks = 1, hinge = 'L', tint = PAL.wood) => memo(`door${letter}${locks}${hinge}${tint}`, () => {
  const P = 400, w = DOOR.w * P, h = DOOR.h * P, c = canvas(w, h), g = c.getContext('2d'), R = mulberry32(letter.charCodeAt(0));
  g.fillStyle = tint; g.fillRect(0, 0, w, h);
  // grain
  g.strokeStyle = rgba('#2b1408', 0.16); g.lineWidth = 1.2;
  for (let i = 0; i < 40; i++) { const x = R() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 10, h * 0.3, x - 12, h * 0.7, x + 4, h); g.stroke(); }
  const panel = (x, y, pw, ph) => {
    g.fillStyle = darker(tint, 0.22); g.fillRect(x, y, pw, ph);
    g.fillStyle = lighter(tint, 0.08); g.fillRect(x + 10, y + 10, pw - 20, ph - 20);
    g.fillStyle = rgba('#ffffff', 0.08); g.fillRect(x, y, pw, 5); g.fillRect(x, y, 5, ph);
    g.fillStyle = rgba('#000000', 0.2); g.fillRect(x, y + ph - 5, pw, 5); g.fillRect(x + pw - 5, y, 5, ph);
  };
  panel(w * 0.16, h * 0.07, w * 0.68, h * 0.4);
  panel(w * 0.16, h * 0.55, w * 0.68, h * 0.34);
  const L = hinge === 'L' ? w - DOOR.lockX * P : DOOR.lockX * P;   // the lock side is away from the hinge
  // brass: the letter, the spyhole, the knob, the locks, the kick plate
  const brass = (x, y, r) => {
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gr.addColorStop(0, PAL.brassLt); gr.addColorStop(0.6, PAL.brass); gr.addColorStop(1, PAL.brassDk);
    g.fillStyle = gr; ell(g, x, y, r, r); g.fill();
  };
  g.fillStyle = PAL.brass; rrect(g, w / 2 - 34, h - 1.62 * P - 40, 68, 80, 8); g.fill();
  g.fillStyle = PAL.brassDk; g.font = `800 64px ${FACE}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(letter, w / 2, h - 1.62 * P + 3);
  brass(w / 2, h - 1.5 * P, 11); g.fillStyle = '#1a1714'; ell(g, w / 2, h - 1.5 * P, 5, 5); g.fill();
  brass(L, h - DOOR.knobY * P, 22); g.fillStyle = rgba('#ffffff', 0.35); ell(g, L - 7, h - DOOR.knobY * P - 7, 6, 4); g.fill();
  for (let i = 0; i < locks; i++) {
    const y = h - DOOR.lockY[i] * P;
    g.fillStyle = PAL.brassDk; rrect(g, L - 13, y - 22, 26, 44, 12); g.fill();
    g.fillStyle = PAL.brass; rrect(g, L - 11, y - 20, 22, 40, 10); g.fill();
    g.fillStyle = '#1a1714'; ell(g, L, y - 5, 4.5, 4.5); g.fill(); g.fillRect(L - 2, y - 5, 4, 14);
  }
  g.fillStyle = PAL.brass; g.fillRect(0, h - 0.12 * P, w, 0.12 * P);
  g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(0, h - 0.12 * P, w, 3);
  return c;
});

// the building's street door: varnished wood around a tall pane behind iron scrolls, the brass push
// bar, the lock. The glass is see-through: the lobby behind it is drawn first
export const PORTAL = { w: 1.3, h: 2.7, lockY: 1.1, lockX: 0.14 };
export const portal = (night = false) => memo('portal' + night, () => {
  const P = 300, w = PORTAL.w * P, h = PORTAL.h * P, c = canvas(w, h), g = c.getContext('2d');
  const fr = 0.14 * P, gx = fr, gy = fr, gw = w - fr * 2, gh = h * 0.62;
  g.fillStyle = PAL.woodDk; g.fillRect(0, 0, w, h);
  g.fillStyle = rgba('#ffffff', 0.06); g.fillRect(8, 8, w - 16, h - 16);
  // lower panel
  g.fillStyle = darker(PAL.woodDk, 0.2); g.fillRect(fr, gy + gh + fr * 0.6, gw, h - (gy + gh + fr * 0.6) - fr * 1.4);
  g.fillStyle = rgba('#ffffff', 0.07); g.fillRect(fr + 10, gy + gh + fr * 0.6 + 10, gw - 20, 6);
  // the pane: a tint over whatever is behind
  g.clearRect(gx, gy, gw, gh);
  g.fillStyle = night ? rgba('#ffd98a', 0.28) : rgba('#cfe0e6', 0.34); g.fillRect(gx, gy, gw, gh);
  const sh = g.createLinearGradient(gx, gy, gx + gw, gy + gh);
  sh.addColorStop(0, rgba('#ffffff', 0.25)); sh.addColorStop(0.3, rgba('#ffffff', 0.02)); sh.addColorStop(0.55, rgba('#ffffff', 0.14)); sh.addColorStop(0.6, rgba('#ffffff', 0.0));
  g.fillStyle = sh; g.fillRect(gx, gy, gw, gh);
  // ironwork: a frame, bars and C-scrolls
  g.strokeStyle = '#17150f'; g.lineCap = 'round'; g.lineWidth = 7;
  g.strokeRect(gx + 10, gy + 10, gw - 20, gh - 20);
  g.lineWidth = 5;
  for (let i = 1; i < 4; i++) { const x = gx + (gw * i) / 4; g.beginPath(); g.moveTo(x, gy + 10); g.lineTo(x, gy + gh - 10); g.stroke(); }
  const scroll = (x, y, r, dir) => { g.beginPath(); g.arc(x, y, r, dir ? 0 : Math.PI, dir ? Math.PI * 1.6 : Math.PI * 2.6); g.stroke(); };
  for (let k = 0; k < 4; k++) for (let i = 0; i < 4; i++) {
    const cx = gx + (gw * (i + 0.5)) / 4, cy = gy + gh * (0.14 + k * 0.24);
    g.lineWidth = 4; scroll(cx - 9, cy, 12, true); scroll(cx + 9, cy + 16, 12, false);
  }
  g.lineWidth = 6; g.beginPath(); g.moveTo(gx + 10, gy + gh * 0.5); g.lineTo(gx + gw - 10, gy + gh * 0.5); g.stroke();
  // brass push bar and lock
  const by = h - 1.0 * P;
  g.fillStyle = PAL.brassDk; rrect(g, fr * 0.6, by - 9, w - fr * 1.2, 20, 10); g.fill();
  g.fillStyle = PAL.brass; rrect(g, fr * 0.6, by - 11, w - fr * 1.2, 16, 8); g.fill();
  g.fillStyle = rgba('#ffffff', 0.4); g.fillRect(fr * 0.8, by - 9, w - fr * 1.6, 3);
  const lx = w - PORTAL.lockX * P, ly = h - PORTAL.lockY * P;
  g.fillStyle = PAL.brass; rrect(g, lx - 14, ly - 30, 28, 60, 12); g.fill();
  g.fillStyle = '#17130e'; ell(g, lx, ly - 8, 5, 5); g.fill(); g.fillRect(lx - 2.5, ly - 8, 5, 16);
  g.fillStyle = PAL.brass; g.fillRect(0, h - 0.18 * P, w, 0.18 * P);
  g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(0, h - 0.18 * P, w, 4);
  return c;
});

// the lift: brushed steel leaves that slide, or the old wooden door with its slot of a window
export const LIFT = { w: 0.9, h: 2.05 };
export const steelLeaf = () => memo('steel', () => {
  const P = 300, w = (LIFT.w / 2) * P, h = LIFT.h * P, c = canvas(w, h), g = c.getContext('2d'), R = mulberry32(31);
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, PAL.steelDk); gr.addColorStop(0.2, PAL.steel); gr.addColorStop(0.6, PAL.steelLt); gr.addColorStop(1, PAL.steel);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { g.fillStyle = rgba(R() < 0.5 ? '#ffffff' : '#50585c', 0.08); g.fillRect(R() * w, R() * h, 1, 20 + R() * 90); }
  g.fillStyle = rgba('#000000', 0.25); g.fillRect(w - 2, 0, 2, h);
  return c;
});
export const woodLift = (lit = false) => memo('wlift' + lit, () => {
  const P = 300, w = LIFT.w * P, h = LIFT.h * P, c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = PAL.wood; g.fillRect(0, 0, w, h);
  g.fillStyle = darker(PAL.wood, 0.25); g.fillRect(14, 14, w - 28, h - 28);
  g.fillStyle = PAL.wood; g.fillRect(24, 24, w - 48, h - 48);
  const sx = w * 0.42, sw = w * 0.16, sy = h * 0.18, sh = h * 0.5;
  g.fillStyle = PAL.brassDk; g.fillRect(sx - 6, sy - 6, sw + 12, sh + 12);
  const gl = g.createLinearGradient(0, sy, 0, sy + sh);
  if (lit) { gl.addColorStop(0, '#fff1c9'); gl.addColorStop(1, '#f2c86a'); } else { gl.addColorStop(0, '#2c2a26'); gl.addColorStop(1, '#161513'); }
  g.fillStyle = gl; g.fillRect(sx, sy, sw, sh);
  g.strokeStyle = rgba('#000000', 0.4); g.lineWidth = 1.5;
  for (let y = sy + 6; y < sy + sh; y += 6) { g.beginPath(); g.moveTo(sx, y); g.lineTo(sx + sw, y); g.stroke(); }
  g.fillStyle = PAL.brass; rrect(g, w * 0.78, h * 0.47, 22, 90, 10); g.fill();
  g.fillStyle = rgba('#ffffff', 0.35); g.fillRect(w * 0.78 + 5, h * 0.47 + 8, 4, 70);
  return c;
});

// ---------- fittings ----------
export const mailboxes = (seed = 41) => memo('mail' + seed, () => {
  const P = 320, w = 1.25 * P, h = 0.72 * P, c = canvas(w, h), g = c.getContext('2d'), R = mulberry32(seed);
  const names = ['GARCÍA', 'LÓPEZ', 'SANZ', 'RUIZ', 'MORENO', 'GIL', 'NAVARRO', 'ORTEGA', 'DÍAZ', 'MARÍN', 'VIDAL', 'SERRANO', 'ROMERO', 'CANO', 'PEÑA'];
  g.fillStyle = PAL.brassDk; rrect(g, 0, 0, w, h, 8); g.fill();
  const cols = 5, rows = 3, bw = (w - 16) / cols, bh = (h - 16) / rows;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x = 8 + k * bw + 3, y = 8 + r * bh + 3, ww = bw - 6, hh = bh - 6;
    const gr = g.createLinearGradient(x, y, x + ww, y + hh);
    gr.addColorStop(0, PAL.brassLt); gr.addColorStop(0.45, PAL.brass); gr.addColorStop(1, PAL.brassDk);
    g.fillStyle = gr; rrect(g, x, y, ww, hh, 4); g.fill();
    g.fillStyle = '#231a0c'; rrect(g, x + ww * 0.15, y + hh * 0.18, ww * 0.7, hh * 0.12, 3); g.fill();
    g.fillStyle = '#f1ead8'; g.fillRect(x + ww * 0.2, y + hh * 0.5, ww * 0.6, hh * 0.22);
    g.fillStyle = PAL.ink; g.font = `700 ${hh * 0.15}px ${TEXT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`${r + 1}º${'ABCDE'[k]} ${names[(r * 5 + k) % names.length]}`, x + ww / 2, y + hh * 0.615);
    g.fillStyle = '#231a0c'; ell(g, x + ww * 0.85, y + hh * 0.84, 3, 3); g.fill();
    if (R() < 0.35) { g.fillStyle = '#ffffff'; g.save(); g.translate(x + ww * 0.5, y + hh * 0.2); g.rotate((R() - 0.5) * 0.2); g.fillRect(-ww * 0.25, -hh * 0.1, ww * 0.5, hh * 0.1); g.restore(); }
  }
  return c;
});

// the stair light's push button: cream plastic, and the pilot lamp that glows orange in the dark
export const SWITCH = { w: 0.085, h: 0.12, y: 1.15 };
export const switchPlate = () => memo('switch', () => {
  const P = 1400, w = SWITCH.w * P, h = SWITCH.h * P, c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#d9d2bf'; rrect(g, 0, 0, w, h, 10); g.fill();
  g.fillStyle = '#f1ecdd'; rrect(g, 4, 4, w - 8, h - 8, 8); g.fill();
  g.fillStyle = '#c9c1ab'; ell(g, w / 2, h * 0.56, w * 0.33, w * 0.33); g.fill();
  const gr = g.createRadialGradient(w / 2 - 8, h * 0.5, 2, w / 2, h * 0.56, w * 0.3);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e3dcc9');
  g.fillStyle = gr; ell(g, w / 2, h * 0.56, w * 0.28, w * 0.28); g.fill();
  g.fillStyle = '#b8551b'; ell(g, w / 2, h * 0.2, 7, 7); g.fill();       // the pilot (lit in the scene)
  g.fillStyle = '#6d6452'; g.font = `600 ${h * 0.08}px ${TEXT}`; g.textAlign = 'center'; g.fillText('LUZ', w / 2, h * 0.93);
  return c;
});
export const CALL = { w: 0.1, h: 0.17, y: 1.2 };
export const callPlate = (lit = false, arrows = 1) => memo('call' + lit + arrows, () => {
  const P = 1100, w = CALL.w * P, h = CALL.h * P, c = canvas(w, h), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, PAL.steelLt); gr.addColorStop(1, PAL.steelDk);
  g.fillStyle = gr; rrect(g, 0, 0, w, h, 8); g.fill();
  g.fillStyle = lit ? PAL.pilot : '#8a8f91'; ell(g, w / 2, h * 0.58, w * 0.3, w * 0.3); g.fill();
  g.fillStyle = lit ? PAL.pilotHot : '#e3e6e6'; ell(g, w / 2, h * 0.58, w * 0.24, w * 0.24); g.fill();
  g.fillStyle = '#2b2f31'; g.beginPath(); g.moveTo(w / 2, h * 0.14); g.lineTo(w / 2 + 12, h * 0.28); g.lineTo(w / 2 - 12, h * 0.28); g.closePath(); g.fill();
  return c;
});
// the cabin's buttons: ground to eighth, the one you want lit
export const cabinPanel = (to = -1) => memo('panel' + to, () => {
  const P = 800, w = 0.2 * P, h = 0.5 * P, c = canvas(w, h), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, PAL.steel); gr.addColorStop(0.5, PAL.steelLt); gr.addColorStop(1, PAL.steelDk);
  g.fillStyle = gr; rrect(g, 0, 0, w, h, 10); g.fill();
  g.fillStyle = '#131515'; rrect(g, w * 0.2, h * 0.05, w * 0.6, h * 0.1, 6); g.fill();
  for (let i = 0; i <= 8; i++) {
    const col = i % 2, row = 4 - Math.floor(i / 2), x = w * (0.3 + col * 0.4), y = h * (0.27 + row * 0.14);
    const on = i === to;
    g.fillStyle = on ? PAL.pilot : '#9aa0a2'; ell(g, x, y, 20, 20); g.fill();
    g.fillStyle = on ? PAL.pilotHot : '#e8ebeb'; ell(g, x, y, 16, 16); g.fill();
    g.fillStyle = '#23272a'; g.font = `800 20px ${FACE}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(i === 0 ? 'B' : String(i), x, y + 1);
  }
  return c;
});
// the entryphone: a speaker grille and two columns of buttons, one per flat
export const INTERCOM = { w: 0.2, h: 0.4, y: 1.25 };
export const intercom = (floors = 3) => memo('icom' + floors, () => {
  const P = 800, w = INTERCOM.w * P, h = INTERCOM.h * P, c = canvas(w, h), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#d7dbdc'); gr.addColorStop(1, '#9ca2a5');
  g.fillStyle = gr; rrect(g, 0, 0, w, h, 10); g.fill();
  g.fillStyle = '#2d3133';
  for (let i = 0; i < 5; i++) for (let k = 0; k < 7; k++) { ell(g, w * 0.22 + k * w * 0.093, h * 0.07 + i * h * 0.025, 3, 3); g.fill(); }
  const rows = Math.min(6, floors * 2);
  for (let r = 0; r < rows; r++) for (let k = 0; k < 2; k++) {
    const x = w * (0.08 + k * 0.46), y = h * (0.26 + r * 0.12), bw = w * 0.38, bh = h * 0.085;
    g.fillStyle = '#f2f1ea'; rrect(g, x, y, bw * 0.62, bh, 4); g.fill();
    g.fillStyle = '#2a2d2f'; g.font = `700 ${bh * 0.5}px ${TEXT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`${Math.floor(r / 2) + 1}º${'ABCD'[(r % 2) * 2 + k]}`, x + bw * 0.31, y + bh / 2 + 1);
    g.fillStyle = '#8b9194'; ell(g, x + bw * 0.83, y + bh / 2, bh * 0.36, bh * 0.36); g.fill();
    g.fillStyle = '#dfe2e2'; ell(g, x + bw * 0.83, y + bh / 2, bh * 0.28, bh * 0.28); g.fill();
  }
  return c;
});
export const bellPlate = () => memo('bell', () => {
  const P = 1400, w = 0.06 * P, h = 0.09 * P, c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = PAL.brass; rrect(g, 0, 0, w, h, 8); g.fill();
  g.fillStyle = '#efe9da'; ell(g, w / 2, h / 2, w * 0.28, w * 0.28); g.fill();
  return c;
});
// the floor's number, enamel on the wall by the switch
export const plaque = (label) => memo('plq' + label, () => {
  const P = 900, w = 0.2 * P, h = 0.14 * P, c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#23407a'; rrect(g, 0, 0, w, h, 16); g.fill();
  g.strokeStyle = '#f4f1e8'; g.lineWidth = 5; rrect(g, 8, 8, w - 16, h - 16, 10); g.stroke();
  g.fillStyle = '#f4f1e8'; g.font = `800 ${h * 0.62}px ${FACE}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, w / 2, h * 0.54);
  return c;
});
// a notice taped to the wall: a title and a few lines
export const notice = (title, lines, { w = 0.21, h = 0.28, col = '#fbfaf5', ink = PAL.ink, tilt = 0 } = {}) => memo('ntc' + title + lines.join('|') + col, () => {
  const P = 700, W = w * P, H = h * P, c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = col; g.fillRect(0, 0, W, H);
  g.fillStyle = rgba('#000000', 0.06); g.fillRect(0, H - 6, W, 6);
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'top';
  let fs = H * 0.14; g.font = `800 ${fs}px ${FACE}`;
  while (g.measureText(title).width > W * 0.88 && fs > 8) { fs -= 1; g.font = `800 ${fs}px ${FACE}`; }
  g.fillText(title, W / 2, H * 0.1);
  g.font = `500 ${H * 0.062}px ${TEXT}`;
  lines.forEach((l, i) => g.fillText(l, W / 2, H * 0.36 + i * H * 0.085));
  g.fillStyle = rgba('#e8e2c0', 0.8);
  for (const [x, y, r] of [[0, 0, -0.6], [W, 0, 0.6]]) { g.save(); g.translate(x, y); g.rotate(r); g.fillRect(-W * 0.12, -8, W * 0.24, 22); g.restore(); }
  return c;
});
// the light well through the half-landing window: the wall across, its windows, somebody's washing
export const lightWell = (night = false, seed = 51) => memo('well' + night + seed, () => {
  const P = 300, w = 0.9 * P, h = 1.1 * P, c = canvas(w, h), g = c.getContext('2d'), R = mulberry32(seed);
  const wall = night ? '#27304a' : '#d9ccb0';
  g.fillStyle = wall; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) {
    const x = w * (0.12 + k * 0.5), y = h * (0.05 + i * 0.34), lit = night && R() < 0.6;
    g.fillStyle = lit ? '#f4cf7a' : night ? '#1a2036' : '#6d6a5e'; g.fillRect(x, y, w * 0.3, h * 0.2);
    g.fillStyle = night ? '#141a2c' : '#8e7f62'; g.fillRect(x - 4, y + h * 0.2, w * 0.3 + 8, 6);
  }
  // clotheslines with a shirt, a towel, socks
  g.strokeStyle = night ? '#4b5575' : '#5e584b'; g.lineWidth = 2;
  for (const y of [h * 0.44, h * 0.78]) {
    g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(w / 2, y + 10, w, y); g.stroke();
    let x = 12;
    while (x < w - 30) {
      const cw = 18 + R() * 40, ch = 26 + R() * 50, col = night ? tone(['#c44b3b', '#3d6fb5', '#e6d25a', '#f2f2ee'][(R() * 4) | 0], '#141a2c', 0.55) : ['#c44b3b', '#3d6fb5', '#e6d25a', '#f2f2ee', '#6ea36a'][(R() * 5) | 0];
      g.fillStyle = col; g.fillRect(x, y + 4, cw, ch);
      g.fillStyle = rgba('#000000', 0.12); g.fillRect(x, y + 4, cw, 4);
      x += cw + 8 + R() * 20;
    }
  }
  if (!night) { const sky = g.createLinearGradient(0, 0, 0, h * 0.3); sky.addColorStop(0, rgba('#ffffff', 0.35)); sky.addColorStop(1, rgba('#ffffff', 0)); g.fillStyle = sky; g.fillRect(0, 0, w, h * 0.3); }
  return c;
});

// the facade: stucco, windows with blinds and balconies, the stone plinth, the fruit shop's green
// shutter on the ground floor, and the bay of the portal left open (the portal is drawn in it).
// Spans x −8..8 m, y 0..13 m. `night`: lit windows, and on Christmas Eve a garland on each balcony
export const FACADE = { x0: -8, x1: 8, h: 13, bay: [-1.05, 0.8, 3.0] };
export const facade = (night = false, xmas = false, seed = 61) => memo('fac' + night + xmas + seed, () => {
  const P = 64, w = 16 * P, h = FACADE.h * P, c = canvas(w, h), g = c.getContext('2d'), R = mulberry32(seed);
  const X = (m) => (m - FACADE.x0) * P, Y = (m) => h - m * P;
  const st = night ? '#5d5a6a' : PAL.stucco;
  g.fillStyle = st; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 700; i++) { g.fillStyle = rgba(R() < 0.5 ? '#ffffff' : '#6b5a3a', 0.05); g.fillRect(R() * w, R() * h, 2 + R() * 8, 2 + R() * 8); }
  // a cornice at every floor line
  for (let f = 1; f <= 4; f++) { g.fillStyle = night ? '#4a4757' : PAL.stuccoDk; g.fillRect(0, Y(f * 3) - 6, w, 10); g.fillStyle = rgba('#ffffff', night ? 0.05 : 0.25); g.fillRect(0, Y(f * 3) - 6, w, 2); }
  for (let f = 1; f <= 3; f++) {
    const y = Y(f * 3 + 0.75 + 1.9);
    for (let k = -3; k <= 3; k++) {
      const x = X(k * 2.4 - 0.6);
      const lit = night && R() < 0.72;
      g.fillStyle = night ? '#2a2c3d' : PAL.stuccoDk; g.fillRect(x - 7, y - 7, 1.2 * P + 14, 1.9 * P + 14);
      g.fillStyle = lit ? '#f3c86e' : night ? '#1c1e2b' : '#3d444b'; g.fillRect(x, y, 1.2 * P, 1.9 * P);
      if (!lit && !night) { g.fillStyle = rgba('#bcd6e6', 0.35); g.fillRect(x + 6, y + 6, 1.2 * P * 0.4, 1.9 * P - 12); }
      const bl = 0.15 + R() * 0.6;
      g.fillStyle = night ? '#4f5250' : '#b7a377'; g.fillRect(x, y, 1.2 * P, 1.9 * P * bl);
      g.strokeStyle = rgba('#000000', 0.16); g.lineWidth = 1;
      for (let yy = y + 5; yy < y + 1.9 * P * bl; yy += 5) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + 1.2 * P, yy); g.stroke(); }
      // the balcony: slab, railing
      g.fillStyle = night ? '#44424a' : '#bfae8c'; g.fillRect(x - 0.3 * P, y + 1.9 * P, 1.8 * P, 0.14 * P);
      g.strokeStyle = night ? '#101014' : '#23201c'; g.lineWidth = 2.5;
      g.strokeRect(x - 0.25 * P, y + 1.0 * P, 1.7 * P, 0.9 * P);
      g.lineWidth = 1.6;
      for (let b = 1; b < 10; b++) { const bx = x - 0.25 * P + (b * 1.7 * P) / 10; g.beginPath(); g.moveTo(bx, y + 1.0 * P); g.lineTo(bx, y + 1.9 * P); g.stroke(); }
      if (!night && R() < 0.4) for (let j = 0; j < 3; j++) { g.fillStyle = '#5f8f46'; ell(g, x + R() * 1.2 * P, y + 1.78 * P, 12, 8); g.fill(); g.fillStyle = ['#c44b3b', '#e86aa0', '#f2f2ee'][j]; ell(g, x + R() * 1.2 * P, y + 1.72 * P, 4, 4); g.fill(); }
      if (xmas) {
        g.strokeStyle = '#1f4a2a'; g.lineWidth = 4; g.beginPath();
        for (let t = 0; t <= 1.001; t += 0.05) g.lineTo(x - 0.25 * P + t * 1.7 * P, y + 1.02 * P + Math.sin(t * Math.PI) * 12);
        g.stroke();
        for (let t = 0.05; t < 1; t += 0.1) { g.fillStyle = ['#ffd36b', '#ff6b5a', '#8fd4ff', '#b8f28a'][Math.round(t * 10) % 4]; ell(g, x - 0.25 * P + t * 1.7 * P, y + 1.02 * P + Math.sin(t * Math.PI) * 12 + 4, 4, 4); g.fill(); }
      }
    }
  }
  // the ground floor: the stone plinth, the fruit shop's shutter and sign on either side of the portal
  g.fillStyle = night ? '#57545c' : PAL.stone; g.fillRect(0, Y(0.95), w, 0.95 * P);
  g.fillStyle = night ? '#4b4850' : PAL.stoneDk; g.fillRect(0, Y(0.95), w, 5);
  g.strokeStyle = rgba('#000000', 0.2); g.lineWidth = 1.5;
  for (let x = 0; x < w; x += 0.62 * P) { g.beginPath(); g.moveTo(x, Y(0.95)); g.lineTo(x, h); g.stroke(); }
  for (const [a, b2, sign] of [[-7.2, -2.1, 'FRUTERÍA'], [2.2, 7.2, 'PELUQUERÍA']]) {
    const sh = night ? '#3d4a3a' : PAL.shutter;
    g.fillStyle = darker(sh, 0.3); g.fillRect(X(a) - 6, Y(2.75) - 6, (b2 - a) * P + 12, 2.75 * P + 6);
    g.fillStyle = sh; g.fillRect(X(a), Y(2.6), (b2 - a) * P, 2.6 * P);
    g.fillStyle = rgba('#000000', 0.22);
    for (let yy = Y(2.6) + 4; yy < h; yy += 7) g.fillRect(X(a), yy, (b2 - a) * P, 2);
    g.fillStyle = rgba('#ffffff', 0.08); g.fillRect(X(a), Y(2.6), (b2 - a) * P, 0.3 * P);
    // the sign board
    g.fillStyle = sign === 'FRUTERÍA' ? PAL.brand : '#7a3350'; g.fillRect(X(a), Y(3.25), (b2 - a) * P, 0.55 * P);
    g.fillStyle = '#f4efe2'; g.font = `800 ${0.42 * P}px ${FACE}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(sign, X((a + b2) / 2), Y(2.97));
    // a little graffiti tag on the shutter
    g.strokeStyle = rgba(sign === 'FRUTERÍA' ? '#e8e3d0' : '#f0b8d0', 0.55); g.lineWidth = 3; g.beginPath();
    const gx = X(a) + (b2 - a) * P * 0.3, gy = Y(1.2);
    g.moveTo(gx, gy); g.bezierCurveTo(gx + 20, gy - 30, gx + 40, gy + 20, gx + 60, gy - 10); g.bezierCurveTo(gx + 70, gy - 25, gx + 90, gy, gx + 100, gy - 20); g.stroke();
  }
  // the bay of the portal: cut out, a stone surround
  const [b0, b1, bh] = FACADE.bay;
  g.fillStyle = night ? '#6d6975' : '#cfc4ae'; g.fillRect(X(b0) - 0.2 * P, Y(bh) - 0.2 * P, (b1 - b0 + 0.4) * P, (bh + 0.2) * P);
  g.clearRect(X(b0), Y(bh), (b1 - b0) * P, bh * P + 1);
  return c;
});
// a car from the side, 4.1 × 1.45 m, the front at the right (flip it for the other way)
export const carSide = (col, seed = 1) => memo('cars' + col + seed, () => {
  const P = 110, w = 4.1 * P, h = 1.45 * P, c = canvas(w, h), g = c.getContext('2d'), R = mulberry32(seed);
  const Y = (m) => h - m * P;
  // body
  g.fillStyle = col;
  g.beginPath(); g.moveTo(0.08 * P, Y(0.3)); g.lineTo(0.02 * P, Y(0.62)); g.quadraticCurveTo(0.05 * P, Y(0.92), 0.4 * P, Y(0.94));
  g.lineTo(0.85 * P, Y(0.96)); g.lineTo(1.25 * P, Y(1.4)); g.lineTo(2.75 * P, Y(1.42)); g.lineTo(3.25 * P, Y(0.98)); g.lineTo(3.9 * P, Y(0.9));
  g.quadraticCurveTo(4.08 * P, Y(0.8), 4.08 * P, Y(0.5)); g.lineTo(4.02 * P, Y(0.3)); g.closePath(); g.fill();
  // glass
  g.fillStyle = '#2b343c'; g.beginPath(); g.moveTo(1.0 * P, Y(0.98)); g.lineTo(1.32 * P, Y(1.34)); g.lineTo(2.7 * P, Y(1.36)); g.lineTo(3.1 * P, Y(0.99)); g.closePath(); g.fill();
  g.fillStyle = rgba('#bcd6e6', 0.35); g.beginPath(); g.moveTo(1.4 * P, Y(1.3)); g.lineTo(1.75 * P, Y(1.32)); g.lineTo(1.45 * P, Y(1.0)); g.lineTo(1.12 * P, Y(1.0)); g.closePath(); g.fill();
  g.fillStyle = col; g.fillRect(2.0 * P, Y(1.38), 0.08 * P, 0.4 * P);
  // shading, the waist line, door cuts
  const sh = g.createLinearGradient(0, Y(0.96), 0, Y(0.3));
  sh.addColorStop(0, rgba('#ffffff', 0.18)); sh.addColorStop(0.35, rgba('#ffffff', 0)); sh.addColorStop(1, rgba('#000000', 0.28));
  g.fillStyle = sh; g.fillRect(0, Y(0.96), w, 0.66 * P);
  g.strokeStyle = rgba('#000000', 0.3); g.lineWidth = 2;
  for (const x of [1.05, 2.05, 3.1]) { g.beginPath(); g.moveTo(x * P, Y(0.95)); g.lineTo(x * P - 6, Y(0.35)); g.stroke(); }
  g.fillStyle = rgba('#000000', 0.35); g.fillRect(1.6 * P, Y(0.8), 0.18 * P, 0.04 * P); g.fillRect(2.6 * P, Y(0.8), 0.18 * P, 0.04 * P);
  // lamps, bumpers
  g.fillStyle = '#b8271f'; g.fillRect(0.02 * P, Y(0.86), 0.08 * P, 0.16 * P);
  g.fillStyle = '#f2ecd8'; g.fillRect(3.98 * P, Y(0.82), 0.1 * P, 0.12 * P);
  g.fillStyle = '#2a2b2d'; g.fillRect(0, Y(0.42), 0.35 * P, 0.14 * P); g.fillRect(3.75 * P, Y(0.42), 0.33 * P, 0.14 * P);
  // wheels
  for (const x of [0.78, 3.3]) {
    g.fillStyle = '#16171a'; ell(g, x * P, Y(0.3), 0.31 * P, 0.31 * P); g.fill();
    g.fillStyle = '#8d9296'; ell(g, x * P, Y(0.3), 0.18 * P, 0.18 * P); g.fill();
    g.fillStyle = '#5a5e62'; ell(g, x * P, Y(0.3), 0.06 * P, 0.06 * P); g.fill();
    g.fillStyle = rgba('#000000', 0.5); g.beginPath(); g.arc(x * P, Y(0.3), 0.36 * P, Math.PI, 0); g.lineTo(x * P + 0.36 * P, Y(0.3)); g.fill();
  }
  // dust
  for (let i = 0; i < 60; i++) { g.fillStyle = rgba('#8a7a5a', 0.06); g.fillRect(R() * w, Y(0.5) + R() * 0.2 * P, 6, 3); }
  return c;
});
// a car's end: the rear (tail lights, plate) or the front (headlights, grille), 1.75 × 1.45 m
export const carEnd = (col, front = false, hazard = false) => memo('care' + col + front + hazard, () => {
  const P = 110, w = 1.75 * P, h = 1.45 * P, c = canvas(w, h), g = c.getContext('2d');
  const Y = (m) => h - m * P;
  g.fillStyle = col;
  g.beginPath(); g.moveTo(0.02 * P, Y(0.28)); g.lineTo(0.0, Y(0.9)); g.lineTo(0.2 * P, Y(0.96)); g.lineTo(0.32 * P, Y(1.4)); g.lineTo(1.43 * P, Y(1.4)); g.lineTo(1.55 * P, Y(0.96)); g.lineTo(1.75 * P, Y(0.9)); g.lineTo(1.73 * P, Y(0.28)); g.closePath(); g.fill();
  g.fillStyle = front ? '#2b343c' : '#232a30'; g.beginPath(); g.moveTo(0.3 * P, Y(0.99)); g.lineTo(0.4 * P, Y(1.34)); g.lineTo(1.35 * P, Y(1.34)); g.lineTo(1.45 * P, Y(0.99)); g.closePath(); g.fill();
  g.fillStyle = rgba('#bcd6e6', 0.25); g.fillRect(0.45 * P, Y(1.3), 0.3 * P, 0.25 * P);
  const sh = g.createLinearGradient(0, Y(0.96), 0, Y(0.28)); sh.addColorStop(0, rgba('#ffffff', 0.15)); sh.addColorStop(1, rgba('#000000', 0.3));
  g.fillStyle = sh; g.fillRect(0, Y(0.96), w, 0.68 * P);
  g.fillStyle = '#2a2b2d'; g.fillRect(0, Y(0.45), w, 0.17 * P);
  if (front) {
    g.fillStyle = '#f4efe0'; rrect(g, 0.1 * P, Y(0.85), 0.36 * P, 0.14 * P, 6); g.fill(); rrect(g, 1.29 * P, Y(0.85), 0.36 * P, 0.14 * P, 6); g.fill();
    g.fillStyle = '#1b1c1e'; rrect(g, 0.55 * P, Y(0.78), 0.65 * P, 0.16 * P, 5); g.fill();
  } else {
    g.fillStyle = '#b8271f'; rrect(g, 0.05 * P, Y(0.92), 0.3 * P, 0.2 * P, 5); g.fill(); rrect(g, 1.4 * P, Y(0.92), 0.3 * P, 0.2 * P, 5); g.fill();
    if (hazard) { g.fillStyle = '#ffae3a'; rrect(g, 0.07 * P, Y(0.8), 0.14 * P, 0.07 * P, 3); g.fill(); rrect(g, 1.54 * P, Y(0.8), 0.14 * P, 0.07 * P, 3); g.fill(); }
    g.fillStyle = '#f2f2ee'; g.fillRect(0.6 * P, Y(0.66), 0.55 * P, 0.12 * P);
    g.fillStyle = '#2d56a6'; g.fillRect(0.6 * P, Y(0.66), 0.06 * P, 0.12 * P);
    g.fillStyle = '#16171a'; g.font = `700 ${0.08 * P}px ${TEXT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('4821 KJT', 0.9 * P, Y(0.6));
  }
  return c;
});
// a doormat in front of a door, 0.7 × 0.45 m
export const doormat = (word = '', col = PAL.mat, seed = 81) => memo('mat' + word + col, () => {
  const P = 300, w = 0.7 * P, h = 0.45 * P, c = canvas(w, h), g = c.getContext('2d'), R = mulberry32(seed);
  g.fillStyle = darker(col, 0.25); rrect(g, 0, 0, w, h, 10); g.fill();
  g.fillStyle = col; rrect(g, 8, 8, w - 16, h - 16, 6); g.fill();
  for (let i = 0; i < 900; i++) { g.fillStyle = rgba(R() < 0.5 ? '#000000' : '#ffffff', 0.08); g.fillRect(8 + R() * (w - 16), 8 + R() * (h - 16), 2, 2); }
  if (word) { g.fillStyle = darker(col, 0.45); g.font = `800 ${h * 0.3}px ${FACE}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(word, w / 2, h / 2 + 2); }
  return c;
});
// the street number over the portal
export const houseNumber = (n = 14) => memo('num' + n, () => {
  const P = 700, w = 0.26 * P, h = 0.2 * P, c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#f2efe6'; rrect(g, 0, 0, w, h, 12); g.fill();
  g.strokeStyle = '#23407a'; g.lineWidth = 5; rrect(g, 6, 6, w - 12, h - 12, 8); g.stroke();
  g.fillStyle = '#23407a'; g.font = `800 ${h * 0.66}px ${FACE}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), w / 2, h * 0.55);
  return c;
});
// a framed picture for the hall at home
export const photo = (seed = 71) => memo('photo' + seed, () => {
  const P = 500, w = 0.4 * P, h = 0.3 * P, c = canvas(w, h), g = c.getContext('2d'), R = mulberry32(seed);
  g.fillStyle = '#3b2717'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f4efe2'; g.fillRect(8, 8, w - 16, h - 16);
  const sky = g.createLinearGradient(0, 16, 0, h - 16); sky.addColorStop(0, '#8fc3e0'); sky.addColorStop(1, '#f1d9a8');
  g.fillStyle = sky; g.fillRect(16, 16, w - 32, h - 32);
  g.fillStyle = '#3f79a6'; g.fillRect(16, h * 0.62, w - 32, h * 0.38 - 16);
  g.fillStyle = '#e8d29a'; g.fillRect(16, h * 0.78, w - 32, h * 0.22 - 16);
  for (let i = 0; i < 3; i++) { g.fillStyle = ['#c44b3b', '#2f6b3f', '#e8762a'][i]; ell(g, w * (0.35 + i * 0.12), h * 0.72, 6, 9); g.fill(); }
  return c;
});
