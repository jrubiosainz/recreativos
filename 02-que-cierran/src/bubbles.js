// Speech bubbles: what people say, drawn over the scene, so muted players (and every
// screenshot) still get the joke. Two slots: you (bottom left, in the line's colour)
// and everyone else (the passenger in the doorway, the car, a runner on the platform).
import { FONT, JP } from './fx.js';
import { LINE } from './car.js';
import { CAR_Z } from './cam.js';
import { clamp, roundRect, Spring } from './util.js';

const INK = '#1b1d26';

function wrap(g, text, maxW) {
  const words = text.split(/(\s+)/).filter((w) => w.trim()), lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (cur && g.measureText(next).width > maxW) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export class Bubbles {
  constructor(scene) { this.scene = scene; this.list = []; this.hidden = false; }
  add({ text, sub = '', who = '', loud = false, dur = 2, at = 'cur', side = 0 }) {
    if (!text) return;
    const slot = at === 'me' ? 'me' : 'them';
    for (const b of this.list) if (b.slot === slot && b.out == null) b.out = 0;
    const s = new Spring(0.15, 620, 15);
    this.list.push({ text, sub, who, loud, dur, at, side, slot, t: 0, s, out: null, lay: null, tilt: loud ? (Math.random() < 0.5 ? -1 : 1) * 0.035 : 0 });
  }
  clear() { this.list.length = 0; }
  update(dt) {
    for (const b of this.list) {
      b.t += dt;
      if (b.out == null && b.t >= b.dur) b.out = 0;
      if (b.out != null) b.out += dt;
      b.s.step(b.out != null ? 0.85 : 1, dt);
    }
    this.list = this.list.filter((b) => !(b.out != null && b.out > 0.22));
  }

  // where the tail points: a head, the doorway, a runner, or you (below the screen)
  tip(b) {
    const sc = this.scene, W = sc.W, H = sc.H;
    if (b.at === 'me') return { x: W * 0.5, y: H + 20, dir: 'me' };
    if (b.at === 'side') return { x: W * (0.5 + (b.side || 1) * 0.3), y: H * 0.7, dir: 'up' };
    const A = sc.anchor;
    if (b.at === 'cur' && A) return { x: A.x - A.s * 0.1, y: A.y - A.s * 0.72, dir: 'up' };
    const d = sc.doorTop(), s = sc.cam.s(CAR_Z);
    return { x: d.x + (b.side || 0) * s * 0.3, y: d.y + s * 0.28, dir: 'up' };
  }

  layout(g, b) {
    const sc = this.scene, W = sc.W, H = sc.H, port = H > W * 1.05;
    const fs = Math.round(clamp(Math.min(W, H) * (port ? 0.043 : 0.034), 14, 27));
    const jp = b.slot === 'me' || /[\u3040-\u30ff\u4e00-\u9fff]/.test(b.text);
    const main = `${b.loud ? 700 : 600} ${Math.round(fs * (jp ? 1.12 : 1))}px ${jp ? JP : FONT}`;
    const small = `600 ${Math.round(fs * 0.7)}px ${FONT}`;
    const maxW = Math.min(W * (port ? 0.72 : 0.4), fs * 17);
    g.font = main; const lines = wrap(g, b.text, maxW);
    let w = Math.max(...lines.map((l) => g.measureText(l).width));
    let subs = [];
    if (b.sub) { g.font = small; subs = wrap(g, b.sub, maxW); w = Math.max(w, ...subs.map((l) => g.measureText(l).width)); }
    const lh = fs * (jp ? 1.3 : 1.22), sh = fs * 0.92, px = fs * 0.72, py = fs * 0.5;
    return { W, H, fs, main, small, lines, subs, lh, sh, bw: w + px * 2, bh: lines.length * lh + subs.length * sh + py * 2 - fs * 0.12, px, py };
  }

  draw(g) {
    if (this.hidden || !this.list.length) return;
    const sc = this.scene;
    for (const b of this.list) {
      if (!b.lay || b.lay.W !== sc.W || b.lay.H !== sc.H) b.lay = this.layout(g, b);
      const L = b.lay, tip = this.tip(b), m = Math.round(L.fs * 0.6), top = (sc.safeTop || 0) + m;
      // the box sits above its tip; people in the doorway talk from its left, you from the bottom left
      let x = b.slot === 'me' ? Math.max(m, Math.min(sc.W * 0.5 - L.bw - L.fs * 0.8, sc.W * 0.08)) : tip.x - L.bw * (b.at === 'cur' ? 0.82 : 0.5);
      let y = b.slot === 'me' ? sc.H * 0.9 - L.bh : tip.y - L.fs * 1.1 - L.bh;
      if (b.slot === 'me' && sc.W < sc.H) { x = m; y = sc.H * 0.86 - L.bh; }
      x = clamp(x, m, sc.W - m - L.bw); y = clamp(y, top, sc.H - m - L.bh);
      const k = b.s.x, a = b.out != null ? 1 - b.out / 0.22 : Math.min(1, b.t / 0.06);
      const px = clamp(tip.x, x + L.fs, x + L.bw - L.fs), py = y + L.bh;
      g.save();
      g.globalAlpha = clamp(a);
      const jx = b.loud && b.t < 0.35 ? Math.sin(b.t * 90) * 1.6 : 0;
      g.translate(px + jx, py); g.rotate(b.tilt); g.scale(k, k); g.translate(-px, -py);
      const me = b.slot === 'me', fill = me ? LINE : b.loud ? '#fff3b8' : '#fffdf8', ink = INK;
      const r = Math.min(L.fs * 0.9, L.bh / 2), lw = Math.max(2, L.fs * (b.loud ? 0.16 : 0.11));
      // tail
      const tw = L.fs * 0.55, tx = clamp(tip.x, x + r + tw, x + L.bw - r - tw), ty = Math.min(tip.y, py + L.fs * 1.6);
      g.beginPath(); g.moveTo(tx - tw, py - 1); g.lineTo(me ? tx + L.fs * 1.4 : tip.x, Math.max(py + L.fs * 0.5, ty)); g.lineTo(tx + tw * 0.3, py - 1);
      g.closePath();
      g.fillStyle = 'rgba(10,8,24,0.28)'; g.save(); g.translate(0, lw); g.fill(); roundRect(g, x, y, L.bw, L.bh, r); g.fill(); g.restore();
      g.lineJoin = 'round'; g.strokeStyle = me ? '#0d2b26' : INK; g.lineWidth = lw;
      roundRect(g, x, y, L.bw, L.bh, r); g.fillStyle = fill; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(tx - tw, py - lw * 0.5); g.lineTo(me ? tx + L.fs * 1.4 : tip.x, Math.max(py + L.fs * 0.5, ty)); g.lineTo(tx + tw * 0.3, py - lw * 0.5);
      g.fill(); g.stroke();
      g.fillRect(tx - tw + lw * 0.6, py - lw * 1.6, tw * 1.3 - lw * 1.2, lw * 1.9);    // hide the box edge under the tail
      if (b.loud) {                                   // shout marks off the top corner
        const cx = b.tilt > 0 ? x + L.bw + L.fs * 0.1 : x - L.fs * 0.1, dir = b.tilt > 0 ? 1 : -1;
        g.strokeStyle = me ? '#ffffff' : INK; g.lineWidth = lw * 0.9; g.lineCap = 'round';
        for (let i = 0; i < 3; i++) { const an = -Math.PI / 2 + dir * (0.35 + i * 0.42); g.beginPath(); g.moveTo(cx + Math.cos(an) * L.fs * 0.35, y + Math.sin(an) * L.fs * 0.35); g.lineTo(cx + Math.cos(an) * L.fs * 0.85, y + Math.sin(an) * L.fs * 0.85); g.stroke(); }
      }
      g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
      let ly = y + L.py + L.lh / 2 - L.fs * 0.06;
      g.font = L.main; for (const l of L.lines) { g.fillText(l, x + L.bw / 2, ly); ly += L.lh; }
      if (L.subs.length) {
        g.font = L.small; g.fillStyle = me ? 'rgba(255,255,255,0.78)' : 'rgba(27,29,38,0.62)'; ly -= (L.lh - L.sh) / 2;
        for (const l of L.subs) { g.fillText(l, x + L.bw / 2, ly); ly += L.sh; }
      }
      g.restore();
    }
  }
}
