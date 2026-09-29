// Hipólito, drawn every frame from a handful of springs. Nothing here is a sprite: the body is an
// airbrushed egg with a hard poster highlight, the snout is the face, and everything the player needs
// to read lives on it. Holding the breath balloons the cheeks and flushes the face (one step per kept
// hiccup); the belly twitches in the quarter-second before a hiccup is due; a hiccup snaps the whole
// body up with the mouth open. Units are tiles, the origin is between the feet, facing right; the
// scene mirrors it and applies the camera.
import { clamp, lerp, damp, TAU } from '../util.js';
import { P } from '../sim.js';

export const HC = {
  ink: '#33265e', body: '#9C8FD0', hi: '#D4CCF5', lo: '#6A5CA6', far: '#8174BC', rim: '#9FE3F2',
  snout: '#F4A6B8', snoutHi: '#FFE0E8', snoutLo: '#D0748E', nostril: '#4A2450', mouth: '#5B1F3E',
  tongue: '#F06A8E', eyeW: '#FFFCF2', pupil: '#1B1233', nail: '#FFF1D6', flush: '#E23B63', tooth: '#FFFDF4',
};

class Sp {
  constructor(v = 0, k = 300, d = 18) { this.x = v; this.t = v; this.v = 0; this.k = k; this.d = d; }
  step(dt) { this.v += (this.k * (this.t - this.x) - this.d * this.v) * dt; this.x += this.v * dt; return this.x; }
  snap(v) { this.x = this.t = v; this.v = 0; }
}

export class HippoAnim {
  constructor() { this.reset(); }
  reset(face = 1) {
    this.t = 0; this.ph = 0; this.walkAmp = 0; this.blinkT = 2; this.blink = 0;
    this.sq = new Sp(0, 420, 13);          // squash (−) / stretch (+)
    this.tilt = new Sp(0, 160, 16);
    this.head = new Sp(0, 520, 16);        // the neck snaps up on a hiccup
    this.ear = new Sp(0, 260, 9);
    this.turn = new Sp(face, 1300, 72);
    this.puff = new Sp(0, 240, 15);
    this.flush = 0; this.tuck = 0; this.spread = 0; this.swim = 0; this.belly = 0; this.lift = 0;
    this.hicT = -9; this.hicL = 0; this.sustoT = -9; this.storeT = -9; this.landT = -9; this.drinkT = -9; this.fizzT = -9;
    this.tellK = 0; this.tremble = 0; this.dizzy = 0; this.cure = 0; this.face = face;
    this.legs = [0, 0, 0, 0]; this.legLen = [1, 1, 1, 1];
    this.eyes = 'open'; this.mouth = 'smile'; this.look = 1; this.endWhy = null; this.gaze = 0;
  }

  event(e) {
    const t = this.t;
    switch (e.k) {
      case 'hic': {
        const L = e.L;
        this.hicT = t; this.hicL = L;
        this.sq.v += 5 + 3.2 * L; this.head.v -= 2.2 + 0.8 * L; this.ear.v -= 16 + 5 * L;
        if (L === 3) this.puff.v -= 6;
        break;
      }
      case 'store': this.storeT = t; this.sq.v -= 3.2; this.puff.v += 5; this.head.v += 1.2; this.ear.v += 6; break;
      case 'land': this.landT = t; this.sq.v -= Math.min(9, 0.45 * e.v); this.ear.v += 0.8 * e.v; break;
      case 'board': this.sq.v -= Math.min(10, 0.5 * e.v); break;
      case 'launch': this.sq.v += 7; this.ear.v -= 18; break;
      case 'boing': this.sq.v += 5; this.ear.v -= 12; break;
      case 'bonk': this.sq.v -= 6; this.head.v += 3; break;
      case 'susto': this.sustoT = t; this.sq.v += 9; this.ear.v -= 30; this.head.v -= 3; break;
      case 'drink': this.drinkT = t; break;
      case 'fizz': this.fizzT = t; this.sq.v += 3; break;
      case 'respawn': this.reset(this.face); break;
      case 'impact': this.endWhy = e.why; this.sq.v -= 10; break;
      default:
    }
  }

