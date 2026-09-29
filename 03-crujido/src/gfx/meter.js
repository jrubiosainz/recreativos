// The loudness meter: a marquee of 16 bulbs lit up to how loud a sound may be right now without
// anyone near you noticing (the film, the snorer, the rain, minus how touchy they are), and a
// painted arrow at how loud your next bite will be. The light reaches the arrow: you are covered.
// Portrait: a red enamel bar under the screen. Landscape: a blade sign beside it.
import { bulb, clamp, lerp, rr, gilt, text, mix, fit } from './paint.js';

export const LO = 42, STEP = 3, N = 16;
export const frac = (dB) => clamp((dB - LO) / (STEP * N));

// what the arrow shows: the next bite, or the one after the swallow / the hand coming back
export function upcoming(sim, t) {
  const now = sim.next(t);
  if (now != null) return { L: now, live: true };
  if (sim.over) return null;
  const s = sim.state;
  if (s === 'chew') return { L: sim.snack.pattern[sim.i] - sim.soak, live: false };
  if (s === 'swallow') { const n = sim.combo[sim.piece + 1]; return n ? { L: n.pattern[0], live: false } : null; }
  if (s === 'fetch' || s === 'cough') return { L: s === 'cough' && sim.back === 'chew' ? sim.snack.pattern[sim.i] - sim.soak : sim.snack.pattern[0], live: false };
  return null;
}

export class Meter {
  constructor() { this.b = new Float32Array(N); this.arrow = null; this.ax = -1; this.safe = 0; this.vis = 0; this.gv = LO; }
  update(sim, t, dt) {
    const gv = sim.over ? -Infinity : sim.gauge(t);
    this.gv = gv;
    // filaments: the value is exact, only the glow has a little inertia (up 20 ms, down 70 ms)
    for (let k = 0; k < N; k++) {
      const on = Number.isFinite(gv) ? clamp((gv - (LO + STEP * k)) / STEP) : 0;
      this.b[k] += (on - this.b[k]) * (1 - Math.exp(-dt / (on > this.b[k] ? 0.02 : 0.07)));
    }
    const u = upcoming(sim, t);
    this.arrow = u;
    if (u) {
      const x = frac(u.L);
      this.ax = this.ax < 0 ? x : lerp(this.ax, x, 1 - Math.exp(-dt / 0.06));
      const safe = u.live && gv >= u.L ? 1 : 0;
      this.safe += (safe - this.safe) * (1 - Math.exp(-dt / 0.03));
    }
    this.vis += ((u ? (u.live ? 1 : 0.45) : 0) - this.vis) * (1 - Math.exp(-dt / 0.08));
  }

