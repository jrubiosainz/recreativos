// What people say, over their heads: white cards with the station's blue ink; yours are yellow like
// your raincoat. Anchored to whoever says it, kept inside the screen (a warning from behind you sits
// at the bottom edge), and a newer line from the same person replaces the old one.
import { clamp } from '../util.js';
import { PAL, rrect } from './paint.js';
import { FONT } from './station.js';

export class Bubbles {
  constructor() { this.list = []; }
  clear() { this.list.length = 0; }
  add(who, text, now, o = {}) {
    if (!text) return;
    const at = now + (o.delay || 0);
    this.list = this.list.filter((b) => b.who !== who || b.t0 > at);
    this.list.push({ who, text, t0: at, dur: o.dur ?? Math.max(1.05, 0.55 + text.length * 0.045), you: who === 'you', big: !!o.big, low: !!o.low });
  }
  // where(who) → [screen x, screen y of the head top, px per metre] or null (off camera)
  draw(g, now, where, W, H, top) {
    this.list = this.list.filter((b) => now < b.t0 + b.dur);
    const placed = [];
    for (const b of this.list) {
      const age = now - b.t0;
      if (age < 0) continue;
      let p = where(b.who);
      const off = !p;
      if (off && !b.low) continue;
      if (off) p = [W / 2, H - 70, 60];
      const fs = clamp(p[2] * (b.big ? 0.24 : 0.19), b.big ? 15 : 13, b.big ? 24 : 19);
      g.font = `800 ${fs}px ${FONT}`;
      const tw = g.measureText(b.text).width, bw = tw + fs * 1.0, bh = fs * 1.62;
      let x = clamp(p[0], bw / 2 + 8, W - bw / 2 - 8), y = p[1] - bh - fs * 0.5;
      y = clamp(y, top + 6, H - bh - 10);
      for (const q of placed) if (Math.abs(q[0] - x) < (q[2] + bw) / 2 && Math.abs(q[1] - y) < bh) y = q[1] - bh - 4;
      placed.push([x, y, bw]);
      const k = clamp(age / 0.11), out = clamp((b.t0 + b.dur - now) / 0.2), sc = 0.86 + 0.14 * (1 - (1 - k) * (1 - k));
      g.save();
      g.globalAlpha = Math.min(k * 1.6, out);
      g.translate(x, y + bh); g.scale(sc, sc); g.translate(-x, -y - bh);
      const col = b.you ? PAL.yellow : '#fbfaf6', ink = b.you ? '#1d2233' : PAL.band;
      // the tail points at the speaker's head (or down, for someone behind you)
      const tx = clamp(p[0], x - bw / 2 + fs * 0.6, x + bw / 2 - fs * 0.6);
      g.beginPath(); g.moveTo(tx - fs * 0.32, y + bh - 1); g.lineTo(tx + fs * 0.32, y + bh - 1); g.lineTo(tx + (off ? 0 : clamp(p[0] - tx, -fs, fs) * 0.4), y + bh + fs * 0.45); g.closePath();
      g.fillStyle = col; g.fill();
      rrect(g, x - bw / 2, y, bw, bh, fs * 0.36); g.fill();
      g.lineWidth = 1.5; g.strokeStyle = b.you ? '#d5a20c' : '#c9ccd4'; g.stroke();
      g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(b.text, x, y + bh / 2 + fs * 0.04);
      g.restore();
    }
  }
}
