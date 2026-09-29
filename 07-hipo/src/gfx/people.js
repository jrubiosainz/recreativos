// The two grown-ups at the pool. Paco, the lifeguard, who only wants a quiet afternoon: step into his
// range and he stands, raises the whistle and blows it (a fright is a hiccup cure, and the biggest
// leap in the game). And the abuela, who has seen everything, fans herself and tells you how it works.
// Both are drawn in tiles from the feet, facing right; the scene mirrors them.
import { INK, rr, ell, star5 } from './paint.js';
import { TAU, clamp, lerp, damp } from '../util.js';
import { P } from '../sim.js';

const SKIN = '#E0A071', SKIN_LO = '#B8744C', SKIN_HI = '#F6C9A2', HAIR = '#2B2233';

export class Guard {
  constructor(g) { this.g = g; this.stand = 0; this.raise = 0; this.blowT = -9; this.t = Math.random() * 5; this.look = g.face; this.alertT = -9; }
  event(e) {
    if (e.k === 'whistleUp' && e.g === this.g) this.alertT = this.t;
    if (e.k === 'whistle' && e.g === this.g) this.blowT = this.t;
  }
  update(dt) {
    const g = this.g; this.t += dt;
    const blowing = this.t - this.blowT < 0.7;
    this.stand = damp(this.stand, g.up || blowing ? 1 : 0, g.up ? 14 : 3, dt);
    this.raise = damp(this.raise, g.up || blowing ? 1 : 0, 12, dt);
    this.look = damp(this.look, g.face, 8, dt);
  }
  drawRange(ctx, sim) {
    const g = this.g, R = g.range || P.whistle.range, near = clamp(1 - (g.d - R) / 4);
    const a = Math.max(near * 0.8, g.up ? 1 : 0);
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(g.x, g.y, R, 0, TAU);
    ctx.fillStyle = g.up ? 'rgba(216,50,42,0.12)' : 'rgba(216,50,42,0.05)'; ctx.fill();
    ctx.setLineDash([0.35, 0.3]); ctx.lineDashOffset = -this.t * 0.8;
    ctx.lineWidth = 0.08; ctx.strokeStyle = g.up ? INK.red : 'rgba(216,50,42,0.7)'; ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  draw(ctx) {
    const g = this.g, t = this.t, s = this.stand, face = this.look >= 0 ? 1 : -1;
    const blow = clamp(1 - (t - this.blowT) / 0.7), alert = g.up ? clamp(g.ph / P.whistle.tele) : 0;
    ctx.save(); ctx.translate(g.x, g.y + 0.5);
    // the folding stool stays where it is
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK.key; ctx.lineWidth = 0.13; ctx.beginPath(); ctx.moveTo(-0.55, 0); ctx.lineTo(0.35, -1.0); ctx.moveTo(0.35, 0); ctx.lineTo(-0.55, -1.0); ctx.stroke();
    ctx.strokeStyle = '#C9CFD8'; ctx.lineWidth = 0.07; ctx.stroke();
    ctx.beginPath(); rr(ctx, -0.7, -1.12, 1.2, 0.16, 0.05); ctx.fillStyle = INK.blue; ctx.lineWidth = 0.04; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
    ctx.scale(face, 1);
    const breathe = Math.sin(t * 1.7) * 0.02 * (1 - s);
    const hipY = lerp(-1.12, -1.42, s), hipX = lerp(-0.1, 0.1, s);
    // legs: sitting (knees forward) → standing (planted)
    const legs = [[-0.16, SKIN_LO], [0.16, SKIN]];
    for (const [ox, col] of legs) {
      const kx = lerp(0.55, 0.1, s) + ox * 0.3, ky = lerp(-1.1, -0.72, s), fx = lerp(0.6, 0.05, s) + ox, fy = 0;
      ctx.strokeStyle = INK.key; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(hipX + ox * 0.5, hipY); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy - 0.1); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 0.22; ctx.stroke();
      // flip-flop
      ctx.beginPath(); rr(ctx, fx - 0.18, -0.08, 0.5, 0.08, 0.04); ctx.fillStyle = INK.yellow; ctx.fill();
      ctx.fillStyle = col; ell(ctx, fx + 0.08, -0.12, 0.2, 0.08); ctx.fill();
    }
    // red shorts
    ctx.beginPath(); rr(ctx, hipX - 0.42, hipY - 0.2, 0.84 + lerp(0.25, 0, s), 0.45, 0.14);
    ctx.fillStyle = INK.red; ctx.lineWidth = 0.05; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
    // torso: a proud belly in a yellow SOCORRISTA tank top
    const shY = hipY - 1.15 + breathe, cx = hipX + 0.02;
    ctx.beginPath();
    ctx.moveTo(cx - 0.36, hipY - 0.1);
    ctx.bezierCurveTo(cx - 0.5, hipY - 0.6, cx - 0.42, shY + 0.2, cx - 0.2, shY);
    ctx.lineTo(cx + 0.22, shY);
    ctx.bezierCurveTo(cx + 0.55, shY + 0.25, cx + 0.72, hipY - 0.45, cx + 0.42, hipY - 0.08);
    ctx.closePath();
    const tg = ctx.createLinearGradient(cx - 0.5, 0, cx + 0.7, 0); tg.addColorStop(0, '#E8B830'); tg.addColorStop(0.45, INK.yellow); tg.addColorStop(1, '#D9A21E');
    ctx.fillStyle = tg; ctx.lineWidth = 0.05; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
    ctx.fillStyle = INK.red; ctx.fillRect(cx - 0.05, shY + 0.35, 0.3, 0.09); ctx.fillRect(cx + 0.055, shY + 0.245, 0.09, 0.3);
    // arms
    const arm = (x0, y0, x1, y1, x2, y2, col) => {
      ctx.strokeStyle = INK.key; ctx.lineWidth = 0.24; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x1, y1, x2, y2); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 0.16; ctx.stroke();
      ctx.fillStyle = col; ell(ctx, x2, y2, 0.11, 0.11); ctx.fill();
    };
    const r = this.raise;
    // far arm: crossed on the belly → pointing at you
    arm(cx - 0.15, shY + 0.12, lerp(cx + 0.1, cx + 0.5, r), lerp(shY + 0.75, shY + 0.1, r), lerp(cx + 0.35, cx + 1.05, r), lerp(shY + 0.55, shY + 0.02 - alert * 0.1, r), SKIN_LO);
    // head
    const hy = shY - 0.52 - blow * 0.05, hx = cx + 0.08 + 0.05 * s;
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(hx, hy, 0.46, 0.5, 0, 0, TAU);
    const hg = ctx.createRadialGradient(hx - 0.15, hy - 0.2, 0.05, hx, hy, 0.6); hg.addColorStop(0, SKIN_HI); hg.addColorStop(0.6, SKIN); hg.addColorStop(1, SKIN_LO);
    ctx.fillStyle = hg; ctx.lineWidth = 0.05; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
    // ear, cap with the visor forward
    ctx.fillStyle = SKIN_LO; ell(ctx, hx - 0.36, hy + 0.02, 0.09, 0.13); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx - 0.45, hy - 0.12); ctx.quadraticCurveTo(hx - 0.4, hy - 0.62, hx + 0.05, hy - 0.6); ctx.quadraticCurveTo(hx + 0.42, hy - 0.58, hx + 0.46, hy - 0.2); ctx.closePath();
    ctx.fillStyle = INK.white; ctx.stroke(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + 0.3, hy - 0.24); ctx.quadraticCurveTo(hx + 0.75, hy - 0.26, hx + 0.8, hy - 0.14); ctx.lineTo(hx + 0.35, hy - 0.12); ctx.closePath(); ctx.fillStyle = INK.red; ctx.stroke(); ctx.fill();
    // aviators
    ctx.fillStyle = '#1F1B33'; ctx.beginPath(); rr(ctx, hx + 0.02, hy - 0.1, 0.36, 0.2, 0.08); ctx.fill();
    ctx.fillStyle = 'rgba(160,220,255,0.7)'; ctx.fillRect(hx + 0.08, hy - 0.07, 0.1, 0.04);
    // nose, moustache, mouth (or cheeks puffed round the whistle)
    ctx.fillStyle = SKIN_LO; ell(ctx, hx + 0.46, hy + 0.1, 0.12, 0.1); ctx.fill();
    ctx.fillStyle = HAIR; ctx.beginPath(); ctx.moveTo(hx + 0.12, hy + 0.2); ctx.quadraticCurveTo(hx + 0.35, hy + 0.12, hx + 0.52, hy + 0.2); ctx.quadraticCurveTo(hx + 0.4, hy + 0.32, hx + 0.12, hy + 0.2); ctx.fill();
    if (blow > 0) {
      ctx.fillStyle = '#F08A7A'; ell(ctx, hx + 0.26, hy + 0.3, 0.2 + 0.05 * blow, 0.16 + 0.04 * blow); ctx.fill();
    } else {
      ctx.strokeStyle = INK.key; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(hx + 0.2, hy + 0.34); ctx.quadraticCurveTo(hx + 0.32, hy + 0.37 - 0.05 * alert, hx + 0.42, hy + 0.33); ctx.stroke();
    }
    // lanyard and whistle; the near arm brings it up
    const wx = lerp(cx + 0.25, hx + 0.52, r), wy = lerp(shY + 0.45, hy + 0.3, r);
    ctx.strokeStyle = INK.red; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(cx - 0.1, shY + 0.02); ctx.quadraticCurveTo(lerp(cx + 0.05, cx + 0.3, r), lerp(shY + 0.35, shY + 0.1, r), wx, wy); ctx.stroke();
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(-0.25 * r);
    ctx.beginPath(); rr(ctx, -0.02, -0.07, 0.28, 0.14, 0.06); ctx.fillStyle = '#D6DCE6'; ctx.lineWidth = 0.03; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(0.02, -0.05, 0.12, 0.025);
    ctx.restore();
    arm(cx + 0.12, shY + 0.12, lerp(cx + 0.3, cx + 0.62, r), lerp(shY + 0.8, shY + 0.25, r), lerp(cx + 0.2, wx - 0.02, r), lerp(shY + 0.62, wy + 0.08, r), SKIN);
    // blast lines
    if (blow > 0) {
      ctx.strokeStyle = INK.key; ctx.lineWidth = 0.06; ctx.globalAlpha = blow;
      for (let i = -1; i <= 1; i++) { const a = i * 0.35, L0 = 0.55 + (1 - blow) * 0.6; ctx.beginPath(); ctx.moveTo(wx + 0.3 + Math.cos(a) * L0, wy + Math.sin(a) * L0); ctx.lineTo(wx + 0.3 + Math.cos(a) * (L0 + 0.35), wy + Math.sin(a) * (L0 + 0.35)); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    // the «!» while he winds up
    if (alert > 0) {
      const k = Math.min(1, alert * 3), bob = Math.sin(t * 18) * 0.05;
      ctx.save(); ctx.translate(hx, hy - 1.05 + bob); ctx.scale(face * k, k);
      ctx.beginPath(); ell(ctx, 0, 0, 0.32, 0.36); ctx.fillStyle = INK.red; ctx.lineWidth = 0.05; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); rr(ctx, -0.055, -0.24, 0.11, 0.3, 0.05); ctx.fill(); ell(ctx, 0, 0.17, 0.06, 0.06); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

export class Abuela {
  constructor(d) { this.d = d; this.t = Math.random() * 3; this.talk = 0; this.fan = 0; this.zT = 0; }
  update(dt, talking) {
    this.t += dt; this.talk = damp(this.talk, talking ? 1 : 0, 8, dt);
    this.fan += dt * (talking ? 11 : 5);
  }
  draw(ctx) {
    const d = this.d, t = this.t, sleep = !!d.sleep;
    ctx.save(); ctx.translate(d.x, d.y); ctx.scale(d.face || 1, 1);
    // the folding beach chair
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK.key; ctx.lineWidth = 0.12;
    ctx.beginPath(); ctx.moveTo(-0.7, 0); ctx.lineTo(0.4, -1.0); ctx.moveTo(0.6, 0); ctx.lineTo(-0.5, -1.0); ctx.moveTo(-0.62, -0.95); ctx.lineTo(-0.95, -2.3); ctx.stroke();
    ctx.strokeStyle = '#D8DDE3'; ctx.lineWidth = 0.06; ctx.stroke();
    // striped canvas of the seat and back
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-0.95, -2.3); ctx.lineTo(-0.62, -0.95); ctx.lineTo(0.5, -0.95); ctx.lineTo(0.55, -1.08); ctx.lineTo(-0.5, -1.12); ctx.lineTo(-0.78, -2.32); ctx.closePath(); ctx.clip();
    for (let i = -3; i < 6; i++) { ctx.fillStyle = i % 2 ? INK.white : '#3BB7D8'; ctx.fillRect(-1.2 + i * 0.22, -2.5, 0.22, 1.7); }
    ctx.restore();
    // legs and slippers
    for (const [ox, col] of [[-0.05, SKIN_LO], [0.12, '#EAB48C']]) {
      ctx.strokeStyle = INK.key; ctx.lineWidth = 0.22; ctx.beginPath(); ctx.moveTo(-0.1 + ox, -1.12); ctx.lineTo(0.45 + ox, -1.05); ctx.lineTo(0.5 + ox, -0.1); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 0.15; ctx.stroke();
      ctx.beginPath(); rr(ctx, 0.35 + ox, -0.12, 0.36, 0.12, 0.05); ctx.fillStyle = INK.pink; ctx.fill();
    }
    // the dress: navy with white polka dots
    const lean = sleep ? -0.2 : 0;
    ctx.save(); ctx.translate(-0.35, -1.1); ctx.rotate(lean);
    ctx.beginPath(); ctx.moveTo(-0.3, 0.05); ctx.bezierCurveTo(-0.45, -0.5, -0.3, -1.05, 0.02, -1.08); ctx.bezierCurveTo(0.35, -1.05, 0.55, -0.55, 0.7, 0.1); ctx.closePath();
    ctx.fillStyle = INK.navy; ctx.lineWidth = 0.05; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = '#F3EEDF';
    for (let i = 0; i < 14; i++) { ell(ctx, -0.35 + (i * 0.37) % 1.1, -1.05 + ((i * 0.53) % 1.15), 0.045, 0.045); ctx.fill(); }
    ctx.restore();
    // head: grey perm, sunglasses on top, a little smile (or asleep under the newspaper)
    const hx = 0.08, hy = -1.42, nod = sleep ? Math.sin(t * 0.9) * 0.03 : Math.sin(t * 1.3) * 0.02 + this.talk * Math.sin(t * 9) * 0.03;
    ctx.save(); ctx.translate(hx, hy + nod); ctx.rotate(sleep ? 0.25 : 0);
    ctx.fillStyle = '#E4DEE8'; for (const [x, y, r] of [[-0.28, -0.2, 0.18], [-0.1, -0.33, 0.2], [0.12, -0.33, 0.19], [-0.33, 0.02, 0.15]]) { ell(ctx, x, y, r, r); ctx.lineWidth = 0.04; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill(); }
    const fg = ctx.createRadialGradient(0.02, -0.08, 0.02, 0.05, 0, 0.4); fg.addColorStop(0, SKIN_HI); fg.addColorStop(1, SKIN);
    ctx.beginPath(); ctx.ellipse(0.06, 0.02, 0.3, 0.33, 0, 0, TAU); ctx.fillStyle = fg; ctx.stroke(); ctx.fill();
    ctx.fillStyle = '#E4DEE8'; for (const [x, y, r] of [[-0.12, -0.28, 0.15], [0.12, -0.3, 0.14]]) { ell(ctx, x, y, r, r); ctx.fill(); }
    ctx.fillStyle = INK.red; ctx.beginPath(); rr(ctx, -0.06, -0.3, 0.36, 0.1, 0.04); ctx.fill();
    if (sleep) {
      ctx.strokeStyle = INK.key; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.arc(0.18, -0.02, 0.07, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.fillStyle = '#7A2A3A'; ell(ctx, 0.2, 0.17, 0.05, 0.06 + 0.02 * Math.sin(t * 2)); ctx.fill();
    } else {
      ctx.fillStyle = INK.key; ell(ctx, 0.2, -0.03, 0.035, 0.05); ctx.fill();
      ctx.strokeStyle = INK.key; ctx.lineWidth = 0.035; ctx.beginPath();
      const m = this.talk * (0.5 + 0.5 * Math.sin(t * 16));
      ctx.moveTo(0.12, 0.16); ctx.quadraticCurveTo(0.2, 0.22 + m * 0.07, 0.3, 0.14); ctx.stroke();
      ctx.fillStyle = 'rgba(240,106,142,0.45)'; ell(ctx, 0.05, 0.08, 0.07, 0.05); ctx.fill();
    }
    ctx.fillStyle = SKIN_LO; ell(ctx, 0.34, 0.04, 0.05, 0.06); ctx.fill();
    ctx.restore();
    // hands: a red fan going, or the newspaper open on her lap
    if (sleep) {
      ctx.save(); ctx.translate(0.25, -0.55); ctx.rotate(-0.2);
      ctx.beginPath(); rr(ctx, -0.35, -0.3, 0.9, 0.55, 0.03); ctx.fillStyle = '#F4EFE2'; ctx.lineWidth = 0.04; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
      ctx.fillStyle = INK.key; ctx.fillRect(-0.28, -0.22, 0.76, 0.1);
      ctx.fillStyle = 'rgba(42,33,80,0.4)'; for (let i = 0; i < 4; i++) ctx.fillRect(-0.28, -0.05 + i * 0.07, i === 3 ? 0.4 : 0.76, 0.03);
      ctx.restore();
    } else {
      const a = Math.sin(this.fan) * 0.45;
      ctx.save(); ctx.translate(0.52, -0.62); ctx.rotate(-0.9 + a);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 0.55, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); ctx.closePath();
      ctx.fillStyle = INK.red; ctx.lineWidth = 0.035; ctx.strokeStyle = INK.key; ctx.stroke(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,160,0.8)'; ctx.lineWidth = 0.02; ctx.beginPath(); for (let i = -3; i <= 3; i++) { const aa = -Math.PI / 2 + i * 0.26; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(aa) * 0.52, Math.sin(aa) * 0.52); } ctx.stroke();
      ctx.fillStyle = '#EAB48C'; ell(ctx, 0, 0, 0.09, 0.09); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    if (sleep) {   // Zzz
      ctx.fillStyle = INK.navy; ctx.textAlign = 'center';
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.35 + i / 3) % 1;
        ctx.globalAlpha = Math.sin(ph * Math.PI); ctx.font = `850 ${0.35 + ph * 0.3}px Gluten, system-ui, sans-serif`;
        ctx.fillText('z', 0.3 + ph * 0.9 + Math.sin(ph * 6) * 0.1, -2.1 - ph * 1.4);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

export function dizzyStars(ctx, x, y, t, k) {
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + i * TAU / 3, sx = x + Math.cos(a) * 0.7, sy = y + Math.sin(a) * 0.22;
    ctx.fillStyle = i === 1 ? INK.pink : INK.yellow; ctx.globalAlpha = k * (0.7 + 0.3 * Math.sin(a));
    star5(ctx, sx, sy, 0.17, a); ctx.fill(); ctx.lineWidth = 0.03; ctx.strokeStyle = INK.key; ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
