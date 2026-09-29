// The camera around the finder: a black 90s compact with a silver shutter button, a grey LCD and
// three LEDs, plus what is said in front of it (bubbles) and the family's «¡PATATA!».
import { seg7 } from './gfx/seg.js';
import { layout, ASPECT } from './layout.js';
import { clamp, lerp, roundRect } from './util.js';

const TAU = Math.PI * 2, INK = '#2a1a14';
export const FONT = { display: '"Titan One", "Archivo", sans-serif', ui: '"Archivo", system-ui, sans-serif', hand: '"Kalam", "Comic Sans MS", cursive', marker: '"Permanent Marker", "Titan One", sans-serif' };

// where everything sits for a W×H screen; mode 'v' is the portrait photo, 'h' the landscape one
export function playLayout(W, H, mode, safe = { t: 0, b: 0, l: 0, r: 0 }) {
  const m = Math.max(10, Math.min(W, H) * 0.025), top = safe.t + 58, bez = Math.max(8, Math.min(W, H) * 0.018);
  if (mode === 'v') {
    const panelH = clamp(H * 0.24, 168, 230) + safe.b;
    let w = W - 2 * m - 2 * bez - safe.l - safe.r, h = w * 1.5;
    const maxH = H - top - panelH - 2 * bez - m;
    if (h > maxH) { h = maxH; w = h / 1.5; }
    const vf = { x: (W - w) / 2, y: top + bez, w, h };
    const py = vf.y + h + bez + m * 0.6, ph = H - py - safe.b - m * 0.5;
    const r = clamp(Math.min(ph * 0.36, W * 0.13), 34, 62);
    const btn = { cx: W / 2, cy: py + ph * 0.46, r };
    const lcd = { x: vf.x - bez * 0.2, y: py + ph * 0.46 - r * 0.62, w: Math.min(W * 0.3, btn.cx - r - vf.x - m * 0.6), h: r * 1.24 };
    const dev = { x: btn.cx + r + m, y: btn.cy - 24, w: vf.x + w - (btn.cx + r + m) + bez * 0.2, h: 48 };
    return { mode, W, H, vf, bez, btn, lcd, dev, top: safe.t, panel: { x: 0, y: py, w: W, h: ph } };
  }
  const pw = clamp(W * 0.22, 190, 280);
  let h = H - top - m - 2 * bez - safe.b, w = h * 1.5;
  const maxW = W - pw - 2 * m - 2 * bez - safe.l - safe.r;
  if (w > maxW) { w = maxW; h = w / 1.5; }
  const vf = { x: safe.l + m + bez + (maxW - w) / 2, y: top + bez + (H - top - m - safe.b - 2 * bez - h) / 2, w, h };
  const px = vf.x + w + bez + m, pwid = W - px - m - safe.r;
  const r = clamp(Math.min(pwid * 0.3, h * 0.13), 38, 66);
  const btn = { cx: px + pwid / 2, cy: vf.y + h * 0.56, r };
  const lcd = { x: px + pwid * 0.06, y: vf.y + h * 0.04, w: pwid * 0.88, h: Math.min(h * 0.26, 128) };
  const dev = { x: px + pwid * 0.08, y: vf.y + h - 48, w: pwid * 0.84, h: 48 };
  return { mode, W, H, vf, bez, btn, lcd, dev, top: safe.t, panel: { x: px, y: vf.y, w: pwid, h } };
}

// leatherette: the body's fine grain, made once
let SKIN = null;
function skinTile() {
  if (SKIN || typeof document === 'undefined') return SKIN;
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const x = c.getContext('2d'); x.fillStyle = '#232428'; x.fillRect(0, 0, 96, 96);
  let s = 7;
  for (let i = 0; i < 900; i++) {
    s = (s * 16807) % 2147483647; const px = s % 96; s = (s * 16807) % 2147483647; const py = s % 96; s = (s * 16807) % 2147483647;
    x.fillStyle = s % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.22)'; x.beginPath(); x.arc(px, py, 0.6 + (s % 5) * 0.25, 0, TAU); x.fill();
  }
  return (SKIN = c);
}

