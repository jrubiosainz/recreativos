// The cat, drawn from the sim's capsule (±15 cm along the body, 13 cm thick) with a slice of toast taped to its
// back, jam side up. Everything visual that the sim doesn't need lives here: the tail's spring chain, the
// paddling legs, squash, blinks, and a face that tells you what the cat thinks of all this. The intro's puppet can
// ask for a little more: facing left (flip), standing still (stand), a squash of its own, no toast yet, tape half on.
import { K } from '../sim.js';
import { TAU, clamp, lerp, angDiff, damp, rgba, mulberry32, ellipse, roundRect } from '../util.js';
import { INK } from './room.js';

export const C = {
  fur: '#f08a3c', furD: '#cf6a26', stripe: '#c2561a', belly: '#fbe3c4', ear: '#f5a898', nose: '#e8727e', eye: '#f2c230',
  crust: '#b86a2c', crumb: '#f3d49a', jam: '#d2283c', jamD: '#8e1426', jamL: '#f25a68', seed: '#ffe3a3', tape: '#b9bcc0', tapeD: '#8f9398',
};
const SEEDS = [[-0.7, -0.3], [-0.35, 0.45], [0.05, -0.5], [0.3, 0.3], [0.62, -0.2], [-0.05, 0.1], [0.85, 0.35], [-0.9, 0.2]];
const TAIL = 8, SEG = 4.2;
const LEGS = [
  // hip, length, width, phase, far?, sit paw
  { h: [9, 4], l: 9.5, w: 5, ph: Math.PI, far: true, sit: [-8, 11] },
  { h: [-17, 3], l: 9, w: 6, ph: 0, far: true, sit: [-25, 11] },
  { h: [6, 5], l: 9.5, w: 5.4, ph: 0, far: false, sit: [-10, 12] },
  { h: [-14, 4], l: 9, w: 6.4, ph: Math.PI, far: false, sit: [-26, 13] },
];

