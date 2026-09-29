// The pool, alive: every surface is a row of little springs (four to a tile) that the hippo, the
// floats and the bomba push around, and the body is a see-through gradient laid over whatever is
// under it, so a hippo in the water is a hippo seen through water. Caustics ride on top.
import { WATER } from '../sim.js';
import { INK } from './paint.js';

const PER = 4;   // springs per tile

export class Pool {
  constructor(map) {
    this.map = map; this.t = 0;
    const { w, h, tiles } = map, isW = (c, r) => c >= 0 && c < w && r >= 0 && r < h && tiles[r * w + c] === WATER;
    this.isW = isW;
    // surfaces: runs of water tiles with air above
    this.surf = [];
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (!isW(c, r) || isW(c, r - 1) || (isW(c - 1, r) && !isW(c - 1, r - 1))) continue;
        let c1 = c; while (isW(c1 + 1, r) && !isW(c1 + 1, r - 1)) c1++;
        const n = (c1 + 1 - c) * PER + 1;
        this.surf.push({ r, c0: c, c1: c1 + 1, n, h: new Float32Array(n), v: new Float32Array(n) });
      }
    }
    // body runs, row by row
    this.rows = [];
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      if (!isW(c, r) || isW(c - 1, r)) continue;
      let c1 = c; while (isW(c1 + 1, r)) c1++;
      let depth = 0; while (depth < 30 && isW(c, r - depth - 1)) depth++;
      this.rows.push({ r, c0: c, c1: c1 + 1, top: !isW(c, r - 1), depth });
    }
  }
  surfaceAt(x, y) {   // the surface run under/around (x, y)
    let best = null;
    for (const s of this.surf) if (x >= s.c0 - 0.5 && x <= s.c1 + 0.5 && s.r >= y - 2 && (!best || Math.abs(s.r - y) < Math.abs(best.r - y))) best = s;
    return best;
  }
  level(s, x) {
    const i = (x - s.c0) * PER, i0 = Math.max(0, Math.min(s.n - 1, Math.floor(i))), i1 = Math.min(s.n - 1, i0 + 1), f = Math.max(0, Math.min(1, i - i0));
    return s.r + s.h[i0] * (1 - f) + s.h[i1] * f;
  }
  // push the surface at x: + is down
  poke(x, y, amt, radius = 0.8) {
    const s = this.surfaceAt(x, y); if (!s) return;
    const i0 = (x - s.c0) * PER, R = radius * PER;
    for (let i = Math.max(0, Math.floor(i0 - R)); i <= Math.min(s.n - 1, Math.ceil(i0 + R)); i++) {
      const d = Math.abs(i - i0) / R; if (d > 1) continue;
      s.v[i] += amt * (1 - d * d);
    }
  }
  step(dt) {
    this.t += dt;
    const k = 60, damp = 2.4, spread = 0.26;
    for (const s of this.surf) {
      const { h, v, n } = s;
      for (let i = 0; i < n; i++) { v[i] += (-k * h[i] - damp * v[i]) * dt; }
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < n; i++) {
          const l = i > 0 ? h[i - 1] : h[i], r = i < n - 1 ? h[i + 1] : h[i];
          v[i] += spread * (l + r - 2 * h[i]) * 60 * dt;
        }
      }
      for (let i = 0; i < n; i++) { h[i] += v[i] * dt; if (h[i] > 1.4) h[i] = 1.4; if (h[i] < -2.2) h[i] = -2.2; }
      // ambient chop
      const t = this.t;
      for (let i = 0; i < n; i += 1) h[i] += Math.sin(t * 2.1 + i * 0.55 + s.r) * 0.0009 + Math.sin(t * 3.3 - i * 0.31) * 0.0007;
    }
  }

  // ctx in tile units; view = { x0, y0, x1, y1 } in tiles
  draw(ctx, view, px) {
    const t = this.t;
    ctx.save();
    for (const row of this.rows) {
      if (row.r > view.y1 || row.r + 1 < view.y0 || row.c1 < view.x0 || row.c0 > view.x1) continue;
      const surf = row.top ? this.surf.find((s) => s.r === row.r && row.c0 <= row.c0 && s.c1 >= row.c1) : null;
      const d0 = row.depth, g = ctx.createLinearGradient(0, row.r, 0, row.r + 1);
      g.addColorStop(0, depthCol(d0)); g.addColorStop(1, depthCol(d0 + 1));
      ctx.fillStyle = g;
      ctx.beginPath();
      if (surf) {
        const a = Math.max(row.c0, view.x0 - 1), b = Math.min(row.c1, view.x1 + 1);
        ctx.moveTo(a, row.r + 1.001);
        for (let x = a; x <= b + 1e-6; x += 1 / PER) ctx.lineTo(x, this.level(surf, x));
        ctx.lineTo(b, row.r + 1.001); ctx.closePath();
      } else ctx.rect(Math.max(row.c0, view.x0 - 1), row.r - 0.002, Math.min(row.c1, view.x1 + 1) - Math.max(row.c0, view.x0 - 1), 1.004);
      ctx.fill();
    }
    // caustics: light nets in the top two tiles of every pool
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 0.05; ctx.lineCap = 'round';
    for (const s of this.surf) {
      if (s.c1 < view.x0 || s.c0 > view.x1 || s.r > view.y1 || s.r + 4 < view.y0) continue;
      for (let layer = 0; layer < 3; layer++) {
        const y = s.r + 0.45 + layer * 0.7;
        ctx.strokeStyle = `rgba(190,245,255,${0.2 - layer * 0.05})`;
        ctx.beginPath();
        const a = Math.max(s.c0, view.x0 - 1), b = Math.min(s.c1, view.x1 + 1);
        for (let x = a; x <= b; x += 0.9) {
          const ph = t * (1.1 + 0.2 * layer) + x * 1.7 + layer * 2;
          const yy = y + Math.sin(ph) * 0.12;
          ctx.moveTo(x, yy); ctx.quadraticCurveTo(x + 0.25, yy - 0.18 + Math.sin(ph * 1.3) * 0.08, x + 0.55, yy + Math.cos(ph) * 0.1);
        }
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    // the surface: a white highlight line, a lighter band under it
    for (const s of this.surf) {
      if (s.c1 < view.x0 || s.c0 > view.x1) continue;
      const a = Math.max(s.c0, view.x0 - 1), b = Math.min(s.c1, view.x1 + 1);
      ctx.beginPath();
      for (let x = a; x <= b + 1e-6; x += 1 / PER) ctx.lineTo(x, this.level(s, x) + 0.12);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 0.22; ctx.stroke();
      ctx.beginPath();
      for (let x = a; x <= b + 1e-6; x += 1 / PER) ctx.lineTo(x, this.level(s, x));
      ctx.strokeStyle = INK.foam; ctx.lineWidth = 0.07; ctx.stroke();
      // glints
      ctx.fillStyle = '#FFFFFF';
      for (let x = Math.ceil(a); x < b; x += 1) {
        const ph = (t * 0.6 + x * 0.37) % 1;
        if (ph < 0.5) { const aa = Math.sin(ph * Math.PI * 2) * 0.8; ctx.globalAlpha = Math.max(0, aa); ctx.fillRect(x + 0.3, this.level(s, x + 0.3) + 0.05, 0.35, 0.05); }
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}
function depthCol(d) {
  const f = Math.min(1, d / 5);
  const a = [110, 214, 236], b = [30, 120, 178];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * f));
  return `rgba(${c[0]},${c[1]},${c[2]},${0.62 + 0.2 * f})`;
}
