// The intro: how the toast got there. Before each room the cat is up on something high (a shelf, the top of the
// cupboards, the top of a door…) with a slice of toast and jam in front of it and a roll of duct tape behind, the
// tape's end already stuck to the toast. It crouches and leaps off; the toast flips up after it; in mid-air it slaps
// onto its back, and the cat spins twice to wind the tape round, rips it off the roll, notices where it is, and
// drops, until the two laws catch it a cat's height over the floor, exactly where the room begins. A replay of the
// same room gets the short cut: already taped, a hop, a twirl and the drop.
// It plays on a puppet of the sim (the sim itself waits), drawn by the scene's own cat. Every pose is a pure
// function of the time, so it can be scrubbed for QA; only the events need the clock to pass them.
import { G } from './sim.js';
import { TAU, clamp, lerp, smooth, smoother, angDiff } from './util.js';
import { INK } from './gfx/room.js';
import { C } from './gfx/cat.js';

const STAND = 16, TOAST = 42, ROLL = 34, RR = 4.4, TAPE_W = 2.2;
// on the cat (its cm): the slice's centre; where the tape starts on the slice; the two bands' leading ends
const SLICE_C = [-6.3, -13.4], TOP = -17, BAND = [-15.6 + 1.75, 1.4 + 1.75], Y0 = -20, Y1 = 11;
const bandEnd = (i, y) => [BAND[i] + (0.9 * (y - Y0)) / (Y1 - Y0), Math.max(TOP, y)];

// the perch laid out: the cat facing the room's start, the toast in front of it, the tape behind
export function perchOf(lv) {
  if (!lv.perch) return null;
  const [x, y, kind, edge] = lv.perch, dx = lv.start[0] - x, f = Math.abs(dx) < 6 ? 1 : Math.sign(dx);
  return { x, y, kind, f, edge: edge ?? x + f * 40, toast: [x + f * TOAST, y - 4.85], roll: [x - f * ROLL, y - RR] };
}

// the roll of duct tape left on the perch, turned by `a` as tape comes off it; a tab of it sticking out once torn
export function drawRoll(g, lv, o = {}) {
  const P = perchOf(lv); if (!P) return;
  const [x, y] = P.roll, lw = Math.max(0.5, (o.px || 0.4) * 1.1), a = o.a || 0;
  g.save(); g.lineJoin = 'round';
  g.fillStyle = 'rgba(40,20,10,0.22)'; g.beginPath(); g.ellipse(x, y + RR - 0.3, RR * 1.15, 1.1, 0, 0, TAU); g.fill();
  if (o.tab !== false) {
    // the torn end, peeled up off the roll and curling over
    const f = P.f;
    g.beginPath(); g.moveTo(x + f * RR * 0.2, y - RR); g.quadraticCurveTo(x + f * (RR + 1.6), y - RR - 1.2, x + f * (RR + 2.4), y - RR + 1.6);
    g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 1.5 + lw; g.stroke(); g.strokeStyle = C.tape; g.lineWidth = 1.5; g.stroke();
  }
  g.beginPath(); g.arc(x, y, RR, 0, TAU); g.fillStyle = C.tape; g.fill();
  g.strokeStyle = 'rgba(143,147,152,0.8)'; g.lineWidth = 0.3;
  for (const r of [3.3, 3.8]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
  // a scuff on the roll that turns with it
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.6; g.beginPath(); g.arc(x, y, RR - 0.7, a - 2.4, a - 1.6); g.stroke();
  g.strokeStyle = C.tapeD; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x + Math.cos(a) * 2.8, y + Math.sin(a) * 2.8); g.lineTo(x + Math.cos(a) * RR, y + Math.sin(a) * RR); g.stroke();
  g.beginPath(); g.arc(x, y, RR, 0, TAU); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
  g.beginPath(); g.arc(x, y, 2.7, 0, TAU); g.fillStyle = '#c99558'; g.fill(); g.strokeStyle = INK; g.lineWidth = lw * 0.8; g.stroke();
  g.beginPath(); g.arc(x, y, 1.9, 0, TAU); g.fillStyle = '#4a3222'; g.fill();
  g.restore();
}

// a length of tape pulled off the roll: a ribbon with an outline and a shine along it
function drawStrip(g, [ax, ay], [bx, by], px) {
  const lw = Math.max(0.5, (px || 0.4) * 1.1), L = Math.hypot(bx - ax, by - ay); if (L < 0.5) return;
  g.save(); g.lineCap = 'butt';
  g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by);
  g.strokeStyle = INK; g.lineWidth = TAPE_W + lw * 1.6; g.stroke();
  g.strokeStyle = C.tape; g.lineWidth = TAPE_W; g.stroke();
  const nx = -(by - ay) / L, ny = (bx - ax) / L, o = TAPE_W * 0.22;
  g.beginPath(); g.moveTo(ax + nx * o, ay + ny * o); g.lineTo(bx + nx * o, by + ny * o); g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.45; g.stroke();
  g.restore();
}