export class CatViz {
  constructor() { this.rng = mulberry32(77); this.reset(); }
  reset() {
    this.tail = null; this.t = 0; this.sq = 0; this.sqv = 0;
    this.blink = 0; this.nextBlink = 1.5; this.face = null; this.faceT = 0;
    this.phase = 0; this.amp = 0; this.sitK = 0; this.headRot = 0; this.ears = 0; this.puff = 0; this.wet = 0; this.splat = 0;
  }
  kick(a) { this.sqv += a * 30; }
  setFace(f, t) { this.face = f; this.faceT = t; }
  event(e) {
    switch (e.k) {
      case 'bonk': this.kick(0.3); this.setFace('x', 0.8); break;
      case 'sit': this.kick(e.box ? 0.22 : 0.12); break;
      case 'bump': this.kick(Math.min(0.2, e.v / 1500)); if (e.v > 140) this.setFace('ouch', 0.4); break;
      case 'knock': this.kick(0.2); this.setFace('x', 0.6); break;
      case 'cucumber': this.puff = 1; this.setFace('fright', 1.2); break;
      case 'spin': this.kick(-0.12); break;
      case 'sizzle': this.setFace('hot', 0.6); break;
      case 'splash': this.wet = 1; this.setFace('wet', 99); break;
      case 'tempt': this.setFace('smug', 1.4); break;
      case 'break': if (this.face !== 'smug') this.setFace('oops', 0.9); break;
      case 'squirt': this.splat = 1; this.setFace('yuck', 0.9); break;
      case 'refill': if (!this.face) this.setFace('purr', 0.5); break;
      case 'hop': this.kick(-0.14); break;
      case 'end': if (e.win) this.setFace('happy', 99); else if (e.why === 'jam') this.setFace('sad', 99); break;
    }
  }
  update(dt, s) {
    this.t += dt;
    if (s.squash != null) { this.sq = s.squash; this.sqv = 0; }
    else { this.sqv += (-260 * this.sq - 16 * this.sqv) * dt; this.sq = clamp(this.sq + this.sqv * dt, -0.3, 0.3); }
    if ((this.faceT -= dt) <= 0) this.face = null;
    if ((this.nextBlink -= dt) <= 0) { this.blink = 0.13; this.nextBlink = 1.8 + this.rng() * 3.2; }
    this.blink = Math.max(0, this.blink - dt);
    this.puff = Math.max(0, this.puff - dt * 0.8); this.splat = Math.max(0, this.splat - dt * 0.28);
    const sp = Math.hypot(s.vx, s.vy), sitting = !!s.sit || !!(s.end && s.end.win);
    this.ears = damp(this.ears, clamp((sp - 140) / 180) + (this.face === 'fright' || this.face === 'hot' ? 1 : 0), 10, dt);
    this.sitK = damp(this.sitK, sitting ? 1 : 0, 9, dt);
    this.amp = s.stand ? damp(this.amp, 0, 18, dt) : damp(this.amp, sitting ? 0 : clamp(0.25 + Math.abs(s.vx) / 260, 0, 0.9), 6, dt);
    this.phase += dt * (6 + Math.abs(s.vx) / 22);
    const level = angDiff(0, s.th), spinning = Math.abs(s.w) > 5;
    this.headRot = damp(this.headRot, spinning ? 0 : lerp(clamp(level * 0.3, -0.45, 0.45), level, this.sitK) * (s.flip || 1), 10, dt);
    this.tailStep(dt, s);
  }
  // the tail: each link chases where the body wants it, the tip lazier than the root, then keeps its length
  tailStep(dt, s) {
    const W = (lx, ly) => this.toWorld(s, lx, ly);
    const sway = Math.sin(this.t * (this.sitK > 0.5 ? 2.2 : 5)) * (this.sitK > 0.5 ? 0.5 : 0.18);
    const rest = [], base = [-23, -3];
    let px = base[0], py = base[1], a = lerp(Math.PI + 0.05, Math.PI / 2 + 0.55, this.sitK);
    rest.push([px, py]);
    for (let i = 1; i < TAIL; i++) {
      a += lerp(0.24, -0.27, this.sitK) + sway * (i / TAIL) * 0.6;
      px += Math.cos(a) * SEG; py += Math.sin(a) * SEG; rest.push([px, py]);
    }
    if (!this.tail) this.tail = rest.map(([lx, ly]) => W(lx, ly));
    const T = this.tail;
    T[0] = W(...rest[0]);
    for (let i = 1; i < TAIL; i++) {
      const [tx, ty] = W(...rest[i]), lam = lerp(34, 7, i / (TAIL - 1)), k = 1 - Math.exp(-lam * dt);
      const p = T[i]; p[0] += (tx - p[0]) * k; p[1] += (ty - p[1]) * k + 30 * dt * (i / TAIL) * (1 - this.sitK);
      const q = T[i - 1], dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy) || 1;
      p[0] = q[0] + (dx / d) * SEG; p[1] = q[1] + (dy / d) * SEG;
    }
    // sitting, the tail lies along the floor (of the box) instead of through it
    const fl = s.sit?.s;
    if (fl) { const fy = fl.y - 0.7; for (let i = 1; i < TAIL; i++) if (T[i][1] > fy) T[i][1] = fy; }
  }

  // the paradox holding the cat up: a shimmer between the cat and whatever it hovers over
  drawCushion(ctx, s, t) {
    const h = s.hover; if (!h || h.none || s.sit || s.end) return;
    const f = clamp(s.fight) * (0.5 + 0.5 * clamp(1 - h.h / K.reach)) * (0.8 + 0.4 * s.charge);
    if (f < 0.03) return;
    const low = s.lowY(), ex = s.extX() * 0.9, x = s.x;
    // the column trails a moving cat; on a run-up it reaches forward onto the step's edge, like a ramp
    const R = h.run, gy = R ? Math.max(R.y, low + 6) : h.gy, hgt = gy - low;
    if (hgt < 1) return;
    const lean = R ? R.x + R.dir * ex * 0.9 - x : clamp(-s.vx * 0.06, -14, 14);
    ctx.save();
    const col = ctx.createLinearGradient(0, low, 0, gy);
    col.addColorStop(0, 'rgba(255,220,110,0)'); col.addColorStop(0.55, `rgba(255,214,90,${(0.16 * f).toFixed(3)})`); col.addColorStop(1, `rgba(255,196,60,${(0.42 * f).toFixed(3)})`);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x - ex * 0.6, low); ctx.lineTo(x + ex * 0.6, low); ctx.lineTo(x + lean + ex * 1.1, gy); ctx.lineTo(x + lean - ex * 1.1, gy); ctx.closePath(); ctx.fill();
    // rings pressed down the column, faster the harder the two laws fight
    for (let i = 0; i < 4; i++) {
      const u = (t * (1.4 + 2.6 * s.fight + 1.5 * s.charge) + i / 4) % 1, yy = low + hgt * u, w = ex * lerp(0.6, 1.1, u), cx = x + lean * u;
      ctx.strokeStyle = `rgba(255,${lerp(236, 184, u) | 0},${lerp(150, 50, u) | 0},${(0.85 * f * Math.sin(Math.PI * u)).toFixed(3)})`;
      ctx.lineWidth = lerp(0.8, 1.8, u); ctx.beginPath(); ctx.ellipse(cx, yy, w, 1.6 + 2.2 * u, 0, 0, TAU); ctx.stroke();
    }
    // where it pushes on the ground: a glow and a trembling ring
    const gx = x + lean, pr = 1 + 0.1 * Math.sin(t * 24);
    const gl = ctx.createRadialGradient(gx, gy, 0, gx, gy, ex * 1.6);
    gl.addColorStop(0, `rgba(255,226,120,${(0.5 * f).toFixed(3)})`); gl.addColorStop(1, 'rgba(255,226,120,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(gx, gy - 0.3, ex * 1.6, 4.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,190,60,${(0.9 * f).toFixed(3)})`; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(gx, gy - 0.4, ex * 1.2 * pr, 3 * pr, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${(0.75 * f).toFixed(3)})`; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(gx, gy - 0.4, ex * 0.75 * pr, 1.9 * pr, 0, 0, TAU); ctx.stroke();
    // motes rising through it
    for (let i = 0; i < 5; i++) {
      const u = (t * 0.9 + i * 0.37) % 1, mx = x + lean * (1 - u) + Math.sin(t * 3 + i * 2.1) * ex * 0.7, my = gy - hgt * u;
      ctx.fillStyle = `rgba(255,244,200,${(0.95 * f * Math.sin(Math.PI * u)).toFixed(3)})`;
      star(ctx, mx, my, 0.9 + 0.5 * ((i * 7) % 3), t * 2 + i); ctx.fill();
    }
    ctx.restore();
  }
  // a whirl around a spinning cat
  drawSwirl(ctx, s, t) {
    const a = clamp((Math.abs(s.w) - 5) / 8); if (a <= 0 || s.end) return;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.th);
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const r = 33 + i * 4, off = (i * TAU) / 3 + t * 2;
      ctx.strokeStyle = `rgba(255,255,255,${(0.55 - i * 0.12) * a})`; ctx.lineWidth = 2.2 - i * 0.5;
      ctx.beginPath(); ctx.arc(0, 0, r, off, off + (Math.sign(s.w) || 1) * -1.3, s.w > 0); ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- the rig
