// The station, drawn: granite floor and its seams, white tiles with the blue band, pink posters,
// direction plates, turnstiles, the stair flights and their rail, the platform with its track, and the
// train waiting at the end of the trip: across the mouth of a corridor, or along the platform.
// Everything is placed in metres and goes through the camera; every colour goes through the haze.
import { LW } from '../route.js';
import { clamp, lerp, mulberry32 } from '../util.js';
import { PAL, fog, darker, lighter, ell, rrect } from './paint.js';
import { laneX, floorAt, fogAt, FOG0, FOG1, FAR } from './cam.js';

export const WALL_H = 9, TREAD = 0.42;
const BAND = [1.7, 2.0], TILE = 0.3, SEAM = 1.2, SKIRT = 0.12;
export const EDGE = -2.05, TX = -2.2, TX2 = -5.0, TTOP = 3.35, PIT = -1.1, FARW = -6.3;
const CAR = 17.5, CGAP = 0.8, DOORS = [2.6, 8.05, 13.5], DW = 1.3, DH = 2.02, TBOT = -0.55;
const SIGN_L = 2.6, SIGN_Y = [2.32, 2.82];
export const LINE = { A: '#6a3d9a', B: '#e0782f', C: '#1f8a8a', D: '#c85a7c' };
export const FONT = '"Anybody", "Arial Narrow", system-ui, sans-serif';
export const DOTS = '"Doto", ui-monospace, monospace';

export function wallsOf(s) {
  const r = laneX(s.open[1]) + LW / 2 + 0.25;
  return [s.type === 'platform' ? EDGE : laneX(s.open[0]) - LW / 2 - 0.25, r];
}

// ---- paths through the lens
function hq(g, cam, x0, x1, y, z0, z1) {           // a horizontal patch (floor, tread, roof)
  const a = cam.v(x0, y, z0), b = cam.v(x1, y, z0), c = cam.v(x1, y, z1), d = cam.v(x0, y, z1);
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath();
}
function wq(g, cam, X, z0, z1, y0a, y1a, y0b, y1b) { // a patch of wall in the plane x = X
  const a = cam.v(X, y0a, z0), b = cam.v(X, y1a, z0), c = cam.v(X, y1b, z1), d = cam.v(X, y0b, z1);
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath();
}
function fr(cam, z, x0, x1, y0, y1) {              // a face toward you, at z: its screen rectangle
  const a = cam.v(x0, y1, z), b = cam.v(x1, y0, z);
  return [a[0], a[1], b[0] - a[0], b[1] - a[1], a[2]];
}
function line3(g, cam, x0, y0, z0, x1, y1, z1) {
  const a = cam.v(x0, y0, z0), b = cam.v(x1, y1, z1);
  g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
}
// the haze as a gradient: along the floor it runs up the screen, along a wall across it
function floorGrad(g, cam, h, col) {
  const y0 = cam.hy + ((cam.y - h) * cam.f) / (cam.pz + FOG0 - cam.z), y1 = cam.hy + ((cam.y - h) * cam.f) / (cam.pz + FOG1 - cam.z);
  const gr = g.createLinearGradient(0, y0, 0, Math.min(y0 - 0.5, y1));
  gr.addColorStop(0, col); gr.addColorStop(1, PAL.fog);
  return gr;
}
function wallGrad(g, cam, X, col) {
  const k = (d) => cam.W / 2 + ((X - cam.x) * cam.f) / d + cam.sh;
  const x0 = k(cam.pz + FOG0 - cam.z), x1 = k(cam.pz + FOG1 - cam.z);
  const gr = g.createLinearGradient(x0, 0, Math.abs(x1 - x0) < 0.5 ? x0 + 0.5 : x1, 0);
  gr.addColorStop(0, col); gr.addColorStop(1, PAL.fog);
  return gr;
}

// the network's mark: two arrows, one each way, in a rounded square
export function mark(g, cx, cy, S, col, bg = null) {
  g.save(); g.translate(cx, cy); g.scale(S / 100, S / 100);
  if (bg) { rrect(g, -50, -50, 100, 100, 22); g.fillStyle = bg; g.fill(); }
  rrect(g, -44, -44, 88, 88, 18); g.lineWidth = 7; g.strokeStyle = col; g.stroke();
  g.fillStyle = col;
  for (const s of [-1, 1]) {
    g.beginPath();
    const x = s * 15;
    g.moveTo(x - 5, s * 26); g.lineTo(x + 5, s * 26); g.lineTo(x + 5, -s * 6); g.lineTo(x + 14, -s * 6); g.lineTo(x, -s * 28); g.lineTo(x - 14, -s * 6); g.lineTo(x - 5, -s * 6); g.closePath();
    g.fill();
  }
  g.restore();
}

