// The rooms, painted once per level and size: a Spanish flat cut open like a dollhouse. Slabs and walls show
// their section (hatched concrete), the neighbours' rooms glow dimly above and below, and every piece of
// furniture is drawn from the solid it is in the sim, so what you see is exactly what the cat bumps into.
// Centimetres, y down, the room's floor at y = H. Painted into vertical chunks (a canvas has an area limit).
import { mulberry32, roundRect, shade, rgba, TAU } from '../util.js';

export const INK = '#2a1c14';
export const WOOD = ['#b8793f', '#8f5a2c', '#6f431f'];
const TH = {
  desayuno: { wall: ['#f8e6c4', '#eed09f'], dado: { h: 100, kind: 'hydra' }, floor: 'tile', sky: 'morning', light: [0.3, 0.1, '255,238,200', 0.9], nb: ['#3a2c26', '#ffcf7a'] },
  nevera: { wall: ['#eef3ec', '#dfe7de'], floor: 'check', sky: 'noon', light: [0.55, 0.05, '255,250,235', 0.7], nb: ['#302a2a', '#9fd2ff'] },
  salon: { wall: ['#eab777', '#d99a55'], paper: true, floor: 'parquet', sky: 'dusk', light: [0.65, 0.35, '255,196,120', 1], nb: ['#352823', '#ffb45e'] },
  pasillo: { wall: ['#e3d4b7', '#d2bf9b'], dado: { h: 92, kind: 'wood' }, floor: 'terrazo', sky: 'evening', light: [0.7, 0.05, '255,214,150', 1], nb: ['#2b2426', '#ffd28a'] },
  bano: { wall: ['#c6e4ea', '#a9d3dc'], dado: { h: 250, kind: 'tile' }, floor: 'check', sky: 'night', light: [0.5, 0.05, '235,248,255', 0.8], nb: ['#232530', '#b8c8ff'] },
  terraza: { sky: 'midnight', light: [0.5, 0.2, '255,210,140', 0.6], nb: ['#231d2e', '#ffcf73'] },
};
export const themeOf = (lv) => TH[lv.id] || TH.desayuno;
export const SKY = {
  morning: ['#9fd0f0', '#ffe2b0', '#f7b27a'], noon: ['#7ec1ec', '#bfe3f7', '#e8f4fa'], dusk: ['#5a5f9c', '#e98a6b', '#ffc98a'],
  evening: ['#2e3a6b', '#6b5a8c', '#e39a7a'], night: ['#141a33', '#1f2a4d', '#2f3b66'], midnight: ['#0c1024', '#151d3d', '#26305a'],
};
const CHUNK = 4096;
// how thick the slabs look: thinner than the sim's, so a landscape screen sees a strip of each neighbour
const SLAB = { ceil: 22, floor: 24 };