  update(dt, sim) {
    const hp = sim.hp, h = sim.hic, t = (this.t += dt);
    const end = sim.end, dive = sim.dive, onGround = !!hp.ground && !hp.spring;
    const speed = Math.abs(hp.vx), water = hp.inWater && !dive;
    this.face = hp.face;
    this.turn.t = hp.face; this.turn.step(dt);
    // the clock: how close the next hiccup is (the tell), and what the breath is doing
    const T = sim.period(), tell = h.cure > 0 ? 0 : clamp((h.phase - (T - P.tell)) / P.tell);
    this.tellK = tell; this.dizzy = h.dizzy; this.cure = h.cure;
    // walking, paddling
    if (water || (end && end.why === 'bomba')) this.ph += dt * 10;
    else if (onGround) this.ph += dt * speed * (hp.hold ? 6.2 : 3.6);
    this.walkAmp = damp(this.walkAmp, onGround && !water ? clamp(speed / P.walk * 1.25) : 0, 16, dt);
    // poses that take the whole body
    const tucked = (dive || end) && hp.hold && !(end && end.why === 'planchazo');
    this.tuck = damp(this.tuck, tucked && !(end && t - this.landT > 0) ? 1 : dive && hp.hold ? 1 : 0, 14, dt);
    if (end) this.tuck = damp(this.tuck, 0, 3, dt);
    this.spread = damp(this.spread, dive && !hp.hold ? 1 : 0, 10, dt);
    this.belly = damp(this.belly, end && end.why === 'planchazo' && t > 0 ? 1 : 0, 3, dt);
    this.swim = damp(this.swim, water || (end && end.why === 'bomba') ? 1 : 0, 8, dt);
    // squash / stretch targets
    let sq = 0;
    if (hp.spring) sq = -0.34;
    else if (!hp.ground && !end) sq = hp.vy < 0 ? clamp(-hp.vy * 0.011, 0, 0.2) : clamp(hp.vy * 0.005, 0, 0.1);
    else sq = -0.06 * tell + 0.018 * Math.sin(t * 3.1);  // the breath; the tell pulls the belly in
    if (hp.hold) sq -= 0.05 + 0.03 * h.k;
    this.sq.t = sq; this.sq.step(dt);
    // lean into motion; nose up going up, down coming down
    let tilt = onGround ? 0.05 * hp.vx / P.walk * hp.face : clamp(-hp.vy * 0.018, -0.35, 0.3);
    if (this.spread > 0.01) tilt = lerp(tilt, 0.12 * Math.sin(t * 5), this.spread);
    if (h.dizzy > 0) tilt += 0.1 * Math.sin(t * 13);
    this.tilt.t = tilt; this.tilt.step(dt);
    this.head.t = -0.05 * tell; this.head.step(dt);
    this.ear.t = (!hp.ground && hp.vy > 6 ? -0.5 : 0) - 0.4 * tell; this.ear.step(dt);
    this.puff.t = hp.hold ? 0.28 + 0.36 * h.k + (this.tellK * 0.12) : 0; this.puff.step(dt);
    this.flush = damp(this.flush, hp.hold ? clamp(0.18 + 0.3 * h.k + 0.06 * hp.holdT) : end && end.why === 'planchazo' ? 0.8 : 0, hp.hold ? 3 : 2, dt);
    this.tremble = damp(this.tremble, hp.hold && h.k >= 2 ? 1 : hp.hold && h.k === 1 ? 0.35 : 0, 10, dt);
    // legs: [near front, far front, near back, far back]
    const L = this.legs, ln = this.legLen;
    if (this.swim > 0.5) {
      for (let i = 0; i < 4; i++) { L[i] = 0.55 * Math.sin(this.ph + (i === 0 || i === 3 ? 0 : Math.PI)); ln[i] = 1; }
    } else if (onGround || hp.spring) {
      const A = 0.55 * this.walkAmp;
      for (let i = 0; i < 4; i++) {
        const s = this.ph + (i === 0 || i === 3 ? 0 : Math.PI);
        L[i] = damp(L[i], -A * Math.sin(s), 30, dt);
        ln[i] = 1 - 0.22 * this.walkAmp * Math.max(0, Math.cos(s)) - (hp.hold ? 0 : 0);
      }
    } else {
      const up = hp.vy < 0, fl = Math.sin(t * 17) * 0.12;
      const tgt = up ? [-0.35, -0.2, 0.45, 0.3] : [-0.55 + fl, -0.4 - fl, 0.6 - fl, 0.45 + fl];
      for (let i = 0; i < 4; i++) { L[i] = damp(L[i], tgt[i], 12, dt); ln[i] = damp(ln[i], 1, 12, dt); }
    }
    // the face
    const since = (x) => t - x;
    this.blinkT -= dt; if (this.blinkT <= 0) { this.blink = 0.13; this.blinkT = 2 + 3 * Math.random(); }
    this.blink = Math.max(0, this.blink - dt);
    let eyes = 'open', mouth = 'smile';
    if (end) { eyes = end.why === 'bomba' ? 'happy' : 'spiral'; mouth = end.why === 'bomba' ? 'grin' : 'ouch'; }
    else if (since(this.sustoT) < 0.7) { eyes = 'pop'; mouth = 'scream'; }
    else if (h.dizzy > 0) { eyes = 'spiral'; mouth = 'o'; }
    else if (dive && !hp.hold) { eyes = 'pop'; mouth = 'scream'; }
    else if (hp.hold) { eyes = h.k >= 1 || dive ? 'shut' : 'squint'; mouth = 'puff'; }
    else if (since(this.hicT) < 0.2) { eyes = 'wide'; mouth = 'o'; }
    else if (tell > 0) { eyes = 'wide'; mouth = 'flat'; }
    else if (h.cure > 0) { eyes = 'calm'; mouth = 'smile'; }
    else if (!hp.ground && hp.vy > 14) { eyes = 'wide'; mouth = 'o'; }
    else if (since(this.fizzT) < 0.6 || since(this.drinkT) < 0.5) { eyes = 'happy'; mouth = 'drink'; }
    if (eyes === 'open' && this.blink > 0) eyes = 'blink';
    this.eyes = eyes; this.mouth = mouth;
    this.gaze = damp(this.gaze, !hp.ground && hp.vy > 4 ? 0.8 : hp.vy < -3 ? -0.6 : 0, 8, dt);
  }