// pictures painted once and then pasted onto walls in perspective (in vertical slices)
const cache = new Map();
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function posterImg(text) {
  const key = 'p' + text;
  let c = cache.get(key); if (c) return c;
  c = canvas(240, 320); const g = c.getContext('2d');
  g.fillStyle = PAL.pink; g.fillRect(0, 0, 240, 320);
  g.fillStyle = lighter(PAL.pink, 0.25); g.fillRect(0, 0, 240, 6);
  g.strokeStyle = PAL.band; g.lineWidth = 3; g.strokeRect(14, 14, 212, 292);
  const lines = text.split('|');
  g.fillStyle = PAL.band; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 40px ${FONT}`;
  const wid = Math.max(...lines.map((l) => g.measureText(l).width));
  const size = Math.min(50, (40 * 188) / wid), lh = size * 1.02;
  g.font = `900 ${size}px ${FONT}`;
  const y0 = 128 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => g.fillText(l, 120, y0 + i * lh));
  mark(g, 120, 256, 44, PAL.band);
  cache.set(key, c);
  return c;
}
function plateImg(name) {
  const key = 's' + name;
  let c = cache.get(key); if (c) return c;
  c = canvas(560, 110); const g = c.getContext('2d');
  rrect(g, 0, 0, 560, 110, 14); g.fillStyle = PAL.band; g.fill();
  rrect(g, 7, 7, 546, 96, 10); g.strokeStyle = PAL.signLt; g.lineWidth = 3; g.stroke();
  g.fillStyle = PAL.signLt; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 58px ${FONT}`;
  const w = g.measureText(name).width;
  g.font = `900 ${Math.min(58, (58 * 470) / w)}px ${FONT}`;
  g.fillText(name, 280, 58);
  cache.set(key, c);
  return c;
}
// the clock the station is named after: navy rim, twelve bars, and a second hand that jumps each second
function clockFace(g, cx, cy, R, secs, k) {
  g.fillStyle = fog(PAL.sign, k); ell(g, cx, cy, R, R); g.fill();
  g.fillStyle = fog(PAL.signLt, k); ell(g, cx, cy, R * 0.86, R * 0.86); g.fill();
  if (R < 5) return;
  const ink = fog('#22252b', k), TAU = Math.PI * 2;
  g.strokeStyle = ink; g.lineCap = 'butt';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, c = Math.cos(a), sn = Math.sin(a);
    g.lineWidth = Math.max(1, R * (i % 3 ? 0.05 : 0.1));
    g.beginPath(); g.moveTo(cx + sn * R * 0.6, cy - c * R * 0.6); g.lineTo(cx + sn * R * 0.77, cy - c * R * 0.77); g.stroke();
  }
  const hand = (u, len, wid, col, tail = 0.12) => {
    const a = u * TAU, c = Math.cos(a), sn = Math.sin(a);
    g.strokeStyle = col; g.lineWidth = Math.max(1, R * wid);
    g.beginPath(); g.moveTo(cx - sn * R * tail, cy + c * R * tail); g.lineTo(cx + sn * R * len, cy - c * R * len); g.stroke();
  };
  g.lineCap = 'round';
  hand(((secs / 3600) % 12) / 12, 0.42, 0.1, ink);
  hand(((secs / 60) % 60) / 60, 0.66, 0.07, ink);
  hand((Math.floor(secs) % 60) / 60, 0.7, 0.03, fog('#e2632a', k), 0.2);
  g.lineCap = 'butt';
  g.fillStyle = fog('#e2632a', k); ell(g, cx, cy, R * 0.06, R * 0.06); g.fill();
}
// a direction plate: line bullets, where to, and the arrow at the end it points to (dir 1: right)
function signImg(sg, dir) {
  const key = 'g' + dir + sg.lines.join('') + sg.to;
  let c = cache.get(key); if (c) return c;
  const W = 832, H = 160, cy = H / 2, R = 44, A = 96, pad = 30;
  c = canvas(W, H); const g = c.getContext('2d');
  rrect(g, 0, 0, W, H, 16); g.fillStyle = PAL.sign; g.fill();
  rrect(g, 8, 8, W - 16, H - 16, 11); g.strokeStyle = PAL.signLt; g.lineWidth = 3; g.stroke();
  const ax = dir > 0 ? W - pad - A / 2 : pad + A / 2, d = dir * A;
  g.beginPath();
  g.moveTo(ax - 0.5 * d, cy - 0.13 * A); g.lineTo(ax + 0.04 * d, cy - 0.13 * A); g.lineTo(ax + 0.04 * d, cy - 0.4 * A);
  g.lineTo(ax + 0.5 * d, cy); g.lineTo(ax + 0.04 * d, cy + 0.4 * A); g.lineTo(ax + 0.04 * d, cy + 0.13 * A); g.lineTo(ax - 0.5 * d, cy + 0.13 * A);
  g.closePath(); g.fillStyle = PAL.signLt; g.fill();
  let x = dir > 0 ? pad + 6 : pad + A + 34;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const ln of sg.lines) {
    ell(g, x + R, cy, R, R); g.fillStyle = LINE[ln]; g.fill();
    g.fillStyle = PAL.signLt; g.font = `900 58px ${FONT}`; g.fillText(ln, x + R, cy + 3);
    x += 2 * R + 14;
  }
  const room = (dir > 0 ? W - pad - A - 30 : W - pad - 10) - (x + 12);
  g.font = `800 76px ${FONT}`;
  const fs = Math.min(76, (76 * room) / g.measureText(sg.to).width);
  g.font = `800 ${fs}px ${FONT}`; g.textAlign = 'left'; g.fillStyle = PAL.signLt;
  g.fillText(sg.to, x + 12, cy + 4);
  cache.set(key, c);
  return c;
}
// paste an image onto the wall plane x = X: its left edge at zA, right edge at zB, between two heights.
// In slices a few pixels wide, each one sheared to follow the top edge, so lettering stays whole.
function onWall(g, cam, img, X, zA, zB, yBot, yTop, k) {
  const iw = img.width, ih = img.height, A = cam.v(X, yTop, zA), B = cam.v(X, yTop, zB), zc = cam.z + 0.3;
  const N = clamp(Math.ceil(Math.abs(B[0] - A[0]) / 5), 2, 120), sw = iw / N;
  g.save();
  const M = g.getTransform();
  for (let i = 0; i < N; i++) {
    const za = lerp(zA, zB, i / N), zb = lerp(zA, zB, (i + 1) / N);
    if (Math.min(za, zb) < zc) continue;
    const a = cam.v(X, yTop, za), b = cam.v(X, yTop, zb), c = cam.v(X, yBot, za);
    if (Math.abs(b[0] - a[0]) < 0.2) continue;
    const sx = i * sw, ow = Math.min(sw * 1.25, iw - sx);
    g.setTransform(M); g.transform((b[0] - a[0]) / sw, (b[1] - a[1]) / sw, 0, (c[1] - a[1]) / ih, a[0], a[1]);
    g.drawImage(img, sx, 0, ow, ih, 0, 0, ow, ih);
  }
  g.restore();
  if (k > 0.02) { wq(g, cam, X, zA, zB, yBot, yTop, yBot, yTop); g.fillStyle = PAL.fog; g.globalAlpha = k; g.fill(); g.globalAlpha = 1; }
}

export class Station {
  constructor(lv, route, text) {
    this.lv = lv; this.R = route; this.text = text; this.len = route.len;
    const segs = route.segs, last = segs[segs.length - 1];
    this.side = last.type === 'platform';
    this.zEnd = this.len + (this.side ? 0.6 : 0.9);          // the floor runs to here
    this.zBack = this.len + (this.side ? 0.6 : 4.2);         // the wall across the end
    this.zT = this.len + 1.0;                                // (across the end) the train's side
    for (const s of segs) { const w = wallsOf(s); s.wl = w[0]; s.wr = w[1]; s.h0 = floorAt(route, s.z0); s.h1 = floorAt(route, s.z1); }
    const r = mulberry32(0x51a7 + lv.n * 977);
    // posters on the walls, now one side now the other, never over a pillar or in the turnstile rows
    this.posters = [];
    let side = r() < 0.5 ? -1 : 1, pi = (lv.n * 3) % text.posters.length;
    for (const s of segs) {
      if (s.type === 'stairs') continue;
      const plat = s.type === 'platform';
      for (let z = s.z0 + 3.5 + r() * 3; z < s.z1 - 3; z += 7.5 + r() * 4.5) {
        let zz = z;
        if (plat) {                                          // between two pillars, on the wall behind them
          side = 1;
          const ps = route.pillars.filter((p) => p.z > s.z0 && p.z < s.z1);
          const nx = ps.find((p) => p.z > z);
          if (!nx) break;
          zz = nx.z - 4; z = nx.z + 1;
          if (zz < s.z0 + 2) continue;
        }
        if (s.gates && Math.abs(zz - (s.z0 + s.gates.at)) < 3.2) continue;
        this.posters.push({ z: zz, side, X: side < 0 ? s.wl : s.wr, h: s.h0, text: text.posters[pi++ % text.posters.length] });
        if (!plat) side = -side;
      }
    }
    // direction plates on the walls, where a corridor starts and now and then (hung across the way,
    // a sign would hide the very faces you need to read); a poster never shares their stretch of wall
    this.signs = [];
    let si = 0, ss = r() < 0.5 ? -1 : 1;
    for (const [i, s] of segs.entries()) {
      if (s.type === 'platform' || s.type === 'stairs') continue;
      for (let z = s.z0 + (i === 0 ? 6 : 2.5); z < s.z1 - 4; z += 15) {
        if (s.gates && Math.abs(z + 1.3 - (s.z0 + s.gates.at)) < 3.4) continue;
        const sg = text.signs[(lv.n + si++) % text.signs.length];
        this.signs.push({ z, side: ss, X: ss < 0 ? s.wl : s.wr, h: floorAt(route, z), ...sg });
        ss = -ss;
      }
    }
    this.posters = this.posters.filter((p) => !this.signs.some((sg) => sg.side === p.side && p.z < sg.z + SIGN_L + 0.8 && p.z + 1.2 > sg.z - 0.8));
    // the far wall of the track: the station's name, every few metres
    this.plates = [];
    if (this.side) for (let z = last.z0 + 4; z < last.z1; z += 9) this.plates.push(z);
    // the train
    if (this.side) { this.cars = clamp(Math.floor((last.len - 2) / (CAR + CGAP)), 1, 3); this.zf = this.len + 3.8; }
    this.gate = route.gates.map(() => new Float32Array(7));
    this.specks = new Map();
    this.pass = mulberry32(lv.n * 131 + 7);
    this.faces = [];                                          // who is inside the train, by window
    for (let i = 0; i < 48; i++) this.faces.push([r(), r(), r()]);
  }