export class Room {
  constructor() { this.chunks = []; this.k = 1; this.b = [0, 0, 1, 1]; }
  // what gets painted: the room plus enough of the building to fill the view (portrait screens see a lot of it)
  static bounds(lv, viewH = 320) {
    if (lv.id === 'terraza') return [-120, -Math.max(260, viewH / 2 + 60), lv.W + 120, lv.H + Math.max(300, viewH / 2 + 120)];
    const m = Math.max(90, (viewH - lv.H) / 2 + 50);
    return [-80, -m, lv.W + 80, lv.H + m + 20];
  }
  paint(lv, k, viewH, maxArea = 16e6) {
    const b = Room.bounds(lv, viewH), [x0, y0, x1, y1] = b, W = x1 - x0, H = y1 - y0;
    if (W * H * k * k > maxArea) k = Math.sqrt(maxArea / (W * H));
    this.k = k; this.b = b; this.lv = lv; this.th = themeOf(lv); this.px = 1 / k;
    const cw = Math.floor(CHUNK / k) - 4, n = Math.ceil(W / cw);
    while (this.chunks.length < n) this.chunks.push({ c: typeof document !== 'undefined' ? document.createElement('canvas') : null });
    this.chunks.length = n;
    for (let i = 0; i < n; i++) {
      const ch = this.chunks[i], a = x0 + i * cw - 1, e = Math.min(x1, x0 + (i + 1) * cw) + 1;
      ch.x0 = a; ch.x1 = e; ch.c.width = Math.ceil((e - a) * k); ch.c.height = Math.ceil(H * k);
      const g = ch.c.getContext('2d'); this.g = g;
      g.setTransform(k, 0, 0, k, -a * k, -y0 * k);
      this.rng = mulberry32(lv.n * 97 + 5);
      if (lv.id === 'terraza') this.terrace(lv); else this.room(lv);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    this.g = null;
    return this;
  }
  // under the camera's world transform
  draw(ctx) {
    const [, y0, , y1] = this.b;
    for (const ch of this.chunks) ctx.drawImage(ch.c, ch.x0, y0, ch.x1 - ch.x0, y1 - y0);
  }
  // beyond the painted bounds: more building
  fill(ctx, x, y, w, h) {
    const nb = this.th.nb || ['#2a201c'];
    ctx.fillStyle = shade(nb[0], -0.25); ctx.fillRect(x, y, w, h);
  }

  // ---------------------------------------------------------------- an ordinary room
  room(lv) {
    const g = this.g, { W, H } = lv, th = this.th, [x0, y0, x1, y1] = this.b;
    g.fillStyle = shade(th.nb[0], -0.2); g.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
    this.neighbours(lv);
    const wg = g.createLinearGradient(0, 0, 0, H); wg.addColorStop(0, th.wall[0]); wg.addColorStop(1, th.wall[1]);
    g.fillStyle = wg; g.fillRect(0, 0, W, H);
    if (th.paper) this.wallpaper(W, H);
    if (th.dado) this.dado(W, H, th.dado);
    g.fillStyle = shade(th.wall[1], -0.35); g.fillRect(0, H - 9, W, 9);
    g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(0, H - 9, W, 0.8);
    for (const d of lv.decor || []) this.decor(d, lv);
    const S = lv.solids;
    this.tub(S, H);
    for (const q of S) this.solid(q, lv);
    this.boxes(S, H);
    // the light of the room: a warm pool from the lamp or the window, and the corners darker
    const [lx, ly, lc, la] = th.light, cx = W * lx, cy = H * ly, r = Math.max(W, H) * 0.9;
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip();
    const lg = g.createRadialGradient(cx, cy, 10, cx, cy, r); lg.addColorStop(0, `rgba(${lc},${0.3 * la})`); lg.addColorStop(0.5, `rgba(${lc},${0.08 * la})`); lg.addColorStop(1, `rgba(${lc},0)`);
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.45, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(60,30,10,0)'); vg.addColorStop(1, 'rgba(60,30,10,0.2)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.restore();
    for (const q of S) if (q[4] === 'floor' || q[4] === 'ceil' || q[4] === 'wall') this.slab(q, lv);
  }
}

Object.assign(Room.prototype, {
  ink(k = 1) { const g = this.g; g.strokeStyle = INK; g.lineWidth = Math.max(this.px * 1.2, 0.7 * k); g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); },
  fillInk(c, k = 1) { this.g.fillStyle = c; this.g.fill(); this.ink(k); },
  R(x, y, w, h, r) { roundRect(this.g, x, y, w, h, r); },

  // upstairs and downstairs: somebody else's evening, dimly
  neighbours(lv) {
    const g = this.g, { W, H } = lv, [, y0, , y1] = this.b, [bg, lamp] = this.th.nb, rng = mulberry32(lv.n * 31 + 7);
    const flats = [[-SLAB.ceil - H, -SLAB.ceil], [H + SLAB.floor, H + SLAB.floor + H]];
    for (const [top, bot] of flats) {
      if (bot < y0 || top > y1) continue;
      const wg = g.createLinearGradient(0, top, 0, bot); wg.addColorStop(0, shade(bg, 0.06)); wg.addColorStop(1, shade(bg, -0.1));
      g.fillStyle = wg; g.fillRect(0, top, W, bot - top);
      const wins = [];
      for (let x = 70 + rng() * 90; x < W - 90; x += 250 + rng() * 220) {
        wins.push(x);
        const wy = bot - 190, gl = g.createRadialGradient(x + 35, wy + 45, 5, x + 35, wy + 45, 150);
        gl.addColorStop(0, rgba(lamp, 0.3)); gl.addColorStop(1, rgba(lamp, 0));
        g.fillStyle = gl; g.fillRect(x - 120, top, 310, bot - top);
        g.fillStyle = rgba(lamp, 0.45); this.R(x, wy, 70, 95, 3); g.fill();
        g.fillStyle = rgba('#000000', 0.4); g.fillRect(x, wy + 44, 70, 3); g.fillRect(x + 33.5, wy, 3, 95);
      }
      // silhouettes of furniture, and a hanging lamp
      g.fillStyle = rgba('#000000', 0.32);
      const sx = W * (0.25 + rng() * 0.4);
      this.R(sx, bot - 45, 150, 38, 8); g.fill(); this.R(sx - 10, bot - 70, 24, 66, 8); g.fill(); this.R(sx + 136, bot - 70, 24, 66, 8); g.fill(); this.R(sx + 8, bot - 90, 134, 30, 8); g.fill();
      g.fillRect(sx + 260, bot - 75, 110, 8); g.fillRect(sx + 270, bot - 70, 7, 70); g.fillRect(sx + 356, bot - 70, 7, 70);
      // their floor: a rug, slippers kicked off, a plant
      g.fillStyle = rgba(lamp, 0.1); this.R(sx - 40, bot - 8, 240, 4, 2); g.fill();
      g.fillStyle = rgba('#000000', 0.34);
      for (const [dx, a] of [[0, -0.12], [13, 0.2]]) { g.save(); g.translate(sx + 170 + dx, bot - 3.2); g.rotate(a); this.R(-5.5, -2.4, 11, 4.8, 2.4); g.fill(); g.restore(); }
      const px = W * 0.09 + rng() * 40;
      g.beginPath(); g.moveTo(px - 11, bot - 24); g.lineTo(px + 11, bot - 24); g.lineTo(px + 8, bot - 1); g.lineTo(px - 8, bot - 1); g.closePath(); g.fill();
      for (const [lx, ly, rx, ry, a] of [[-8, -34, 5, 13, -0.5], [7, -36, 5, 14, 0.45], [0, -40, 4.5, 15, 0]]) { g.beginPath(); g.ellipse(px + lx, bot + ly, rx, ry, a, 0, TAU); g.fill(); }
      // their ceiling: curtain rails over the windows, and a lamp on a short flex
      for (const x of wins) {
        g.fillStyle = rgba('#000000', 0.3); g.fillRect(x - 24, top + 8, 118, 2.5);
        for (const [cx, dir] of [[x - 20, 1], [x + 90, -1]]) {
          g.beginPath(); g.moveTo(cx, top + 10);
          for (let i = 0; i <= 4; i++) g.lineTo(cx + dir * i * 5, top + 10 + (i % 2) * 1.6);
          g.lineTo(cx + dir * 24, bot - 4); g.lineTo(cx - dir * 2, bot - 4); g.closePath(); g.fill();
        }
      }
      const lx = W * 0.8, ly = top + 16;
      g.fillStyle = rgba('#000000', 0.34); g.fillRect(lx - 7, top, 14, 2.5); g.fillRect(lx - 0.8, top, 1.6, ly - top);
      g.beginPath(); g.moveTo(lx - 17, ly + 16); g.lineTo(lx + 17, ly + 16); g.lineTo(lx + 8, ly); g.lineTo(lx - 8, ly); g.closePath(); g.fill();
      g.fillStyle = rgba(lamp, 0.8); g.beginPath(); g.ellipse(lx, ly + 16, 15, 2.2, 0, 0, Math.PI); g.fill();
      const lg = g.createRadialGradient(lx, ly + 20, 2, lx, ly + 20, 110); lg.addColorStop(0, rgba(lamp, 0.4)); lg.addColorStop(1, rgba(lamp, 0));
      g.fillStyle = lg; g.fillRect(lx - 110, ly, 220, 130);
      g.fillStyle = rgba('#000000', 0.18); g.fillRect(0, bot - 6, W, 6);
    }
    // the building beyond them: slabs every floor
    for (const [y, h] of [[-SLAB.ceil - H - SLAB.floor, SLAB.floor], [H + SLAB.floor + H, SLAB.ceil]]) if (y + h > y0 && y < y1) this.hatch(-80, y, W + 160, h, shade('#cdbfae', -0.35));
  },
  wallpaper(W, H) {
    const g = this.g, c = this.th.wall[1];
    for (let y = 12, row = 0; y < H; y += 26, row++) for (let x = (row % 2) * 17; x < W + 17; x += 34) {
      g.fillStyle = rgba(shade(c, -0.14), 0.5); g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill();
      g.fillStyle = rgba('#fff3dd', 0.4); g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill();
      g.fillStyle = rgba(shade(c, -0.3), 0.4); g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill();
    }
  },
  dado(W, H, d) {
    const g = this.g, top = H - d.h, px = this.px;
    if (d.kind === 'hydra') {
      const t = 20;
      for (let y = top; y < H - 9; y += t) for (let x = 0; x < W; x += t) {
        g.fillStyle = '#efe0c2'; g.fillRect(x, y, t, t);
        g.fillStyle = '#3f6f73'; g.beginPath(); g.moveTo(x + t / 2, y + 2.5); g.lineTo(x + t - 2.5, y + t / 2); g.lineTo(x + t / 2, y + t - 2.5); g.lineTo(x + 2.5, y + t / 2); g.closePath(); g.fill();
        g.fillStyle = '#efe0c2'; g.beginPath(); g.arc(x + t / 2, y + t / 2, 4.2, 0, TAU); g.fill();
        g.fillStyle = '#b6533a'; g.beginPath(); g.arc(x + t / 2, y + t / 2, 2.6, 0, TAU); g.fill();
        g.fillStyle = '#d9a95c'; for (const [a, b] of [[0, 0], [t, 0], [0, t], [t, t]]) { g.beginPath(); g.arc(x + a, y + b, 3.4, 0, TAU); g.fill(); }
      }
      g.strokeStyle = rgba('#7a5a3a', 0.3); g.lineWidth = px;
      for (let y = top; y < H - 9; y += t) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (let x = 0; x < W; x += t) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, H - 9); g.stroke(); }
      g.fillStyle = '#7b4a2b'; g.fillRect(0, top - 3, W, 4);
    } else if (d.kind === 'wood') {
      g.fillStyle = '#8a5a3b'; g.fillRect(0, top, W, d.h);
      for (let x = 0; x < W; x += 46) { g.fillStyle = rgba('#000000', 0.13); g.fillRect(x + 5, top + 10, 36, d.h - 26); g.fillStyle = rgba('#ffffff', 0.09); g.fillRect(x + 5, top + 10, 36, 1.2); }
      g.fillStyle = '#6b4128'; g.fillRect(0, top - 4, W, 5); g.fillStyle = rgba('#ffffff', 0.15); g.fillRect(0, top - 4, W, 1);
    } else if (d.kind === 'tile') {
      const t = 15, y0 = Math.max(0, top);
      for (let y = y0; y < H - 9; y += t) for (let x = 0; x < W; x += t) {
        g.fillStyle = (((x + y) / t) | 0) % 2 ? '#a3d3dd' : '#b3dce5'; g.fillRect(x, y, t, t);
        g.fillStyle = rgba('#ffffff', 0.4); g.fillRect(x + 1.5, y + 1.5, t - 3, 1);
      }
      g.strokeStyle = rgba('#5d8f9a', 0.4); g.lineWidth = px;
      for (let y = y0; y < H; y += t) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (let x = 0; x < W; x += t) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, H); g.stroke(); }
    }
  },
  slab([x, y, w, h, tag], lv) {
    const g = this.g, { W, H } = lv, [, y0, , y1] = this.b;
    if (tag === 'floor') {
      this.hatch(x, y + 5, w, SLAB.floor - 5, '#cdbfae');
      this.floorFinish(y, lv);
      g.fillStyle = INK; g.fillRect(x, y + 5, w, 0.6);
    } else if (tag === 'ceil') {
      this.hatch(x, y + h - SLAB.ceil, w, SLAB.ceil - 4, '#cdbfae');
      g.fillStyle = '#f3ece0'; g.fillRect(0, y + h - 4, W, 4);
      g.fillStyle = rgba('#000000', 0.16); g.fillRect(0, y + h, W, 3);
      g.fillStyle = INK; g.fillRect(x, y + h - 4.3, w, 0.6);
    } else {
      // a wall cut through: brick behind the plaster, all the way up and down the building
      this.hatch(x, y0, w, y1 - y0, '#c9b8a2');
      const inner = x < 0 ? 0 : W;
      g.fillStyle = rgba('#000000', 0.22); g.fillRect(x < 0 ? inner : inner - 3, 0, 3, H);
      g.fillStyle = INK; g.fillRect(inner - 0.3, y0, 0.6, y1 - y0);
    }
  },
  floorFinish(y, lv) {
    const g = this.g, f = this.th.floor, W = lv.W, rng = mulberry32(lv.n * 13);
    const band = (step, cols) => { for (let u = 0; u < W; u += step) { g.fillStyle = cols[((u / step) | 0) % cols.length]; g.fillRect(u, y, Math.min(step, W - u), 5); } };
    if (f === 'tile') band(25, ['#b9623c', '#a9552f']);
    else if (f === 'check') band(20, ['#2f3d46', '#ece6da']);
    else if (f === 'parquet') band(34, ['#b07a4a', '#9b673c', '#a8703f']);
    else { g.fillStyle = '#dad2c4'; g.fillRect(0, y, W, 5); for (let u = 0; u < W; u += 2.2) { g.fillStyle = ['#8b7d6b', '#b36b4b', '#5e6b73', '#e8e0d0'][(rng() * 4) | 0]; g.fillRect(u, y + 0.8 + rng() * 3.4, 0.9, 0.9); } }
    g.fillStyle = rgba('#ffffff', 0.35); g.fillRect(0, y, W, 0.9);
  },
  hatch(x, y, w, h, c) {
    const g = this.g, rng = mulberry32(((x * 7 + y * 13) | 0) + 1);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = c; g.fillRect(x, y, w, h);
    g.strokeStyle = rgba(INK, 0.22); g.lineWidth = 0.5;
    g.beginPath(); for (let u = x - h; u < x + w; u += 7) { g.moveTo(u, y + h); g.lineTo(u + h, y); } g.stroke();
    g.fillStyle = rgba(INK, 0.3); for (let i = 0, n = Math.min(3000, (w * h) / 70); i < n; i++) g.fillRect(x + rng() * w, y + rng() * h, 1, 1);
    g.restore();
  },
  frame(x, y, w, h, c, t) {
    const g = this.g;
    g.strokeStyle = c; g.lineWidth = t; g.strokeRect(x - t / 2, y - t / 2, w + t, h + t);
    g.strokeStyle = INK; g.lineWidth = 0.6; g.strokeRect(x - t, y - t, w + 2 * t, h + 2 * t); g.strokeRect(x, y, w, h);
  },
  // through a window: the street at this hour
  sky(x, top, w, h, kind) {
    const g = this.g, sk = SKY[this.th.sky] || SKY.morning, rng = mulberry32((x | 0) * 3 + 11);
    g.save(); g.beginPath(); g.rect(x, top, w, h); g.clip();
    const sea = kind === 'sea', sg = g.createLinearGradient(0, top, 0, top + h);
    sg.addColorStop(0, sea ? '#8cc7e6' : sk[0]); sg.addColorStop(0.6, sea ? '#d8eef6' : sk[1]); sg.addColorStop(1, sea ? '#f6e9c9' : sk[2]);
    g.fillStyle = sg; g.fillRect(x, top, w, h);
    if (sea) {
      g.fillStyle = '#3f7fae'; g.fillRect(x, top + h * 0.62, w, h * 0.38);
      g.fillStyle = rgba('#ffffff', 0.5); for (let i = 0; i < 6; i++) g.fillRect(x + rng() * w, top + h * (0.66 + rng() * 0.3), 6, 0.8);
      g.fillStyle = '#f8f1dc'; g.beginPath(); g.moveTo(x + w * 0.5, top + h * 0.28); g.lineTo(x + w * 0.5, top + h * 0.58); g.lineTo(x + w * 0.68, top + h * 0.58); g.closePath(); g.fill();
      g.fillStyle = '#7a4a2a'; g.fillRect(x + w * 0.42, top + h * 0.58, w * 0.3, 3);
      g.fillStyle = '#fff4c8'; g.beginPath(); g.arc(x + w * 0.2, top + h * 0.3, 6, 0, TAU); g.fill();
    } else {
      const night = ['night', 'midnight', 'evening'].includes(this.th.sky);
      if (this.th.sky === 'morning') { g.fillStyle = rgba('#fff4c8', 0.9); g.beginPath(); g.arc(x + w * 0.7, top + h * 0.38, 7, 0, TAU); g.fill(); }
      if (night) { g.fillStyle = '#ffffff'; for (let i = 0; i < 8; i++) g.fillRect(x + rng() * w, top + rng() * h * 0.4, 0.8, 0.8); }
      for (let u = x - 10; u < x + w + 10;) {
        const bw = 18 + rng() * 26, bh = h * (0.25 + rng() * 0.35);
        g.fillStyle = night ? '#1d2138' : shade(sk[2], -0.3); g.fillRect(u, top + h - bh, bw, bh);
        if (rng() < 0.4) { g.fillRect(u + bw * 0.6, top + h - bh - 8, 1, 8); g.fillRect(u + bw * 0.45, top + h - bh - 8, 6, 1); }
        g.fillStyle = night ? '#ffd27a' : rgba('#ffffff', 0.35);
        for (let wy = top + h - bh + 5; wy < top + h - 4; wy += 7) for (let wx = u + 3; wx < u + bw - 4; wx += 6) if (rng() < (night ? 0.35 : 0.45)) g.fillRect(wx, wy, 2.5, 3);
        u += bw + 2;
      }
    }
    g.restore();
  },
});

