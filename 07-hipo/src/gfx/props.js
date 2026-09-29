// Everything at the pool that moves or reacts: the plastic chairs that give way, the parasols that
// boing, the floats and the croc riding the water, the springboards, the showers, the gaseosa, the
// PREMIO sticks and the towels. Drawn every frame in tile units from the sim's own lists.
import { INK, rr, ell, popText, star5 } from './paint.js';
import { TAU, clamp, lerp } from '../util.js';

export class Props {
  constructor(sim, pool) {
    this.sim = sim; this.pool = pool; this.t = 0;
    const solidBelow = (x, y) => { let r = Math.ceil(y); while (r < sim.h && sim.tile(Math.floor(x), r) === 0) r++; return r; };
    for (const p of sim.plats) { p._ground = solidBelow((p.x0 + p.x1) / 2, p.top + 0.5); p._pop = 0; }
    this.solidBelow = solidBelow;
    this.stickFx = []; this.towelT = new Map(); this.fizzPop = new Map(); this.drinkT = new Map(); this.guardBlow = new Map();
  }
  event(e) {
    if (e.k === 'towel') this.towelT.set(e.w, this.t);
    if (e.k === 'fizzBack') this.fizzPop.set(e.z, this.t);
    if (e.k === 'drink') this.drinkT.set(e.f, this.t);
    if (e.k === 'whistle') this.guardBlow.set(e.g, this.t);
    if (e.k === 'chairBack') e.p._pop = this.t;
  }
  update(dt) { this.t += dt; }

  // the springboard's drawn bend at x (tiles, + is down)
  bend(p, x) {
    const u = clamp(p.anchor < 0 ? (x - p.x0) / (p.x1 - p.x0) : (p.x1 - x) / (p.x1 - p.x0));
    return u * u * p.d * 2.2;
  }

  drawBack(ctx, view) {
    const s = this.sim;
    for (const p of s.plats) {
      if (p.x1 < view.x0 - 3 || p.x0 > view.x1 + 3) continue;
      if (p.kind === 'parasol') this.parasol(ctx, p);
      else if (p.kind === 'chair') this.chair(ctx, p);
      else if (p.kind === 'board') this.board(ctx, p);
    }
    for (const sh of s.showers) this.spray(ctx, sh);
    for (const f of s.fountains) this.fountainJet(ctx, f);
    for (const z of s.fizz) this.bottle(ctx, z);
    for (const w of s.towels) this.towel(ctx, w);
  }
  drawFloats(ctx, view) {
    for (const p of this.sim.plats) {
      if (p.x1 < view.x0 - 3 || p.x0 > view.x1 + 3) continue;
      if (p.kind === 'float') this.float(ctx, p);
      else if (p.kind === 'croc') this.croc(ctx, p);
    }
  }
  drawFront(ctx, view) {
    for (const k of this.sim.sticks) this.stick(ctx, k);
  }