  // turnstile paddles open when someone is about to walk through that way
  update(dt, P, agents) {
    const R = this.R;
    R.gates.forEach((gt, gi) => {
      const O = this.gate[gi];
      for (let l = 0; l < 7; l++) {
        const k = gt.lanes[l];
        let want = 0;
        const near = (a, dir) => Math.abs(a.x - l) < 0.45 && a.z > gt.z - 0.5 && a.z < gt.z + gt.depth + 0.4 && (k === 'both' || k === (dir > 0 ? 'in' : 'out'));
        if (near(P, 1) && P.gates.has(gi) && P.hold - 0.2 < (this.t || 0)) want = 1;
        for (const a of agents) if (!a.gone && near(a, a.dir) && (a.dir < 0 || (a.gates && a.gates.has(gt) && a.hold - 0.15 < (this.t || 0)))) want = 1;
        O[l] += (want - O[l]) * (1 - Math.exp(-dt * (want ? 16 : 6)));
      }
    });
  }

  // ---------- behind everything ----------
  back(g, cam, st) {
    const R = this.R, zN = cam.z + 0.32, zF = cam.pz + FAR;
    this.t = st.t;
    g.fillStyle = PAL.fog; g.fillRect(0, 0, cam.W, cam.H);
    if (this.zBack - cam.pz < FAR + 1) this.theEnd(g, cam, st);
    for (let i = R.segs.length - 1; i >= 0; i--) {
      const s = R.segs[i], last = i === R.segs.length - 1;
      const za = i === 0 ? zN : Math.max(s.z0, zN), zb = Math.min(last ? this.zEnd : s.z1, zF);
      if (zb <= za) continue;
      this.segment(g, cam, s, i, za, zb, st);
    }
  }

  segment(g, cam, s, i, za, zb, st) {
    const R = this.R, plat = s.type === 'platform', last = i === R.segs.length - 1;
    if (plat) this.trackSide(g, cam, s, za, zb, st);
    if (s.type === 'stairs') this.steps(g, cam, s, za, zb); else this.floor(g, cam, s, za, zb, last);
    const wzb = last ? Math.min(this.zBack, cam.pz + FAR) : zb;
    if (!plat) this.wall(g, cam, s, -1, za, wzb);
    this.wall(g, cam, s, 1, za, wzb);
    const n = R.segs[i + 1];
    if (n && s.z1 < cam.pz + FAR) {                         // a hall narrowing into a corridor: the wall turns toward you
      if (n.wl > s.wl + 0.01 && n.type !== 'platform' && !plat) this.returnFace(g, cam, s.z1, s.wl, n.wl, s.h1);
      if (n.wr < s.wr - 0.01) this.returnFace(g, cam, s.z1, n.wr, s.wr, s.h1);
    }
  }