Object.assign(Room.prototype, {
  decor(d, lv) {
    const g = this.g, H = lv.H, [k, x] = d, y = (cm) => H - cm;
    switch (k) {
      case 'window': {
        const [, , b, w, h] = d, top = y(b + h);
        this.sky(x, top, w, h);
        g.fillStyle = '#ebe3d1'; g.fillRect(x, top, w, h * 0.3);
        g.strokeStyle = rgba('#8a7d66', 0.55); g.lineWidth = 0.4;
        g.beginPath(); for (let u = top + 3; u < top + h * 0.3; u += 3.2) { g.moveTo(x, u); g.lineTo(x + w, u); } g.stroke();
        g.fillStyle = rgba('#000000', 0.15); g.fillRect(x, top + h * 0.3, w, 1.5);
        g.fillStyle = '#f5f1e8'; g.fillRect(x + w / 2 - 1.5, top + h * 0.3, 3, h * 0.7);
        g.strokeStyle = rgba('#ffffff', 0.35); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 6, top + h * 0.95); g.lineTo(x + 18, top + h * 0.4); g.moveTo(x + w / 2 + 6, top + h * 0.95); g.lineTo(x + w / 2 + 14, top + h * 0.6); g.stroke();
        this.frame(x, top, w, h, '#f5f1e8', 4);
        this.R(x - 7, y(b) - 1, w + 14, 5, 1.5); this.fillInk('#efe7d6');
        // a pot of geraniums on the sill
        g.fillStyle = '#c56a3e'; g.beginPath(); g.moveTo(x + w - 26, y(b) - 12); g.lineTo(x + w - 8, y(b) - 12); g.lineTo(x + w - 10, y(b) - 1); g.lineTo(x + w - 24, y(b) - 1); g.closePath(); g.fill(); this.ink(0.7);
        for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#3f8a4c' : '#4f9a5a'; g.beginPath(); g.arc(x + w - 25 + i * 4, y(b) - 15 - (i % 2) * 3, 3.2, 0, TAU); g.fill(); }
        for (const [a, b2] of [[-22, -20], [-15, -23], [-12, -18]]) { g.fillStyle = '#e0343a'; g.beginPath(); g.arc(x + w + a, y(b) + b2, 2, 0, TAU); g.fill(); }
        break;
      }
      case 'clock': {
        const [, , at] = d, cy = y(at);
        g.fillStyle = '#fbf7ee'; g.beginPath(); g.arc(x, cy, 13, 0, TAU); g.fill(); g.lineWidth = 2.4; g.strokeStyle = '#c24d2c'; g.stroke();
        g.beginPath(); g.arc(x, cy, 14.4, 0, TAU); g.strokeStyle = INK; g.lineWidth = 0.6; g.stroke();
        g.fillStyle = INK; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.fillRect(x + Math.cos(a) * 10 - 0.6, cy + Math.sin(a) * 10 - 0.6, 1.2, 1.2); }
        g.strokeStyle = INK; g.lineCap = 'round'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, cy); g.lineTo(x + 4.5, cy - 4.5); g.stroke();
        g.lineWidth = 1; g.beginPath(); g.moveTo(x, cy); g.lineTo(x - 1, cy - 9.5); g.stroke();
        break;
      }
      case 'calendar': {
        const [, , at] = d, top = y(at);
        g.fillStyle = '#fffaf0'; g.beginPath(); g.rect(x - 14, top, 28, 40); g.fill(); this.ink(0.8);
        g.fillStyle = '#e9a35e'; g.fillRect(x - 11, top + 3, 22, 16);
        g.fillStyle = '#c96a2c'; g.beginPath(); g.ellipse(x - 1, top + 14, 6, 3.6, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(x + 5, top + 10.5, 3, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(x + 3, top + 8.5); g.lineTo(x + 3.6, top + 6); g.lineTo(x + 5, top + 8); g.moveTo(x + 5.5, top + 8); g.lineTo(x + 7, top + 6); g.lineTo(x + 7.4, top + 8.8); g.fill();
        g.fillStyle = rgba(INK, 0.45); for (let i = 0; i < 20; i++) g.fillRect(x - 11 + (i % 5) * 4.6, top + 22 + ((i / 5) | 0) * 4, 3, 2);
        g.fillStyle = '#c24d2c'; g.fillRect(x - 11 + 2 * 4.6, top + 26, 3, 2);
        g.fillStyle = INK; g.beginPath(); g.arc(x, top - 2, 1.2, 0, TAU); g.fill();
        break;
      }
      case 'shelf': {
        const [, , at, w] = d, sy = y(at);
        g.fillStyle = WOOD[2]; g.fillRect(x + 6, sy + 3, 3, 8); g.fillRect(x + w - 9, sy + 3, 3, 8);
        const jars = [['#d9e8e0', 10, 14, '#c9533a'], ['#f0d9a8', 8, 18, '#6b8f3a'], ['#c9533a', 9, 11, '#f2c230'], ['#e6eef2', 12, 16, '#3b7be0']];
        let u = x + 6;
        for (const [c, jw, jh, lid] of jars) { g.fillStyle = c; this.R(u, sy - jh, jw, jh, 2); g.fill(); this.ink(0.7); g.fillStyle = lid; g.fillRect(u - 0.5, sy - jh - 2, jw + 1, 2.5); g.fillStyle = rgba('#ffffff', 0.5); g.fillRect(u + 2, sy - jh + 3, 1.4, jh - 6); u += jw + 7; }
        this.R(x, sy, w, 3, 0.8); this.fillInk(WOOD[1], 0.8);
        break;
      }
      case 'cabinets': {
        const [, , b, w, h] = d, top = y(b + h), n = Math.round(w / 45), cw = w / n;
        this.R(x, top, w, h, 1); this.fillInk('#86b9a6');
        for (let i = 0; i < n; i++) {
          const u = x + i * cw;
          g.fillStyle = shade('#86b9a6', 0.1); this.R(u + 3, top + 3, cw - 6, h - 6, 2); g.fill(); g.strokeStyle = rgba(INK, 0.35); g.lineWidth = 0.4; g.stroke();
          g.fillStyle = '#d8d3c6'; this.R(u + (i % 2 ? 6 : cw - 8), top + h - 20, 2, 12, 1); g.fill();
        }
        g.fillStyle = rgba('#000000', 0.14); g.fillRect(x, top + h, w, 5);
        break;
      }
      case 'tiles': {
        const [, , b, w, h] = d, top = y(b + h), t = 12, bano = lv.id === 'bano';
        g.save(); g.beginPath(); g.rect(x, top, w, h); g.clip();
        g.fillStyle = bano ? '#eef6f7' : '#f7fbf8'; g.fillRect(x, top, w, h);
        g.strokeStyle = rgba(bano ? '#7fa5ad' : '#8aa39a', 0.5); g.lineWidth = 0.4; g.beginPath();
        for (let yy = top, r = 0; yy < top + h; yy += t / 2, r++) { g.moveTo(x, yy); g.lineTo(x + w, yy); for (let u = x + (r % 2) * (t / 2); u < x + w; u += t) { g.moveTo(u, yy); g.lineTo(u, yy + t / 2); } }
        g.stroke();
        g.fillStyle = rgba('#ffffff', 0.5); for (let yy = top; yy < top + h; yy += t / 2) g.fillRect(x, yy + 0.8, w, 0.5);
        g.restore();
        if (bano) { g.fillStyle = '#5d8f9a'; g.fillRect(x, top - 2, w, 2); }
        break;
      }
      case 'magnets': {
        const [, , at] = d, cy = y(at);
        g.save(); g.translate(x + 30, cy); g.rotate(-0.08);
        g.fillStyle = '#fffdf6'; g.beginPath(); g.rect(-15, -19, 30, 26); g.fill(); this.ink(0.6);
        g.strokeStyle = '#e07a2e'; g.lineWidth = 1.1; g.beginPath(); g.ellipse(-2, -3, 7, 4, 0, 0, TAU); g.stroke(); g.beginPath(); g.arc(6, -7, 3, 0, TAU); g.stroke();
        g.fillStyle = '#e8c070'; g.fillRect(-8, -10.5, 10, 3); g.fillStyle = '#ffd84a'; g.fillRect(-7, -11.5, 8, 1.2);
        g.strokeStyle = '#3b7be0'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-12, 4); g.quadraticCurveTo(-4, 1, 3, 4); g.stroke();
        g.restore();
        for (const [mx, my, c] of [[x + 30, cy - 19, '#e0463b'], [x + 10, cy + 20, '#3b7be0'], [x + 52, cy + 32, '#f2c230'], [x + 22, cy + 46, '#43b67a']]) { g.fillStyle = c; g.beginPath(); g.arc(mx, my, 3, 0, TAU); g.fill(); this.ink(0.6); g.fillStyle = rgba('#ffffff', 0.5); g.fillRect(mx - 1.5, my - 1.8, 1.4, 1); }
        g.fillStyle = '#ffffff'; g.save(); g.translate(x + 8, cy + 24); g.rotate(0.1); g.fillRect(-6, -3, 16, 22); g.fillStyle = rgba('#3b7be0', 0.6); for (let i = 0; i < 5; i++) g.fillRect(-4, 1 + i * 3.5, 11, 0.7); g.restore();
        break;
      }
      case 'picture': {
        const [, , b, w, h] = d, top = y(b + h);
        g.fillStyle = rgba('#000000', 0.15); g.fillRect(x + 3, top + 4, w + 4, h + 4);
        this.sky(x, top, w, h, 'sea');
        this.frame(x, top, w, h, '#b88a3a', 5);
        g.strokeStyle = INK; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x + w * 0.3, top - 5); g.lineTo(x + w / 2, top - 22); g.lineTo(x + w * 0.7, top - 5); g.stroke();
        g.fillStyle = INK; g.beginPath(); g.arc(x + w / 2, top - 22, 1.2, 0, TAU); g.fill();
        break;
      }
      case 'plant': {
        const [, , on] = d, by = y(on);
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.34, l = 40 + (i % 3) * 12, lx = x + Math.cos(a) * l, ly = by - 30 + Math.sin(a) * l;
          g.strokeStyle = '#3f7d4a'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, by - 30); g.quadraticCurveTo(x + Math.cos(a) * l * 0.4, by - 30 + Math.sin(a) * l * 0.6, lx, ly); g.stroke();
          g.save(); g.translate(lx, ly); g.rotate(a + Math.PI / 2); g.beginPath(); g.ellipse(0, 0, 7.5, 12, 0, 0, TAU); this.fillInk(i % 2 ? '#4f9a5a' : '#3f8a4c', 0.7);
          g.strokeStyle = rgba('#ffffff', 0.35); g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, -10); g.lineTo(0, 10); g.stroke(); g.restore();
        }
        g.beginPath(); g.moveTo(x - 14, by - 30); g.lineTo(x + 14, by - 30); g.lineTo(x + 10, by); g.lineTo(x - 10, by); g.closePath(); this.fillInk('#c56a3e');
        g.fillStyle = rgba('#000000', 0.15); g.fillRect(x - 13, by - 26, 26, 2);
        break;
      }
      case 'rug': {
        const [, , on, w] = d, ry = y(on);
        g.fillStyle = '#9b3b35'; g.fillRect(x, ry - 1.6, w, 1.6);
        g.fillStyle = '#e8c070'; for (let u = x + 4; u < x + w - 4; u += 12) g.fillRect(u, ry - 1.4, 5, 1);
        break;
      }
      case 'door': {
        const [, , b, w, h] = d, top = y(b + h);
        g.fillStyle = rgba('#000000', 0.2); g.fillRect(x - 6, top - 6, w + 12, h + 6);
        this.R(x - 4, top - 4, w + 8, h + 4, 1); this.fillInk('#f1eadb', 0.8);
        g.beginPath(); g.rect(x, top, w, h); this.fillInk('#9a6a44');
        for (const [a, b2] of [[0.08, 0.42], [0.5, 0.92]]) { g.fillStyle = rgba('#000000', 0.12); g.fillRect(x + 9, top + h * a, w - 18, h * (b2 - a)); g.fillStyle = rgba('#ffffff', 0.12); g.fillRect(x + 9, top + h * a, w - 18, 1); }
        g.fillStyle = '#d9b45a'; g.beginPath(); g.arc(x + w - 11, top + h * 0.5, 2.6, 0, TAU); g.fill(); this.ink(0.5);
        break;
      }
      case 'mirror': {
        const [, , b, w, h] = d, top = y(b + h);
        const mg = g.createLinearGradient(x, top, x + w, top + h); mg.addColorStop(0, '#dfeef2'); mg.addColorStop(0.5, '#b9d3db'); mg.addColorStop(1, '#e8f3f5');
        this.R(x, top, w, h, Math.min(w, h) * 0.45); g.fillStyle = mg; g.fill(); g.lineWidth = 3; g.strokeStyle = '#c8a35a'; g.stroke();
        this.R(x - 1.5, top - 1.5, w + 3, h + 3, Math.min(w, h) * 0.47); this.ink(0.6);
        g.strokeStyle = rgba('#ffffff', 0.75); g.lineWidth = 2; g.beginPath(); g.moveTo(x + w * 0.22, top + h * 0.34); g.lineTo(x + w * 0.44, top + h * 0.14); g.moveTo(x + w * 0.28, top + h * 0.52); g.lineTo(x + w * 0.62, top + h * 0.2); g.stroke();
        break;
      }
      case 'coats': {
        const [, , at] = d, hy = y(at);
        g.beginPath(); g.moveTo(x - 30, hy); g.lineTo(x - 12, hy); g.lineTo(x - 7, hy + 72); g.lineTo(x - 36, hy + 72); g.closePath(); this.fillInk('#4b5d7a');
        g.fillStyle = rgba('#000000', 0.15); g.fillRect(x - 22, hy + 4, 2, 66);
        g.beginPath(); g.rect(x + 3, hy, 8, 60); this.fillInk('#c94a3a', 0.7);
        g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + 27, hy); g.lineTo(x + 27, hy + 64); g.arc(x + 23, hy + 64, 4, 0, Math.PI); g.stroke();
        g.beginPath(); g.moveTo(x + 27, hy + 4); g.lineTo(x + 37, hy + 52); g.lineTo(x + 17, hy + 52); g.closePath(); this.fillInk('#2d6f5e', 0.7);
        this.R(x - 42, hy - 5, 84, 5, 1); this.fillInk(WOOD[1], 0.7);
        for (const u of [x - 21, x + 7, x + 27]) { g.fillStyle = '#d9b45a'; g.beginPath(); g.arc(u, hy + 1, 1.8, 0, TAU); g.fill(); }
        break;
      }
      case 'lamp': {
        const [, , at] = d, ly = y(at);
        g.fillStyle = '#f7efe0'; g.beginPath(); g.ellipse(x, ly + 3, 18, 5, 0, 0, Math.PI); g.fill(); this.ink(0.7);
        const lg = g.createRadialGradient(x, ly + 6, 2, x, ly + 6, 70); lg.addColorStop(0, 'rgba(255,236,190,0.45)'); lg.addColorStop(1, 'rgba(255,236,190,0)');
        g.fillStyle = lg; g.fillRect(x - 70, ly, 140, 80);
        break;
      }
      case 'cistern': {
        const [, , on] = d, by = y(on);
        this.R(x + 2, by - 72, 30, 34, 3); this.fillInk('#f4f7f7');
        g.fillStyle = '#c9d2d4'; this.R(x + 13, by - 77, 8, 5, 1); g.fill(); this.ink(0.5);
        g.fillStyle = '#e8eef0'; g.fillRect(x + 14, by - 38, 5, 8);
        break;
      }
      case 'towel': {
        const [, , at] = d, ty = y(at);
        g.fillStyle = '#c0c6c8'; this.R(x - 26, ty - 2, 52, 3, 1.5); g.fill(); this.ink(0.5);
        g.beginPath(); g.moveTo(x - 20, ty); g.lineTo(x + 20, ty); g.lineTo(x + 18, ty + 48); g.lineTo(x - 18, ty + 48); g.closePath(); this.fillInk('#e87a6a');
        g.fillStyle = rgba('#ffffff', 0.55); g.fillRect(x - 18, ty + 38, 36, 3); g.fillRect(x - 18, ty + 43, 36, 1.2);
        break;
      }
    }
  },
});