const BODY = (g, begin = true) => {
  if (begin) g.beginPath();
  g.moveTo(-22, -6);
  g.bezierCurveTo(-18, -11, -6, -10.6, 2, -10.1); g.bezierCurveTo(8, -9.6, 12, -8.2, 14.5, -5);
  g.lineTo(14.5, 3); g.bezierCurveTo(12.5, 7.2, 6, 8.6, -2, 8.6); g.bezierCurveTo(-10, 8.6, -18, 7.6, -22, 4.2);
  g.bezierCurveTo(-25.6, 1, -25.6, -3.6, -22, -6); g.closePath();
};
// a bristling outline for when a cucumber appears
const PUFF = (g, p, t) => {
  g.beginPath(); const n = 26;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, r = (i % 2 ? 1 : 1.28 + 0.06 * Math.sin(t * 40 + i)) * p;
    const x = -5 + Math.cos(a) * (21 + 4 * r), y = Math.sin(a) * (10 + 4 * r);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
};

Object.assign(CatViz.prototype, {
  pose(s) {
    const sitK = this.sitK, spin = Math.abs(s.w) > 5, ph = this.phase, amp = this.amp;
    return LEGS.map((L, i) => {
      const hind = i % 2 === 1, hip = hind ? [lerp(L.h[0], L.h[0] - 4, sitK), L.h[1] + sitK * 1.5] : L.h;
      let a = Math.sin(ph + L.ph) * amp * (hind ? 0.75 : 0.95);
      if (spin) a = (hind ? -0.9 : 0.9) + Math.sin(ph * 2 + L.ph) * 0.2;        // tucked in a ball
      const len = L.l * (spin ? 0.72 : 1);
      const fly = [hip[0] + Math.sin(a) * len, hip[1] + Math.cos(a) * len * (1 - 0.18 * this.ears)];
      const sit = s.sit && s.sit.s && s.sit.s.tag === 'boxfloor' && !hind ? [L.sit[0] + 12, L.sit[1] - 3] : L.sit;
      return { L, hip, paw: [lerp(fly[0], sit[0], sitK), lerp(fly[1], sit[1], sitK)] };
    });
  },
  leg(g, P, lw, far) {
    const { L, hip, paw } = P, w = L.w, a = Math.atan2(paw[1] - hip[1], paw[0] - hip[0]);
    g.lineCap = 'round';
    g.strokeStyle = INK; g.lineWidth = w + lw * 2; g.beginPath(); g.moveTo(...hip); g.lineTo(...paw); g.stroke();
    g.strokeStyle = far ? C.furD : C.fur; g.lineWidth = w; g.beginPath(); g.moveTo(...hip); g.lineTo(...paw); g.stroke();
    g.save(); g.translate(...paw); g.rotate(a - Math.PI / 2);
    ellipse(g, 0, 0.6, w * 0.62, w * 0.5); g.fillStyle = far ? '#e3c6a4' : C.belly; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
    if (!far) { g.lineWidth = lw * 0.7; g.beginPath(); g.moveTo(-w * 0.2, w * 0.35); g.lineTo(-w * 0.2, w * 0.95); g.moveTo(w * 0.2, w * 0.35); g.lineTo(w * 0.2, w * 0.95); g.stroke(); }
    g.restore();
  },
  drawTail(g, lw) {
    const T = this.tail; if (!T) return;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const wAt = (i) => lerp(5.4, 3.6, i / (TAIL - 1));
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < TAIL; i++) {
        g.strokeStyle = pass ? (i >= TAIL - 2 || i % 2 === 0 ? C.stripe : C.fur) : INK;
        g.lineWidth = wAt(i) + (pass ? 0 : lw * 2);
        g.beginPath(); g.moveTo(...T[i - 1]); g.lineTo(...T[i]); g.stroke();
      }
    }
  },
  body(g, lw, s) {
    if (this.puff > 0.02) { PUFF(g, this.puff, this.t); g.fillStyle = C.fur; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); }
    BODY(g); g.fillStyle = C.fur; g.fill();
    g.save(); BODY(g); g.clip();
    ellipse(g, -3, 10.5, 15, 5.4); g.fillStyle = C.belly; g.fill();
    g.strokeStyle = C.stripe; g.lineCap = 'round'; g.lineWidth = 2.3;
    for (const x of [-18, -12, -6, 0.5, 7]) { g.beginPath(); g.moveTo(x + 1.5, -12); g.quadraticCurveTo(x - 1, -7, x - 0.4, -3.6); g.stroke(); }
    g.strokeStyle = rgba('#ffffff', 0.22); g.lineWidth = 1.6; g.beginPath(); g.moveTo(-19, -7.4); g.bezierCurveTo(-12, -9.8, 0, -9.4, 9, -7.6); g.stroke();
    if (this.wet > 0) { g.fillStyle = `rgba(52,40,70,${0.3 * this.wet})`; g.fillRect(-30, -14, 50, 26); }
    // a squirt of jam in the belly, sliding off
    if (this.splat > 0) {
      const a = Math.min(1, this.splat * 1.6), k = 1 - this.splat, x = -2, y = 7.2 + k * 1.5;
      g.fillStyle = rgba(C.jam, a); g.beginPath();
      for (let i = 0; i <= 10; i++) { const q = (i / 10) * TAU, r = 3.6 * (1 + 0.28 * Math.sin(q * 4 + 1)); i ? g.lineTo(x + Math.cos(q) * r * 1.5, y + Math.sin(q) * r * 0.75) : g.moveTo(x + Math.cos(q) * r * 1.5, y + Math.sin(q) * r * 0.75); }
      g.fill();
      for (const [ddx, L] of [[-3.5, 3], [1.8, 4.5], [4.6, 2.2]]) { ellipse(g, x + ddx, y + 1.5 + L * (0.4 + k), 0.9, L * 0.5 + k * 2); g.fill(); }
      g.fillStyle = rgba('#ffffff', a * 0.6); ellipse(g, x - 2, y - 0.8, 1.6, 0.5); g.fill();
    }
    g.restore();
    BODY(g); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
  },
});

