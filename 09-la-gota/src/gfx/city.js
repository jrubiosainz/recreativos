// What's out there, through the glass: a rainy Spanish street going by. Three depths — the skyline,
// the buildings along the pavement with their shops and balconies, and the pavement itself (lamp posts,
// bare plane trees, bollards, people under umbrellas, the shelter at each stop). Everything is laid out
// once from a seed in "pane widths" and slides right as the bus drives on (we look out of its right side,
// so the street runs from the front, on the left, to the back). Drawn into its own canvas every frame;
// the fog, the lanes and the lenses of the drops all sample it.
import { mulberry32, clamp, lerp, mix, rgba, TAU, roundRect } from '../util.js';
import { F } from '../fonts.js';

const MOODS = {
  dawn: { sky: ['#1a2745', '#3b4c77', '#b98a78'], haze: '#4f5b7b', lit: 0.5, lamps: 1, day: 0.55, pave: '#4c5263', rain: 0.55, glass: '#2a3553' },
  morning: { sky: ['#5f6f87', '#8c99ab', '#c3c7cb'], haze: '#8792a2', lit: 0.2, lamps: 0.25, day: 0.85, pave: '#6f7580', rain: 0.75, glass: '#56627a' },
  day: { sky: ['#7f8ea2', '#a4afbc', '#d2d5d4'], haze: '#97a2ae', lit: 0.05, lamps: 0, day: 1, pave: '#7d838c', rain: 0.4, glass: '#66758a' },
  dusk: { sky: ['#2a2d5a', '#8f5474', '#eb9a62'], haze: '#6a566e', lit: 0.45, lamps: 0.85, day: 0.66, pave: '#554f60', rain: 0.3, glass: '#3b3553' },
  blue: { sky: ['#0b1734', '#1c3669', '#3a5a90'], haze: '#29395e', lit: 0.62, lamps: 1, day: 0.42, pave: '#343c52', rain: 0.6, glass: '#1c2745' },
  night: { sky: ['#04060d', '#0a1024', '#18203d'], haze: '#141a2e', lit: 0.36, lamps: 1, day: 0.26, pave: '#1b1f2c', rain: 0.85, glass: '#0d1224' },
};
export const moodOf = (lv) => ({ '7:42': 'dawn', '8:15': 'morning', '13:05': 'day', '17:30': 'dusk', '19:50': 'blue', '2:17': 'night' })[lv?.clock] || 'dawn';
export const moodColors = (m) => MOODS[m] || MOODS.dawn;

const FACADES = ['#c9a27a', '#b8735a', '#d9cfbf', '#9fae9a', '#c4b08a', '#8f6f5f', '#e0d6c8', '#a7b3bd', '#d4a58c', '#b9b09c'];
const SHUTTER = ['#e8dcc4', '#9c6b4a', '#6d8a6a', '#d8d2c6'];
const SHOPS = [
  { t: 'FARMACIA', bg: '#0e3b2a', fg: '#7dffb0', cross: true },
  { t: 'BAR', bg: '#3a1210', fg: '#ffcf6b' },
  { t: 'PANADERÍA', bg: '#5b3a1a', fg: '#ffe2a6' },
  { t: 'FRUTAS', bg: '#1d4424', fg: '#ffd35a' },
  { t: 'ESTANCO', bg: '#5a1020', fg: '#ffd84a', tabac: true },
  { t: 'LOTERÍA', bg: '#10306a', fg: '#ffe066' },
  { t: 'CAFÉ', bg: '#2b1b14', fg: '#ffb38a' },
  { t: 'CHURROS', bg: '#6a2a12', fg: '#ffe7b0' },
  { t: 'ZAPATERÍA', bg: '#26263a', fg: '#c9c9ff' },
  { t: 'PELUQUERÍA', bg: '#3b1a3a', fg: '#ff9ad6' },
];
const COATS = ['#2d3a5a', '#7a2a2a', '#3f4a3a', '#5a4a3a', '#222630', '#6b5a7a', '#8a6a3a'];
const BRELLAS = ['#e0453a', '#2a5bd7', '#f2c230', '#1e1e24', '#3aa37a', '#e27ab0', '#f07a2a', '#7a4ad0'];