  // ctx: already in tile units at the feet. `alpha`: overall opacity (respawn fade).
  draw(ctx, o = {}) {
    const s = this.sq.x, sx = 1 - 0.55 * s, sy = 1 + s;
    const tuck = this.tuck, spread = this.spread, belly = this.belly;
    const tr = this.tremble * 0.018;
    ctx.save();
    if (tr) ctx.translate(Math.sin(this.t * 91) * tr, Math.cos(this.t * 77) * tr * 0.5);
    let dir = this.turn.x; if (Math.abs(dir) < 0.12) dir = 0.12 * Math.sign(dir || 1);
    ctx.scale(dir, 1);
    // pivots: squash about the feet, rotation about the belly
    ctx.scale(sx, sy);
    ctx.translate(0, -0.62); ctx.rotate(this.tilt.x + belly * Math.PI + tuck * 0.45);
    if (tuck > 0.001) ctx.scale(1 - 0.2 * tuck, 1 + 0.26 * tuck);   // the cannonball is a ball
    ctx.translate(0, 0.62);
    if (o.shadowOnly) { ctx.restore(); return; }
    this._legs(ctx, true);
    this._tail(ctx);
    this._body(ctx);
    this._legs(ctx, false);
    this._head(ctx);
    ctx.restore();
  }