// ---------------------------------------------------------------- toast, jam, tape
// The slice lies on the back, seen a little from above: its face is a squashed loaf shape, the crown (two
// shoulders over a neck) at the tail end, and under it the crust's edge. Clockwise, like BODY, so the two
// can share a clip.
const TX0 = -20, TX1 = 7.5, TTOP = -17, TMID = -12.2, TH = 2.4;
const SLICE = (g, y0, y1, begin = true) => {
  const h = y1 - y0, n = h * 0.06, o = h * 0.26, x0 = TX0, x1 = TX1, cx = x0 + 3.6;
  if (begin) g.beginPath();
  g.moveTo(cx + 1.6, y0 + n);
  g.lineTo(x1 - 1.3, y0 + n); g.quadraticCurveTo(x1, y0 + n, x1, y0 + n + 1.1);
  g.lineTo(x1, y1 - n - 1.1); g.quadraticCurveTo(x1, y1 - n, x1 - 1.3, y1 - n);
  g.lineTo(cx + 1.6, y1 - n);
  g.bezierCurveTo(cx + 0.2, y1 - n, cx + 0.6, y1 + o, cx - 1, y1 + o);
  g.bezierCurveTo(x0 - 1.2, y1 + o, x0 - 1.2, y0 - o, cx - 1, y0 - o);
  g.bezierCurveTo(cx + 0.6, y0 - o, cx + 0.2, y0 + n, cx + 1.6, y0 + n);
  g.closePath();
};
const PORES = [[-15.5, -15.2], [-12, -13.6], [-9, -15.8], [-3.5, -13.4], [0.5, -15.6], [4, -14.2], [-17.2, -13.4], [2.5, -12.9]];
Object.assign(CatViz.prototype, {
  toast(g, lw, s) {
    const b = clamp(s.b), t = this.t, k = s.tape;
    this.slice(g, lw);
    // duct tape round the lot: over the slice, down the flank, under the belly (the intro winds it on)
    g.save(); BODY(g); SLICE(g, TTOP, TMID, false); SLICE(g, TTOP + TH, TMID + TH, false); g.clip();
    this.tape(g, -15.6, 3.5, k ? k[0] : 1); this.tape(g, 1.4, 3.5, k ? k[1] : 1, true);
    g.restore();
    if (b > 0.01) this.jam(g, lw, s, b, t);
    else { g.strokeStyle = rgba('#ffffff', 0.35); g.lineWidth = 0.5; g.beginPath(); g.moveTo(-11, -15.6); g.lineTo(-2, -15.9); g.stroke(); }
  },
  // the crust's edge, then the face
  slice(g, lw) {
    SLICE(g, TTOP + TH, TMID + TH); g.fillStyle = C.crust; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
    const face = g.createRadialGradient(-6, -14.8, 1, -6, -14.8, 16);
    face.addColorStop(0, '#f7d993'); face.addColorStop(0.7, '#eab565'); face.addColorStop(1, '#d48f45');
    SLICE(g, TTOP, TMID); g.fillStyle = face; g.fill();
    g.save(); g.clip(); g.strokeStyle = '#b8682c'; g.lineWidth = 1.7; g.stroke(); g.restore();
    g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
    g.fillStyle = rgba('#a8622a', 0.45);
    for (const [x, y] of PORES) { ellipse(g, x, y, 0.42, 0.22); g.fill(); }
  },
  // a slice lying about or flying, jam side up at a = 0, centred on (x, y)
  looseToast(g, x, y, a, s, o = {}) {
    const lw = Math.max(0.7, (o.px || 0.4) * 1.15), f = o.flip || 1;
    g.save(); g.lineJoin = 'round'; g.translate(x, y); g.rotate(a); g.scale(f, 1); g.translate(6.3, 13.4);
    this.slice(g, lw);
    if (s.b > 0.01) this.jam(g, lw, { th: a, sag: 0, flip: f }, clamp(s.b), this.t);
    g.restore();
  },
  // band k of the way on, from the top of the slice down the flank to under the belly (or, up, the other way)
  tape(g, x0, w, k = 1, up = false) {
    if (k <= 0) return;
    k = Math.min(1, k);
    const Y0 = TTOP - 3, Y1 = 11, ya = up ? lerp(Y1, Y0, k) : Y0, yb = up ? Y1 : lerp(Y0, Y1, k), sk = (y) => (0.9 * (y - Y0)) / (Y1 - Y0);
    g.beginPath(); g.moveTo(x0 + sk(ya), ya); g.lineTo(x0 + w + sk(ya), ya); g.lineTo(x0 + w + sk(yb), yb); g.lineTo(x0 + sk(yb), yb); g.closePath();
    g.fillStyle = C.tape; g.fill();
    g.strokeStyle = rgba(C.tapeD, 0.5); g.lineWidth = 0.22;
    for (let y = Y0 + 1; y < yb; y += 1.7) { if (y < ya) continue; g.beginPath(); g.moveTo(x0 - 0.2, y); g.lineTo(x0 + w + 1, y - 0.5); g.stroke(); }
    g.strokeStyle = rgba('#ffffff', 0.55); g.lineWidth = 0.6; g.beginPath(); g.moveTo(x0 + 0.8 + sk(ya), ya); g.lineTo(x0 + 0.8 + sk(yb), yb); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 0.45;
    g.beginPath(); g.moveTo(x0 + sk(ya), ya); g.lineTo(x0 + sk(yb), yb); g.moveTo(x0 + w + sk(ya), ya); g.lineTo(x0 + w + sk(yb), yb); g.stroke();
    if (k < 1) { const y = up ? ya : yb; g.strokeStyle = C.tapeD; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x0 + sk(y), y); g.lineTo(x0 + w + sk(y), y); g.stroke(); }
    // where the tape leaves the slice for the fur, a shadow
    if (ya < TMID + TH && yb > TMID + TH + 0.8) { g.fillStyle = rgba('#000000', 0.16); g.fillRect(x0 - 1, TMID + TH - 0.2, w + 2, 0.9); }
  },
  // the jam: a glossy spread with seeds and a chunk of strawberry, smaller as it's used up. Its drips always hang
  // towards the floor: feet down they run over the crust's front edge; turned over, the whole spread sags off the
  // face and hangs in drips that stretch and let go (the sim drops them as gloops)
  jam(g, lw, s, b, t) {
    const cx = -6.4, cy = -14.3, pw = lerp(6, 21, b), pd = lerp(1.9, 3.7, b);
    const dx = Math.sin(s.th) * (s.flip || 1), dy = Math.cos(s.th), out = clamp(s.sag || 0) * clamp(-dy * 1.3);
    const ox = cx + dx * out * 1.2, oy = cy + dy * out * 1.4;
    const pt = (a, k = 1) => {
      const ca = Math.cos(a), sa = Math.sin(a), r = (1 + 0.11 * Math.sin(a * 3 + 1.3) + 0.07 * Math.sin(a * 5 + t * 0.9)) * k;
      const f = Math.max(0, ca * dx + sa * dy) * out * 2.6;
      return [ox + ca * pw * 0.5 * r + dx * f, oy + sa * pd * 0.5 * r + dy * f];
    };
    g.beginPath();
    for (let i = 0; i <= 16; i++) { const [x, y] = pt((i / 16) * TAU); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath();
    const gr = g.createLinearGradient(0, oy - pd, 0, oy + pd);
    gr.addColorStop(0, C.jamL); gr.addColorStop(0.45, C.jam); gr.addColorStop(1, C.jamD);
    g.fillStyle = gr; g.fill(); g.strokeStyle = INK; g.lineWidth = lw * 0.7; g.stroke();
    // a chunk of strawberry, the seeds, and the shine
    if (b > 0.3) {
      ellipse(g, ox - pw * 0.16, oy - pd * 0.05, pw * 0.12, pd * 0.3, -0.2); g.fillStyle = C.jamD; g.fill();
      ellipse(g, ox - pw * 0.19, oy - pd * 0.14, pw * 0.05, pd * 0.1, -0.2); g.fillStyle = rgba('#ffb0b8', 0.8); g.fill();
    }
    g.fillStyle = C.seed;
    for (const [u, v] of SEEDS) { if (Math.abs(u) > b + 0.25) continue; ellipse(g, ox + u * pw * 0.42, oy + v * pd * 0.36, 0.28, 0.17); g.fill(); }
    g.strokeStyle = rgba('#ffffff', 0.8); g.lineWidth = 0.45; g.lineCap = 'round';
    g.beginPath(); g.ellipse(ox - pw * 0.05, oy - pd * 0.08, pw * 0.3, pd * 0.24, 0, Math.PI * 1.12, Math.PI * 1.62); g.stroke();
    // drips, pointing at the floor
    const drip = (ax, ay, L, w) => {
      if (L < 0.15) return;
      const ux = dx, uy = dy, nx = -uy, ny = ux, ex = ax + ux * L, ey = ay + uy * L, r = w * (0.85 + 0.35 * Math.min(1, L / 3)), a0 = Math.atan2(ny, nx);
      g.beginPath(); g.moveTo(ax + nx * w, ay + ny * w);
      g.quadraticCurveTo(ex + nx * w * 0.3 - ux * r, ey + ny * w * 0.3 - uy * r, ex + nx * r, ey + ny * r);
      g.arc(ex, ey, r, a0, a0 - Math.PI, true);
      g.quadraticCurveTo(ex - nx * w * 0.3 - ux * r, ey - ny * w * 0.3 - uy * r, ax - nx * w, ay - ny * w);
      g.closePath(); g.fillStyle = C.jam; g.fill();
      g.fillStyle = rgba('#ffffff', 0.6); ellipse(g, ex - nx * r * 0.35 - ux * r * 0.3, ey - ny * r * 0.35 - uy * r * 0.3, r * 0.28, r * 0.2); g.fill();
    };
    if (dy > 0.25) {
      if (b > 0.45) for (const [k, ph] of [[0.34, 0], [-0.3, 2.1]]) drip(cx + pw * k, TMID - 0.4, (0.8 + 2.6 * (b - 0.45)) * (0.75 + 0.25 * Math.sin(t * 2.6 + ph)), 0.75);
    } else if (out > 0.05) {
      const n = out > 0.55 ? 3 : 2, rate = 0.7 + 1.3 * out;
      for (let i = 0; i < n; i++) {
        const [ax, ay] = pt(Math.atan2(dy, dx) + (i - (n - 1) / 2) * 0.55, 0.92), u = (t * rate + i * 0.37) % 1;
        drip(ax, ay, out * (1.2 + 6 * u * u), 0.7 + 0.25 * out);
      }
    }
  },
});

