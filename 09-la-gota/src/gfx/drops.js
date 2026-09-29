// The drops: each one a tiny lens with the street upside down in it, a dark refracting edge, a glint up
// on the left and light pooled at the bottom. A running drop pulls into a teardrop along its track, a
// drop that just swallowed another wobbles, new beads swell out of the fog. On top of them, the marks
// that make the race readable: whose drop is whose, the ring your fingertip must never enter, the
// candidates breathing while everyone calls theirs.
import { K, YOU, NEUTRAL, PW, PH } from '../sim.js';
import { clamp, damp, ease, roundRect, TAU } from '../util.js';
import { F } from '../fonts.js';

export const KID_COL = { you: '#FFC23D', dani: '#FF5A4E', lucia: '#7CE0B8', iker: '#6FB7FF', vega: '#D08CFF' };
const INK = '#17161c';

// a drop, in its own frame: the bulb at the origin, the tail trailing up (−y) behind it
function dropPath(ctx, R, tail) {
  ctx.beginPath();
  if (tail < R * 0.06) { ctx.arc(0, 0, R, 0, TAU); return; }
  const T = R + tail;
  ctx.moveTo(0, -T);
  ctx.bezierCurveTo(R * 0.28, -T + tail * 0.45, R, -R * 0.62, R, 0);
  ctx.arc(0, 0, R, 0, Math.PI);
  ctx.bezierCurveTo(-R, -R * 0.62, -R * 0.28, -T + tail * 0.45, 0, -T);
  ctx.closePath();
}

export class DropArt {
  constructor() { this.vs = new Map(); this.bubbles = []; this.m = 0.24; this.sprites = new Map(); this.mat = typeof DOMMatrix === 'function' ? new DOMMatrix() : null; }
  reset() { this.vs.clear(); this.bubbles.length = 0; }
  st(id) { let v = this.vs.get(id); if (!v) this.vs.set(id, (v = { wob: 0, ph: 0, ang: 0, str: 0, pulse: Math.random() * 3 })); return v; }
  onEvent(e, sim) {
    if (e.k === 'merge') { const v = this.st(e.id); v.wob = Math.min(1.3, v.wob + (e.lost !== NEUTRAL ? 1 : 0.55)); v.ph = 0; }
    else if (e.k === 'call') this.bubbles.push({ own: e.own, id: e.id, t0: sim.time });
  }