// how many pane widths a metre of street is worth at each depth
const K_FAR = 1 / 80, K_MID = 1 / 9, K_NEAR = 1 / 3.4;
const GROUND = 0.8; // the pavement line, in pane heights

export class City {
  constructor(seed = 1) {
    this.seed = seed;
    this.mood = 'dawn';
    this.c = document.createElement('canvas');
    this.g = this.c.getContext('2d');
    this.w = 1; this.h = 1;
    this.stops = [0];
    this.cache = new Map();
    this.build();
  }
  setMood(m) { if (m !== this.mood) { this.mood = m; this.cache.clear(); } }
  // where the bus will stand still, in metres: a shelter is waiting at each of them
  setStops(list) { this.stops = list.length ? list : [0]; this.buildNear(); }
  resize(w, h) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    if (w === this.w && h === this.h) return;
    this.w = this.c.width = w; this.h = this.c.height = h;
    this.cache.clear();
  }

  // ---------- laying the street out ----------
  build() {
    const rng = mulberry32(this.seed * 7919 + 13);
    // the skyline: blocks and towers far away, with the odd crane
    this.far = [];
    for (let x = -60; x < 2;) {
      const w = 0.05 + rng() * 0.12, tall = rng() < 0.12;
      this.far.push({ x, w, h: tall ? 0.28 + rng() * 0.16 : 0.08 + rng() * 0.12, crane: rng() < 0.05, lit: rng() });
      x += w * (0.7 + rng() * 0.5);
    }
    // the buildings along the pavement
    this.mid = [];
    for (let x = -120; x < 2;) {
      const w = 0.42 + rng() * 0.5, floors = 3 + Math.floor(rng() * 5);
      const b = {
        x, w, floors, top: GROUND - 0.12 - floors * (0.085 + rng() * 0.012),
        col: FACADES[Math.floor(rng() * FACADES.length)], cols: 2 + Math.floor(w * 5.2),
        balc: rng() < 0.6, shut: SHUTTER[Math.floor(rng() * SHUTTER.length)], shop: SHOPS[Math.floor(rng() * SHOPS.length)],
        awn: rng() < 0.5 ? BRELLAS[Math.floor(rng() * BRELLAS.length)] : null, seed: Math.floor(rng() * 1e9), cornice: rng() < 0.5,
      };
      this.mid.push(b);
      x += w + (rng() < 0.2 ? 0.02 + rng() * 0.05 : 0);
    }
    this.buildNear();
  }
  buildNear() {
    const rng = mulberry32(this.seed * 104729 + 7);
    this.near = [];
    // a shelter centred in the window at every stop
    for (const s of this.stops) this.near.push({ k: 'shelter', x: 0.5 - 0.55 - s * K_NEAR, w: 1.1, seed: Math.floor(rng() * 1e9) });
    const blocked = (x, w) => this.near.some((o) => o.k === 'shelter' && x + w > o.x - 0.1 && x < o.x + o.w + 0.1);
    for (let x = -260; x < 2; x += 0.35 + rng() * 0.9) {
      const r = rng(), w = 0.12;
      if (blocked(x, w)) continue;
      if (r < 0.3) this.near.push({ k: 'lamp', x, w: 0.08 });
      else if (r < 0.52) this.near.push({ k: 'tree', x, w: 0.5, seed: Math.floor(rng() * 1e9) });
      else if (r < 0.64) this.near.push({ k: 'bollards', x, w: 0.4 });
      else if (r < 0.72) this.near.push({ k: 'bin', x, w: 0.08 });
      else this.near.push({ k: 'person', x, w: 0.14, coat: COATS[Math.floor(rng() * COATS.length)], brolly: BRELLAS[Math.floor(rng() * BRELLAS.length)], walk: (rng() - 0.5) * 0.9, ph: rng() * TAU, h: 0.3 + rng() * 0.06 });
    }
    // and a little crowd under each shelter
    for (const o of this.near.filter((q) => q.k === 'shelter')) {
      for (let j = 0; j < 3; j++) this.near.push({ k: 'person', x: o.x + 0.2 + j * 0.28 + rng() * 0.08, w: 0.14, coat: COATS[Math.floor(rng() * COATS.length)], brolly: j === 1 ? null : BRELLAS[Math.floor(rng() * BRELLAS.length)], walk: 0, ph: rng() * TAU, h: 0.29 + rng() * 0.06 });
    }
    this.near.sort((p, q) => (p.k === 'shelter' ? -1 : 0) - (q.k === 'shelter' ? -1 : 0));
  }

  // ---------- drawing ----------
  draw(dist, time) {
    const g = this.g, W = this.w, H = this.h, M = MOODS[this.mood];
    // sky
    const sky = g.createLinearGradient(0, 0, 0, H * GROUND);
    sky.addColorStop(0, M.sky[0]); sky.addColorStop(0.55, M.sky[1]); sky.addColorStop(1, M.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // skyline
    const uf = dist * K_FAR;
    g.fillStyle = mix(M.haze, M.sky[1], 0.35);
    for (const b of this.far) {
      const px = b.x + uf;
      if (px > 1 || px + b.w < 0) continue;
      g.fillRect(px * W, (GROUND - 0.3 - b.h) * H, b.w * W + 1, (b.h + 0.3) * H);
      if (b.crane) { g.fillRect(px * W + b.w * W * 0.5, (GROUND - 0.3 - b.h - 0.12) * H, Math.max(1, W * 0.004), 0.12 * H); g.fillRect(px * W, (GROUND - 0.3 - b.h - 0.12) * H, b.w * W * 1.6, Math.max(1, W * 0.004)); }
    }
    // buildings
    const um = dist * K_MID;
    for (const b of this.mid) {
      const sx = b.x + um;
      if (sx > 1 || sx + b.w < 0) continue;
      g.drawImage(this.facade(b), Math.round(sx * W), Math.round(b.top * H));
    }
    // pavement, wet: the lit shops shine in it
    const pv = g.createLinearGradient(0, GROUND * H, 0, H);
    pv.addColorStop(0, M.pave); pv.addColorStop(1, mix(M.pave, '#000000', 0.35));
    g.fillStyle = pv; g.fillRect(0, GROUND * H, W, H * (1 - GROUND));
    g.fillStyle = rgba('#000000', 0.18); g.fillRect(0, GROUND * H, W, Math.max(1, H * 0.006));
    if (M.lit > 0.3) {
      for (const b of this.mid) {
        const sx = b.x + um;
        if (sx > 1 || sx + b.w < 0) continue;
        const rg = g.createLinearGradient(0, GROUND * H, 0, H);
        rg.addColorStop(0, rgba(b.shop.fg, 0.22 * M.lit)); rg.addColorStop(1, rgba(b.shop.fg, 0));
        g.fillStyle = rg; g.fillRect((sx + b.w * 0.15) * W, GROUND * H, b.w * 0.7 * W, H * (1 - GROUND));
      }
    }
    // kerb stones
    g.strokeStyle = rgba('#000000', 0.12); g.lineWidth = Math.max(1, W * 0.003);
    const un = dist * K_NEAR;
    for (let k = Math.floor(-un / 0.25) - 1; k < Math.floor(-un / 0.25) + 6; k++) {
      const x = (k * 0.25 + un) * W; g.beginPath(); g.moveTo(x, GROUND * H + H * 0.02); g.lineTo(x - W * 0.08, H); g.stroke();
    }
    // the pavement's things
    for (const o of this.near) {
      let sx = o.x + un;
      if (o.k === 'person' && o.walk) sx += ((o.walk * time * 0.25) % 3);
      if (sx > 1.1 || sx + o.w < -0.1) continue;
      this.nearThing(o, sx, time, M);
    }
    // rain, outside
    if (M.rain > 0) {
      const slant = clamp(this.speed || 0, 0, 14) * 0.02 + 0.05;
      g.strokeStyle = rgba('#dfe8f5', 0.16 + 0.1 * M.rain); g.lineWidth = Math.max(1, W * 0.0025);
      g.beginPath();
      const n = Math.round(70 * M.rain);
      for (let j = 0; j < n; j++) {
        const s = (j * 0.6180339) % 1, s2 = (j * 0.7548776) % 1;
        const y = ((s2 + time * (1.3 + s * 0.6)) % 1.1) - 0.05, x = (s + y * slant + time * slant * 0.2) % 1;
        g.moveTo(x * W, y * H); g.lineTo((x - slant * 0.05) * W, (y + 0.035) * H);
      }
      g.stroke();
    }
  }

  // a building's face, painted once per mood and size
  facade(b) {
    let c = this.cache.get(b);
    if (c) return c;
    const W = this.w, H = this.h, M = MOODS[this.mood], rng = mulberry32(b.seed);
    const w = Math.max(2, Math.round(b.w * W)), h = Math.max(2, Math.round((GROUND - b.top) * H) + 1);
    c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const body = mix(mix(b.col, M.haze, 0.25), '#0a0c14', 1 - M.day);
    g.fillStyle = body; g.fillRect(0, 0, w, h);
    // a touch of shade down one side and a cornice
    const sh = g.createLinearGradient(0, 0, w, 0);
    sh.addColorStop(0, rgba('#000000', 0.12)); sh.addColorStop(0.2, rgba('#000000', 0)); sh.addColorStop(0.9, rgba('#000000', 0)); sh.addColorStop(1, rgba('#000000', 0.2));
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
    if (b.cornice) { g.fillStyle = mix(body, '#ffffff', 0.12); g.fillRect(0, 0, w, Math.max(2, H * 0.012)); }
    // floors of windows with balconies
    const shopH = 0.12 * H, fl = (h - shopH) / b.floors;
    const cw = w / b.cols, ww = cw * 0.46, wh = fl * 0.58;
    for (let f = 0; f < b.floors; f++) {
      const y = f * fl + fl * 0.22;
      for (let k = 0; k < b.cols; k++) {
        const x = k * cw + (cw - ww) / 2;
        const lit = rng() < M.lit * 0.8, half = rng();
        g.fillStyle = lit ? mix('#ffcf7a', '#ff9e4a', rng() * 0.5) : mix(M.glass, body, 0.25);
        g.fillRect(x, y, ww, wh);
        if (!lit) { g.fillStyle = rgba('#ffffff', 0.05 + 0.08 * M.day); g.fillRect(x, y, ww * 0.35, wh); }
        // the Spanish blind, halfway down
        if (half < 0.55) { g.fillStyle = mix(b.shut, body, 0.3 + 0.5 * (1 - M.day)); g.fillRect(x, y, ww, wh * (0.25 + half * 0.9)); }
        if (b.balc && f < b.floors) {
          g.fillStyle = mix(body, '#000000', 0.45);
          g.fillRect(x - ww * 0.18, y + wh, ww * 1.36, Math.max(1, fl * 0.05));
          g.globalAlpha = 0.55;
          for (let q = 0; q <= 5; q++) g.fillRect(x - ww * 0.18 + (q / 5) * ww * 1.36, y + wh * 0.62, Math.max(1, w * 0.004), wh * 0.38);
          g.fillRect(x - ww * 0.18, y + wh * 0.6, ww * 1.36, Math.max(1, fl * 0.03));
          g.globalAlpha = 1;
        }
      }
    }
    // the shop at street level
    const sy = h - shopH, s = b.shop;
    g.fillStyle = mix(body, '#000000', 0.25); g.fillRect(0, sy, w, shopH);
    const lit = M.lit > 0.15 || M.day < 0.9;
    const win = g.createLinearGradient(0, sy, 0, h);
    win.addColorStop(0, lit ? mix(s.fg, '#fff3d6', 0.5) : mix(M.glass, '#ffffff', 0.15));
    win.addColorStop(1, lit ? mix(s.fg, '#000000', 0.55) : M.glass);
    g.fillStyle = win; g.fillRect(w * 0.08, sy + shopH * 0.36, w * 0.84, shopH * 0.64);
    g.fillStyle = mix(body, '#000000', 0.5); g.fillRect(w * 0.55, sy + shopH * 0.36, Math.max(1, w * 0.012), shopH * 0.64);
    // the sign
    const signH = shopH * 0.26;
    g.fillStyle = s.bg; g.fillRect(w * 0.06, sy + shopH * 0.05, w * 0.88, signH);
    g.font = F.hand(Math.round(signH * 0.72), 800);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (lit) { g.shadowColor = s.fg; g.shadowBlur = signH * 0.6; }
    g.fillStyle = lit ? s.fg : mix(s.fg, '#888888', 0.4);
    g.fillText(s.t, w / 2, sy + shopH * 0.05 + signH * 0.54, w * 0.8);
    g.shadowBlur = 0;
    if (b.awn) {
      g.fillStyle = mix(b.awn, '#000000', 1 - M.day * 0.9);
      g.beginPath(); g.moveTo(w * 0.06, sy + shopH * 0.33); g.lineTo(w * 0.94, sy + shopH * 0.33); g.lineTo(w * 0.98, sy + shopH * 0.5); g.lineTo(w * 0.02, sy + shopH * 0.5); g.closePath(); g.fill();
      g.fillStyle = rgba('#ffffff', 0.25 * M.day);
      for (let q = 0; q < 8; q++) if (q % 2) g.fillRect(w * (0.06 + q * 0.11), sy + shopH * 0.33, w * 0.11, shopH * 0.17);
    }
    this.cache.set(b, c);
    return c;
  }

  nearThing(o, sx, time, M) {
    const g = this.g, W = this.w, H = this.h, x = sx * W, foot = H * 0.965;
    const dark = mix('#1c1f28', M.haze, 0.25 * M.day);
    if (o.k === 'lamp') {
      g.fillStyle = dark;
      g.fillRect(x - W * 0.008, H * 0.12, W * 0.016, foot - H * 0.12);
      g.fillRect(x - W * 0.008, H * 0.12, W * 0.07, W * 0.012);
      const lx = x + W * 0.06, ly = H * 0.12 + W * 0.02;
      g.fillStyle = M.lamps ? '#ffd9a0' : '#8c8f96';
      roundRect(g, lx - W * 0.03, ly - W * 0.008, W * 0.06, W * 0.02, W * 0.008); g.fill();
      if (M.lamps) {
        const R = W * 0.22, rg = g.createRadialGradient(lx, ly, 0, lx, ly, R);
        rg.addColorStop(0, rgba('#ffc47a', 0.55 * M.lamps)); rg.addColorStop(1, rgba('#ffc47a', 0));
        g.fillStyle = rg; g.fillRect(lx - R, ly - R, R * 2, R * 2);
        const cone = g.createLinearGradient(0, ly, 0, foot);
        cone.addColorStop(0, rgba('#ffc47a', 0.16 * M.lamps)); cone.addColorStop(1, rgba('#ffc47a', 0.02));
        g.fillStyle = cone;
        g.beginPath(); g.moveTo(lx - W * 0.02, ly); g.lineTo(lx + W * 0.02, ly); g.lineTo(lx + W * 0.16, foot); g.lineTo(lx - W * 0.16, foot); g.closePath(); g.fill();
      }
    } else if (o.k === 'tree') {
      g.drawImage(this.tree(o), x - W * 0.25, H * 0.1);
    } else if (o.k === 'bollards') {
      g.fillStyle = dark;
      for (let q = 0; q < 3; q++) { roundRect(g, x + q * W * 0.14, foot - H * 0.06, W * 0.03, H * 0.06, W * 0.012); g.fill(); }
    } else if (o.k === 'bin') {
      g.fillStyle = mix('#2f5a3a', '#000000', 1 - M.day * 0.8);
      roundRect(g, x, foot - H * 0.075, W * 0.065, H * 0.07, W * 0.01); g.fill();
      g.fillStyle = dark; g.fillRect(x + W * 0.028, foot - H * 0.075, W * 0.01, H * 0.075);
    } else if (o.k === 'person') {
      this.person(o, x, foot, time, M);
    } else if (o.k === 'shelter') {
      this.shelter(o, x, foot, M);
    }
  }
  tree(o) {
    let c = this.cache.get(o);
    if (c) return c;
    const W = this.w, H = this.h, M = MOODS[this.mood], rng = mulberry32(o.seed);
    c = document.createElement('canvas'); c.width = Math.max(2, Math.round(W * 0.5)); c.height = Math.max(2, Math.round(H * 0.87));
    const g = c.getContext('2d'), col = mix('#3a322b', M.haze, 0.25 + 0.3 * M.day), twig = mix(col, M.haze, 0.45);
    g.lineCap = 'round';
    // a pollarded plane tree in winter: knuckled limbs, a fan of fine twigs, a few seed balls hanging on
    const branch = (x, y, a, len, wd, n) => {
      const bend = (rng() - 0.5) * 0.5, x2 = x + Math.sin(a) * len, y2 = y - Math.cos(a) * len;
      const mx = (x + x2) / 2 + Math.cos(a) * len * bend * 0.3, my = (y + y2) / 2 + Math.sin(a) * len * bend * 0.3;
      g.strokeStyle = n <= 1 ? twig : col; g.lineWidth = Math.max(0.6, wd);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx, my, x2, y2); g.stroke();
      if (n <= 0) { if (rng() < 0.18) { g.fillStyle = col; g.beginPath(); g.arc(x2, y2 + wd * 3, Math.max(1, W * 0.006), 0, TAU); g.fill(); } return; }
      const k = n > 3 ? 2 : 2 + (rng() < 0.5 ? 1 : 0);
      for (let j = 0; j < k; j++) branch(x2, y2, a + (j - (k - 1) / 2) * 0.7 + (rng() - 0.5) * 0.5, len * (0.6 + rng() * 0.16), wd * 0.62, n - 1);
    };
    branch(c.width / 2, c.height, (rng() - 0.5) * 0.1, c.height * 0.34, W * 0.03, 6);
    // the mottled bark of a plane tree
    g.fillStyle = mix(col, '#c9c0a8', 0.35);
    for (let i = 0; i < 6; i++) { const yy = c.height * (0.7 + rng() * 0.28); g.beginPath(); g.ellipse(c.width / 2 + (rng() - 0.5) * W * 0.02, yy, W * 0.008, W * 0.016, 0, 0, TAU); g.fill(); }
    this.cache.set(o, c);
    return c;
  }
  person(o, x, foot, time, M) {
    const g = this.g, H = this.h, W = this.w, h = o.h * H, shade = 1 - M.day * 0.75;
    const bob = o.walk ? Math.abs(Math.sin(time * 5 + o.ph)) * h * 0.015 : 0;
    const coat = mix(o.coat, '#05060a', shade), skin = mix('#d9a887', '#20222c', shade);
    // legs
    g.fillStyle = mix('#1a1c24', '#000000', 0.3);
    const step = o.walk ? Math.sin(time * 5 + o.ph) * h * 0.05 : 0;
    g.fillRect(x - h * 0.05 + step, foot - h * 0.36, h * 0.045, h * 0.36);
    g.fillRect(x + h * 0.01 - step, foot - h * 0.36, h * 0.045, h * 0.36);
    // coat
    g.fillStyle = coat;
    roundRect(g, x - h * 0.1, foot - h * 0.78 - bob, h * 0.2, h * 0.46, h * 0.06); g.fill();
    // head and a scarf
    g.fillStyle = skin; g.beginPath(); g.arc(x, foot - h * 0.86 - bob, h * 0.07, 0, TAU); g.fill();
    g.fillStyle = mix(o.brolly || '#c0392b', '#000000', shade * 0.8); g.fillRect(x - h * 0.08, foot - h * 0.8 - bob, h * 0.16, h * 0.05);
    if (o.brolly) {
      const col = mix(o.brolly, '#000000', shade * 0.85), cx = x + h * 0.02, cy = foot - h * 0.98 - bob;
      g.strokeStyle = '#111'; g.lineWidth = Math.max(1, W * 0.003);
      g.beginPath(); g.moveTo(x + h * 0.02, foot - h * 0.6 - bob); g.lineTo(cx, cy); g.stroke();
      g.fillStyle = col;
      g.beginPath(); g.ellipse(cx, cy, h * 0.26, h * 0.13, 0, Math.PI, TAU); g.lineTo(cx - h * 0.26, cy); g.fill();
      g.fillStyle = rgba('#ffffff', 0.12 * M.day); g.beginPath(); g.ellipse(cx - h * 0.08, cy - h * 0.06, h * 0.08, h * 0.03, -0.3, 0, TAU); g.fill();
    }
  }
  shelter(o, x, foot, M) {
    const g = this.g, W = this.w, H = this.h, w = o.w * W, top = H * 0.36;
    const frame = mix('#3d4552', '#05060a', 1 - M.day * 0.8);
    // glass back panel
    g.fillStyle = rgba(mix('#a9c3d6', M.glass, 0.5), 0.35); g.fillRect(x, top, w, foot - top - H * 0.04);
    // the ad, lit from behind
    const ax = x + w * 0.62, aw = w * 0.32, ay = top + H * 0.05, ah = foot - ay - H * 0.1;
    const ad = g.createLinearGradient(0, ay, 0, ay + ah);
    ad.addColorStop(0, '#6fc7ff'); ad.addColorStop(1, '#1b4e9a');
    g.fillStyle = ad; g.fillRect(ax, ay, aw, ah);
    // a big water drop: the ad for a water company, of course
    g.fillStyle = rgba('#ffffff', 0.9);
    g.beginPath(); const dx = ax + aw / 2, dy = ay + ah * 0.42, R = aw * 0.26;
    g.moveTo(dx, dy - R * 1.9); g.bezierCurveTo(dx + R * 0.4, dy - R, dx + R, dy - R * 0.3, dx + R, dy + R * 0.2);
    g.arc(dx, dy + R * 0.2, R, 0, Math.PI); g.bezierCurveTo(dx - R, dy - R * 0.3, dx - R * 0.4, dy - R, dx, dy - R * 1.9); g.fill();
    g.fillStyle = '#ffffff'; g.font = F.wipe(Math.round(aw * 0.16)); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('AGUA', dx, ay + ah * 0.82);
    if (M.lamps > 0.2) { const rg = g.createRadialGradient(dx, ay + ah / 2, 0, dx, ay + ah / 2, aw); rg.addColorStop(0, rgba('#8fd4ff', 0.3)); rg.addColorStop(1, rgba('#8fd4ff', 0)); g.fillStyle = rg; g.fillRect(dx - aw, ay + ah / 2 - aw, aw * 2, aw * 2); }
    // frame, roof and bench
    g.fillStyle = frame;
    g.fillRect(x, top - H * 0.02, w, H * 0.025);
    g.fillRect(x, top, W * 0.012, foot - top); g.fillRect(x + w - W * 0.012, top, W * 0.012, foot - top); g.fillRect(ax - W * 0.01, top, W * 0.01, foot - top);
    g.fillRect(x + w * 0.08, foot - H * 0.13, w * 0.48, H * 0.018);
    // the stop's sign: a pole with the line number
    const px = x - W * 0.06;
    g.fillRect(px, H * 0.2, W * 0.012, foot - H * 0.2);
    g.fillStyle = '#d8342c'; roundRect(g, px - W * 0.05, H * 0.2, W * 0.11, W * 0.11, W * 0.02); g.fill();
    g.fillStyle = '#ffffff'; g.font = F.wipe(Math.round(W * 0.06)); g.fillText(this.line || '27', px + W * 0.005, H * 0.2 + W * 0.058);
  }
}