// ---------------------------------------------------------------- the head and what it thinks
const FACE = {
  grumpy: { eyes: 'open', lid: 0.42, slant: 0.55, pupil: 'slit', mouth: 'frown' },
  alarm: { eyes: 'open', lid: 0, slant: -0.25, pupil: 'round', mouth: 'o' },
  worried: { eyes: 'open', lid: 0.1, slant: -0.65, pupil: 'round', mouth: 'wavy', sweat: 1 },
  smug: { eyes: 'open', lid: 0.56, slant: -0.2, pupil: 'slit', mouth: 'smile' },
  meh: { eyes: 'open', lid: 0.52, slant: 0.12, pupil: 'slit', mouth: 'w' },
  purr: { eyes: 'closed', mouth: 'w' },
  happy: { eyes: 'closed', mouth: 'open' },
  x: { eyes: 'x', mouth: 'open' },
  spiral: { eyes: 'spiral', mouth: 'wavy' },
  hot: { eyes: 'squeeze', mouth: 'open' },
  fright: { eyes: 'open', lid: 0, slant: -0.35, pupil: 'dot', mouth: 'open' },
  oops: { eyes: 'open', lid: 0, slant: -0.35, pupil: 'round', mouth: 'o' },
  ouch: { eyes: 'wince', mouth: 'frown' },
  sad: { eyes: 'open', lid: 0.28, slant: -0.6, pupil: 'round', mouth: 'frown', tear: 1 },
  wet: { eyes: 'open', lid: 0.58, slant: 0.05, pupil: 'slit', mouth: 'flat', droop: 1 },
  yuck: { eyes: 'squeeze', mouth: 'wavy', droop: 1 },
};
const EYES = [{ x: 1.6, y: -1.9, rx: 2.55, ry: 2.55, inner: 1 }, { x: 8.3, y: -2, rx: 1.75, ry: 2.4, inner: -1 }];