Object.assign(Room.prototype, {
  solid(q, lv) {
    const g = this.g, [x, y, w, h, tag] = q, H = lv.H, R = (a, b, c, d, r) => this.R(a, b, c, d, r);
    switch (tag) {
      case 'bench': {
        for (const [lx, d] of [[x + 6, -1], [x + w - 14, 1]]) { g.beginPath(); g.moveTo(lx, y + 6); g.lineTo(lx + 8, y + 6); g.lineTo(lx + 8 + d * 4 + (d < 0 ? 0 : 0), H); g.lineTo(lx + d * 4, H); g.closePath(); this.fillInk(WOOD[1], 0.8); }
        g.fillStyle = WOOD[2]; g.fillRect(x + 10, y + h * 0.62, w - 20, 3);
        R(x, y, w, 6, 2); this.fillInk(WOOD[0]);
        g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(x + 3, y + 1, w - 6, 1);
        g.fillStyle = '#e9d9b5'; R(x + 14, y - 3, w - 28, 3.5, 1.5); g.fill(); this.ink(0.5);
        break;
      }
      case 'table': case 'console': case 'ctable': {
        R(x - 2, y, w + 4, h, 1.2); this.fillInk(tag === 'console' ? '#5a3a24' : WOOD[0]);
        if (tag === 'table') {
          const tc = () => { g.beginPath(); g.moveTo(x - 4, y - 0.6); g.lineTo(x + w + 4, y - 0.6); g.lineTo(x + w + 6, y + 18); for (let u = x + w + 6; u > x - 6; u -= 8.5) g.quadraticCurveTo(u - 4.25, y + 21.5, u - 8.5, y + 18); g.closePath(); };
          g.save(); tc(); g.fillStyle = '#f7f2ea'; g.fill(); g.clip();
          g.fillStyle = rgba('#d23c32', 0.75); for (let u = x - 6; u < x + w + 8; u += 8) g.fillRect(u, y - 1, 4, 24);
          g.fillStyle = rgba('#d23c32', 0.45); for (let v = y + 1; v < y + 24; v += 8) g.fillRect(x - 6, v, w + 14, 4);
          g.fillStyle = rgba('#000000', 0.1); g.fillRect(x - 6, y - 1, w + 14, 2.5);
          g.restore(); tc(); this.ink(0.7);
        } else { g.fillStyle = rgba('#ffffff', 0.18); g.fillRect(x, y + 0.8, w, 0.8); if (tag === 'console') { g.fillStyle = '#4a2e1c'; g.fillRect(x + 12, y + h, w - 24, 10); g.fillStyle = '#d9b45a'; g.fillRect(x + w / 2 - 3, y + h + 4, 6, 1.6); } }
        break;
      }
      case 'tableleg': case 'consoleleg': case 'ctableleg': {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w - 0.8, y + h); g.lineTo(x + 0.8, y + h); g.closePath(); this.fillInk(tag === 'consoleleg' ? '#4a2e1c' : WOOD[1], 0.7);
        break;
      }
      case 'counter': case 'hob': {
        R(x, y + 5, w, h - 5, 0.5); this.fillInk('#f1ece2');
        const n = Math.max(1, Math.round(w / 40)), cw = w / n;
        for (let i = 0; i < n; i++) { g.fillStyle = shade('#f1ece2', -0.05); R(x + i * cw + 3, y + 10, cw - 6, h - 24, 2); g.fill(); g.strokeStyle = rgba(INK, 0.3); g.lineWidth = 0.4; g.stroke(); g.fillStyle = '#9aa1a6'; g.fillRect(x + i * cw + cw / 2 - 5, y + 15, 10, 2); }
        g.fillStyle = '#3a3230'; g.fillRect(x + 1, y + h - 9, w - 2, 9);
        R(x - 1, y, w + 2, 5, 1); this.fillInk(tag === 'hob' ? '#1d1d22' : '#d8d2c6');
        if (tag === 'hob') { g.fillStyle = rgba('#ffffff', 0.22); g.fillRect(x + 2, y + 1, w - 4, 0.7); g.fillStyle = '#1d1d22'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + 12 + i * 15, y + 12, 2.2, 0, TAU); g.fill(); } }
        else { g.fillStyle = rgba(INK, 0.25); for (let i = 0; i < w / 3; i++) g.fillRect(x + this.rng() * w, y + 0.8 + this.rng() * 3.4, 0.7, 0.7); }
        break;
      }
      case 'sink': {
        // the basin (the water is drawn live), the cupboard under it, the tap at the back
        const bt = y - 20;
        const bg2 = g.createLinearGradient(x, 0, x + w, 0); bg2.addColorStop(0, '#9aa6ad'); bg2.addColorStop(0.5, '#dfe6ea'); bg2.addColorStop(1, '#a3aeb4');
        g.fillStyle = bg2; g.fillRect(x, bt, w, 20); g.strokeStyle = INK; g.lineWidth = 0.6; g.strokeRect(x, bt, w, 20);
        g.strokeStyle = '#b8c2c8'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + w - 10, bt); g.lineTo(x + w - 10, bt - 28); g.quadraticCurveTo(x + w - 10, bt - 40, x + w - 26, bt - 36); g.lineTo(x + w - 27, bt - 31); g.stroke();
        R(x, y, w, h, 0.5); this.fillInk('#f1ece2');
        g.fillStyle = shade('#f1ece2', -0.05); R(x + 3, y + 6, w - 6, h - 20, 2); g.fill(); g.strokeStyle = rgba(INK, 0.3); g.lineWidth = 0.4; g.stroke();
        g.fillStyle = '#3a3230'; g.fillRect(x + 1, y + h - 9, w - 2, 9);
        break;
      }
      case 'micro': {
        R(x, y, w, h, 3); this.fillInk('#ece6da');
        R(x + 4, y + 5, w * 0.62, h - 10, 2); this.fillInk('#2c3238', 0.7);
        g.fillStyle = rgba('#ffffff', 0.15); g.fillRect(x + 6, y + 7, w * 0.3, 2);
        g.fillStyle = '#1b2a1f'; g.fillRect(x + w * 0.72, y + 6, w * 0.22, 6);
        g.fillStyle = '#6dff8a'; g.font = '700 4.4px monospace'; g.textBaseline = 'middle'; g.fillText('7:42', x + w * 0.74, y + 9.2);
        for (let i = 0; i < 6; i++) { g.fillStyle = '#c9c2b4'; g.fillRect(x + w * 0.72 + (i % 2) * 6, y + 15 + ((i / 2) | 0) * 5, 4, 3); }
        break;
      }
      case 'fridge': {
        R(x, y, w, h, 10); this.fillInk('#f4ead2', 1.2);
        g.fillStyle = rgba('#ffffff', 0.4); g.fillRect(x + 6, y + 8, 3, h - 20);
        g.beginPath(); g.moveTo(x + 2, y + h * 0.3); g.lineTo(x + w - 2, y + h * 0.3); this.ink(0.9);
        g.fillStyle = '#b8bfc4'; R(x + w - 12, y + 12, 4, 22, 2); g.fill(); this.ink(0.5); R(x + w - 12, y + h * 0.3 + 10, 4, 40, 2); g.fill(); this.ink(0.5);
        g.fillStyle = '#c24d2c'; g.font = 'italic 700 8px Georgia, serif'; g.textBaseline = 'alphabetic'; g.fillText('Frigo', x + 12, y + h - 14);
        g.fillStyle = '#9aa1a6'; g.fillRect(x + 8, y + h - 5, w - 16, 5);
        break;
      }
      case 'stool': {
        for (const [a, b] of [[x + 3, x - 3], [x + w - 7, x + w - 1]]) { g.beginPath(); g.moveTo(a, y + 5); g.lineTo(a + 4, y + 5); g.lineTo(b + 4, H); g.lineTo(b, H); g.closePath(); this.fillInk('#c9c9c9', 0.6); }
        g.fillStyle = '#9d9d9d'; g.fillRect(x - 1, y + h * 0.58, w + 2, 2);
        R(x - 3, y, w + 6, 5, 2.5); this.fillInk('#d24b3a');
        g.fillStyle = rgba('#ffffff', 0.3); g.fillRect(x, y + 1, w - 4, 0.8);
        break;
      }
      case 'sofa': {
        R(x + 8, y - 44, w - 16, 52, 12); this.fillInk('#d9a441');
        g.beginPath(); g.moveTo(x + w / 2, y - 40); g.lineTo(x + w / 2, y); this.ink(0.5);
        for (const bx of [x + w * 0.27, x + w * 0.73]) { g.fillStyle = rgba('#000000', 0.12); g.beginPath(); g.arc(bx, y - 22, 1.6, 0, TAU); g.fill(); }
        R(x + 20, y - 6, w - 40, 12, 5); this.fillInk('#e4b24e', 0.8);
        g.beginPath(); g.moveTo(x + w / 2, y - 5); g.lineTo(x + w / 2, y + 6); this.ink(0.5);
        R(x + 2, y + 6, w - 4, h - 11, 3); this.fillInk('#c28f33');
        g.fillStyle = '#5a3a24'; for (const fx of [x + 10, x + w - 16]) g.fillRect(fx, H - 5, 6, 5);
        break;
      }
      case 'arm': { R(x, y, w, h - 5, 9); this.fillInk('#cf9a3a'); g.fillStyle = rgba('#ffffff', 0.22); g.fillRect(x + 5, y + 2, w - 10, 1.2); break; }
      case 'tvstand': {
        R(x, y, w, h - 4, 2); this.fillInk('#8a5a34');
        for (let i = 0; i < 2; i++) { R(x + 4 + i * (w / 2 - 2), y + 6, w / 2 - 6, h - 18, 2); this.fillInk(shade('#8a5a34', 0.08), 0.6); g.fillStyle = '#d9b45a'; g.fillRect(x + 4 + i * (w / 2 - 2) + w / 4 - 5, y + h / 2 - 3, 5, 2); }
        g.fillStyle = '#4a2e1c'; g.fillRect(x + 4, H - 4, 5, 4); g.fillRect(x + w - 9, H - 4, 5, 4);
        break;
      }
      case 'tv': {
        g.strokeStyle = INK; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x + w * 0.46, y + 1); g.lineTo(x + w * 0.24, y - 28); g.moveTo(x + w * 0.52, y + 1); g.lineTo(x + w * 0.76, y - 26); g.stroke();
        g.fillStyle = INK; for (const [a, b] of [[0.24, -28], [0.76, -26]]) { g.beginPath(); g.arc(x + w * a, y + b, 1.3, 0, TAU); g.fill(); }
        g.fillStyle = '#5b5346'; g.beginPath(); g.ellipse(x + w * 0.49, y + 1, 7, 3.5, 0, Math.PI, 0); g.fill();
        R(x, y, w, h, 6); this.fillInk('#b9ad96', 1.1);
        R(x + 5, y + 5, w * 0.66, h - 10, 8); this.fillInk('#223344', 0.7);
        for (let i = 0; i < 3; i++) { g.fillStyle = '#5b5346'; g.beginPath(); g.arc(x + w * 0.86, y + 12 + i * 10, 2.6, 0, TAU); g.fill(); }
        break;
      }
      case 'lamp': {
        const cx = x + w / 2, sy = y + h - 24;
        g.strokeStyle = INK; g.lineWidth = 0.7; g.beginPath(); g.moveTo(cx, y); g.lineTo(cx, sy); g.stroke();
        const lg = g.createRadialGradient(cx, y + h, 2, cx, y + h, 120); lg.addColorStop(0, 'rgba(255,226,160,0.4)'); lg.addColorStop(1, 'rgba(255,226,160,0)');
        g.fillStyle = lg; g.beginPath(); g.moveTo(cx - 20, y + h); g.lineTo(cx + 20, y + h); g.lineTo(cx + 110, H); g.lineTo(cx - 110, H); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(cx - 6, sy); g.lineTo(cx + 6, sy); g.lineTo(x + w + 7, y + h); g.lineTo(x - 7, y + h); g.closePath(); this.fillInk('#e36b3a');
        g.fillStyle = rgba('#ffffff', 0.25); g.beginPath(); g.moveTo(cx - 4, sy + 2); g.lineTo(cx - 1, sy + 2); g.lineTo(x - 1, y + h - 1); g.lineTo(x - 4, y + h - 1); g.closePath(); g.fill();
        g.fillStyle = '#fff3c4'; g.beginPath(); g.ellipse(cx, y + h, w / 2 + 6, 2.2, 0, 0, Math.PI); g.fill();
        break;
      }
      case 'shoes': {
        R(x, y, w, h, 2); this.fillInk('#ede3d0');
        for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(x + 2, y + (h * i) / 3); g.lineTo(x + w - 2, y + (h * i) / 3); this.ink(0.5); }
        const sh = [['#3b5ea8', 0, 10], ['#d24b3a', 1, 40], ['#2d2d2d', 1, 8], ['#e8d8b8', 2, 30], ['#6b8f3a', 2, 58]];
        for (const [c, row, sx] of sh) { const sy = y + (h * (row + 1)) / 3; R(x + sx, sy - 6, 22, 6, 3); this.fillInk(c, 0.5); g.fillStyle = rgba('#ffffff', 0.6); g.fillRect(x + sx + 2, sy - 1.8, 18, 1); }
        g.fillStyle = '#d24b3a'; R(x + 12, y - 7, 24, 7, 3.5); g.fill(); this.ink(0.5); g.fillStyle = '#ffffff'; g.fillRect(x + 14, y - 2.4, 20, 1.2);
        g.fillStyle = '#3b5ea8'; R(x + 44, y - 6, 22, 6, 3); g.fill(); this.ink(0.5);
        break;
      }
      case 'radiator': {
        const n = Math.round(w / 8);
        g.fillStyle = '#c9c2b4'; g.fillRect(x + 4, H - 10, 4, 10); g.fillRect(x + w - 8, H - 10, 4, 10);
        for (let i = 0; i < n; i++) { R(x + (i * w) / n + 0.4, y, w / n - 0.8, h - 10, 3); this.fillInk('#f4f1ea', 0.6); g.fillStyle = rgba('#000000', 0.07); g.fillRect(x + (i * w) / n + (w / n) * 0.55, y + 4, 1.4, h - 18); }
        g.fillStyle = '#b84a2c'; R(x - 4, y + h - 20, 5, 6, 1); g.fill(); this.ink(0.5);
        break;
      }
      case 'toilet': {
        g.beginPath(); g.moveTo(x + 4, y + 5); g.lineTo(x + w - 2, y + 5); g.quadraticCurveTo(x + w, y + h * 0.55, x + w * 0.62, y + h * 0.68); g.lineTo(x + w * 0.66, H); g.lineTo(x + w * 0.2, H); g.lineTo(x + w * 0.22, y + h * 0.64); g.quadraticCurveTo(x, y + h * 0.5, x + 4, y + 5); g.closePath(); this.fillInk('#f6f8f8', 1);
        R(x - 1, y, w + 3, 6, 3); this.fillInk('#ffffff');
        g.fillStyle = rgba('#8fb7c2', 0.4); g.fillRect(x + w * 0.25, y + h * 0.3, w * 0.4, 1.6);
        break;
      }
      case 'bathstool': {
        g.beginPath(); g.moveTo(x + 3, y + 4); g.lineTo(x + w - 3, y + 4); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); this.fillInk('#3f8fc8');
        g.fillStyle = rgba('#ffffff', 0.3); g.beginPath(); g.ellipse(x + w / 2, y + h * 0.58, w * 0.22, h * 0.18, 0, 0, TAU); g.fill();
        R(x - 2, y, w + 4, 4.5, 2); this.fillInk('#4a9fd8');
        break;
      }
      case 'washer': {
        R(x, y, w, h, 4); this.fillInk('#f3f5f5', 1.1);
        g.beginPath(); g.moveTo(x + 1, y + 16); g.lineTo(x + w - 1, y + 16); this.ink(0.6);
        g.fillStyle = '#c9cfd2'; g.beginPath(); g.arc(x + w * 0.8, y + 8, 4.5, 0, TAU); g.fill(); this.ink(0.5);
        g.fillStyle = '#9fd6ff'; g.fillRect(x + 6, y + 5, 16, 5);
        const cx = x + w / 2, cy = y + 16 + (h - 16) * 0.5, r = Math.min(w, h - 16) * 0.36;
        g.fillStyle = '#b8c0c4'; g.beginPath(); g.arc(cx, cy, r + 3.5, 0, TAU); g.fill(); this.ink(0.8);
        g.fillStyle = '#2b4a66'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
        g.fillStyle = '#e06a5a'; g.beginPath(); g.ellipse(cx - 3, cy + r * 0.45, r * 0.6, r * 0.3, 0.3, 0, TAU); g.fill();
        g.fillStyle = '#f2c230'; g.beginPath(); g.ellipse(cx + 4, cy + r * 0.55, r * 0.4, r * 0.22, -0.2, 0, TAU); g.fill();
        g.fillStyle = rgba('#ffffff', 0.35); g.beginPath(); g.ellipse(cx - r * 0.35, cy - r * 0.35, r * 0.3, r * 0.15, -0.7, 0, TAU); g.fill();
        break;
      }
      case 'tub': { R(x - 2, y - 2, w + 4, 6, 3); this.fillInk('#fbfdfd'); break; }
    }
  },
  // the bathtub is two rims and a bottom in the sim; on screen it's one enamel tub on claw feet
  tub(S, H) {
    const t = S.filter((q) => q[4] === 'tub'); if (t.length < 2) return;
    const g = this.g, a = Math.min(...t.map((q) => q[0])), b = Math.max(...t.map((q) => q[0] + q[2])), top = Math.min(...t.map((q) => q[1]));
    for (const fx of [a + 18, b - 30]) { g.beginPath(); g.moveTo(fx, H - 9); g.lineTo(fx + 12, H - 9); g.quadraticCurveTo(fx + 15, H - 2, fx + 16, H); g.lineTo(fx - 3, H); g.quadraticCurveTo(fx - 2, H - 2, fx, H - 9); g.closePath(); this.fillInk('#c8a35a', 0.7); }
    g.beginPath(); g.moveTo(a - 2, top); g.lineTo(b + 2, top); g.quadraticCurveTo(b + 4, H - 9, b - 22, H - 8); g.lineTo(a + 22, H - 8); g.quadraticCurveTo(a - 4, H - 9, a - 2, top); g.closePath();
    const tg = g.createLinearGradient(0, top, 0, H); tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#d5e2e6');
    g.fillStyle = tg; g.fill(); this.ink(1.1);
    g.fillStyle = rgba('#ffffff', 0.7); g.fillRect(a + 10, top + 8, 3, H - top - 22);
    g.strokeStyle = '#c0c8cb'; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(a + 30, top - 1); g.lineTo(a + 30, top - 24); g.lineTo(a + 46, top - 24); g.stroke();
    g.fillStyle = '#c0c8cb'; g.beginPath(); g.arc(a + 46, top - 21, 3.5, Math.PI, 0); g.fill();
  },
  // the cardboard box, its front cut away (the front lip is drawn over the cat, live)
  boxes(S) {
    const g = this.g, f = S.find((q) => q[4] === 'boxfloor'); if (!f) return;
    const [x, y] = f, top = y - 38, w = 60;
    g.fillStyle = '#9c6a3a'; g.fillRect(x + 3, top, w - 6, 38);
    const sh = g.createLinearGradient(0, top, 0, y); sh.addColorStop(0, 'rgba(40,20,5,0.45)'); sh.addColorStop(1, 'rgba(40,20,5,0.05)');
    g.fillStyle = sh; g.fillRect(x + 3, top, w - 6, 38);
    g.strokeStyle = rgba('#5a3a1a', 0.35); g.lineWidth = 0.5; g.beginPath(); for (let u = x + 8; u < x + w - 5; u += 5) { g.moveTo(u, top + 6); g.lineTo(u, y); } g.stroke();
    for (const [fx, dir] of [[x, -1], [x + w, 1]]) { g.beginPath(); g.moveTo(fx, top); g.lineTo(fx + dir * 21, top - 13); g.lineTo(fx + dir * 24, top - 10); g.lineTo(fx + dir * 3, top + 1.5); g.closePath(); this.fillInk('#c99558', 0.7); }
    for (const wx of [x, x + w - 3]) { g.beginPath(); g.rect(wx, top, 3, 38); this.fillInk('#d7a86a', 0.6); g.strokeStyle = rgba('#7a4f28', 0.7); g.lineWidth = 0.4; g.beginPath(); for (let v = top + 1; v < y; v += 1.8) { g.moveTo(wx, v); g.lineTo(wx + 3, v + 0.9); } g.stroke(); }
    g.beginPath(); g.rect(x, y, w, 2); this.fillInk('#c99558', 0.6);
    g.fillStyle = rgba('#000000', 0.2); g.beginPath(); g.ellipse(x + w / 2, y + 2.5, w * 0.55, 2.5, 0, 0, TAU); g.fill();
  },
});