  // ---------- parts ----------
  _legs(ctx, far) {
    const hips = [[0.26, -0.4], [0.4, -0.44], [-0.52, -0.38], [-0.38, -0.43]];
    const tuck = this.tuck, spread = this.spread;
    for (const i of far ? [1, 3] : [0, 2]) {
      const [hx, hy] = hips[i], front = i < 2;
      let a = this.legs[i], len = 0.42 * this.legLen[i];
      a = lerp(a, front ? 2.1 : -2.0, tuck); len *= 1 - 0.3 * tuck;   // hugging the knees
      a = lerp(a, (front ? -1.35 : 1.35) + Math.sin(this.t * 23 + i) * 0.12, spread);
      a += this.belly * Math.sin(this.t * 9 + i * 1.7) * 0.4;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(a);
      ctx.beginPath(); rr(ctx, -0.13, -0.12, 0.26, len + 0.12, 0.12);
      ctx.fillStyle = far ? HC.far : HC.body; ctx.lineWidth = 0.045; ctx.strokeStyle = HC.ink; ctx.stroke(); ctx.fill();
      // foot pad and three nails
      ctx.beginPath(); ctx.ellipse(0.01, len - 0.03, 0.15, 0.075, 0, 0, TAU); ctx.stroke(); ctx.fill();
      ctx.fillStyle = far ? '#e9dcc4' : HC.nail;
      for (let n = 0; n < 3; n++) { ctx.beginPath(); ctx.ellipse(0.1 - n * 0.085, len + 0.005, 0.033, 0.026, 0, 0, TAU); ctx.fill(); }
      if (!far) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-0.05, 0.02, 0.03, len * 0.35, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
  _tail(ctx) {
    const w = Math.sin(this.t * (this.walkAmp > 0.1 ? 14 : 3)) * (0.25 + 0.4 * this.walkAmp);
    ctx.save(); ctx.translate(-0.86, -0.72); ctx.rotate(-0.5 + w);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.14, -0.02, -0.2, 0.08);
    ctx.lineWidth = 0.1; ctx.lineCap = 'round'; ctx.strokeStyle = HC.ink; ctx.stroke();
    ctx.lineWidth = 0.055; ctx.strokeStyle = HC.body; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-0.21, 0.1, 0.05, 0.07, 0.4, 0, TAU); ctx.fillStyle = HC.lo; ctx.fill();
    ctx.restore();
  }
  _body(ctx) {
    const bx = -0.2, by = -0.64, rx = 0.72, ry = 0.54;
    const g = ctx.createRadialGradient(bx - 0.28, by - 0.3, 0.02, bx, by, 0.95);
    g.addColorStop(0, HC.hi); g.addColorStop(0.42, HC.body); g.addColorStop(1, HC.lo);
    ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, 0, 0, TAU);
    ctx.lineWidth = 0.05; ctx.strokeStyle = HC.ink; ctx.stroke(); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    // pink belly, pool light bouncing off the underside, the hard poster highlight on top
    const bg = ctx.createRadialGradient(-0.1, -0.2, 0.05, -0.1, -0.2, 0.62);
    bg.addColorStop(0, '#FBC6D2'); bg.addColorStop(0.6, HC.snout); bg.addColorStop(1, 'rgba(208,116,142,0)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(-0.12, -0.22, 0.62, 0.26, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = HC.rim; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.07;
    ctx.beginPath(); ctx.ellipse(bx, by + 0.02, rx - 0.02, ry - 0.02, 0, 0.55 * Math.PI, 0.95 * Math.PI); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.beginPath(); ctx.ellipse(-0.42, -1.0, 0.26, 0.065, -0.22, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-0.6, -0.95, 0.045, 0.03, -0.3, 0, TAU); ctx.fill();
  }
  _head(ctx) {
    const puff = Math.max(0, this.puff.x), fl = this.flush;
    ctx.save(); ctx.translate(0, this.head.x);
    if (this.tuck > 0.01) { ctx.translate(-0.16 * this.tuck, 0.2 * this.tuck); }
    // head dome
    const hx = 0.3, hy = -0.98;
    const g = ctx.createRadialGradient(hx - 0.14, hy - 0.2, 0.02, hx, hy, 0.55);
    g.addColorStop(0, HC.hi); g.addColorStop(0.5, HC.body); g.addColorStop(1, HC.lo);
    // ears (behind the dome)
    const ea = this.ear.x;
    for (const [ex, ey, sc] of [[0.14, -1.3, 0.85], [0.0, -1.27, 1]]) {
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(-0.35 + ea * (sc < 1 ? 0.8 : 1)); ctx.scale(sc, sc);
      ctx.beginPath(); ctx.ellipse(0, -0.07, 0.075, 0.11, 0, 0, TAU);
      ctx.lineWidth = 0.045; ctx.strokeStyle = HC.ink; ctx.stroke(); ctx.fillStyle = sc < 1 ? HC.far : HC.body; ctx.fill();
      ctx.beginPath(); ctx.ellipse(0.005, -0.065, 0.04, 0.07, 0, 0, TAU); ctx.fillStyle = '#E9849E'; ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(hx, hy, 0.43, 0.4, 0, 0, TAU);
    ctx.lineWidth = 0.05; ctx.strokeStyle = HC.ink; ctx.stroke(); ctx.fillStyle = g; ctx.fill();
    // eye bumps
    for (const [x, y, r] of [[0.46, -1.3, 0.12], [0.24, -1.3, 0.13]]) {
      ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.95, Math.PI * 2.05); ctx.stroke();
      ctx.fillStyle = HC.body; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(0.13, -1.2, 0.12, 0.045, -0.5, 0, TAU); ctx.fill();
    if (fl > 0.01) {
      const f = ctx.createRadialGradient(0.36, -1.0, 0.05, 0.36, -1.0, 0.5);
      f.addColorStop(0, `rgba(226,59,99,${0.55 * fl})`); f.addColorStop(1, 'rgba(226,59,99,0)');
      ctx.fillStyle = f; ctx.beginPath(); ctx.ellipse(hx, hy, 0.43, 0.4, 0, 0, TAU); ctx.fill();
    }
    // cheeks: they balloon when the breath is held
    const cr = 0.17 + 0.17 * puff;
    ctx.beginPath(); ctx.arc(0.36, -0.72 + 0.02 * puff, cr, 0, TAU);
    const cg = ctx.createRadialGradient(0.3, -0.8, 0.01, 0.36, -0.72, cr + 0.05);
    cg.addColorStop(0, fl > 0.4 ? '#F8B6C6' : '#DCD3F7'); cg.addColorStop(0.55, fl > 0.4 ? '#E07C98' : HC.body); cg.addColorStop(1, HC.lo);
    ctx.lineWidth = 0.05; ctx.stroke(); ctx.fillStyle = cg; ctx.fill();
    // the snout
    const sx = 0.62, sy = -0.78, srx = 0.37 * (1 + 0.14 * puff), sry = 0.3 * (1 + 0.22 * puff);
    const sg = ctx.createRadialGradient(sx - 0.1, sy - 0.14, 0.02, sx, sy, 0.45);
    sg.addColorStop(0, HC.snoutHi); sg.addColorStop(0.45, HC.snout); sg.addColorStop(1, HC.snoutLo);
    ctx.beginPath(); ctx.ellipse(sx, sy, srx, sry, -0.08, 0, TAU);
    ctx.stroke(); ctx.fillStyle = sg; ctx.fill();
    if (fl > 0.01) {
      ctx.fillStyle = `rgba(226,59,99,${0.35 * fl})`; ctx.beginPath(); ctx.ellipse(sx, sy, srx, sry, -0.08, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(sx - 0.12, sy - 0.18, 0.12, 0.04, -0.25, 0, TAU); ctx.fill();
    // nostrils flare on a hiccup and while holding
    const flare = 1 + 0.5 * clamp(1 - (this.t - this.hicT) / 0.3) + 0.25 * puff;
    ctx.fillStyle = HC.nostril;
    for (const [nx, ny] of [[0.8, -0.98], [0.64, -1.01]]) {
      ctx.beginPath(); ctx.ellipse(nx + 0.03 * puff, ny - 0.04 * puff, 0.045 * flare, 0.028 * flare, 0.35, 0, TAU); ctx.fill();
    }
    this._mouth(ctx, sx, sy, srx, sry);
    this._eyes(ctx);
    ctx.restore();
  }
  _mouth(ctx, sx, sy, srx, sry) {
    const m = this.mouth, since = this.t - this.hicT;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = HC.mouth; ctx.lineWidth = 0.04;
    const y0 = sy + sry * 0.62;
    if (m === 'smile' || m === 'flat' || m === 'puff') {
      ctx.beginPath();
      if (m === 'smile') { ctx.moveTo(sx - srx * 0.95, y0 - 0.1); ctx.quadraticCurveTo(sx - srx * 0.7, y0 + 0.06, sx + srx * 0.55, y0); }
      else if (m === 'flat') { ctx.moveTo(sx - srx * 0.9, y0 - 0.02); ctx.lineTo(sx + srx * 0.55, y0 - 0.01); }
      else { ctx.moveTo(sx - srx * 0.5, y0 - 0.01); ctx.quadraticCurveTo(sx, y0 + 0.02, sx + srx * 0.4, y0 - 0.02); }
      ctx.stroke();
      if (m === 'puff') { ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(sx + srx * 0.4, y0 - 0.06); ctx.lineTo(sx + srx * 0.46, y0 + 0.02); ctx.stroke(); }
      return;
    }
    if (m === 'ouch') {
      ctx.beginPath(); ctx.moveTo(sx - srx * 0.7, y0);
      for (let i = 1; i <= 6; i++) ctx.lineTo(sx - srx * 0.7 + i * srx * 0.22, y0 + (i % 2 ? -0.035 : 0.035));
      ctx.stroke(); return;
    }
    // open mouths: 'o' (the hiccup), 'scream', 'grin', 'drink'
    let w = 0.1, h = 0.08;
    if (m === 'o') { const k = 1 + 0.35 * this.hicL; const pop = clamp(since / 0.06) * clamp(1.4 - since * 2); w = 0.08 * k; h = (0.05 + 0.07 * Math.max(0.35, pop)) * k; }
    if (m === 'scream') { w = 0.17; h = 0.15; }
    if (m === 'grin') { w = 0.22; h = 0.09; }
    if (m === 'drink') { w = 0.07; h = 0.05 + 0.02 * Math.sin(this.t * 30); }
    const mx = sx + srx * 0.25, my = y0 + 0.02;
    ctx.beginPath();
    if (m === 'grin') { ctx.moveTo(mx - w, my - 0.04); ctx.quadraticCurveTo(mx, my + h * 2, mx + w * 0.8, my - 0.05); ctx.closePath(); }
    else ctx.ellipse(mx, my, w, h, 0, 0, TAU);
    ctx.fillStyle = HC.mouth; ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.fillStyle = HC.tongue; ctx.beginPath(); ctx.ellipse(mx - 0.01, my + h * 0.9, w * 0.8, h * 0.6, 0, 0, TAU); ctx.fill();
    ctx.restore();
    if (m === 'scream' || m === 'grin') {  // the two little tusks
      ctx.fillStyle = HC.tooth;
      for (const tx of [mx - w * 0.55, mx + w * 0.35]) { ctx.beginPath(); rr(ctx, tx - 0.025, my + (m === 'grin' ? -0.03 : h * 0.35), 0.05, 0.07, 0.02); ctx.fill(); }
    }
  }
  _eyes(ctx) {
    const e = this.eyes, t = this.t;
    const pos = [[0.24, -1.31, 1], [0.46, -1.31, 0.9]];
    ctx.lineCap = 'round'; ctx.strokeStyle = HC.pupil;
    pos.forEach(([x, y, sc], i) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      if (e === 'shut') {       // squeezed: > <
        const m = i ? -1 : 1;
        ctx.lineWidth = 0.036; ctx.beginPath(); ctx.moveTo(-0.06 * m, -0.055); ctx.lineTo(0.04 * m, 0); ctx.lineTo(-0.06 * m, 0.045); ctx.stroke();
      } else if (e === 'happy') {
        ctx.lineWidth = 0.035; ctx.beginPath(); ctx.arc(0, 0.03, 0.065, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      } else if (e === 'calm' || e === 'blink') {
        ctx.lineWidth = 0.033; ctx.beginPath(); ctx.arc(0, -0.03, 0.065, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      } else if (e === 'spiral') {
        ctx.fillStyle = HC.eyeW; ctx.beginPath(); ctx.ellipse(0, 0, 0.09, 0.1, 0, 0, TAU); ctx.fill();
        ctx.lineWidth = 0.022; ctx.beginPath();
        for (let a = 0; a < 3.2 * TAU; a += 0.3) { const r = 0.008 + a * 0.0038; const q = a + t * 12; ctx[a ? 'lineTo' : 'moveTo'](Math.cos(q) * r, Math.sin(q) * r); }
        ctx.stroke();
      } else {
        const wide = e === 'wide' ? 1.25 : e === 'pop' ? 1.7 : 1;
        const rx = 0.085 * wide, ry = 0.1 * wide;
        ctx.beginPath(); ctx.ellipse(0, e === 'pop' ? -0.05 : 0, rx, ry, 0, 0, TAU);
        ctx.fillStyle = HC.eyeW; ctx.fill(); ctx.lineWidth = 0.03; ctx.strokeStyle = HC.ink; ctx.stroke();
        const pr = e === 'pop' ? 0.028 : 0.05, gx = 0.03, gy = 0.03 * this.gaze + (e === 'pop' ? -0.05 : 0);
        ctx.fillStyle = HC.pupil; ctx.beginPath(); ctx.arc(gx, gy, pr, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx + 0.018, gy - 0.02, pr * 0.38, 0, TAU); ctx.fill();
        if (e === 'squint') {   // holding with nothing kept yet: heavy lids
          ctx.fillStyle = HC.body; ctx.beginPath(); ctx.ellipse(0, -0.055, rx * 1.15, ry * 0.75, 0, Math.PI, TAU); ctx.fill();
          ctx.lineWidth = 0.03; ctx.strokeStyle = HC.ink; ctx.beginPath(); ctx.moveTo(-rx, -0.02); ctx.lineTo(rx, -0.02); ctx.stroke();
        }
      }
      ctx.restore();
    });
  }
}

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