Object.assign(CatViz.prototype, {
  faceKey(s) {
    if (this.face) return this.face;
    if (Math.abs(s.w) > 7 || s.dizzy > 0) return 'spiral';
    if (s.sit) return s.sit.s && s.sit.s.tag === 'boxfloor' ? 'purr' : 'meh';
    if (s.b < 0.28) return 'worried';
    if (this.ears > 0.6) return 'alarm';
    return 'grumpy';
  },
  ear(g, lw, base0, base1, tip, tipBack, col) {
    const e = this.ears, tx = lerp(tip[0], tipBack[0], e), ty = lerp(tip[1], tipBack[1], e);
    g.beginPath(); g.moveTo(...base0); g.quadraticCurveTo((base0[0] + tx) / 2 - 0.8, (base0[1] + ty) / 2, tx, ty); g.quadraticCurveTo((base1[0] + tx) / 2 + 0.6, (base1[1] + ty) / 2, ...base1); g.closePath();
    g.fillStyle = col; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
    const cx = (base0[0] + base1[0]) / 2, cy = (base0[1] + base1[1]) / 2;
    g.beginPath(); g.moveTo(lerp(cx, base0[0], 0.55), lerp(cy, base0[1], 0.55)); g.lineTo(lerp(cx, tx, 0.78), lerp(cy, ty, 0.78)); g.lineTo(lerp(cx, base1[0], 0.55), lerp(cy, base1[1], 0.55)); g.closePath();
    g.fillStyle = C.ear; g.fill();
  },
  head(g, lw, s) {
    const k = this.sitK;
    g.save(); g.translate(lerp(18, 17, k), lerp(-3, 0, k)); g.rotate(this.headRot);
    this.ear(g, lw, [2.4, -8.4], [8.4, -5.4], [7, -14.6], [0.5, -11.4], C.furD);
    this.ear(g, lw, [-7, -5.2], [-0.8, -8.6], [-5, -14.4], [-11.4, -8.6], C.fur);
    // cheek ruff, head, forehead stripes
    g.beginPath(); g.moveTo(-8.4, 0.5); g.lineTo(-11.8, 3.2); g.lineTo(-8.8, 4.2); g.lineTo(-10.6, 6.9); g.lineTo(-6.6, 6.6); g.lineTo(-6, 4); g.closePath();
    g.fillStyle = C.fur; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
    ellipse(g, 0, 0, 10.2, 8.9); g.fillStyle = C.fur; g.fill();
    g.save(); ellipse(g, 0, 0, 10.2, 8.9); g.clip();
    g.strokeStyle = C.stripe; g.lineCap = 'round'; g.lineWidth = 1.5;
    for (const [x0, x1] of [[-1.8, -1], [1.2, 1.4], [4.2, 3.4]]) { g.beginPath(); g.moveTo(x0, -9.4); g.lineTo(x1, -6); g.stroke(); }
    ellipse(g, 6, 4.8, 5.6, 3.8); g.fillStyle = rgba(C.belly, 0.9); g.fill();
    if (this.wet > 0) { g.fillStyle = `rgba(52,40,70,${0.3 * this.wet})`; g.fillRect(-11, -10, 22, 20); }
    g.restore();
    ellipse(g, 0, 0, 10.2, 8.9); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
    this.face2(g, lw, s, FACE[this.faceKey(s)] || FACE.grumpy);
    g.restore();
  },
  face2(g, lw, s, F) {
    const t = this.t, A = s.th + this.headRot, ca = Math.cos(-A), sa = Math.sin(-A);
    const lx = clamp((s.vx * ca - s.vy * sa) / 380, -1, 1) * (s.flip || 1), ly = clamp((s.vx * sa + s.vy * ca) / 380, -1, 1);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INK;
    for (const E of EYES) this.eye(g, lw, E, F, lx, ly, t);
    // nose, mouth, whiskers
    g.beginPath(); g.moveTo(4.9, 0.7); g.lineTo(7.3, 0.7); g.lineTo(6.1, 2); g.closePath(); g.fillStyle = C.nose; g.fill(); g.lineWidth = lw * 0.6; g.stroke();
    g.lineWidth = lw * 0.75; g.beginPath();
    const m = F.mouth;
    if (m === 'open' || m === 'o') {
      g.moveTo(6.1, 2); g.lineTo(6.1, 2.7); g.stroke();
      const r = m === 'o' ? 0.95 : 1.7, oy = m === 'o' ? 3.9 : 4.4;
      ellipse(g, 6.1, oy, r * 0.95, r * (m === 'o' ? 1 : 1.1 + 0.15 * Math.sin(t * 18))); g.fillStyle = '#5a1f2a'; g.fill(); g.stroke();
      if (m === 'open') { ellipse(g, 6.1, oy + r * 0.55, r * 0.6, r * 0.38); g.fillStyle = '#ef7d8a'; g.fill(); }
    } else {
      g.moveTo(6.1, 2); g.lineTo(6.1, 2.9);
      if (m === 'frown') { g.moveTo(6.1, 2.9); g.quadraticCurveTo(5, 2.7, 4.1, 3.9); g.moveTo(6.1, 2.9); g.quadraticCurveTo(7.2, 2.7, 8, 3.8); }
      else if (m === 'w' || m === 'smile') { const u = m === 'smile' ? 0.6 : 0; g.moveTo(6.1, 2.9); g.quadraticCurveTo(5.2, 4.2 + u, 4.1, 2.9 - u); g.moveTo(6.1, 2.9); g.quadraticCurveTo(7, 4.2 + u, 8, 2.9 - u); }
      else if (m === 'flat') { g.moveTo(4.4, 3.5); g.lineTo(7.8, 3.5); }
      else if (m === 'wavy') { g.moveTo(4.1, 3.9); for (let i = 1; i <= 4; i++) g.lineTo(4.1 + i * 0.95, 3.9 + (i % 2 ? -0.55 : 0)); }
      g.stroke();
    }
    const d = F.droop ? 2.2 : 0;
    g.strokeStyle = rgba('#fff6e6', 0.9); g.lineWidth = 0.32;
    g.beginPath(); g.moveTo(8.8, 3); g.lineTo(14.6, 1.6 + d); g.moveTo(8.9, 3.6); g.lineTo(14.8, 4 + d); g.moveTo(8.6, 4.2); g.lineTo(13.9, 6.1 + d);
    g.moveTo(3.4, 3.4); g.lineTo(-2.6, 2.1 + d); g.moveTo(3.4, 4); g.lineTo(-2.8, 4.7 + d); g.stroke();
    if (F.sweat) { const y = -5 + ((t * 0.9) % 1) * 3; g.beginPath(); g.moveTo(-6.5, y - 2); g.quadraticCurveTo(-5, y + 0.6, -6.5, y + 0.9); g.quadraticCurveTo(-8, y + 0.6, -6.5, y - 2); g.fillStyle = '#8fd0ff'; g.fill(); g.strokeStyle = INK; g.lineWidth = lw * 0.6; g.stroke(); }
    if (F.tear) { const y = 1 + ((t * 0.7) % 1) * 5; ellipse(g, 1, y, 0.7, 1); g.fillStyle = '#8fd0ff'; g.fill(); }
  },
});