  // ---------- the drops ----------
  draw(ctx, x0, y0, s, sim, cityC, dpr, dt) {
    const cs = cityC.width / (PW * s), now = sim.time, small = 5 * dpr;
    // one pattern of the street per frame: every lens fills its own outline with it, flipped and shrunk
    const pat = this.mat && cityC.width > 2 ? ctx.createPattern(cityC, 'no-repeat') : null;
    for (const d of sim.drops) {
      let x = d.x, y = d.y, k = 1;
      if (!d.alive) {
        const u = now - d.t0;
        if (d.gone === 'merged') {
          // the swallowed drop slides into the one that took it
          const b = sim.drop(d.by); if (!b || u > 0.09) continue;
          const w = ease.inQuad(u / 0.09); x += (b.x - x) * w; y += (b.y - y) * w; k = 1 - w * 0.7;
        } else if (d.gone === 'dried') { if (u > 0.4) continue; k = 1 - u / 0.4; }
        else continue;
      }
      if (d.fresh) k *= ease.outBack(clamp((now - d.born) / 0.35));
      const v = this.st(d.id);
      const sp = d.alive && !d.pin && d.fin < 0 ? Math.hypot(d.vx, d.vy) : 0;
      v.str = damp(v.str, clamp(sp * 0.22, 0, 1.3), sp > v.str ? 14 : 5, dt);
      if (sp > 0.05) { const a = Math.atan2(-d.vx, d.vy); v.ang += (Math.atan2(Math.sin(a - v.ang), Math.cos(a - v.ang))) * clamp(dt * 12); }
      v.wob *= Math.exp(-5 * dt); v.ph += dt * 27;
      const R = d.r * s * k; if (R < 0.4) continue;
      const P = { x: x0 + x * s, y: y0 + y * s };
      if (R < small) { this.bead(ctx, P, R); continue; }
      this.lens(ctx, P, R, v, pat, cs, x0, y0);
    }
  }
  bead(ctx, P, R) {
    ctx.fillStyle = 'rgba(14,20,34,0.34)'; ctx.beginPath(); ctx.arc(P.x, P.y + R * 0.18, R, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.arc(P.x, P.y, R * 0.82, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(P.x - R * 0.34, P.y - R * 0.36, Math.max(0.5, R * 0.3), 0, TAU); ctx.fill();
  }
  lens(ctx, P, R, v, pat, cs, x0, y0) {
    const tail = R * v.str, wob = v.wob * Math.sin(v.ph) * 0.15;
    ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(v.ang); ctx.scale(1 + wob, 1 - wob); dropPath(ctx, R, tail); ctx.restore();
    ctx.fillStyle = '#39445c'; ctx.fill();
    if (pat) {
      // the street seen through the drop: upside down, shrunk m times about the drop's centre
      const m = this.m, M = this.mat, k = -m / cs;
      M.a = k; M.b = 0; M.c = 0; M.d = k; M.e = P.x * (1 + m) - m * x0; M.f = P.y * (1 + m) - m * y0;
      pat.setTransform(M); ctx.fillStyle = pat; ctx.fill();
    }
    if (tail > R * 0.06) { ctx.lineWidth = Math.max(0.8, R * 0.05); ctx.strokeStyle = 'rgba(5,8,16,0.3)'; ctx.stroke(); }
    // the light on the glass (cached per size): lift, dark refracting edge, bottom crescent, glints
    const spr = this.sprite(R), h = spr.width / 2;
    if (wob) {
      ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(v.ang); ctx.scale(1 + wob, 1 - wob); ctx.rotate(-v.ang);
      ctx.drawImage(spr, -h, -h); ctx.restore();
    } else ctx.drawImage(spr, P.x - h, P.y - h);
  }
  sprite(R) {
    const key = Math.round(R * 2) / 2;
    let c = this.sprites.get(key);
    if (c) return c;
    if (this.sprites.size > 240) this.sprites.clear();
    const h = Math.ceil(key + 2);
    c = document.createElement('canvas'); c.width = c.height = h * 2;
    const g = c.getContext('2d'), r = key, P = { x: h, y: h };
    g.save(); g.beginPath(); g.arc(P.x, P.y, r, 0, TAU); g.clip();
    const lg = g.createLinearGradient(0, P.y - r, 0, P.y + r);
    lg.addColorStop(0, 'rgba(255,255,255,0.04)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.1)'); lg.addColorStop(1, 'rgba(235,242,255,0.34)');
    g.fillStyle = lg; g.fillRect(0, 0, h * 2, h * 2);
    const gr = g.createRadialGradient(P.x - r * 0.1, P.y - r * 0.12, r * 0.5, P.x, P.y, r * 1.02);
    gr.addColorStop(0, 'rgba(10,14,24,0)'); gr.addColorStop(0.72, 'rgba(10,14,24,0.06)'); gr.addColorStop(1, 'rgba(8,12,22,0.48)');
    g.fillStyle = gr; g.fillRect(0, 0, h * 2, h * 2);
    const cr = g.createRadialGradient(P.x, P.y - r * 0.3, r * 0.78, P.x, P.y - r * 0.3, r * 1.32);
    cr.addColorStop(0, 'rgba(255,255,255,0)'); cr.addColorStop(0.7, 'rgba(255,255,255,0.3)'); cr.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = cr; g.fillRect(0, 0, h * 2, h * 2);
    g.restore();
    g.lineWidth = Math.max(0.8, r * 0.05); g.strokeStyle = 'rgba(5,8,16,0.34)'; g.beginPath(); g.arc(P.x, P.y, r - g.lineWidth / 2, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.beginPath(); g.ellipse(P.x - r * 0.37, P.y - r * 0.4, r * 0.21, r * 0.12, -0.72, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath(); g.ellipse(P.x - r * 0.12, P.y - r * 0.55, r * 0.07, r * 0.05, -0.3, 0, TAU); g.fill();
    this.sprites.set(key, c);
    return c;
  }

  // ---------- the marks ----------
  marks(ctx, x0, y0, s, sim, o) {
    const { dpr, t, names, callText, ptr, mouse, phase } = o;
    const now = sim.time;
    // candidates breathe while there's still one for you to call
    if (phase === 'call' && !sim.kids[0].drop) {
      const mine = sim.kids.every((k) => k.own === YOU || k.drop);
      for (const id of sim.free()) {
        const d = sim.drop(id); if (!d) continue;
        const P = { x: x0 + d.x * s, y: y0 + d.y * s }, R = d.r * s, v = this.st(id);
        for (let i = 0; i < 2; i++) {
          const u = ((t * 0.9 + v.pulse + i * 0.5) % 1);
          ctx.strokeStyle = `rgba(255,255,255,${(mine ? 0.75 : 0.35) * (1 - u)})`; ctx.lineWidth = 2 * dpr;
          ctx.beginPath(); ctx.arc(P.x, P.y, R + (3 + u * 16) * dpr, 0, TAU); ctx.stroke();
        }
      }
    }
    // whose is whose: a name tag per claimed drop, placed where it covers no drop and no other tag
    const tagPx = Math.round(12.5 * dpr), gap = 7 * dpr, pad = 2 * dpr, X1 = x0 + PW * s, Y1 = y0 + PH * s;
    const live = sim.kids.filter((k) => k.drop && !k.out).map((k) => ({ k, d: sim.drop(k.drop) })).filter((o) => o.d && o.d.alive);
    live.sort((a, b) => (b.k.own === YOU) - (a.k.own === YOU));
    const busy = live.map(({ d }) => { const R = d.r * s + 5 * dpr; return { x: x0 + d.x * s - R, y: y0 + d.y * s - R, w: 2 * R, h: 2 * R }; });
    const hit = (x, y, w, h) => busy.some((r) => x < r.x + r.w + pad && x + w + pad > r.x && y < r.y + r.h + pad && y + h + pad > r.y);
    for (const { k, d } of live) {
      const col = KID_COL[k.name] || '#ffffff', P = { x: x0 + d.x * s, y: y0 + d.y * s }, R = d.r * s, me = k.own === YOU, v = this.st(d.id);
      if (me) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 5.5 * dpr; ctx.beginPath(); ctx.arc(P.x, P.y, R + 4 * dpr, 0, TAU); ctx.stroke(); }
      ctx.strokeStyle = col; ctx.lineWidth = (me ? 3 : 2.4) * dpr; ctx.beginPath(); ctx.arc(P.x, P.y, R + 4 * dpr, 0, TAU); ctx.stroke();
      const label = (names[k.name] || k.name).toUpperCase() + (d.fin >= 0 ? ' ✓' : '');
      const fpx = me ? tagPx * 1.15 : tagPx;
      ctx.font = F.hand(fpx, 800);
      const tw = ctx.measureText(label).width, ph = fpx * 1.5, pw = tw + ph * 0.8;
      const at = {
        up: [P.x - pw / 2, P.y - R - gap - ph], down: [P.x - pw / 2, P.y + R + gap],
        left: [P.x - R - gap - pw, P.y - ph / 2], right: [P.x + R + gap, P.y - ph / 2],
      };
      const order = [v.side, 'up', 'down', 'right', 'left'].filter(Boolean);
      let side = null, tx = 0, ty = 0;
      for (let pass = 0; pass < 2 && !side; pass++) {
        for (const sd of order) {
          const [ox, oy] = at[sd], cx = clamp(ox, x0 + pad, X1 - pw - pad);
          if (oy < y0 + pad || oy + ph > Y1 - pad || (cx !== ox && (sd === 'left' || sd === 'right'))) continue;
          if (pass === 0 && hit(cx, oy, pw, ph)) continue;
          side = sd; tx = cx; ty = oy; break;
        }
      }
      if (!side) { side = 'down'; tx = clamp(at.down[0], x0 + pad, X1 - pw - pad); ty = at.down[1]; }
      v.side = side; busy.push({ x: tx, y: ty, w: pw, h: ph });
      ctx.fillStyle = col; roundRect(ctx, tx, ty, pw, ph, ph / 2); ctx.fill();
      const q = 4 * dpr, ax = clamp(P.x, tx + ph / 2, tx + pw - ph / 2), ay = clamp(P.y, ty + ph / 2, ty + ph / 2);
      ctx.beginPath();
      if (side === 'up') { ctx.moveTo(ax - q, ty + ph - 1); ctx.lineTo(ax, ty + ph + q); ctx.lineTo(ax + q, ty + ph - 1); }
      else if (side === 'down') { ctx.moveTo(ax - q, ty + 1); ctx.lineTo(ax, ty - q); ctx.lineTo(ax + q, ty + 1); }
      else if (side === 'left') { ctx.moveTo(tx + pw - 1, ay - q); ctx.lineTo(tx + pw + q, ay); ctx.lineTo(tx + pw - 1, ay + q); }
      else { ctx.moveTo(tx + 1, ay - q); ctx.lineTo(tx - q, ay); ctx.lineTo(tx + 1, ay + q); }
      ctx.fill();
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, tx + pw / 2, ty + ph / 2 + dpr * 0.5);
    }
    // «¡me pido esa!»
    this.bubbles = this.bubbles.filter((b) => now - b.t0 < 1.8);
    for (const b of this.bubbles) {
      const kid = sim.kids[b.own], d = sim.drop(b.id); if (!kid || !d) continue;
      const u = now - b.t0, sc = ease.outBack(clamp(u / 0.28)), a = clamp((1.8 - u) / 0.3);
      const col = KID_COL[kid.name], P = { x: x0 + d.x * s, y: y0 + d.y * s }, R = d.r * s;
      const txt = callText, px = Math.round(15 * dpr);
      ctx.font = F.wipe(px);
      const tw = ctx.measureText(txt).width, bw = tw + px * 1.2, bh = px * 1.9;
      const bx = clamp(P.x - bw / 2, x0 + 3 * dpr, x0 + PW * s - bw - 3 * dpr);
      let by = P.y - R - 34 * dpr - bh; const flip = by < y0 + 4 * dpr; if (flip) by = P.y + R + 34 * dpr;
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(P.x, flip ? by : by + bh); ctx.scale(sc, sc); ctx.translate(-P.x, -(flip ? by : by + bh));
      ctx.fillStyle = '#ffffff'; roundRect(ctx, bx, by, bw, bh, bh * 0.45); ctx.fill();
      ctx.beginPath();
      if (flip) { ctx.moveTo(P.x - 6 * dpr, by + 1); ctx.lineTo(P.x - 2 * dpr, by - 10 * dpr); ctx.lineTo(P.x + 6 * dpr, by + 1); }
      else { ctx.moveTo(P.x - 6 * dpr, by + bh - 1); ctx.lineTo(P.x - 2 * dpr, by + bh + 10 * dpr); ctx.lineTo(P.x + 6 * dpr, by + bh - 1); }
      ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3 * dpr; roundRect(ctx, bx, by, bw, bh, bh * 0.45); ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, bx + bw / 2, by + bh / 2 + px * 0.06);
      ctx.restore();
    }
    // the ring your fingertip must stay out of
    if (ptr && ptr.on && phase === 'race' && !sim.end) {
      for (const k of sim.kids) {
        if (!k.drop || k.out) continue;
        const d = sim.drop(k.drop); if (!d || !d.alive || d.fin >= 0) continue;
        const lim = d.r + K.touch, dd = Math.hypot(ptr.x - d.x, ptr.y - d.y), a = clamp(1 - (dd - lim) / 1.1);
        if (a <= 0) continue;
        ctx.save(); ctx.globalAlpha = a;
        ctx.setLineDash([5 * dpr, 4 * dpr]); ctx.lineDashOffset = -t * 30 * dpr;
        ctx.strokeStyle = k.own === YOU ? '#ffffff' : '#ff3b30'; ctx.lineWidth = 2.2 * dpr;
        ctx.beginPath(); ctx.arc(x0 + d.x * s, y0 + d.y * s, lim * s, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
    // the fingertip, for a mouse (a real finger covers it anyway)
    if (mouse && ptr && ptr.in) {
      const P = { x: x0 + ptr.x * s, y: y0 + ptr.y * s };
      ctx.strokeStyle = ptr.on ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.arc(P.x, P.y, K.finger * s, 0, TAU); ctx.stroke();
      if (ptr.on) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); }
    }
  }
}
export const inPane = (x, y) => x >= 0 && x <= PW && y >= 0 && y <= PH;