// ---------------------------------------------------------------- the balcony at midnight
const NIGHT = { ours: '#5f4b5a', low: '#43384d', right: '#524460', lit: '#ffcf73', tv: '#8fb8ff' };
Object.assign(Room.prototype, {
  terrace(lv) {
    const g = this.g, { W, H } = lv, [x0, y0, x1, y1] = this.b, sk = SKY.midnight, rng = mulberry32(606), y = (cm) => H - cm;
    const sg = g.createLinearGradient(0, y0, 0, y1); sg.addColorStop(0, sk[0]); sg.addColorStop(0.5, sk[1]); sg.addColorStop(0.85, '#3a2f4a'); sg.addColorStop(1, '#5a3f4a');
    g.fillStyle = sg; g.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
    for (let i = 0; i < 120; i++) { g.fillStyle = rgba('#ffffff', 0.25 + rng() * 0.6); const r = 0.5 + rng() * 1.1; g.fillRect(x0 + rng() * (x1 - x0), y0 + rng() * (y(-40) - y0), r, r); }
    for (const d of lv.decor) if (d[0] === 'moon') this.moon(d[1], y(d[2]));
    // the city beyond, then the lower building under the neighbour's terrace, then the tall one on the right
    for (let u = 640; u < 1140;) {
      const bw = 40 + rng() * 60, top = y(40 + rng() * 150);
      g.fillStyle = shade('#2b2340', rng() * 0.08); g.fillRect(u, top, bw, y1 - top);
      for (let wy = top + 10; wy < y1; wy += 16) for (let wx = u + 6; wx < u + bw - 8; wx += 12) if (rng() < 0.3) { g.fillStyle = rng() < 0.8 ? rgba(NIGHT.lit, 0.75) : rgba(NIGHT.tv, 0.7); g.fillRect(wx, wy, 5, 7); }
      if (rng() < 0.4) { g.fillStyle = '#2b2340'; g.fillRect(u + bw * 0.5, top - 14, 1.2, 14); g.fillRect(u + bw * 0.5 - 6, top - 12, 12, 1.2); }
      u += bw + 3;
    }
    const hz = g.createLinearGradient(0, y(40), 0, y(-150)); hz.addColorStop(0, 'rgba(255,160,90,0)'); hz.addColorStop(1, 'rgba(255,160,90,0.18)');
    g.fillStyle = hz; g.fillRect(640, y(40), 500, 190);
    this.facade(690, y(-150), 1110 - 690, y1 - y(-150), NIGHT.low, [[790, -260, 80, 90, NIGHT.tv], [950, -270, 80, 90, null]]);
    this.facade(1110, y0, x1 - 1110, y1 - y0, NIGHT.right, [[1140, 190, 70, 90, NIGHT.lit], [1160, -330, 80, 90, null]]);
    this.facade(x0, y0, 690 - x0, y1 - y0, NIGHT.ours, [[175, 200, 80, 95, NIGHT.lit], [80, -210, 90, 100, NIGHT.tv], [505, -200, 120, 100, NIGHT.lit], [120, -520, 90, 100, null], [480, -520, 90, 100, NIGHT.lit]]);
    // the upstairs balcony overhead, with a geranium hanging from it
    this.R(-60, y(415), 490, 15, 1); this.fillInk('#8f8479');
    g.fillStyle = rgba('#000000', 0.3); g.fillRect(-60, y(400), 490, 4);
    g.fillStyle = '#1f2a26'; for (let u = -40; u < 430; u += 14) g.fillRect(u, y(470), 2, 55); g.fillRect(-60, y(472), 490, 3);
    for (const d of lv.decor) this.nightDecor(d, lv);
    for (const q of lv.solids) this.nightSolid(q, lv);
    this.boxes(lv.solids, H);
    // our door's light spilling onto the balcony
    const lg = g.createRadialGradient(65, y(80), 10, 65, y(80), 260); lg.addColorStop(0, 'rgba(255,200,120,0.28)'); lg.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = lg; g.fillRect(-60, y(300), 500, 340);
  },
  facade(x, top, w, h, c, wins) {
    const g = this.g, H = this.lv.H, y = (cm) => H - cm;
    g.fillStyle = c; g.fillRect(x, top, w, h);
    g.strokeStyle = rgba('#000000', 0.12); g.lineWidth = 0.5; g.beginPath(); for (let v = top + 6; v < top + h; v += 9) { g.moveTo(x, v); g.lineTo(x + w, v); } g.stroke();
    g.fillStyle = rgba('#ffffff', 0.05); g.fillRect(x, top, w, h * 0.4);
    for (const [wx, b, ww, wh, lit] of wins) {
      const wt = y(b + wh);
      if (lit) { const gl = g.createRadialGradient(wx + ww / 2, wt + wh / 2, 4, wx + ww / 2, wt + wh / 2, ww * 1.6); gl.addColorStop(0, rgba(lit, 0.3)); gl.addColorStop(1, rgba(lit, 0)); g.fillStyle = gl; g.fillRect(wx - ww * 1.2, wt - wh, ww * 3.4, wh * 3); }
      g.fillStyle = lit ? lit : '#1a1522'; g.fillRect(wx, wt, ww, wh);
      if (lit) { g.fillStyle = rgba('#000000', 0.25); g.fillRect(wx, wt, ww, wh * 0.35); g.fillStyle = rgba('#7a3a2a', 0.5); g.fillRect(wx + ww * 0.08, wt + wh * 0.35, ww * 0.18, wh * 0.65); g.fillRect(wx + ww * 0.74, wt + wh * 0.35, ww * 0.18, wh * 0.65); }
      g.fillStyle = rgba('#000000', 0.45); g.fillRect(wx + ww / 2 - 1, wt, 2, wh);
      g.strokeStyle = '#2a2230'; g.lineWidth = 2.5; g.strokeRect(wx, wt, ww, wh);
      g.fillStyle = '#7d6f78'; g.fillRect(wx - 5, y(b) , ww + 10, 4);
    }
  },
  moon(x, cy) {
    const g = this.g, gl = g.createRadialGradient(x, cy, 4, x, cy, 110); gl.addColorStop(0, 'rgba(255,244,210,0.35)'); gl.addColorStop(1, 'rgba(255,244,210,0)');
    g.fillStyle = gl; g.fillRect(x - 110, cy - 110, 220, 220);
    g.fillStyle = '#fff4d2'; g.beginPath(); g.arc(x, cy, 22, 0, TAU); g.fill();
    g.fillStyle = rgba('#d9c9a0', 0.55); for (const [a, b, r] of [[-6, -5, 5], [7, 4, 4], [-2, 9, 3], [9, -8, 2]]) { g.beginPath(); g.arc(x + a, cy + b, r, 0, TAU); g.fill(); }
  },
  nightDecor(d, lv) {
    const g = this.g, H = lv.H, [k, x] = d, y = (cm) => H - cm;
    if (k === 'door' || k === 'ndoor') {
      const [, , b, w, h] = d, top = y(b + h);
      const gl = g.createRadialGradient(x + w / 2, top + h / 2, 5, x + w / 2, top + h / 2, h); gl.addColorStop(0, 'rgba(255,200,110,0.35)'); gl.addColorStop(1, 'rgba(255,200,110,0)');
      g.fillStyle = gl; g.fillRect(x - h, top - h / 2, w + 2 * h, h * 2);
      g.fillStyle = '#ffd896'; g.fillRect(x, top, w, h);
      g.fillStyle = rgba('#b8603a', 0.55); g.fillRect(x + 4, top + 4, w * 0.3, h - 8); g.fillRect(x + w * 0.66, top + 4, w * 0.3, h - 8);
      if (k === 'door') { g.fillStyle = rgba('#000000', 0.3); g.beginPath(); g.ellipse(x + w * 0.5, top + h * 0.62, 10, 14, 0, 0, TAU); g.fill(); g.fillRect(x + w * 0.5 - 13, top + h * 0.7, 26, h * 0.3); }
      g.strokeStyle = '#3a2a22'; g.lineWidth = 3; g.strokeRect(x, top, w, h); g.lineWidth = 2; g.beginPath(); g.moveTo(x + w / 2, top); g.lineTo(x + w / 2, top + h); for (let v = top + h / 4; v < top + h - 1; v += h / 4) { g.moveTo(x, v); g.lineTo(x + w, v); } g.stroke();
      g.fillStyle = '#7d6f78'; g.fillRect(x - 6, top - 6, w + 12, 6);
    } else if (k === 'lights') {
      // verbena bulbs strung under the upstairs balcony
      const a = [0, y(236)], b = [430, y(228)], n = 13, cols = ['#ffd27a', '#ff6a5a', '#ffe9a8', '#7ad0ff', '#ffd27a', '#8cff9a'];
      g.strokeStyle = '#1f1a18'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(215, y(206), b[0], b[1]); g.stroke();
      for (let i = 1; i < n; i++) {
        const t = i / n, bx = (1 - t) ** 2 * a[0] + 2 * t * (1 - t) * 215 + t * t * b[0], by = (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * y(206) + t * t * b[1], c = cols[i % cols.length];
        const gl = g.createRadialGradient(bx, by + 4, 0.5, bx, by + 4, 18); gl.addColorStop(0, rgba(c, 0.55)); gl.addColorStop(1, rgba(c, 0));
        g.fillStyle = gl; g.fillRect(bx - 18, by - 14, 36, 36);
        g.fillStyle = '#1f1a18'; g.fillRect(bx - 1, by, 2, 2.2);
        g.fillStyle = c; g.beginPath(); g.ellipse(bx, by + 4.6, 2, 2.8, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(bx - 0.8, by + 3, 0.8, 1.4);
      }
    } else if (k === 'clothes') {
      const [, , at, w] = d, ly = y(at), x2 = x + w + 2;
      g.fillStyle = '#9a9a9a'; g.fillRect(x2 - 1, ly - 6, 2.4, y(-110) - ly + 6);
      g.fillRect(x - 4, ly - 3, 6, 6);
      g.strokeStyle = '#d8d8d8'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x, ly); g.quadraticCurveTo((x + x2) / 2, ly + 12, x2, ly); g.stroke();
      const sag = (u) => { const t = (u - x) / (x2 - x); return ly + 4 * t * (1 - t) * 12; };
      const shirt = (u, c) => { const v = sag(u); g.beginPath(); g.moveTo(u - 13, v); g.lineTo(u + 13, v); g.lineTo(u + 20, v + 9); g.lineTo(u + 14, v + 13); g.lineTo(u + 11, v + 8); g.lineTo(u + 11, v + 34); g.lineTo(u - 11, v + 34); g.lineTo(u - 11, v + 8); g.lineTo(u - 14, v + 13); g.lineTo(u - 20, v + 9); g.closePath(); this.fillInk(c, 0.6); };
      const sock = (u, c) => { const v = sag(u); g.beginPath(); g.moveTo(u - 3, v); g.lineTo(u + 3, v); g.lineTo(u + 3, v + 14); g.lineTo(u + 7, v + 17); g.lineTo(u + 6, v + 20); g.lineTo(u - 3, v + 18); g.closePath(); this.fillInk(c, 0.5); };
      const pants = (u, c) => { const v = sag(u); g.beginPath(); g.moveTo(u - 10, v); g.lineTo(u + 10, v); g.lineTo(u + 9, v + 12); g.lineTo(u + 2, v + 12); g.lineTo(u, v + 7); g.lineTo(u - 2, v + 12); g.lineTo(u - 9, v + 12); g.closePath(); this.fillInk(c, 0.5); };
      shirt(x + 45, '#e9e4d8'); sock(x + 92, '#d23c32'); sock(x + 106, '#d23c32'); pants(x + 140, '#3b7be0');
      const u = x + 200, v = sag(u); g.beginPath(); g.rect(u - 18, v, 36, 44); this.fillInk('#f2c230', 0.6); g.fillStyle = '#d23c32'; for (let i = 0; i < 4; i++) g.fillRect(u - 18, v + 6 + i * 10, 36, 4);
      g.fillStyle = '#6aa0d8'; for (const p of [x + 34, x + 56, x + 92, x + 106, x + 132, x + 148, x + 186, x + 214]) g.fillRect(p - 1, sag(p) - 2.5, 2, 5);
    }
  },
  nightSolid(q, lv) {
    const g = this.g, [x, y, w, h, tag] = q;
    switch (tag) {
      case 'wall': {
        this.hatch(x, y, w, h, '#8a7466');
        g.fillStyle = INK; g.fillRect(x < 100 ? x + w - 0.3 : x - 0.3, y, 0.6, h);
        break;
      }
      case 'balcony': case 'nbalcony': {
        this.hatch(x, y + 4, w, h - 4, '#9a8f84');
        g.fillStyle = '#b85c3a'; g.fillRect(x, y, w, 4);
        g.strokeStyle = rgba('#000000', 0.25); g.lineWidth = 0.4; g.beginPath(); for (let u = x; u < x + w; u += 20) { g.moveTo(u, y); g.lineTo(u, y + 4); } g.stroke();
        g.fillStyle = rgba('#ffffff', 0.18); g.fillRect(x, y, w, 0.8);
        g.fillStyle = INK; g.fillRect(x, y + 4, w, 0.5); g.fillRect(x + w - 0.3, y, 0.6, h); g.fillRect(x, y + h - 0.3, w, 0.6);
        g.fillStyle = rgba('#000000', 0.3); g.fillRect(x, y + h, w, 5);
        break;
      }
      case 'rail': {
        g.fillStyle = '#1f2a26'; g.fillRect(x, y, w, 4); g.fillRect(x + w / 2 - 1.5, y, 3, h); g.fillRect(x - 2, y + h - 3, w + 4, 3);
        g.strokeStyle = '#1f2a26'; g.lineWidth = 1.3;
        for (let v = y + 12; v < y + h - 12; v += 22) { g.beginPath(); g.arc(x + w / 2 - 3.5, v + 6, 4.5, -Math.PI / 2, Math.PI / 2); g.stroke(); g.beginPath(); g.arc(x + w / 2 + 3.5, v + 15, 4.5, Math.PI / 2, (3 * Math.PI) / 2); g.stroke(); }
        g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(x, y, w, 0.8);
        break;
      }
      case 'planter': {
        for (let i = 0; i < 9; i++) { const lx = x + 4 + (i * (w - 8)) / 8, ly = y + 4 + (i % 3) * 3; g.fillStyle = i % 2 ? '#3f7d4a' : '#4f9a5a'; g.beginPath(); g.ellipse(lx, ly, 6.5, 4.5, i, 0, TAU); g.fill(); }
        for (let i = 0; i < 5; i++) { const lx = x + 8 + i * ((w - 16) / 4), ly = y - 4 - (i % 2) * 5; g.fillStyle = '#e0343a'; g.beginPath(); g.arc(lx, ly, 3.8, 0, TAU); g.fill(); g.fillStyle = '#ff7a7a'; g.beginPath(); g.arc(lx - 1, ly - 1, 1.5, 0, TAU); g.fill(); }
        g.beginPath(); g.moveTo(x - 3, y + 8); g.lineTo(x + w + 3, y + 8); g.lineTo(x + w - 2, y + h); g.lineTo(x + 2, y + h); g.closePath(); this.fillInk('#b8603a');
        g.fillStyle = rgba('#ffffff', 0.14); g.fillRect(x, y + 11, w, 2.5);
        break;
      }
      case 'awning': {
        const vh = 11, path = () => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h + vh - 4); for (let u = x + w; u > x + 1; u -= 12) g.quadraticCurveTo(u - 6, y + h + vh + 4, u - 12, y + h + vh - 4); g.closePath(); };
        g.save(); path(); g.clip();
        for (let u = x; u < x + w; u += 12) { g.fillStyle = (((u - x) / 12) | 0) % 2 ? '#e9e5da' : '#2f7a55'; g.fillRect(u, y, 12, h + vh + 4); }
        g.fillStyle = rgba('#000000', 0.18); g.fillRect(x, y + h, w, 1.5);
        g.restore();
        path(); this.ink(0.8);
        g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(x, y, w, 0.8);
        break;
      }
    }
  },
});
