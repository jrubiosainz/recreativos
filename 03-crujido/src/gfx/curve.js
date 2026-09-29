// Your film on one strip: the loudest noise nobody would have noticed, second by second (the
// cover the film gave you), and every sound you made on top of it. Under the curve, hidden;
// above it, heard. Drawn live on the result screen (u sweeps 0..1) and once for the share card.
import { clamp, backOut, text, rr } from './paint.js';

const LO = 40, HI = 92;

// data: { curve: dB at `hz`, hz, end, crunches: [{ t, L, heard, kind }], shush: [t], why }
export function drawCurve(g, x, y, w, h, data, { u = 1, dpr = 1, labels = null } = {}) {
  const { curve, hz, end, crunches, shush, why } = data;
  const s = h / 150, pad = 8 * s, now = u * end;
  const X = (tt) => x + pad + clamp(tt / Math.max(1, end)) * (w - 2 * pad), Y = (L) => y + h * (1 - (clamp(L, LO, HI) - LO) / (HI - LO));
  g.save();
  g.fillStyle = '#0b1020'; rr(g, x, y, w, h, 8 * s); g.fill();
  g.beginPath(); rr(g, x, y, w, h, 8 * s); g.clip();
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
  for (let L = LO + 6; L < HI; L += 6) { g.beginPath(); g.moveTo(x, Y(L)); g.lineTo(x + w, Y(L)); g.stroke(); }
  // the film's cover, revealed left to right
  const n = Math.min(curve.length, Math.ceil(now * hz) + 1);
  if (n > 1) {
    g.save();
    g.beginPath(); g.moveTo(X(0), y + h);
    for (let i = 0; i < n; i++) g.lineTo(X(i / hz), Y(Number.isFinite(curve[i]) ? curve[i] : HI));
    g.lineTo(X((n - 1) / hz), y + h); g.closePath();
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, 'rgba(255,196,96,0.85)'); gr.addColorStop(0.55, 'rgba(232,120,48,0.45)'); gr.addColorStop(1, 'rgba(140,40,30,0.12)');
    g.fillStyle = gr; g.fill();
    g.beginPath();
    for (let i = 0; i < n; i++) { const yy = Y(Number.isFinite(curve[i]) ? curve[i] : HI); if (i) g.lineTo(X(i / hz), yy); else g.moveTo(X(0), yy); }
    g.strokeStyle = '#ffd98a'; g.lineWidth = 2 * s; g.lineJoin = 'round';
    g.shadowColor = 'rgba(255,170,60,0.8)'; g.shadowBlur = 6 * s; g.stroke();
    g.restore();
  }
  // shown out: the torch, and the rest of the film you never saw
  if (why === 'expelled' && u >= 1) {
    const xe = X(end);
    g.fillStyle = 'rgba(255,240,200,0.12)'; g.fillRect(xe - 3 * s, y, 6 * s, h);
  }
  // shushes along the top
  for (const ts of shush) {
    if (ts > now) continue;
    const k = backOut(clamp((now - ts) / (end * 0.05 + 0.01))), xs = X(ts);
    g.save(); g.globalAlpha = clamp(k);
    g.strokeStyle = 'rgba(232,37,47,0.55)'; g.lineWidth = 1.2 * s; g.setLineDash([3 * s, 3 * s]);
    g.beginPath(); g.moveTo(xs, y + 16 * s); g.lineTo(xs, y + h); g.stroke(); g.setLineDash([]);
    g.translate(xs, y + 10 * s); g.scale(k, k);
    g.fillStyle = '#e8252f'; rr(g, -9 * s, -6 * s, 18 * s, 12 * s, 6 * s); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 2.2 * s, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // every sound you made
  for (const c of crunches) {
    if (c.t > now) continue;
    const k = backOut(clamp((now - c.t) / (end * 0.03 + 0.01))), small = c.kind === 'rustle', r = (c.heard ? 4.6 : small ? 2.2 : 3.8) * s;
    g.save(); g.translate(X(c.t), Y(c.L)); g.scale(k, k);
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
    if (c.heard) { g.fillStyle = '#e8252f'; g.fill(); g.lineWidth = 1.4 * s; g.strokeStyle = '#fff4ec'; g.stroke(); }
    else { g.fillStyle = small ? 'rgba(255,211,94,0.7)' : '#ffd35e'; g.fill(); g.lineWidth = 1.2 * s; g.strokeStyle = '#2a1606'; g.stroke(); }
    g.restore();
  }
  g.restore();
  if (labels) legend(g, x, y + h + 8 * s, w, s, labels);
}

// the key under the strip (the share card draws its own; the result screen's is DOM)
function legend(g, x, y, w, s, L) {
  const size = Math.round(15 * s), font = `600 ${size}px Oswald, sans-serif`, cy = y + size * 0.6;
  g.save(); g.font = font;
  const items = [['film', L.film], ['hid', L.hid], ['heard', L.heard]], gap = 26 * s;
  const widths = items.map(([, s2]) => g.measureText(s2.toUpperCase()).width + 20 * s);
  let xx = x + (w - widths.reduce((a, b) => a + b, 0) - gap * 2) / 2;
  items.forEach(([k, str], i) => {
    if (k === 'film') { const gr = g.createLinearGradient(0, cy - 6 * s, 0, cy + 6 * s); gr.addColorStop(0, '#ffd98a'); gr.addColorStop(1, '#c0582e'); g.fillStyle = gr; g.fillRect(xx, cy - 6 * s, 12 * s, 12 * s); }
    else { g.beginPath(); g.arc(xx + 6 * s, cy, 5 * s, 0, Math.PI * 2); g.fillStyle = k === 'hid' ? '#ffd35e' : '#e8252f'; g.fill(); }
    text(g, str.toUpperCase(), xx + 18 * s, cy + 1, { font, fill: '#f3e6c8', align: 'left' });
    xx += widths[i] + gap;
  });
  g.restore();
}