  floor(g, cam, s, za, zb, last) {
    const h = s.h0, xl = s.wl, xr = s.wr;
    hq(g, cam, xl, xr, h, za, zb); g.fillStyle = floorGrad(g, cam, h, PAL.floor); g.fill();
    const near = Math.min(zb, cam.pz + FOG1);
    // flecks in the granite, pinned to the floor (they are what tells you are walking)
    const lim = Math.min(near, cam.pz + 10);
    for (let m = Math.floor(za); m < lim; m++) {
      let sp = this.specks.get(m);
      if (!sp) {
        const r = mulberry32(m * 2654435761 + 17); sp = new Float32Array(40);
        for (let j = 0; j < 40; j += 4) { sp[j] = -2.8 + r() * 5.6; sp[j + 1] = r(); sp[j + 2] = 0.015 + r() * 0.03; sp[j + 3] = r(); }
        this.specks.set(m, sp);
      }
      for (let j = 0; j < 40; j += 4) {
        const x = sp[j], z = m + sp[j + 1];
        if (x < xl + 0.05 || x > xr - 0.05 || z < za || z > zb) continue;
        const p = cam.v(x, h, z), w = sp[j + 2] * p[2];
        if (w < 0.7) continue;
        g.fillStyle = fog(sp[j + 3] < 0.6 ? PAL.speck : PAL.speckLt, fogAt(cam, z));
        g.fillRect(p[0] - w, p[1] - w * 0.35, w * 2, w * 0.7);
      }
    }
    // seams: along the lanes (they run away to the vanishing point) and across, every slab
    g.lineCap = 'butt';
    const b = s.open;
    g.beginPath();
    for (let l = b[0]; l <= b[1] + 1; l++) { const x = laneX(l) - LW / 2; if (x > xl + 0.02 && x < xr - 0.02) line3(g, cam, x, h, za, x, h, Math.min(zb, cam.pz + FOG1)); }
    g.strokeStyle = floorGrad(g, cam, h, PAL.seam); g.lineWidth = 1; g.stroke();
    for (let z = Math.ceil(za / SEAM) * SEAM; z < near; z += SEAM) {
      const a = cam.v(xl, h, z), c = cam.v(xr, h, z);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]);
      g.strokeStyle = fog(PAL.seam, fogAt(cam, z)); g.lineWidth = clamp(a[2] * 0.012, 0.6, 2); g.stroke();
    }
    if (s.type === 'platform') {                             // the edge: stone, then the yellow tactile strip
      hq(g, cam, EDGE, EDGE + 0.12, h, za, zb); g.fillStyle = floorGrad(g, cam, h, '#e4e3dd'); g.fill();
      hq(g, cam, EDGE + 0.17, EDGE + 0.42, h, za, zb); g.fillStyle = floorGrad(g, cam, h, PAL.yellow); g.fill();
      g.beginPath();
      for (let z = Math.ceil(za / 0.25) * 0.25; z < Math.min(zb, cam.pz + 9); z += 0.25) line3(g, cam, EDGE + 0.17, h, z, EDGE + 0.42, h, z);
      g.strokeStyle = PAL.yellowDk; g.lineWidth = 1; g.stroke();
    }
    if (last && !this.side && zb > this.len) {               // the corridor ends at the platform edge
      const z0 = this.len + 0.42, z1 = this.len + 0.68, k = fogAt(cam, this.len);
      hq(g, cam, xl, xr, h, z0, z1); g.fillStyle = fog(PAL.yellow, k); g.fill();
      hq(g, cam, xl, xr, h, this.len + 0.78, this.zEnd); g.fillStyle = fog('#e4e3dd', k); g.fill();
    }
  }

  steps(g, cam, s, za, zb) {
    const h0 = s.h0, n = Math.round(s.len / TREAD), rise = (s.h1 - s.h0) / n, T = s.len / n, xl = s.wl, xr = s.wr;
    const k0 = clamp(Math.floor((za - s.z0) / T), 0, n - 1), k1 = clamp(Math.ceil((zb - s.z0) / T), 0, n);
    // the top landing lip
    if (zb >= s.z1 - 0.01) { const r0 = fr(cam, s.z1, xl, xr, h0 + (n - 0.5) * rise, s.h1); g.fillStyle = fog(PAL.floorDk, fogAt(cam, s.z1)); g.fillRect(r0[0], r0[1], r0[2], r0[3]); }
    for (let k = k1 - 1; k >= k0; k--) {
      const z = s.z0 + k * T, ht = h0 + (k + 0.5) * rise, hp = k ? h0 + (k - 0.5) * rise : h0, f = fogAt(cam, z);
      hq(g, cam, xl, xr, ht, Math.max(z, za), z + T); g.fillStyle = fog(k & 1 ? PAL.floor : '#c9cac4', f); g.fill();
      if (z < za) continue;
      const r = fr(cam, z, xl, xr, hp, ht);
      g.fillStyle = fog('#9d9e98', f); g.fillRect(r[0], r[1], r[2], r[3]);
      hq(g, cam, xl + 0.05, xr - 0.05, ht, z, z + 0.055); g.fillStyle = fog(PAL.yellow, f); g.fill();
    }
  }

  wall(g, cam, s, side, za, zb) {
    const X = side < 0 ? s.wl : s.wr, h0 = s.h0, sl = (s.h1 - s.h0) / Math.max(0.01, s.z1 - s.z0);
    const hA = h0 + (za - s.z0) * sl, hB = h0 + (Math.min(zb, s.z1) - s.z0) * sl + Math.max(0, zb - s.z1) * 0;
    wq(g, cam, X, za, zb, hA, hA + WALL_H, hB, hB + WALL_H);
    g.fillStyle = wallGrad(g, cam, X, PAL.tile); g.fill();
    const zg = Math.min(zb, cam.pz + FOG1);
    // grout: the courses run away with the wall, the joints stand up across it
    g.beginPath();
    for (let y = TILE; y < 5.2; y += TILE) { if (y > BAND[0] - 0.02 && y < BAND[1] + 0.02) continue; line3(g, cam, X, hA + y, za, X, hB + y, zb); }
    g.strokeStyle = wallGrad(g, cam, X, PAL.grout); g.lineWidth = 1; g.stroke();
    for (let z = Math.ceil(za / TILE) * TILE; z < zg; z += TILE) {
      const a = cam.v(X, h0 + (Math.min(z, s.z1) - s.z0) * sl, z);
      if (a[2] * TILE < 4) break;
      const b = cam.v(X, h0 + (Math.min(z, s.z1) - s.z0) * sl + 5.2, z);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
      g.strokeStyle = fog(PAL.grout, fogAt(cam, z)); g.lineWidth = 1; g.stroke();
    }
    // skirting, and the band
    wq(g, cam, X, za, zb, hA, hA + SKIRT, hB, hB + SKIRT); g.fillStyle = wallGrad(g, cam, X, '#8d918f'); g.fill();
    wq(g, cam, X, za, zb, hA + BAND[0], hA + BAND[1], hB + BAND[0], hB + BAND[1]); g.fillStyle = wallGrad(g, cam, X, PAL.band); g.fill();
    wq(g, cam, X, za, zb, hA + BAND[1], hA + BAND[1] + 0.05, hB + BAND[1], hB + BAND[1] + 0.05); g.fillStyle = wallGrad(g, cam, X, PAL.bandDk); g.fill();
    for (const p of this.posters) {
      if (p.X !== X || p.z + 1.2 < za || p.z > zb || p.z > cam.pz + FOG1) continue;
      const k = fogAt(cam, p.z + 0.6), y0 = p.h + 2.25, y1 = p.h + 3.85;
      wq(g, cam, X, p.z - 0.05, p.z + 1.25, y0 - 0.05, y1 + 0.05, y0 - 0.05, y1 + 0.05); g.fillStyle = fog(PAL.steel, k); g.fill();
      onWall(g, cam, posterImg(p.text), X, side < 0 ? p.z : p.z + 1.2, side < 0 ? p.z + 1.2 : p.z, y0, y1, k);
    }
    for (const sg of this.signs) {
      if (sg.X !== X || sg.z + SIGN_L < za || sg.z > zb || sg.z > cam.pz + FOG1) continue;
      const k = fogAt(cam, sg.z + SIGN_L / 2), y0 = sg.h + SIGN_Y[0], y1 = sg.h + SIGN_Y[1], e = 0.035;
      wq(g, cam, X, sg.z - e, sg.z + SIGN_L + e, y0 - e, y1 + e, y0 - e, y1 + e); g.fillStyle = fog(PAL.steelDk, k); g.fill();
      onWall(g, cam, signImg(sg, side < 0 ? 1 : -1), X, side < 0 ? sg.z : sg.z + SIGN_L, side < 0 ? sg.z + SIGN_L : sg.z, y0, y1, k);
    }
  }

  returnFace(g, cam, z, x0, x1, h) {
    if (z < cam.z + 0.4) return;
    const k = fogAt(cam, z), r = fr(cam, z, x0, x1, h, h + WALL_H);
    g.fillStyle = fog(PAL.tile, k); g.fillRect(r[0], r[1], r[2], r[3]);
    const s = r[4];
    if (s * TILE > 4) {
      g.beginPath();
      for (let y = TILE; y < 5.2; y += TILE) { const yy = r[1] + r[3] - y * s; g.moveTo(r[0], yy); g.lineTo(r[0] + r[2], yy); }
      for (let x = Math.ceil(x0 / TILE) * TILE; x < x1; x += TILE) { const xx = r[0] + (x - x0) * s; g.moveTo(xx, r[1] + r[3]); g.lineTo(xx, r[1] + r[3] - 5.2 * s); }
      g.strokeStyle = fog(PAL.grout, k); g.lineWidth = 1; g.stroke();
    }
    g.fillStyle = fog('#8d918f', k); g.fillRect(r[0], r[1] + r[3] - SKIRT * s, r[2], SKIRT * s);
    g.fillStyle = fog(PAL.band, k); g.fillRect(r[0], r[1] + r[3] - BAND[1] * s, r[2], (BAND[1] - BAND[0]) * s);
    g.fillStyle = fog(PAL.bandDk, k); g.fillRect(r[0], r[1] + r[3] - (BAND[1] + 0.05) * s, r[2], 0.05 * s);
  }

  // ---------- the platform's other side: the far wall, the pit, the train ----------
  trackSide(g, cam, s, za, zb, st) {
    const h = s.h0, zF = Math.min(s.z1 + 0.6, cam.pz + FAR);
    const zA = za;
    // the far wall, with its band and the station's name
    wq(g, cam, FARW, zA, zF, h + PIT, h + WALL_H, h + PIT, h + WALL_H); g.fillStyle = wallGrad(g, cam, FARW, PAL.tile); g.fill();
    g.beginPath();
    for (let y = 0.6; y < 5.4; y += TILE * 2) line3(g, cam, FARW, h + y, zA, FARW, h + y, zF);
    g.strokeStyle = wallGrad(g, cam, FARW, PAL.grout); g.lineWidth = 1; g.stroke();
    wq(g, cam, FARW, zA, zF, h + 1.3, h + 1.62, h + 1.3, h + 1.62); g.fillStyle = wallGrad(g, cam, FARW, PAL.band); g.fill();
    for (const z of this.plates) {
      if (z + 3 < zA || z > zF || z > cam.pz + FOG1) continue;
      onWall(g, cam, plateImg(this.text.station), FARW, z, z + 3, h + 2.0, h + 2.6, fogAt(cam, z + 1.5));
    }
    // the pit: ballast, sleepers, rails
    hq(g, cam, FARW, EDGE, h + PIT, zA, zF); g.fillStyle = floorGrad(g, cam, h + PIT, PAL.track); g.fill();
    for (let z = Math.ceil(zA / 0.6) * 0.6; z < Math.min(zF, cam.pz + FOG1); z += 0.6) {
      hq(g, cam, -4.9, -2.3, h + PIT + 0.02, z, z + 0.24); g.fillStyle = fog(PAL.trackDk, fogAt(cam, z)); g.fill();
    }
    g.beginPath();
    for (const x of [-2.85, -4.3]) line3(g, cam, x, h + PIT + 0.15, zA, x, h + PIT + 0.15, zF);
    g.strokeStyle = floorGrad(g, cam, h + PIT, PAL.rail); g.lineWidth = 2; g.stroke();
    if (this.side && s === this.R.segs[this.R.segs.length - 1]) this.sideTrain(g, cam, s, st);
  }

  sideTrain(g, cam, s, st) {
    const h = s.h0, off = st.off || 0, open = st.open ?? 1;
    const lit = st.lit ?? 1;
    for (let c = this.cars - 1; c >= 0; c--) {
      const zr = this.zf - c * (CAR + CGAP) + off, z0 = zr - CAR, z1 = Math.min(zr, this.zBack);
      if (z0 > Math.min(cam.pz + FAR, this.zBack) - 0.05 || z1 < cam.z + 0.5) continue;
      const k = fogAt(cam, Math.max(z0, cam.pz)), za = Math.max(z0, cam.z + 0.35);
      // roof, side, the light line under the windows
      hq(g, cam, TX2, TX, h + TTOP, za, z1); g.fillStyle = floorGrad(g, cam, h + TTOP, '#cfd2d4'); g.fill();
      wq(g, cam, TX, za, z1, h + TBOT, h + TTOP, h + TBOT, h + TTOP); g.fillStyle = wallGrad(g, cam, TX, PAL.train); g.fill();
      wq(g, cam, TX, za, z1, h + 0.72, h + 0.84, h + 0.72, h + 0.84); g.fillStyle = wallGrad(g, cam, TX, PAL.trainLt); g.fill();
      wq(g, cam, TX, za, z1, h + TTOP - 0.28, h + TTOP, h + TTOP - 0.28, h + TTOP); g.fillStyle = wallGrad(g, cam, TX, PAL.trainDk); g.fill();
      // windows between the doors, with people in them
      const zs = [z0 + 0.5, ...DOORS.flatMap((d) => [z0 + d - DW / 2 - 0.3, z0 + d + DW / 2 + 0.3]), zr - 0.5];
      for (let w = 0; w < zs.length; w += 2) {
        const wa = zs[w], wb = Math.min(zs[w + 1], z1);
        if (wb < cam.z + 0.5 || wb - wa < 0.4) continue;
        const kk = fogAt(cam, (wa + wb) / 2);
        wq(g, cam, TX, Math.max(wa, za), wb, h + 1.05, h + 2.2, h + 1.05, h + 2.2); g.fillStyle = fog(lit ? PAL.lit : PAL.glassDk, kk); g.fill();
        if (lit) this.sideFolk(g, cam, h, wa, wb, c * 7 + w, kk);
        if (c === 0 && w === 4 && st.you) this.youAtWindow(g, cam, h, Math.max(wa, za), wb, st, kk);
        wq(g, cam, TX, Math.max(wa, za), wb, h + 1.05, h + 1.14, h + 1.05, h + 1.14); g.fillStyle = fog(PAL.trainDk, kk); g.fill();
      }
      // doors: the leaves slide back along the car
      DOORS.forEach((d, j) => {
        const zc = z0 + d, kk = fogAt(cam, zc);
        if (zc + DW / 2 < cam.z + 0.5 || zc + DW / 2 > z1) return;
        wq(g, cam, TX, zc - DW / 2, zc + DW / 2, h, h + DH, h, h + DH); g.fillStyle = fog(PAL.lit, kk); g.fill();
        this.sideFolk(g, cam, h - 0.3, zc - DW / 2 + 0.1, zc + DW / 2 - 0.1, c * 5 + j + 20, kk);
        if (!(st.board && c === 0 && j === 2)) this.sideLeaves(g, cam, h, zc, open, lit, kk);
      });
      // the gap to the next car: bellows
      if (zr + CGAP < this.zBack) { wq(g, cam, TX + 0.25, zr, zr + CGAP, h + 0.1, h + TTOP - 0.25, h + 0.1, h + TTOP - 0.25); g.fillStyle = wallGrad(g, cam, TX, '#2a2c30'); g.fill(); }
      if (c === this.cars - 1 && z0 > cam.z + 0.5) {                // the tail of the train, toward you
        const r = fr(cam, z0, TX2, TX, h + TBOT, h + TTOP), sc = r[4];
        g.fillStyle = fog(PAL.trainDk, k); g.fillRect(r[0], r[1], r[2], r[3]);
        g.fillStyle = fog(PAL.glassDk, k); g.fillRect(r[0] + 0.5 * sc, r[1] + 0.55 * sc, r[2] - 1.0 * sc, 0.95 * sc);
        g.fillStyle = fog('#c43a33', k);
        for (const x of [0.32, r[2] / sc - 0.32]) { ell(g, r[0] + x * sc, r[1] + r[3] - 1.05 * sc, 0.1 * sc, 0.1 * sc); g.fill(); }
      }
    }
  }
  // you, painted on the glass like everybody else in there, but in your raincoat, waving
  youAtWindow(g, cam, h, wa, wb, st, k) {
    const L = st.you.L, z = wb - 0.5, u = clamp((st.t - st.you.t0) / 0.3);
    if (z < wa + 0.2 || z < cam.z + 0.8) return;
    const p = cam.v(TX - 0.3, h + 1.5, z), s = p[2], x = p[0], y = p[1];
    if (s < 5) return;
    g.save();
    wq(g, cam, TX, wa, wb, h + 1.05, h + 2.2, h + 1.05, h + 2.2); g.clip();
    g.globalAlpha = u;
    const wv = Math.sin(st.t * 10) * 0.07 * s;
    g.strokeStyle = fog(L.coat, k); g.lineWidth = 0.1 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + 0.15 * s, y + 0.02 * s); g.lineTo(x + 0.27 * s + wv * 0.4, y - 0.36 * s); g.stroke();
    g.fillStyle = fog(L.skin, k); ell(g, x + 0.28 * s + wv, y - 0.44 * s, 0.055 * s, 0.065 * s); g.fill();
    g.fillStyle = fog(L.coat, k); ell(g, x, y + 0.14 * s, 0.23 * s, 0.21 * s); g.fill();
    g.fillStyle = fog(L.hair, k); ell(g, x, y - 0.17 * s, 0.13 * s, 0.14 * s); g.fill();
    g.fillStyle = fog(L.skin, k); ell(g, x + 0.02 * s, y - 0.14 * s, 0.08 * s, 0.1 * s); g.fill();
    g.restore();
  }
  sideLeaves(g, cam, h, zc, open, lit, kk) {
    const o = open * (DW / 2 - 0.05);
    for (const e of [-1, 1]) {
      const a0 = zc + (e < 0 ? -DW / 2 - o : o), a1 = a0 + DW / 2;
      wq(g, cam, TX + 0.01, a0, a1, h, h + DH, h, h + DH); g.fillStyle = fog(PAL.door, kk); g.fill();
      wq(g, cam, TX + 0.01, a0 + 0.12, a1 - 0.12, h + 1.05, h + 1.85, h + 1.05, h + 1.85); g.fillStyle = fog(lit ? PAL.lit : PAL.glassDk, kk); g.fill();
    }
  }
  // the opening of the door you board by, as a path (to clip you to it once you are inside)
  doorPath(g, cam, d) {
    const s = this.R.segs[this.R.segs.length - 1];
    if (d.side) { wq(g, cam, TX, d.z - DW / 2, d.z + DW / 2, s.h0, s.h0 + DH, s.h0, s.h0 + DH); return; }
    const r = fr(cam, this.zT, d.x - DW / 2, d.x + DW / 2, s.h1, s.h1 + DH);
    g.beginPath(); g.rect(r[0], r[1], r[2], r[3]);
  }
  // the door leaves, drawn over whoever is getting on
  leaves(g, cam, st, d) {
    const s = this.R.segs[this.R.segs.length - 1];
    if (d.side) { this.sideLeaves(g, cam, s.h0, d.z, st.open ?? 1, st.lit ?? 1, fogAt(cam, d.z)); return; }
    this.faceTrain(g, cam, st, s.wl, s.wr, s.h1, 'leaves');
  }
  // heads and shoulders in a lit window, painted on the glass
  sideFolk(g, cam, h, wa, wb, seed, k) {
    const F = this.faces, n = Math.max(1, Math.floor((wb - wa) / 0.75));
    for (let i = 0; i < n; i++) {
      const f = F[(seed * 3 + i) % F.length];
      if (f[0] < 0.25) continue;
      const z = wa + ((i + 0.5) / n) * (wb - wa) + (f[1] - 0.5) * 0.2, y = h + 1.35 + f[2] * 0.35;
      const p = cam.v(TX - 0.3, y, z), s = p[2];
      if (s < 4) continue;
      g.fillStyle = fog(f[1] < 0.5 ? '#c7b27c' : '#b39c69', k);
      ell(g, p[0], p[1] - 0.18 * s, 0.1 * s, 0.12 * s); g.fill();
      ell(g, p[0], p[1] + 0.12 * s, 0.22 * s, 0.2 * s); g.fill();
    }
  }

  // ---------- the end of a corridor trip: the platform edge, and the train standing across ----------
  theEnd(g, cam, st) {
    if (this.side) {                                          // the platform's end wall, the tunnel over the track
      const s = this.R.segs[this.R.segs.length - 1], h = s.h0, z = this.zBack, k = fogAt(cam, z);
      const r = fr(cam, z, FARW, s.wr, h + PIT, h + WALL_H);
      g.fillStyle = fog(PAL.tile, k); g.fillRect(r[0], r[1], r[2], r[3]);
      const t = fr(cam, z, -5.1, -2.1, h + PIT, h + TTOP + 0.18);
      g.fillStyle = fog('#1d1e22', k); g.fillRect(t[0], t[1], t[2], t[3]);
      const bm = fr(cam, z, -5.25, EDGE, h + TTOP + 0.18, h + TTOP + 0.36);
      g.fillStyle = fog(PAL.steelDk, k); g.fillRect(bm[0], bm[1], bm[2], bm[3]);
      const b = fr(cam, z, EDGE, s.wr, h + BAND[0], h + BAND[1]);
      g.fillStyle = fog(PAL.band, k); g.fillRect(b[0], b[1], b[2], b[3]);
      const d = fr(cam, z, s.wr - 1.45, s.wr - 0.45, h, h + 2.1);
      g.fillStyle = fog(PAL.steelDk, k); g.fillRect(d[0], d[1], d[2], d[3]);
      g.fillStyle = fog(PAL.steel, k); g.fillRect(d[0] + d[2] * 0.06, d[1] + d[3] * 0.04, d[2] * 0.88, d[3] * 0.96);
      const cx = (EDGE + s.wr) / 2, pw = Math.min(3.0, s.wr - EDGE - 0.8);
      this.nameAndClock(g, cam, st, z, cx - pw / 2, pw, h + 2.55, 0.59, cx, h + 3.92, 0.5, k);
      return;
    }
    const s = this.R.segs[this.R.segs.length - 1], h = s.h1, xl = s.wl, xr = s.wr;
    const zB = this.zBack, kB = fogAt(cam, zB);
    // the wall beyond the track, with the station's name above the train
    const r = fr(cam, zB, xl, xr, h + PIT, h + WALL_H), sc = r[4];
    g.fillStyle = fog(PAL.tile, kB); g.fillRect(r[0], r[1], r[2], r[3]);
    g.fillStyle = fog(PAL.band, kB); g.fillRect(r[0], r[1] + r[3] - (BAND[1] - PIT) * sc, r[2], (BAND[1] - BAND[0]) * sc);
    const pw = Math.min(3.0, xr - xl - 1.8), x0 = -(pw + 1.22) / 2;
    this.nameAndClock(g, cam, st, zB, x0 + 1.22, pw, h + 3.72, 0.59, x0 + 0.5, h + 4.02, 0.5, kB);
    // the pit and its rails, running across
    const z0 = this.zEnd;
    hq(g, cam, xl, xr, h + PIT, z0, zB); g.fillStyle = fog(PAL.track, kB); g.fill();
    g.beginPath();
    for (const z of [this.len + 1.85, this.len + 3.3]) line3(g, cam, xl, h + PIT + 0.15, z, xr, h + PIT + 0.15, z);
    g.strokeStyle = fog(PAL.rail, kB); g.lineWidth = Math.max(1, sc * 0.05); g.stroke();
    this.faceTrain(g, cam, st, xl, xr, h, st.board ? 'body' : 'all');
  }

  // the station's name on its plate, and its clock, on a wall square to you at z
  nameAndClock(g, cam, st, z, px, pw, py, ph, cx, cy, cr, k) {
    const pr = fr(cam, z, px, px + pw, py, py + ph);
    g.drawImage(plateImg(this.text.station), pr[0], pr[1], pr[2], pr[3]);
    if (k > 0.02) { g.fillStyle = PAL.fog; g.globalAlpha = k; g.fillRect(pr[0], pr[1], pr[2], pr[3]); g.globalAlpha = 1; }
    const c = cam.v(cx, cy, z), C = this.lv.clock || [8, 0, 0];
    clockFace(g, c[0], c[1], cr * c[2], C[0] * 3600 + C[1] * 60 + C[2] + (st.t || 0), k);
  }

  // the train's side, seen square on: one car's middle door right where the corridor meets it
  faceTrain(g, cam, st, xl, xr, h, part = 'all') {
    const off = st.off || 0, open = st.open ?? 1, z = this.zT, k = fogAt(cam, z), lit = st.lit ?? 1;
    if (off > 90) return;
    const S = fr(cam, z, 0, 1, h, h + 1), sc = S[4], X = (x) => S[0] + x * sc, Y = (y) => S[1] + S[3] - (y - h) * sc;
    if (part !== 'leaves') {
      g.fillStyle = fog(PAL.train, k); g.fillRect(X(xl), Y(h + TTOP), (xr - xl) * sc, (TTOP - TBOT) * sc);
      g.fillStyle = fog(PAL.trainDk, k); g.fillRect(X(xl), Y(h + TTOP), (xr - xl) * sc, 0.28 * sc);
      g.fillStyle = fog(PAL.trainLt, k); g.fillRect(X(xl), Y(h + 0.84), (xr - xl) * sc, 0.12 * sc);
      for (let c = -1; c <= 2; c++) {
        const u0 = -8.05 + c * (CAR + CGAP) - off, u1 = u0 + CAR;
        if (u1 < xl - 1 || u0 > xr + 1) continue;
        // windows
        const zs = [u0 + 0.5, ...DOORS.flatMap((d) => [u0 + d - DW / 2 - 0.3, u0 + d + DW / 2 + 0.3]), u1 - 0.5];
        for (let w = 0; w < zs.length; w += 2) {
          const a = Math.max(zs[w], xl), b = Math.min(zs[w + 1], xr);
          if (b - a < 0.05) continue;
          g.fillStyle = fog(lit ? PAL.lit : PAL.glassDk, k); g.fillRect(X(a), Y(h + 2.2), (b - a) * sc, 1.15 * sc);
          if (lit) this.faceFolk(g, X, Y, sc, h, zs[w], zs[w + 1], a, b, c * 11 + w, k);
          g.fillStyle = fog(PAL.trainDk, k); g.fillRect(X(a), Y(h + 1.14), (b - a) * sc, 0.09 * sc);
        }
        // the doorways (their insides), and the display over the middle one
        for (const [j, d] of DOORS.entries()) {
          const a = u0 + d - DW / 2, b = a + DW;
          if (b < xl || a > xr) continue;
          g.fillStyle = fog(lit ? PAL.lit : PAL.glassDk, k); g.fillRect(X(a), Y(h + DH), DW * sc, DH * sc);
          if (lit) this.faceFolk(g, X, Y, sc, h - 0.3, a + 0.1, b - 0.1, a + 0.1, b - 0.1, c * 7 + j + 30, k);
          g.fillStyle = fog('#b9bbb8', k); g.fillRect(X(a), Y(h + 0.06), DW * sc, 0.06 * sc);
          if (j === 1) {
            const dx = X(a + 0.05), dy = Y(h + 2.72), dw = (DW - 0.1) * sc, dh = 0.3 * sc;
            g.fillStyle = fog('#141417', k); g.fillRect(dx, dy, dw, dh);
            if (dh > 6) {
              g.fillStyle = fog('#f2a31a', k); g.font = `700 ${dh * 0.62}px ${DOTS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
              g.fillText(this.text.dest, dx + dw / 2, dy + dh * 0.54, dw * 0.92);
            }
          }
        }
        // between cars
        const gA = u1, gB = u1 + CGAP;
        if (gB > xl && gA < xr) { g.fillStyle = fog('#2a2c30', k); g.fillRect(X(Math.max(gA, xl)), Y(h + TTOP - 0.25), (Math.min(gB, xr) - Math.max(gA, xl)) * sc, (TTOP - 0.35) * sc); }
      }
    }
    if (part !== 'body') {
      for (let c = -1; c <= 2; c++) {
        const u0 = -8.05 + c * (CAR + CGAP) - off;
        for (const d of DOORS) {
          const zc = u0 + d, o = open * (DW / 2 - 0.05);
          if (zc + DW < xl || zc - DW > xr) continue;
          for (const e of [-1, 1]) {
            const a0 = zc + (e < 0 ? -DW / 2 - o : o), a1 = a0 + DW / 2;
            const a = Math.max(a0, xl), b = Math.min(a1, xr);
            if (b - a < 0.01) continue;
            g.fillStyle = fog(PAL.door, k); g.fillRect(X(a), Y(h + DH), (b - a) * sc, DH * sc);
            const ga = Math.max(a0 + 0.12, xl), gb = Math.min(a1 - 0.12, xr);
            if (gb > ga) { g.fillStyle = fog(lit ? PAL.lit : PAL.glassDk, k); g.fillRect(X(ga), Y(h + 1.85), (gb - ga) * sc, 0.8 * sc); }
            g.fillStyle = fog('#9fa3a6', k); g.fillRect(X(e < 0 ? a1 - 0.03 : a0), Y(h + DH), 0.03 * sc, DH * sc);
          }
        }
      }
    }
  }
  faceFolk(g, X, Y, sc, h, wa, wb, a, b, seed, k) {
    const F = this.faces, n = Math.max(1, Math.floor((wb - wa) / 0.62));
    g.save(); g.beginPath(); g.rect(X(a), Y(h + 3), (b - a) * sc, 3 * sc); g.clip();
    for (let i = 0; i < n; i++) {
      const f = F[(seed * 3 + i) % F.length];
      if (f[0] < 0.2) continue;
      const x = wa + ((i + 0.5) / n) * (wb - wa) + (f[1] - 0.5) * 0.18, y = h + 1.62 + f[2] * 0.3;
      g.fillStyle = fog(f[1] < 0.5 ? '#c7b27c' : '#b39c69', k);
      ell(g, X(x), Y(y + 0.2), 0.1 * sc, 0.12 * sc); g.fill();
      ell(g, X(x), Y(y - 0.12), 0.23 * sc, 0.22 * sc); g.fill();
    }
    g.restore();
  }
  // where you get on: the doorway nearest you
  door(P) {
    if (this.side) {
      const zc = this.zf - CAR + DOORS[2];
      return { side: true, x: TX, z: zc, w: DW };
    }
    const u0 = -8.05, xs = DOORS.map((d) => u0 + d);
    const px = laneX(P.x);
    let best = xs[0];
    for (const x of xs) if (Math.abs(x - px) < Math.abs(best - px)) best = x;
    return { side: false, x: best, z: this.zT, w: DW };
  }

  // ---------- things that stand among the people (drawn in depth order with them) ----------
  fixtures(cam, out, st) {
    const zN = cam.z + 0.45, zF = cam.pz + FAR, R = this.R;
    for (const p of R.pillars) if (p.z > zN - 0.6 && p.z < zF) out.push({ z: p.z, draw: (g) => this.pillar(g, cam, p) });
    R.gates.forEach((gt, gi) => {
      if (gt.z + gt.depth < zN || gt.z > zF) return;
      const seg = R.seg(gt.z + 0.1), lo = seg.open[0], hi = seg.open[1];
      for (let l = lo; l <= hi + 1; l++) {
        const x = laneX(l) - LW / 2;
        out.push({ z: gt.z + 0.4 + Math.abs(x - cam.x) * 0.02, draw: (g) => this.cabinet(g, cam, gt, gi, l, x, lo, hi) });
      }
      for (let l = lo; l <= hi; l++) out.push({ z: gt.z + 0.34, draw: (g) => this.paddles(g, cam, gt, gi, l) });
    });
    for (const rl of R.rails) {
      for (let z = rl.z0; z < rl.z1; z += 1.2) {
        const zb = Math.min(z + 1.2, rl.z1);
        if (zb < zN || z > zF) continue;
        out.push({ z, draw: (g) => this.rail(g, cam, rl, z, zb) });
      }
    }
  }

  pillar(g, cam, p) {
    const h = floorAt(this.R, p.z), x0 = laneX(p.lane) - 0.3, x1 = laneX(p.lane) + LW / 2 + 0.3, z0 = p.z, z1 = p.z + p.len, k = fogAt(cam, z0);
    if (cam.x < x0) { wq(g, cam, x0, Math.max(z0, cam.z + 0.35), z1, h, h + WALL_H, h, h + WALL_H); g.fillStyle = fog(darker(PAL.tile, 0.06), k); g.fill();
      wq(g, cam, x0, Math.max(z0, cam.z + 0.35), z1, h + BAND[0], h + BAND[1], h + BAND[0], h + BAND[1]); g.fillStyle = fog(PAL.bandDk, k); g.fill(); }
    if (z0 < cam.z + 0.4) return;
    const r = fr(cam, z0, x0, x1, h, h + WALL_H), s = r[4];
    g.fillStyle = fog(PAL.tile, k); g.fillRect(r[0], r[1], r[2], r[3]);
    if (s * TILE > 5) {
      g.beginPath();
      for (let y = TILE; y < 5.2; y += TILE) { const yy = r[1] + r[3] - y * s; g.moveTo(r[0], yy); g.lineTo(r[0] + r[2], yy); }
      g.strokeStyle = fog(PAL.grout, k); g.lineWidth = 1; g.stroke();
    }
    g.fillStyle = fog(PAL.band, k); g.fillRect(r[0], r[1] + r[3] - BAND[1] * s, r[2], (BAND[1] - BAND[0]) * s);
    g.fillStyle = fog('#8d918f', k); g.fillRect(r[0], r[1] + r[3] - SKIRT * s, r[2], SKIRT * s);
    g.fillStyle = fog(PAL.steel, k); g.fillRect(r[0] - 0.02 * s, r[1] + r[3] - 1.4 * s, 0.05 * s, 1.4 * s);
  }

  cabinet(g, cam, gt, gi, l, xc, lo, hi) {
    const h = floorAt(this.R, gt.z), z0 = gt.z, z1 = gt.z + gt.depth, x0 = xc - 0.1, x1 = xc + 0.1, top = h + 1.02, k = fogAt(cam, z0);
    if (z1 < cam.z + 0.4) return;
    const za = Math.max(z0, cam.z + 0.35);
    hq(g, cam, x0, x1, top, za, z1); g.fillStyle = fog(PAL.steelLt, k); g.fill();
    if (cam.x < x0) { wq(g, cam, x0, za, z1, h, top, h, top); g.fillStyle = fog(PAL.steelDk, k); g.fill(); }
    else if (cam.x > x1) { wq(g, cam, x1, za, z1, h, top, h, top); g.fillStyle = fog(PAL.steelDk, k); g.fill(); }
    if (z0 < cam.z + 0.4) return;
    const r = fr(cam, z0, x0, x1, h, top), s = r[4];
    g.fillStyle = fog(PAL.steel, k); g.fillRect(r[0], r[1], r[2], r[3]);
    g.fillStyle = fog(PAL.steelDk, k); g.fillRect(r[0], r[1] + r[3] - 0.08 * s, r[2], 0.08 * s);
    // the light for the passage on its right: a green arrow in, a red cross out
    if (l <= hi && l >= lo && s > 10) {
      const kind = gt.lanes[l], ok = kind === 'in' || kind === 'both';
      const cx = r[0] + r[2] / 2, cy = r[1] + 0.2 * s, q = 0.055 * s;
      g.fillStyle = fog('#1a1c20', k); g.fillRect(cx - 0.075 * s, cy - 0.075 * s, 0.15 * s, 0.15 * s);
      g.strokeStyle = fog(ok ? PAL.go : PAL.stop, k); g.lineWidth = Math.max(1, 0.022 * s); g.lineCap = 'round';
      g.beginPath();
      if (ok) { g.moveTo(cx, cy + q); g.lineTo(cx, cy - q); g.moveTo(cx - q * 0.7, cy - q * 0.3); g.lineTo(cx, cy - q); g.lineTo(cx + q * 0.7, cy - q * 0.3); }
      else { g.moveTo(cx - q * 0.7, cy - q * 0.7); g.lineTo(cx + q * 0.7, cy + q * 0.7); g.moveTo(cx + q * 0.7, cy - q * 0.7); g.lineTo(cx - q * 0.7, cy + q * 0.7); }
      g.stroke();
    }
    // the validator (violet) sits on the cabinet to the right of a way in
    const left = l - 1;
    if (left >= lo && (gt.lanes[left] === 'in' || gt.lanes[left] === 'both')) {
      const v = fr(cam, z0 + 0.08, x0 - 0.02, x1 + 0.02, top, top + 0.2);
      g.fillStyle = fog(PAL.violet, k); g.fillRect(v[0], v[1], v[2], v[3]);
      const on = this.gate[gi][left] > 0.5;
      g.fillStyle = fog(on ? '#7fe0a0' : PAL.violetLt, k); g.fillRect(v[0] + v[2] * 0.22, v[1] + v[3] * 0.25, v[2] * 0.56, v[3] * 0.3);
    }
  }
  paddles(g, cam, gt, gi, l) {
    const h = floorAt(this.R, gt.z), z = gt.z + 0.34, k = fogAt(cam, z);
    if (z < cam.z + 0.4) return;
    const o = this.gate[gi][l], x = laneX(l), reach = (LW / 2 - 0.1) * (1 - o);
    if (reach < 0.02) return;
    g.fillStyle = fog(PAL.glass, k); g.globalAlpha = 0.75;
    for (const e of [-1, 1]) {
      const xa = e < 0 ? x - LW / 2 + 0.1 : x + LW / 2 - 0.1 - reach;
      const r = fr(cam, z, xa, xa + reach, h + 0.45, h + 1.05);
      g.fillRect(r[0], r[1], r[2], r[3]);
    }
    g.globalAlpha = 1;
  }
  rail(g, cam, rl, z0, z1) {
    const x = laneX(rl.at) + LW / 2, a = floorAt(this.R, z0), b = floorAt(this.R, z1), k = fogAt(cam, z0);
    g.lineCap = 'round';
    g.beginPath(); line3(g, cam, x, a + 0.95, Math.max(z0, cam.z + 0.35), x, b + 0.95, z1);
    const p = cam.v(x, a, Math.max(z0, cam.z + 0.35));
    g.strokeStyle = fog(PAL.steelDk, k); g.lineWidth = Math.max(1.2, 0.05 * p[2]); g.stroke();
    if (z0 > cam.z + 0.4) {
      const t = cam.v(x, a + 0.95, z0), f = cam.v(x, a, z0);
      g.beginPath(); g.moveTo(f[0], f[1]); g.lineTo(t[0], t[1]); g.strokeStyle = fog(PAL.steel, k); g.lineWidth = Math.max(1.2, 0.045 * f[2]); g.stroke();
    }
  }
}