export function drawBody(g, Lo) {
  const { W, H, vf, bez } = Lo;
  g.fillStyle = '#1d1e22'; g.fillRect(0, 0, W, H);
  const tile = skinTile(); if (tile) { g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, W, H); }
  const sh = g.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(255,255,255,0.06)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = sh; g.fillRect(0, 0, W, H);
  // the rubber eyecup round the finder
  const r = bez * 1.6;
  g.save();
  roundRect(g, vf.x - bez, vf.y - bez, vf.w + 2 * bez, vf.h + 2 * bez, r); g.fillStyle = '#0d0d10'; g.fill();
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.09)'; g.stroke();
  roundRect(g, vf.x - 2, vf.y - 2, vf.w + 4, vf.h + 4, r * 0.5); g.fillStyle = '#000'; g.fill();
  g.restore();
}

// ---- the LCD: frames left, the family's patience as a battery, flash and self-timer ----
const LCD_INK = '#1c2619', LCD_OFF = 'rgba(28,38,25,0.075)';
function bolt(g, x, y, s, on) {
  g.beginPath(); g.moveTo(x + s * 0.55, y); g.lineTo(x + s * 0.12, y + s * 0.56); g.lineTo(x + s * 0.44, y + s * 0.56);
  g.lineTo(x + s * 0.3, y + s); g.lineTo(x + s * 0.86, y + s * 0.38); g.lineTo(x + s * 0.54, y + s * 0.38); g.lineTo(x + s * 0.72, y); g.closePath();
  g.fillStyle = on ? LCD_INK : LCD_OFF; g.fill();
}
function clock(g, x, y, s, on) {
  g.strokeStyle = on ? LCD_INK : LCD_OFF; g.fillStyle = g.strokeStyle; g.lineWidth = Math.max(1.2, s * 0.12);
  g.beginPath(); g.arc(x + s / 2, y + s * 0.56, s * 0.4, 0, TAU); g.stroke();
  g.fillRect(x + s * 0.38, y, s * 0.24, s * 0.12);
  g.beginPath(); g.moveTo(x + s / 2, y + s * 0.56); g.lineTo(x + s / 2, y + s * 0.3); g.moveTo(x + s / 2, y + s * 0.56); g.lineTo(x + s * 0.68, y + s * 0.64); g.stroke();
}
function battery(g, x, y, w, h, n, of, blink) {
  const lw = Math.max(1.2, h * 0.11), nub = w * 0.07;
  g.lineWidth = lw; g.strokeStyle = LCD_INK;
  roundRect(g, x, y, w - nub, h, h * 0.16); g.stroke();
  g.fillStyle = LCD_INK; g.fillRect(x + w - nub, y + h * 0.3, nub, h * 0.4);
  const ix = x + lw * 1.4, iy = y + lw * 1.4, iw = w - nub - lw * 2.8, ih = h - lw * 2.8, gap = Math.max(1, iw * 0.04), sw = (iw - gap * (of - 1)) / of;
  for (let i = 0; i < of; i++) {
    const on = i < n && !(blink && i === n - 1);
    g.fillStyle = on ? LCD_INK : LCD_OFF; g.fillRect(ix + i * (sw + gap), iy, sw, ih);
  }
}
const lblFont = (g, px) => { g.font = `800 ${px.toFixed(2)}px ${FONT.ui}`; if ('letterSpacing' in g) g.letterSpacing = `${(px * 0.08).toFixed(2)}px`; };
const lblW = (g, s, px) => { lblFont(g, px); const w = g.measureText(s).width; if ('letterSpacing' in g) g.letterSpacing = '0px'; return w; };
// printed legends; maxW is a hard cap so a long word never runs under its neighbour
const lbl = (g, s, x, y, px, maxW) => {
  lblFont(g, px); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = LCD_INK;
  g.fillText(s, x, y, maxW);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
};
// s: { frames, patience, P, flash (bool: this event has one), charge (0..1, 1 = ready), timer (seconds left | null), t, L: labels }
export function drawLCD(g, R, s) {
  const r = Math.min(R.h * 0.16, 10);
  g.save();
  roundRect(g, R.x - 3, R.y - 3, R.w + 6, R.h + 6, r + 3); g.fillStyle = '#0b0b0d'; g.fill();
  g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.1)'; g.stroke();
  roundRect(g, R.x, R.y, R.w, R.h, r);
  const gl = g.createLinearGradient(R.x, R.y, R.x, R.y + R.h); gl.addColorStop(0, '#b3bc9c'); gl.addColorStop(1, '#939e81');
  g.fillStyle = gl; g.fill(); g.clip();
  const sh = g.createLinearGradient(0, R.y, 0, R.y + R.h * 0.3); sh.addColorStop(0, 'rgba(0,0,0,0.3)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh; g.fillRect(R.x, R.y, R.w, R.h * 0.3);
  const pad = R.h * 0.13, dh = R.h * 0.5, lp = Math.max(8.5, R.h * 0.135), ly = R.y + R.h - pad * 0.85;
  const timing = s.timer != null;
  const num = timing ? String(Math.max(0, Math.ceil(s.timer))).padStart(2, ' ') : String(Math.max(0, s.frames)).padStart(2, ' ');
  const dx = R.x + pad * 1.1, dy = R.y + pad * 0.9;
  const blinkT = timing && (s.timer < 2 ? (s.t * 4) % 1 < 0.5 : (s.t * 2) % 1 < 0.6);
  seg7(g, num, dx, dy, dh, { on: LCD_INK, off: LCD_OFF, lw: dh * 0.15 });
  const bx = dx + dh * 1.55 + pad * 0.9, bw = Math.min(R.x + R.w - bx - pad, R.h * 0.95), bh = bw * 0.46;
  // both legends share one size, and it doesn't jump when the timer swaps the left one
  const mL = bx - dx - pad * 1.1, mR = R.x + R.w - bx - pad * 0.6;
  const lz = lp * Math.min(1, mL / Math.max(lblW(g, s.L.shots, lp), lblW(g, s.L.timer, lp)), mR / lblW(g, s.L.patience, lp));
  lbl(g, timing ? s.L.timer : s.L.shots, dx, ly, lz, mL);
  battery(g, bx, dy + dh * 0.12, bw, bh, s.patience, s.P, s.patience === 1 && (s.t * 2.5) % 1 < 0.5);
  const is = Math.min(dh * 0.5, (R.x + R.w - bx - pad) * 0.3), iy = dy + dh * 0.12 + bh + (dh - bh - is) * 0.55 + is * 0.15;
  if (s.flash) bolt(g, bx, iy, is, s.charge >= 1 || (s.t * 3) % 1 < 0.5);
  if (s.timerOn != null) clock(g, bx + is * 1.4, iy, is, timing ? blinkT : s.timerOn);
  lbl(g, s.L.patience, bx, ly, lz, mR);
  g.globalCompositeOperation = 'screen';
  const gg = g.createLinearGradient(R.x, R.y, R.x + R.w * 0.5, R.y + R.h);
  gg.addColorStop(0, 'rgba(255,255,255,0.2)'); gg.addColorStop(0.5, 'rgba(255,255,255,0.04)'); gg.addColorStop(0.51, 'rgba(255,255,255,0)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gg; g.fillRect(R.x, R.y, R.w, R.h);
  g.restore();
}

// ---- the shutter button: brushed silver in a black collar, with a light ring that says what it will do ----
// the words under the button: size, centre line and lowest ink (the tutorial's note keeps clear of them)
export const btnLabel = (B) => { const px = Math.round(clamp(B.r * 0.4, 14, 24)), y = B.cy + B.r * 1.22 + px * 0.95; return { px, y, bottom: y + px * 0.62 }; };
const RING = { call: '#e8b62c', shot: '#4be08a', timer: '#ff8a1f', wait: '#ff8a1f', busy: '#6b6e75', out: '#4a4c52', last: '#e2b857' };
// s: { kind, press 0..1, t, charge 0..1 (flash), shake 0..1, label }
export function drawButton(g, B, s) {
  const { r } = B, cx = B.cx + Math.sin(s.t * 70) * r * 0.08 * (s.shake || 0), p = s.press || 0, cy = B.cy + p * r * 0.05;
  const col = RING[s.kind] || RING.busy, live = s.kind === 'call' || s.kind === 'shot' || s.kind === 'timer';
  g.save();
  // collar
  g.beginPath(); g.arc(cx, B.cy + r * 0.06, r * 1.26, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fill();
  g.beginPath(); g.arc(cx, B.cy, r * 1.22, 0, TAU);
  const cg = g.createLinearGradient(0, B.cy - r * 1.2, 0, B.cy + r * 1.2); cg.addColorStop(0, '#3b3d43'); cg.addColorStop(1, '#0d0d10');
  g.fillStyle = cg; g.fill();
  // light ring
  const pulse = s.kind === 'shot' ? 0.72 + 0.28 * Math.sin(s.t * TAU * 1.6) : live ? 0.9 : 0.35;
  g.lineWidth = r * 0.085;
  g.beginPath(); g.arc(cx, B.cy, r * 1.1, 0, TAU); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.stroke();
  if (s.kind === 'wait') {
    g.beginPath(); g.arc(cx, B.cy, r * 1.1, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(s.charge || 0)); g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = r * 0.25; g.stroke();
  } else {
    g.globalAlpha = pulse; g.beginPath(); g.arc(cx, B.cy, r * 1.1, 0, TAU); g.strokeStyle = col;
    if (live) { g.shadowColor = col; g.shadowBlur = r * (s.kind === 'shot' ? 0.5 : 0.3); }
    g.stroke(); g.globalAlpha = 1;
  }
  g.shadowBlur = 0;
  // the button itself
  g.beginPath(); g.arc(cx, cy + r * 0.07 * (1 - p), r, 0, TAU); g.fillStyle = '#26272b'; g.fill();
  const bg = g.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.05, cx, cy, r * 1.05);
  bg.addColorStop(0, p ? '#d9dbe0' : '#fafbfc'); bg.addColorStop(0.45, p ? '#a9acb3' : '#c9ccd1'); bg.addColorStop(1, p ? '#62656c' : '#7c8088');
  g.beginPath(); g.arc(cx, cy, r * (1 - p * 0.03), 0, TAU); g.fillStyle = bg; g.fill();
  if (g.createConicGradient) {
    const cc = g.createConicGradient(0.6, cx, cy);
    for (let i = 0; i <= 8; i++) cc.addColorStop(i / 8, i % 2 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.07)');
    g.fillStyle = cc; g.fill();
  }
  g.lineWidth = Math.max(1, r * 0.03); g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.beginPath(); g.arc(cx, cy, r * 0.97, Math.PI * 1.05, Math.PI * 1.75); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(cx, cy, r * 0.97, Math.PI * 0.05, Math.PI * 0.95); g.stroke();
  // label
  if (s.label) {
    const { px, y: ly } = btnLabel(B);
    g.font = `${px}px ${FONT.display}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = live ? '#f4ecd9' : 'rgba(244,236,217,0.55)';
    if (s.kind === 'shot') { g.shadowColor = RING.shot; g.shadowBlur = px * 0.6 * pulse; }
    g.fillText(s.label, B.cx, ly);
  }
  g.restore();
}
export const inButton = (B, x, y, pad = 1.35) => Math.hypot(x - B.cx, y - B.cy) <= B.r * pad;

// ---- speech: bubbles above everybody's heads (never over a face), and the family's big word ----
const outBack = (k) => { const c = 1.9; k -= 1; return 1 + (c + 1) * k * k * k + c * k * k; };
const bandCache = new Map();
export function headLine(ev, mode) {
  const key = ev.id + mode;
  if (!bandCache.has(key)) {
    const L = layout(ev, mode), A = ASPECT[mode];
    bandCache.set(key, Math.min(...Object.values(L).map((q) => q.y - q.d * A * 0.66)));
  }
  return bandCache.get(key);
}
function wrap(g, text, maxW) {
  const out = []; let cur = '';
  for (const w of text.split(/\s+/)) { const s = cur ? cur + ' ' + w : w; if (!cur || g.measureText(s).width <= maxW) cur = s; else { out.push(cur); cur = w; } }
  if (cur) out.push(cur);
  return out;
}
function bubblePath(g, x, y, w, h, r, tx, ty, tb) {
  const down = ty > y + h, bx = clamp(tx, x + r + tb, x + w - r - tb), e = down ? y + h : y, L = ty - e;
  g.beginPath(); g.moveTo(x + r, y);
  if (!down) { g.lineTo(bx - tb, y); g.quadraticCurveTo(bx - tb * 0.1, y + L * 0.5, tx, ty); g.quadraticCurveTo(bx + tb * 0.5, y + L * 0.4, bx + tb, y); }
  g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  if (down) { g.lineTo(bx + tb, e); g.quadraticCurveTo(bx + tb * 0.5, e + L * 0.4, tx, ty); g.quadraticCurveTo(bx - tb * 0.1, e + L * 0.5, bx - tb, e); }
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
const over = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export class Speech {
  constructor() { this.list = []; }
  clear() { this.list.length = 0; }
  // somebody was interrupted mid-sentence: their bubble goes now
  cut(who, t) { for (const b of this.list) if (b.who === who && t < b.t0 + b.dur) b.dur = Math.max(0, t - b.t0); }
  // e: { id, who, text, t0, dur, off (the photographer, behind the camera) }
  add(e) {
    this.list = this.list.filter((b) => b.who !== e.who);
    let h = 0; for (const c of e.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    this.list.push({ ...e, rot: ((h % 100) / 100 - 0.5) * 0.06 });
  }
  draw(g, Lo, ev, mode, t, view) {
    this.list = this.list.filter((b) => t < b.t0 + b.dur + 0.4);
    if (!this.list.length) return;
    const { vf } = Lo, L = layout(ev, mode), A = ASPECT[mode];
    const px = Math.round(clamp(vf.w * (mode === 'h' ? 0.023 : 0.041), 12, 22)), lh = px * 1.16, padX = px * 0.72, padY = px * 0.42, tail = px * 0.95;
    const maxW = vf.w * (mode === 'h' ? 0.36 : 0.64), band = vf.y + headLine(ev, mode) * vf.h, m = px * 0.45;
    g.save(); g.font = `700 ${px}px ${FONT.hand}`;
    const placed = [];
    for (const b of this.list) {
      if (t < b.t0) continue;
      const lines = wrap(g, b.text, maxW - 2 * padX), w = Math.max(...lines.map((s) => g.measureText(s).width)) + 2 * padX, h = lines.length * lh + 2 * padY;
      let x, y, tx, ty;
      if (b.off) { x = vf.x + (vf.w - w) / 2; y = vf.y + vf.h - h - tail - m; tx = vf.x + vf.w / 2 + w * 0.12; ty = vf.y + vf.h + 2; }
      else {
        const q = L[b.who], pv = view && view.people.find((p) => p.id === b.who);
        const sx = vf.x + (pv ? pv.x : q ? q.x : 0.5) * vf.w, top = q ? vf.y + (q.y - q.d * A * 0.66) * vf.h : band;
        const bottom = Math.min(band, top) - tail;
        x = clamp(sx - w / 2, vf.x + m, vf.x + vf.w - w - m); y = Math.max(vf.y + m, bottom - h);
        for (const o of placed) if (over({ x, y, w, h }, o)) {
          const left = o.x - w - m, right = o.x + o.w + m;
          if (sx < o.x + o.w / 2 && left >= vf.x + m) x = left;
          else if (right + w <= vf.x + vf.w - m) x = right;
          else if (left >= vf.x + m) x = left;
          else y = Math.max(vf.y + m, o.y - h - m);
        }
        tx = clamp(sx, x + px, x + w - px); ty = y + h + tail;
      }
      placed.push({ x, y, w, h });
      const a = t - b.t0, k = a < 0.22 ? outBack(clamp(a / 0.22)) : 1, fade = clamp((b.t0 + b.dur + 0.4 - t) / 0.25);
      g.save(); g.globalAlpha = fade;
      g.translate(tx, ty); g.rotate(b.rot); g.scale(k, k); g.translate(-tx, -ty);
      bubblePath(g, x, y, w, h, Math.min(h / 2, px * 0.9), tx, ty, px * 0.42);
      g.shadowColor = 'rgba(20,10,8,0.35)'; g.shadowOffsetY = px * 0.14; g.shadowBlur = px * 0.3;
      g.fillStyle = b.off ? '#f2c64a' : '#fffaf0'; g.fill();
      g.shadowColor = 'transparent'; g.lineWidth = Math.max(1.6, px * 0.12); g.lineJoin = 'round'; g.strokeStyle = INK; g.stroke();
      g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach((s, i) => g.fillText(s, x + w / 2, y + padY + lh * (i + 0.52)));
      g.restore();
    }
    g.restore();
  }
}

const CHORUS = { e: ['#ffd23f', '#d8342c', 1, 1], n: ['#fbfaf6', '#e8b62c', 0.86, 0.55], b: ['#c9ccd1', '#6b6e75', 0.68, 0.15] };
// ch: sim.chorus; words: { e, n, b }
export function drawChorus(g, Lo, ev, mode, ch, t, words) {
  if (!ch) return;
  const a0 = ch.start - 0.05, a1 = ch.end + 0.16;
  if (t < a0 || t > a1) return;
  const [fill, shadow, scale, bounce] = CHORUS[ch.mood] || CHORUS.n, chars = [...(words[ch.mood] || words.n)];
  const { vf } = Lo, band = Math.max(vf.h * 0.1, headLine(ev, mode) * vf.h);
  const size = Math.max(18, Math.min(band * 0.8, (vf.w * 0.84) / (chars.length * 0.66))) * scale;
  const out = clamp((a1 - t) / 0.16), reveal = Math.max(0.2, (ch.end - ch.start) * 0.5);
  g.save(); g.font = `${size}px ${FONT.display}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const ws = chars.map((c) => g.measureText(c).width), total = ws.reduce((a, b) => a + b, 0);
  let x = vf.x + (vf.w - total) / 2;
  const cy = vf.y + band * 0.5;
  chars.forEach((c, i) => {
    const ti = ch.start + (i / chars.length) * reveal, k = clamp((t - ti) / 0.16);
    if (k > 0) {
      const s = outBack(k) * (0.55 + 0.45 * out), age = t - ti;
      const dy = -Math.abs(Math.sin(age * 11 - i * 0.7)) * size * 0.12 * bounce * Math.exp(-age * 1.2) + (ch.mood === 'b' ? i * size * 0.025 : 0);
      const rot = ch.mood === 'b' ? (i % 2 ? 0.07 : -0.05) : Math.sin(i * 1.7) * 0.06;
      g.save(); g.globalAlpha = out; g.translate(x + ws[i] / 2, cy + dy); g.rotate(rot); g.scale(s, s);
      g.fillStyle = shadow; g.fillText(c, -ws[i] / 2 + size * 0.05, size * 0.07);
      g.lineWidth = size * 0.14; g.strokeStyle = INK; g.strokeText(c, -ws[i] / 2, 0);
      g.fillStyle = fill; g.fillText(c, -ws[i] / 2, 0);
      g.restore();
    }
    x += ws[i];
  });
  g.restore();
}
