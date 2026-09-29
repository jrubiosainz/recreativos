// The developed photo: the same scene as the finder, frozen at the tap, with the film's warmth,
// flash falloff and the orange date in the corner. Then somebody takes a red marker to it.
import { drawScene, drawGrain } from './scene.js';
import { layout, ASPECT } from './layout.js';
import { seg7, segWidth } from './gfx/seg.js';
import { t as tr } from './i18n.js';
import { clamp } from './util.js';

const TAU = Math.PI * 2;
export const printSize = (mode, long = 1200) => (mode === 'h' ? [long, Math.round(long / 1.5)] : [Math.round(long / 1.5), long]);
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function filmLook(g, W, H, flash) {
  g.save();
  g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(255,196,140,0.35)'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(46,26,40,0.10)'; g.fillRect(0, 0, W, H);
  if (flash) {
    const f = g.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.46, Math.max(W, H) * 0.5);
    f.addColorStop(0, 'rgba(255,255,255,0.14)'); f.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = f; g.fillRect(0, 0, W, H);
  }
  g.globalCompositeOperation = 'multiply';
  const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(1, 'rgba(150,120,110,1)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.restore();
}

export const dateText = (d) => `'${String(d[0]).slice(2)} ${d[1]} ${String(d[2]).padStart(2, ' ')}`;
export function dateStamp(g, W, H, d) {
  const h = Math.round(Math.min(W, H) * 0.052), s = dateText(d), w = segWidth(s, h);
  const x = W - w - Math.min(W, H) * 0.06, y = H - h - Math.min(W, H) * 0.055;
  g.save(); g.globalCompositeOperation = 'screen';
  seg7(g, s, x, y, h, { on: 'rgba(255,120,30,0.95)', glow: h * 0.5, lw: h * 0.13 });
  seg7(g, s, x, y, h, { on: 'rgba(255,190,110,0.6)', lw: h * 0.05 });
  g.restore();
}

// P: { mode, view, flash, bands, flock }
export function renderPrint(P, { ev, bg, long = 1200, S = new Map(), date = true, canvas = null } = {}) {
  const [W, H] = printSize(P.mode, long), c = canvas || mk(W, H);
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  drawScene(g, { x: 0, y: 0, w: W, h: H }, {
    ev, mode: P.mode, bg, view: P.view, S, t: P.view.t, dt: 0, bands: P.bands, flock: P.flock,
    lit: P.flash ? 1 : 0, redeye: !!P.flash, scratch: mk(W, H), grainT: 3.7,
  });
  filmLook(g, W, H, P.flash);
  drawGrain(g, { x: 0, y: 0, w: W, h: H }, 0.1, 1.3);
  if (date) dateStamp(g, W, H, ev.date);
  return c;
}

// where the red circles go: round each culprit's head, the label above (or below when crowded)
export function markSpots(ev, mode, culprits, W, H) {
  const L = layout(ev, mode), out = [], boxes = [], fs = Math.round(Math.min(W, H) * (mode === 'h' ? 0.06 : 0.052));
  const hit = (b) => boxes.some((q) => b.x < q.x + q.w && q.x < b.x + b.w && b.y < q.y + q.h && q.y < b.y + b.h);
  const list = culprits.map((c) => ({ ...c, q: L[c.id] })).filter((c) => c.q).sort((a, b) => a.q.y - b.q.y || a.q.x - b.q.x);
  for (const [i, c] of list.entries()) {
    const q = c.q, cx = q.x * W, cy = q.y * H, rx = q.d * W * 0.74, ry = q.d * W * 0.84;
    const text = tr('why.' + c.why), tw = text.length * fs * 0.62, m = W * 0.02;
    let lx = clamp(cx - tw / 2, m, W - tw - m), ly = cy - ry - fs * 0.35, box = { x: lx, y: ly - fs, w: tw, h: fs * 1.1 };
    if (ly - fs < m || hit(box)) { ly = cy + ry + fs * 1.05; box = { x: lx, y: ly - fs, w: tw, h: fs * 1.1 }; }
    if (hit(box) || ly > H - m) { ly = clamp(cy + fs * 0.3, fs + m, H - m); lx = clamp(cx + rx * 0.9, m, W - tw - m); box = { x: lx, y: ly - fs, w: tw, h: fs * 1.1 }; }
    boxes.push(box);
    const seed = (q.x * 97 + q.y * 31 + i) % 1;
    out.push({ id: c.id, why: c.why, cx, cy, rx, ry, text, lx, ly, fs, rot: (seed - 0.5) * 0.16, seed, a0: -1.9 + seed * 1.2 });
  }
  return out;
}
const RED = '#e3232c';
function ring(g, s, k, lw) {
  const n = 64, turns = 1.14, a0 = s.a0;
  g.beginPath();
  for (let i = 0; i <= n * k; i++) {
    const u = i / n, a = a0 + u * turns * TAU, j = 1 + 0.05 * Math.sin(u * 9 + s.seed * 7) + 0.07 * u;
    const x = s.cx + Math.cos(a) * s.rx * j, y = s.cy + Math.sin(a) * s.ry * j;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.lineWidth = lw; g.stroke();
}
// k: 0..1 across all the marks, drawn one after another like a hand would
export function drawMarks(g, spots, k = 1, W = 1200) {
  const n = spots.length; if (!n) return;
  const lw = Math.max(2, W * 0.0065);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  spots.forEach((s, i) => {
    const u = clamp(k * n - i); if (u <= 0) return;
    const ku = clamp(u / 0.6), kt = clamp((u - 0.55) / 0.45);
    g.strokeStyle = RED; g.globalAlpha = 0.92; ring(g, s, ku, lw);
    g.globalAlpha = 0.35; g.strokeStyle = '#ff6a5a'; ring(g, { ...s, rx: s.rx * 0.985, ry: s.ry * 0.985 }, ku, lw * 0.35);
    if (kt > 0) {
      g.globalAlpha = kt; g.save(); g.translate(s.lx, s.ly); g.rotate(s.rot);
      g.font = `${s.fs}px "Permanent Marker", "Titan One", sans-serif`; g.textBaseline = 'alphabetic';
      g.shadowColor = 'rgba(255,255,255,0.55)'; g.shadowBlur = s.fs * 0.12;
      g.fillStyle = RED; g.fillText(s.text, 0, 0);
      g.restore();
    }
  });
  g.restore();
}