  // ---------- pieces ----------
  parasol(ctx, p) {
    const cx = (p.x0 + p.x1) / 2, top = p.top, w = p.x1 - p.x0 + 0.5, d = p.d;
    const sq = d * 0.45;
    // pole to the ground
    ctx.strokeStyle = INK.key; ctx.lineWidth = 0.2; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(cx, top - 0.3); ctx.lineTo(cx, p._ground); ctx.stroke();
    ctx.strokeStyle = '#EDEFF2'; ctx.lineWidth = 0.11; ctx.stroke();
    // canopy
    ctx.save(); ctx.translate(cx, top + 0.15 + sq * 0.5); ctx.scale(1 + sq * 0.25, 1 - sq);
    const hw = w / 2, apex = -1.05, n = 8;
    ctx.beginPath(); ctx.moveTo(-hw, 0.1); ctx.quadraticCurveTo(-hw * 0.7, apex, 0, apex); ctx.quadraticCurveTo(hw * 0.7, apex, hw, 0.1);
    for (let i = n; i > 0; i--) { const x0 = -hw + (i / n) * w, x1 = -hw + ((i - 1) / n) * w; ctx.quadraticCurveTo((x0 + x1) / 2, 0.4, x1, 0.1); }
    ctx.closePath();
    ctx.lineWidth = 0.06; ctx.strokeStyle = INK.key; ctx.stroke();
    ctx.save(); ctx.clip();
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? INK.white : INK.blue;
      ctx.beginPath(); ctx.moveTo(0, apex - 0.1); ctx.lineTo(-hw + (i / n) * w - 0.05, 0.5); ctx.lineTo(-hw + ((i + 1) / n) * w + 0.05, 0.5); ctx.closePath(); ctx.fill();
    }
    const g = ctx.createRadialGradient(-hw * 0.4, apex * 0.8, 0.05, 0, -0.2, w * 0.7);
    g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(20,20,60,0.25)');
    ctx.fillStyle = g; ctx.fillRect(-hw - 1, apex - 1, w + 2, 2.5);
    ctx.restore();
    ctx.fillStyle = INK.white; ell(ctx, 0, apex - 0.05, 0.12, 0.08); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  chair(ctx, p) {
    const x0 = p.x0, x1 = p.x1, y = p.top, gy = p._ground, t = this.sim.t;
    let rot = 0, drop = 0, alpha = 1;
    if (p.state === 'shake') rot = Math.sin(p.t * 70) * 0.05 * (0.4 + p.t / 0.5);
    if (p.state === 'broken') { drop = Math.min(1, p.t * 6); alpha = p.t > 3.2 ? 1 - (p.t - 3.2) / 0.8 : 1; }
    const pop = this.t - p._pop < 0.3 ? 1 + 0.25 * Math.sin((this.t - p._pop) / 0.3 * Math.PI) : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, alpha);
    const cx = (x0 + x1) / 2;
    ctx.translate(cx, gy); ctx.rotate(rot); ctx.scale(pop, pop); ctx.translate(-cx, -gy);
    const legH = (gy - y) * (1 - drop);
    const sy = gy - legH - 0.02;
    const white = '#FBFBF7', key = INK.key;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // legs (splayed flat when broken)
    for (const [lx, dir] of [[x0 + 0.2, -1], [x1 - 0.2, 1], [x0 + 0.55, -1], [x1 - 0.55, 1]]) {
      ctx.strokeStyle = key; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.moveTo(lx, sy + 0.1); ctx.lineTo(lx + dir * (0.12 + drop * 1.1), gy - 0.05 + drop * 0.02); ctx.stroke();
      ctx.strokeStyle = white; ctx.lineWidth = 0.12; ctx.stroke();
    }
    // backrest on the right, armrests
    const back = [[x1 - 0.2, sy], [x1 - 0.05, sy - 1.9 * (1 - drop * 0.7)]];
    ctx.beginPath(); ctx.moveTo(x1 - 0.35, sy); ctx.quadraticCurveTo(x1 + 0.15, sy - 1, x1 - 0.05, back[1][1]);
    ctx.lineTo(x1 - 0.65, back[1][1] + 0.1); ctx.quadraticCurveTo(x1 - 0.55, sy - 0.8, x1 - 0.8, sy); ctx.closePath();
    ctx.fillStyle = white; ctx.lineWidth = 0.05; ctx.strokeStyle = key; ctx.stroke(); ctx.fill();
    ctx.fillStyle = 'rgba(120,130,150,0.35)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); rr(ctx, x1 - 0.55, back[1][1] + 0.3 + i * 0.35, 0.28, 0.12, 0.05); ctx.fill(); }
    ctx.beginPath(); rr(ctx, x0 - 0.05, sy, x1 - x0 + 0.1, 0.22, 0.1); ctx.fillStyle = white; ctx.stroke(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x0 + 0.1, sy + 0.04, x1 - x0 - 0.4, 0.04);
    ctx.strokeStyle = key; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.moveTo(x0 + 0.05, sy - 0.05); ctx.quadraticCurveTo(x0 - 0.05, sy - 0.7, x0 + 0.4, sy - 0.75); ctx.lineTo(x1 - 0.6, sy - 0.8); ctx.stroke();
    ctx.strokeStyle = white; ctx.lineWidth = 0.08; ctx.stroke();
    // cracks while it gives
    if (p.state === 'shake' && p.t > 0.15) {
      ctx.strokeStyle = key; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(x0 + 0.3, sy + 0.2); ctx.lineTo(x0 + 0.38, sy + 0.45); ctx.lineTo(x0 + 0.3, sy + 0.62); ctx.stroke();
    }
    ctx.restore();
  }
  board(ctx, p) {
    const len = p.x1 - p.x0, y = p.top, a = p.anchor;
    const ax = a < 0 ? p.x0 : p.x1, tx = a < 0 ? p.x1 : p.x0;
    // fulcrum near the anchor, a red block
    const fx = ax - a * 0.2 * len;
    ctx.beginPath(); ctx.moveTo(fx - 0.5, y + 1.4); ctx.lineTo(fx - 0.25, y + 0.3); ctx.lineTo(fx + 0.25, y + 0.3); ctx.lineTo(fx + 0.5, y + 1.4); ctx.closePath();
    ctx.fillStyle = INK.red; ctx.lineWidth = 0.05; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(fx - 0.2, y + 0.35, 0.1, 1);
    // the plank, bent
    const N = 16, pts = [];
    for (let i = 0; i <= N; i++) { const u = i / N, x = lerp(ax, tx, u); pts.push([x, y + this.bend(p, x)]); }
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, yy] of pts) ctx.lineTo(x, yy);
    for (let i = N; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + 0.34);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y, 0, y + 0.34); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#C9D2DC');
    ctx.fillStyle = g; ctx.lineWidth = 0.05; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
    ctx.beginPath(); for (let i = 0; i <= N; i++) ctx.lineTo(pts[i][0], pts[i][1] + 0.17); ctx.strokeStyle = INK.blue; ctx.lineWidth = 0.09; ctx.stroke();
    // non-slip grit on top
    ctx.strokeStyle = 'rgba(40,60,110,0.35)'; ctx.lineWidth = 0.02;
    ctx.beginPath(); for (let i = 1; i < N; i += 2) { ctx.moveTo(pts[i][0], pts[i][1] + 0.03); ctx.lineTo(pts[i + 1][0], pts[i + 1][1] + 0.03); } ctx.stroke();
  }
  float(ctx, p) {
    const x0 = p.x0, x1 = p.x1, y = p.top, w = x1 - x0, cx = (x0 + x1) / 2;
    const wob = Math.sin(this.sim.t * 2.4 + x0) * 0.03;
    ctx.save(); ctx.translate(cx, y + 0.35 + wob); ctx.rotate(Math.sin(this.sim.t * 1.7 + x0) * 0.03);
    // ring, seen from the side: an outer body and the dark hole
    ctx.beginPath(); ctx.ellipse(0, 0, w / 2 + 0.1, 0.42, 0, 0, TAU);
    const g = ctx.createLinearGradient(0, -0.42, 0, 0.42); g.addColorStop(0, '#FFF3A6'); g.addColorStop(0.35, INK.yellow); g.addColorStop(1, '#D9A21E');
    ctx.fillStyle = g; ctx.lineWidth = 0.055; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -0.12, w / 2 - 0.55, 0.13, 0, 0, TAU); ctx.fillStyle = 'rgba(40,70,110,0.55)'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ell(ctx, -w * 0.2, -0.27, w * 0.18, 0.05); ctx.fill();
    // the duck's head at the front
    const hx = w / 2 - 0.25;
    ctx.beginPath(); ctx.moveTo(hx - 0.25, -0.1); ctx.quadraticCurveTo(hx - 0.35, -0.85, hx + 0.05, -0.95); ctx.quadraticCurveTo(hx + 0.45, -0.95, hx + 0.35, -0.35); ctx.lineTo(hx + 0.2, -0.05); ctx.closePath();
    ctx.fillStyle = INK.yellow; ctx.stroke(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + 0.28, -0.72); ctx.quadraticCurveTo(hx + 0.75, -0.7, hx + 0.62, -0.55); ctx.quadraticCurveTo(hx + 0.4, -0.52, hx + 0.3, -0.58); ctx.closePath();
    ctx.fillStyle = INK.orange; ctx.stroke(); ctx.fill();
    ctx.fillStyle = INK.key; ell(ctx, hx + 0.12, -0.78, 0.045, 0.055); ctx.fill();
    ctx.fillStyle = '#fff'; ell(ctx, hx + 0.13, -0.8, 0.015, 0.015); ctx.fill();
    ctx.restore();
  }
  croc(ctx, p) {
    const x0 = p.x0, x1 = p.x1, y = p.top, w = x1 - x0, cx = (x0 + x1) / 2;
    const bite = p.cd > 0 ? Math.sin(clamp(1.2 - p.cd) / 1.2 * Math.PI) : 0;
    ctx.save(); ctx.translate(cx, y + 0.3 + Math.sin(this.sim.t * 2 + x0) * 0.03);
    const G = '#3FAE5A', GD = '#237A3A';
    // body and tail
    ctx.beginPath(); ctx.moveTo(-w / 2 - 0.6, -0.05); ctx.quadraticCurveTo(-w / 2, -0.45, -w / 2 + 0.6, -0.3);
    ctx.lineTo(w / 2 - 0.4, -0.35); ctx.quadraticCurveTo(w / 2, -0.3, w / 2, 0.1); ctx.quadraticCurveTo(0, 0.55, -w / 2 + 0.3, 0.3); ctx.closePath();
    const g = ctx.createLinearGradient(0, -0.45, 0, 0.4); g.addColorStop(0, '#8FDD8F'); g.addColorStop(0.4, G); g.addColorStop(1, GD);
    ctx.fillStyle = g; ctx.lineWidth = 0.055; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
    for (let i = 0; i < 5; i++) { const bx = -w / 2 + 0.8 + i * (w - 1.4) / 4; ctx.beginPath(); ctx.moveTo(bx - 0.15, -0.3); ctx.lineTo(bx, -0.5); ctx.lineTo(bx + 0.15, -0.3); ctx.fillStyle = GD; ctx.fill(); }
    ctx.fillStyle = '#F6E7A0'; ell(ctx, 0, 0.18, w * 0.35, 0.1); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(ctx, -w * 0.15, -0.22, w * 0.2, 0.05); ctx.fill();
    // the head with its grin; it snaps when the hippo lands on it
    ctx.save(); ctx.translate(w / 2 - 0.2, -0.2);
    ctx.rotate(-0.35 * bite);
    ctx.beginPath(); ctx.moveTo(-0.3, -0.25); ctx.quadraticCurveTo(0.5, -0.45, 1.25, -0.12); ctx.quadraticCurveTo(1.35, 0.02, 1.2, 0.05); ctx.lineTo(-0.2, 0.1); ctx.closePath();
    ctx.fillStyle = G; ctx.stroke(); ctx.fill();
    ctx.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0.1 + i * 0.22, 0.08); ctx.lineTo(0.2 + i * 0.22, 0.2); ctx.lineTo(0.3 + i * 0.22, 0.08); ctx.fill(); }
    ctx.fillStyle = '#fff'; ell(ctx, 0.1, -0.42, 0.13, 0.15); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK.key; ell(ctx, 0.14, -0.42, 0.05, 0.08); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(w / 2 - 0.4, 0.05); ctx.quadraticCurveTo(w / 2 + 0.5, 0.35 - 0.1 * bite, w / 2 + 1.0, 0.12); ctx.strokeStyle = INK.key; ctx.lineWidth = 0.05; ctx.stroke();
    ctx.restore();
  }
  spray(ctx, s) {
    const t = this.sim.t, x0 = s.x0, x1 = s.x1, y0 = s.y0, y1 = s.y1;
    ctx.save();
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(200,240,255,0.35)'); g.addColorStop(1, 'rgba(200,240,255,0.08)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0 + 0.1, y0); ctx.lineTo(x1 - 0.1, y0); ctx.lineTo(x1 + 0.15, y1); ctx.lineTo(x0 - 0.15, y1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(235,250,255,0.85)'; ctx.lineWidth = 0.035; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const u = (i + 0.5) / 7, xa = lerp(x0 + 0.1, x1 - 0.1, u), xb = lerp(x0 - 0.15, x1 + 0.15, u);
      for (let k = 0; k < 3; k++) {
        const f = ((t * 3.2 + i * 0.37 + k / 3) % 1), f2 = Math.min(1, f + 0.12);
        ctx.moveTo(lerp(xa, xb, f), lerp(y0, y1, f)); ctx.lineTo(lerp(xa, xb, f2), lerp(y0, y1, f2));
      }
    }
    ctx.stroke();
    // splash where it lands
    ctx.fillStyle = 'rgba(235,250,255,0.8)';
    for (let i = 0; i < 5; i++) { const ph = (t * 2.6 + i * 0.21) % 1; ell(ctx, lerp(x0 - 0.1, x1 + 0.1, (i + 0.5) / 5) + Math.sin(i * 7) * 0.1, y1 - 0.1 - ph * 0.35, 0.04, 0.04); ctx.globalAlpha = 1 - ph; ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  fountainJet(ctx, f) {
    const t0 = this.drinkT.get(f), on = t0 != null && this.t - t0 < 1.2;
    const x = f.x + 0.1, y = f.y - 1.8;
    if (!on && f.dw <= 0) return;
    ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 0.06; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 0.3, y - 0.5, x - 0.55, y - 0.05); ctx.stroke();
  }
  bottle(ctx, z) {
    if (z.gone > 0) return;
    const pt = this.fizzPop.get(z), pop = pt != null && this.t - pt < 0.35 ? 1 + 0.4 * Math.sin((this.t - pt) / 0.35 * Math.PI) : 1;
    const x = z.x, y = z.y + 0.5, bob = Math.sin(this.sim.t * 3 + x) * 0.03;
    ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop); ctx.rotate(Math.sin(this.sim.t * 2.2 + x) * 0.04);
    ctx.beginPath();
    ctx.moveTo(-0.22, 0); ctx.lineTo(-0.22, -0.7); ctx.quadraticCurveTo(-0.22, -0.95, -0.08, -1.05); ctx.lineTo(-0.08, -1.3); ctx.lineTo(0.08, -1.3); ctx.lineTo(0.08, -1.05); ctx.quadraticCurveTo(0.22, -0.95, 0.22, -0.7); ctx.lineTo(0.22, 0); ctx.closePath();
    const g = ctx.createLinearGradient(-0.22, 0, 0.22, 0); g.addColorStop(0, 'rgba(210,240,230,0.9)'); g.addColorStop(0.35, 'rgba(250,255,252,0.95)'); g.addColorStop(1, 'rgba(160,200,190,0.9)');
    ctx.fillStyle = g; ctx.lineWidth = 0.045; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
    ctx.fillStyle = INK.blue; ctx.fillRect(-0.22, -0.62, 0.44, 0.3);
    ctx.fillStyle = INK.yellow; ctx.fillRect(-0.22, -0.52, 0.44, 0.08);
    ctx.fillStyle = INK.red; ctx.fillRect(-0.1, -1.36, 0.2, 0.08);
    // bubbles
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 4; i++) { const ph = (this.sim.t * 0.8 + i * 0.27) % 1; ell(ctx, -0.1 + (i % 3) * 0.09, -0.1 - ph * 0.85 + bob, 0.025, 0.025); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-0.15, -0.95, 0.05, 0.85);
    ctx.restore();
  }
  towel(ctx, w) {
    const t0 = this.towelT.get(w), laid = w.laid, u = laid ? clamp((this.t - (t0 ?? -9)) / 0.45) : 0;
    const x = w.x, y = w.y, len = lerp(0.9, 2.6, u < 1 ? 1 - (1 - u) ** 3 : 1);
    const cols = [INK.red, INK.white, INK.yellow, INK.white, INK.blue];
    if (u <= 0) {   // rolled up, standing by
      ctx.save(); ctx.translate(x, y);
      ctx.beginPath(); rr(ctx, -0.45, -0.36, 0.9, 0.36, 0.16); ctx.fillStyle = INK.white; ctx.lineWidth = 0.05; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = cols[i % 2 ? 0 : 4]; ctx.fillRect(-0.35 + i * 0.22, -0.34, 0.08, 0.32); }
      ctx.beginPath(); ctx.ellipse(0.45, -0.18, 0.1, 0.18, 0, 0, TAU); ctx.fillStyle = '#E8E0CC'; ctx.fill(); ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.save(); ctx.translate(x, y);
    const n = 5, h = 0.1;
    for (let i = 0; i < n; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(-len / 2 + i * len / n, -h, len / n + 0.005, h); }
    ctx.strokeStyle = INK.key; ctx.lineWidth = 0.04; ctx.strokeRect(-len / 2, -h, len, h);
    // fringe
    ctx.strokeStyle = '#E8E0CC'; ctx.lineWidth = 0.02; ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(-len / 2, -h + 0.02 + i * 0.025); ctx.lineTo(-len / 2 - 0.1, -h + 0.02 + i * 0.025); ctx.moveTo(len / 2, -h + 0.02 + i * 0.025); ctx.lineTo(len / 2 + 0.1, -h + 0.02 + i * 0.025); } ctx.stroke();
    ctx.restore();
  }
  stick(ctx, k) {
    const t = this.sim.t;
    if (k.got) return;
    const x = k.x, y = k.y + Math.sin(t * 2.6 + k.x) * 0.1, rot = Math.sin(t * 1.9 + k.y) * 0.14;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    // glow
    const g = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1.1); g.addColorStop(0, 'rgba(255,240,170,0.55)'); g.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = g; ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
    ctx.beginPath(); rr(ctx, -0.2, -0.62, 0.4, 1.24, 0.2);
    const wg = ctx.createLinearGradient(-0.2, 0, 0.2, 0); wg.addColorStop(0, '#E2B87C'); wg.addColorStop(0.4, '#F7DDAA'); wg.addColorStop(1, '#C9975A');
    ctx.fillStyle = wg; ctx.lineWidth = 0.05; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
    ctx.save(); ctx.rotate(-Math.PI / 2); ctx.fillStyle = '#9A5A2A'; ctx.font = '800 0.22px Kanit, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PREMIO', 0, 0.01); ctx.restore();
    // sparkle
    const sp = (t * 0.7 + k.x * 0.13) % 1;
    if (sp < 0.3) { ctx.fillStyle = '#fff'; ctx.globalAlpha = Math.sin(sp / 0.3 * Math.PI); star5(ctx, 0.15, -0.5, 0.18, t); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
  }
}