  draw(g, R, dpr, t) {
    if (R.dir === 'h') this.bar(g, R, dpr, t); else this.blade(g, R, dpr, t);
  }
  bar(g, R, dpr, t) {
    const { x, y, w, h } = R, r = h / 2;
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.5)'; rr(g, x + 2, y + 3, w, h, r); g.fill();
    g.fillStyle = gilt(g, x, y, x, y + h); rr(g, x, y, w, h, r); g.fill();
    const e = Math.max(2, h * 0.1), gr = g.createLinearGradient(0, y + e, 0, y + h - e);
    gr.addColorStop(0, '#9c1a22'); gr.addColorStop(0.5, '#6e0d16'); gr.addColorStop(1, '#3d060c');
    g.fillStyle = gr; rr(g, x + e, y + e, w - e * 2, h - e * 2, r - e); g.fill();
    const pad = h * 0.62, span = w - pad * 2, br = h * 0.25;
    for (let k = 0; k < N; k++) bulb(g, x + pad + (span * k) / (N - 1), y + h / 2, br, this.b[k], { dpr });
    // the arrow points down at the bar from the screen's edge
    if (this.arrow && this.vis > 0.02) {
      const ax = x + pad + span * clamp((this.ax * N - 0.5) / (N - 1)), s = h * 0.5;
      this.pointer(g, ax, y + e * 0.4, s, 'down');
    }
    g.restore();
  }
  blade(g, R, dpr, t) {
    const { x, y, w, h } = R, head = w * 1.05, bx = x + w * 0.16, bw = w * 0.68, by = y + head * 0.9, bh = h - head * 0.9;
    g.save();
    // the crest with the name, then the blade with the bulbs, bottom (quiet) to top (loud)
    g.fillStyle = 'rgba(0,0,0,0.5)'; rr(g, bx + 3, by + 4, bw, bh, bw * 0.2); g.fill();
    g.fillStyle = gilt(g, bx, 0, bx + bw, 0); rr(g, bx, by, bw, bh, bw * 0.2); g.fill();
    const e = Math.max(2, bw * 0.08), gr = g.createLinearGradient(bx, 0, bx + bw, 0);
    gr.addColorStop(0, '#3d060c'); gr.addColorStop(0.45, '#8e1620'); gr.addColorStop(1, '#3d060c');
    g.fillStyle = gr; rr(g, bx + e, by + e, bw - e * 2, bh - e * 2, bw * 0.16); g.fill();
    g.beginPath(); g.moveTo(bx + bw * 0.5, by + bh + w * 0.3); g.lineTo(bx + bw * 0.12, by + bh - 1); g.lineTo(bx + bw * 0.88, by + bh - 1); g.closePath();
    g.fillStyle = gilt(g, bx, 0, bx + bw, 0); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.5)'; rr(g, x + 3, y + 4, w, head, w * 0.18); g.fill();
    g.fillStyle = gilt(g, x, y, x, y + head); rr(g, x, y, w, head, w * 0.18); g.fill();
    g.fillStyle = '#6e0d16'; rr(g, x + e, y + e, w - e * 2, head - e * 2, w * 0.14); g.fill();
    const size = fit(g, 'CRUJIDO', w - e * 4, w * 0.3, (s) => `${s}px Limelight, serif`);
    text(g, 'CRUJIDO', x + w / 2, y + head / 2 + size * 0.05, { font: `${size}px Limelight, serif`, fill: '#ffd98a', stroke: '#2a0508', lw: Math.max(2, size * 0.12), shadow: 'rgba(255,170,60,0.8)', blur: size * 0.5 });
    for (let k = 0; k < 7; k++) bulb(g, x + e * 1.6 + ((w - e * 3.2) * k) / 6, y + head - e * 1.4, Math.max(1.5, w * 0.035), 0.55 + 0.45 * Math.max(0, Math.sin(t * 5 - k * 0.9)), { dpr, halo: false });
    const pad = bw * 0.52, span = bh - pad * 2, br = Math.min(bw * 0.3, span / (N - 1) * 0.42);
    for (let k = 0; k < N; k++) bulb(g, bx + bw / 2, by + bh - pad - (span * k) / (N - 1), br, this.b[k], { dpr });
    if (this.arrow && this.vis > 0.02) {
      const ay = by + bh - pad - span * clamp((this.ax * N - 0.5) / (N - 1));
      this.pointer(g, bx - e * 0.2, ay, bw * 0.5, 'right');
    }
    g.restore();
  }
  // where the arrowhead is on screen (the tutorial's note points at it), or null while hidden
  arrowAt(R) {
    if (!this.arrow || this.vis < 0.02) return null;
    const u = clamp((this.ax * N - 0.5) / (N - 1));
    if (R.dir === 'h') { const pad = R.h * 0.62; return { x: R.x + pad + (R.w - pad * 2) * u, y: R.y, left: R.x }; }
    const head = R.w * 1.05, bx = R.x + R.w * 0.16, bw = R.w * 0.68, by = R.y + head * 0.9, bh = R.h - head * 0.9, pad = bw * 0.52;
    const x = bx - Math.max(2, bw * 0.08) * 0.2;
    return { x, y: by + bh - pad - (bh - pad * 2) * u, left: x - bw * 0.5 * 0.9 };
  }
  // a painted arrowhead: red while your bite would be heard, gold and glowing once it is covered
  pointer(g, x, y, s, dir) {
    const k = this.safe, a = this.vis, fill = mix('#d8252f', '#ffd35e', k), glow = k * a;
    g.save(); g.globalAlpha = a;
    g.translate(x, y); if (dir === 'right') g.rotate(-Math.PI / 2);
    if (glow > 0.02) { g.shadowColor = 'rgba(255,200,90,0.95)'; g.shadowBlur = s * 1.6 * glow; }
    g.beginPath(); g.moveTo(0, s * 0.35); g.lineTo(-s * 0.72, -s * 0.9); g.quadraticCurveTo(0, -s * 0.62, s * 0.72, -s * 0.9); g.closePath();
    g.fillStyle = fill; g.fill();
    g.shadowBlur = 0; g.lineWidth = Math.max(1.5, s * 0.16); g.strokeStyle = '#1b0a06'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-s * 0.4, -s * 0.72); g.lineTo(-s * 0.08, -s * 0.66); g.lineTo(-s * 0.2, -s * 0.3); g.closePath(); g.fill();
    g.restore();
  }
}

// the letter board: how many pieces are left (the piece itself, painted) and your three warnings
export function board(g, R, { n, piece, strikes, dpr, t, flash = 0 }) {
  const { x, y, w, h } = R, e = Math.max(3, h * 0.12);
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.5)'; rr(g, x + 3, y + 4, w, h, h * 0.14); g.fill();
  g.fillStyle = '#6e0d16'; rr(g, x, y, w, h, h * 0.14); g.fill();
  const nb = Math.max(6, Math.round((w + h) / (h * 0.16)));
  for (let i = 0; i < nb; i++) {
    const u = i / nb, per = 2 * (w + h), d = u * per;
    const [bx, by] = d < w ? [x + d, y + e / 2] : d < w + h ? [x + w - e / 2, y + d - w] : d < 2 * w + h ? [x + w - (d - w - h), y + h - e / 2] : [x + e / 2, y + h - (d - 2 * w - h)];
    bulb(g, bx, by, Math.max(1.4, e * 0.3), 0.5 + 0.5 * ((i + Math.floor(t * 4)) % 3 === 0 ? 1 : 0.3), { dpr, halo: false });
  }
  const px = x + e, py = y + e, pw = w - e * 2, ph = h - e * 2;
  g.fillStyle = mix('#f1ead7', '#ffffff', flash); rr(g, px, py, pw, ph, ph * 0.08); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
  for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(px, py + (ph * i) / 3); g.lineTo(px + pw, py + (ph * i) / 3); g.stroke(); }
  const size = ph * 0.62, cy = py + ph * 0.5;
  text(g, String(n), px + pw * 0.2, cy + size * 0.04, { font: `600 ${size}px Oswald, sans-serif`, fill: '#141010' });
  if (piece) { const ih = ph * 0.72, iw = ih * piece.width / piece.height; g.drawImage(piece, px + pw * 0.44 - iw / 2, cy - ih / 2, iw, ih); }
  for (let i = 0; i < 3; i++) bulb(g, px + pw * (0.66 + i * 0.125), cy, Math.max(2.5, Math.min(ph * 0.17, pw * 0.055)), i < strikes ? 1 : 0, { dpr, tint: '#ff3b30' });
  g.restore();
}