// a point on the puppet, unsquashed (cat.toWorld adds the squash; the difference is under a centimetre)
const onCat = (q, lx, ly) => { const c = Math.cos(q.th), n = Math.sin(q.th), X = lx * q.flip; return [q.x + X * c - ly * n, q.y + X * n + ly * c]; };

export class Intro {
  constructor(lv, sim, o = {}) {
    const P = perchOf(lv), f = P.f, short = !!o.short, [sx, sy] = lv.start, ceil = lv.room === false ? -Infinity : 0;
    Object.assign(this, { lv, P, short, t: 0, done: false, face: null, rollA: 0, tab: short });
    this.rollTop = [P.roll[0], P.roll[1] - RR];
    // standing on the perch; crouched; hanging in the air past the ledge, with room above for the spins
    this.y0 = P.y - STAND; this.c0 = [P.x - f * 2, this.y0 + STAND * 0.2];
    this.hx = P.edge + f * 30; this.hy = Math.max(this.y0 - 18, ceil + 36);
    this.bump = clamp(Math.min(this.c0[1], this.hy) - (ceil + 30), 0, 10); this.kd = short ? 0.4 : 1;
    const T = short
      ? { crouch: 0, go: 0.22, apex: 0.5, w: [[0.52, 0.84]], drop: 0.88 }
      : { mew: 0.2, crouch: 0.5, go: 0.8, apex: 1.12, slap: 1.2, w: [[1.36, 1.72], [1.78, 2.14]], rip: 2.2, drop: 2.42 };
    T.alarm = short ? T.w[0][1] : T.rip; T.recoil = short ? 0 : T.rip + 0.25;
    // facing left, the last spin gets an extra half turn and, halfway round, back and belly trade places (a mirror
    // turned half a turn: far too fast to see), so it comes out upright and facing right, like the game's cat
    const last = T.w.length - 1;
    this.turns = T.w.map((_, i) => (f < 0 && i === last ? 1.5 : 1));
    this.swapT = f < 0 ? (T.w[last][0] + T.w[last][1]) / 2 : Infinity;
    // the drop: gravity's own ease to a cat's height over the start, braked by the laws, a bob, and still
    const D = [this.hx + f * 8 * this.kd, this.hy + 6 * this.kd], E = [sx, sy - 30], dy = E[1] - D[1];
    const Tf = clamp(0.95 * Math.sqrt((2 * Math.abs(dy)) / G), 0.32, 0.8), vE = (2 * dy) / Tf, Tb = Math.min(0.24, 93.6 / Math.max(1, Math.abs(vE)));
    T.brake = T.drop + Tf; T.settle = T.brake + Tb; T.end = T.settle + (short ? 0.45 : 0.55);
    Object.assign(this, { T, D, E, dy, vE, Tf, Tb, sy, tilt: Math.sign(sx - D[0]) || 1 });
    if (!short) {
      // where the toast meets the cat's back, and where the torn tape lets go
      const q = this.pose(T.slap); this.land = onCat(q, SLICE_C[0], SLICE_C[1]); this.landA = q.th;
      const R = P.toast; this.ctrl = [(R[0] + this.land[0]) / 2, Math.max(Math.min(R[1], this.land[1]) - 45, ceil + 10)];
      this.len0 = this.stripLen(0); this.ripAt = this.stripAt(T.rip - 1e-4);
    }
    const m = [[T.go, { k: 'leap' }], [T.drop, { k: 'fall', dur: Tf + Tb }], [T.drop + 0.7 * Tf, { k: 'engage' }], [T.brake, { k: 'brake', v: Math.abs(vE) }], [T.end, { k: 'done' }]];
    if (short) m.push([T.w[0][0], { k: 'spin' }]);
    else m.push([T.mew, { k: 'mew', m: 'mrrp' }], [T.slap, { k: 'slap' }], [T.w[0][0], { k: 'tape', long: true, say: true }], [T.w[1][0], { k: 'tape', long: true }], [T.rip, { k: 'tape', rip: true, say: true }]);
    if (this.swapT < Infinity) m.push([this.swapT, { k: 'turn' }]);
    this.marks = m.sort((a, b) => a[0] - b[0]);
    // the puppet: the sim underneath (the room, the jam), a pose of its own
    this.p = Object.create(sim);
    Object.assign(this.p, { vx: 0, vy: 0, w: 0, charge: 0, spin: 0, sit: null, end: null, dizzy: 0, sag: 0, hover: {} });
    this.apply();
  }
  wrapK(i, t) { const w = this.T.w[i]; return w ? smoother((t - w[0]) / (w[1] - w[0])) : 1; }
  pose(t) {
    const T = this.T, P = this.P, f = P.f, q = { x: 0, y: 0, th: 0, flip: 1, sq: null, stand: false, fight: 0, face: null, noToast: false, tape: null };
    if (!this.short) { q.noToast = t < T.slap; q.tape = [this.wrapK(0, t), this.wrapK(1, t)]; }
    if (t < T.drop) {
      q.flip = f;
      if (t < T.go) {
        // on the perch: a look round the room, then down into a crouch, weight back
        const c = t < T.crouch ? 0 : smooth((t - T.crouch) / (T.go - T.crouch));
        q.sq = 0.2 * c + 0.012 * Math.sin(t * 6) * (1 - c);
        q.x = P.x - f * 2 * c; q.y = this.y0 + STAND * q.sq; q.th = f * 0.1 * c; q.stand = true; q.face = 'smug';
      } else if (t < T.apex) {
        // the leap: off like a spring, nose up, and it stops dead in the air
        const u = (t - T.go) / (T.apex - T.go), e = u * (2 - u);
        q.x = lerp(this.c0[0], this.hx, e); q.y = lerp(this.c0[1], this.hy, e) - this.bump * Math.sin(Math.PI * u) ** 2;
        q.th = f * lerp(0.1, -0.22, smooth(u * 1.5)); q.sq = -0.16 * (1 - u) * (1 - u); q.face = 'happy';
      } else {
        // hanging there, as cartoons do until they look down
        const d = smooth((t - T.apex) / (T.drop - T.apex)) * this.kd;
        q.x = this.hx + f * 8 * d; q.y = this.hy + 6 * d; q.th = -f * 0.22 * (1 - smooth((t - T.apex) / 0.2));
        q.face = t < T.w[0][0] ? 'happy' : t < T.alarm ? 'spiral' : 'alarm';
      }
      let spun = 0;
      T.w.forEach(([a, b], i) => { spun += this.turns[i] * smoother((t - a) / (b - a)); });
      q.th += f * TAU * spun;
      if (t >= this.swapT) { q.th += Math.PI; q.flip = 1; }
    } else if (t < T.brake) {
      // falling: tilted the way it's going; the laws wake up as the floor comes near
      const u = (t - T.drop) / this.Tf;
      q.x = lerp(this.D[0], this.E[0], smooth(u)); q.y = this.D[1] + this.dy * u * u;
      q.th = this.tilt * 0.3 * Math.sin(Math.PI * u); q.fight = smooth((u - 0.55) / 0.45); q.face = u < 0.7 ? 'fright' : 'oops';
    } else if (t < T.settle) {
      // caught: braked to a stop a little under the start
      const u = (t - T.brake) / this.Tb, u2 = u * u, u3 = u2 * u;
      q.x = this.E[0]; q.y = (2 * u3 - 3 * u2 + 1) * this.E[1] + (u3 - 2 * u2 + u) * this.Tb * this.vE + (3 * u2 - 2 * u3) * (this.sy + 9);
      q.fight = 1; q.face = 'oops';
    } else {
      // a bob on the cushion, settling exactly onto the start, still
      const u = Math.min(t, T.end) - T.settle, Ts = T.end - T.settle, w = 9.5, k = 1 - smoother(u / Ts);
      q.x = this.E[0]; q.y = this.sy + 9 * Math.exp(-5 * u) * (Math.cos(w * u) + (5 / w) * Math.sin(w * u)) * k;
      q.th = 0.06 * this.tilt * Math.exp(-4 * u) * Math.sin(12 * u) * k; q.fight = 1; q.face = u < Ts * 0.6 ? 'oops' : null;
    }
    q.th = angDiff(q.th, 0);
    return q;
  }
  // the slice: resting on the perch, then flipped up in an arc (constant sideways, gravity's parabola up and down)
  // and a full turn, onto the cat's back at the very angle the cat is at
  toastAt(t) {
    const T = this.T, R = this.P.toast;
    if (t <= T.go) return [R[0], R[1], 0];
    const u = clamp((t - T.go) / (T.slap - T.go)), v = 1 - u, Q = this.ctrl, L = this.land;
    return [v * v * R[0] + 2 * u * v * Q[0] + u * u * L[0], v * v * R[1] + 2 * u * v * Q[1] + u * u * L[1], (this.landA - this.P.f * TAU) * smoother(u)];
  }
  // the far end of the tape from the roll: stuck to the slice; then the end of the band being wound on (down the
  // flank for the first, along the belly, up the other for the second); torn off, flying back; null once it's home.
  // W places a point on the cat (the scene's cat, squash and all; by default the pure pose)
  stripAt(t, W) {
    const T = this.T, f = this.P.f;
    if (this.short || t >= T.recoil) return null;
    if (t < T.slap) { const [x, y, a] = this.toastAt(t), c = Math.cos(a), n = Math.sin(a), lx = f * (BAND[0] - SLICE_C[0]), ly = TOP - SLICE_C[1]; return [x + lx * c - ly * n, y + lx * n + ly * c]; }
    if (t >= T.rip) { const u = (t - T.rip) / (T.recoil - T.rip), e = 1 - (1 - u) ** 3; return [lerp(this.ripAt[0], this.rollTop[0], e), lerp(this.ripAt[1], this.rollTop[1], e)]; }
    if (!W) { const q = this.pose(t); W = (lx, ly) => onCat(q, lx, ly); }
    const k0 = this.wrapK(0, t);
    if (k0 < 1) return W(...bandEnd(0, lerp(Y0, Y1, k0)));
    if (t < T.w[1][0]) { const u = smooth((t - T.w[0][1]) / (T.w[1][0] - T.w[0][1])); return W(lerp(bandEnd(0, Y1)[0], bandEnd(1, Y1)[0], u), Y1); }
    return W(...bandEnd(1, lerp(Y1, Y0, this.wrapK(1, t))));
  }
  stripLen(t) { const e = this.stripAt(t); return e ? Math.hypot(e[0] - this.rollTop[0], e[1] - this.rollTop[1]) : 0; }
  // the puppet posed at this.t, with the velocities the rig and the sound want (the pose's own rate of change)
  apply() {
    const t = this.t, h = 1 / 240, q = this.pose(t), a = this.pose(t - h), b = this.pose(t + h), p = this.p, P = this.P;
    Object.assign(p, { x: q.x, y: q.y, th: q.th, flip: q.flip, squash: q.sq, stand: q.stand, fight: q.fight, noToast: q.noToast, tape: q.tape });
    p.vx = (b.x - a.x) / (2 * h); p.vy = (b.y - a.y) / (2 * h);
    p.w = angDiff(b.th - (a.flip !== b.flip ? Math.PI : 0), a.th) / (2 * h);
    p.spin = clamp((Math.abs(p.w) - 4) / 12);
    this.face = q.face;
    // over the perch it stands on the perch (scenery to the sim, so its shadow is placed by hand); past the ledge, the room
    if (P.f * (p.x - P.edge) < -4 && p.lowY() <= P.y + 1) p.hover = { h: 0, target: 0, gy: P.y, by: P.y, water: false, none: true, solid: null, run: null };
    else p.hover = { ...p.ground(), run: null, target: 0 };
    // the roll turns as tape comes off it: pulled out, then wound on (a cat's girth a band)
    if (!this.short) {
      const tt = Math.min(t, this.T.rip - 1e-4), out = Math.max(0, this.stripLen(tt) - this.len0) + 60 * (this.wrapK(0, tt) + this.wrapK(1, tt));
      this.rollA = (P.f * out) / RR; this.tab = t >= this.T.recoil;
    }
  }
  // play on by dt; the beats passed on the way, placed where the cat is
  update(dt) {
    if (this.done) return [];
    const t0 = this.t, t1 = Math.min(this.T.end, t0 + dt), ev = [];
    this.t = t1; this.apply();
    for (const [m, e] of this.marks) if (m > t0 && m <= t1) ev.push({ ...e, x: this.p.x, y: this.p.y });
    if (t1 >= this.T.end) this.done = true;
    return ev;
  }
  skip() { this.t = this.T.end; this.apply(); this.done = true; }
  // behind the cat: the slice waiting on the perch, the tape's end stuck to it and running back to the roll
  drawBack(g, cat, px) {
    if (this.short || this.t >= this.T.go) return;
    const R = this.P.toast;
    cat.looseToast(g, R[0], R[1], 0, this.p, { px, flip: this.P.f });
    drawStrip(g, this.rollTop, this.stripAt(this.t), px);
  }
  // in front: the slice flying up after it, and the tape from the roll to wherever it has got to
  drawFront(g, cat, px) {
    const t = this.t;
    if (this.short || t < this.T.go) return;
    if (t < this.T.slap) { const [x, y, a] = this.toastAt(t); cat.looseToast(g, x, y, a, this.p, { px, flip: this.P.f }); }
    const e = this.stripAt(t, (lx, ly) => cat.toWorld(this.p, lx, ly));
    if (e) drawStrip(g, this.rollTop, e, px);
  }
}