// ---------------------------------------------------------------- eyes, the whole cat, extras
const star = (g, x, y, r, a) => {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, q = a + (i * Math.PI) / 5 - Math.PI / 2; i ? g.lineTo(x + Math.cos(q) * rr, y + Math.sin(q) * rr) : g.moveTo(x + Math.cos(q) * rr, y + Math.sin(q) * rr); }
  g.closePath();
};
export { star };

Object.assign(CatViz.prototype, {
  eye(g, lw, E, F, lx, ly, t) {
    const { x, y, rx, ry, inner } = E;
    let kind = F.eyes, lid = F.lid || 0, slant = F.slant || 0, pupil = F.pupil;
    if (kind === 'wince') { if (inner === 1) kind = 'squeeze'; else { kind = 'open'; lid = 0.08; slant = -0.35; pupil = 'round'; } }
    if (kind === 'open' && this.blink > 0) kind = 'blink';
    g.strokeStyle = INK; g.lineCap = 'round';
    if (kind === 'open') {
      ellipse(g, x, y, rx, ry); g.fillStyle = C.eye; g.fill();
      g.save(); ellipse(g, x, y, rx, ry); g.clip();
      const px = x + lx * rx * 0.34, py = y + ly * ry * 0.28;
      const pr = pupil === 'slit' ? [rx * 0.27, ry * 0.82] : pupil === 'dot' ? [rx * 0.24, ry * 0.24] : [rx * 0.5, ry * 0.54];
      ellipse(g, px, py, pr[0], pr[1]); g.fillStyle = '#1c1210'; g.fill();
      g.beginPath(); g.arc(x - rx * 0.3, y - ry * 0.36, Math.min(rx, ry) * 0.25, 0, TAU); g.fillStyle = '#ffffff'; g.fill();
      const top = y - ry, yi = top + 2 * ry * lid + slant * ry * 0.5, yo = top + 2 * ry * lid - slant * ry * 0.5;
      const xi = x + inner * (rx + 1), xo = x - inner * (rx + 1);
      if (lid > 0 || slant) { g.beginPath(); g.moveTo(xo, yo); g.lineTo(xi, yi); g.lineTo(xi, top - 4); g.lineTo(xo, top - 4); g.closePath(); g.fillStyle = C.fur; g.fill(); }
      g.restore();
      ellipse(g, x, y, rx, ry); g.lineWidth = lw * 0.8; g.stroke();
      if (lid > 0 || slant) {
        g.save(); ellipse(g, x, y, rx + 0.8, ry + 0.8); g.clip();
        g.beginPath(); g.moveTo(xo, yo); g.lineTo(xi, yi); g.lineWidth = lw * 1.1; g.stroke(); g.restore();
      }
      return;
    }
    g.lineWidth = lw * 1.05; g.beginPath();
    if (kind === 'blink') { g.moveTo(x - rx, y); g.quadraticCurveTo(x, y + ry * 0.55, x + rx, y); }
    else if (kind === 'closed') { g.moveTo(x - rx, y + 0.6); g.quadraticCurveTo(x, y - ry * 1.3, x + rx, y + 0.6); }
    else if (kind === 'x') { const a = rx * 0.8, b = ry * 0.8; g.moveTo(x - a, y - b); g.lineTo(x + a, y + b); g.moveTo(x + a, y - b); g.lineTo(x - a, y + b); }
    else if (kind === 'squeeze') { g.moveTo(x - inner * rx * 0.85, y - ry * 0.7); g.lineTo(x + inner * rx * 0.6, y); g.lineTo(x - inner * rx * 0.85, y + ry * 0.7); }
    else if (kind === 'spiral') {
      ellipse(g, x, y, rx, ry); g.fillStyle = '#fff8e8'; g.fill(); g.stroke(); g.beginPath();
      for (let i = 0; i <= 28; i++) { const a = (i / 28) * 3 * TAU + t * 9 * inner, r = i / 28; const X = x + Math.cos(a) * rx * r * 0.9, Y = y + Math.sin(a) * ry * r * 0.9; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
      g.lineWidth = lw * 0.6;
    }
    g.stroke();
  },
  headWorld(s) { const k = this.sitK; return this.toWorld(s, lerp(18, 17, k), lerp(-3, 0, k)); },
  // a point on the cat (its own cm: head along +x, back along -y) in the room, squash and all
  toWorld(s, lx, ly) {
    const c = Math.cos(s.th), n = Math.sin(s.th), X = lx * (1 + this.sq) * (s.flip || 1), Y = ly * (1 - this.sq);
    return [s.x + X * c - Y * n, s.y + X * n + Y * c];
  },
  draw(g, s, o = {}) {
    const lw = Math.max(0.7, (o.px || 0.4) * 1.15);
    if (Math.abs(s.w) > 7 && !s.end) this.ghosts(g, s);
    g.save(); g.lineJoin = 'round';
    this.drawTail(g, lw);
    g.translate(s.x, s.y); g.rotate(s.th); g.scale((1 + this.sq) * (s.flip || 1), 1 - this.sq);
    const P = this.pose(s);
    for (const p of P) if (p.L.far) this.leg(g, p, lw, true);
    this.body(g, lw, s);
    if (!s.noToast) this.toast(g, lw, s);
    for (const p of P) if (!p.L.far) this.leg(g, p, lw, false);
    this.head(g, lw, s);
    g.restore();
    if (s.dizzy > 0 || this.face === 'x') this.stars(g, s, lw);
  },
  ghosts(g, s) {
    for (let i = 1; i <= 2; i++) {
      g.save(); g.globalAlpha = 0.18 / i; g.translate(s.x, s.y); g.rotate(s.th - s.w * 0.018 * i); g.scale(s.flip || 1, 1);
      BODY(g); g.fillStyle = C.fur; g.fill(); ellipse(g, 18, -3, 10.2, 8.9); g.fill();
      SLICE(g, TTOP, TMID + TH); g.fillStyle = C.crust; g.fill();
      g.restore();
    }
  },
  stars(g, s, lw) {
    const [hx, hy] = this.headWorld(s), t = this.t;
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * TAU) / 3;
      star(g, hx + Math.cos(a) * 12, hy - 14 + Math.sin(a) * 3.5, 2.4 + 0.5 * Math.sin(a), t * 3 + i);
      g.fillStyle = '#ffe24a'; g.fill(); g.strokeStyle = INK; g.lineWidth = lw * 0.7; g.stroke();
    }
  },
  shadow(g, s) {
    const h = s.hover; if (!h || !isFinite(h.by) || h.water) return;
    const d = h.by - s.lowY(); if (d > 170 || d < -8) return;
    const a = 0.24 * (1 - clamp(d / 170)), w = s.extX() * (0.9 + d / 220);
    ellipse(g, s.x, h.by - 0.4, w, 2.2 + d / 70); g.fillStyle = `rgba(40,20,10,${a.toFixed(3)})`; g.fill();
  },
});
