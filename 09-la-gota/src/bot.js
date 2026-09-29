// The autopilot, for the tests and the attract loop. It calls the fattest free drop, then keeps wiping a short
// road just ahead of it: bent towards the stray beads (or a smaller rival) it can still turn into, around bigger
// rivals and stickers, and never within a fingertip of a called drop. `late` reacts slower, draws slower and
// doesn't look as far ahead: it should still win the easy rides.
import { K, PW, PH, YOU, NEUTRAL, DT, holdAngle } from './sim.js';
import { clamp } from './util.js';

const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 1e-9 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
};
export const STYLE = {
  sharp: { react: 0.12, speed: 45, reach: 5, look: 0.6, safe: 0.1 },
  late: { react: 0.45, speed: 25, reach: 4, look: 0, safe: 0.3 },
};

export class Bot {
  constructor(sim, style = 'sharp') {
    this.s = sim; this.o = STYLE[style] || STYLE.sharp;
    this.path = null; this.at = 0; this.wait = this.o.react; this.watch = null; this.calledAt = null;
  }
  step() {
    const s = this.s, inp = s.input;
    if (s.phase === 'call') { inp.down = false; this.call(); return; }
    if (s.phase !== 'race' || s.end) { inp.down = false; this.path = null; return; }
    if (this.path) { this.draw(); return; }
    inp.down = false;
    this.wait -= DT;
    const me = s.you();
    if (!me || !me.alive || me.fin >= 0) return;
    if (this.watch) {
      // re-plan when the drop is running out of road, stops, or the road has had time to dry
      const left = Math.hypot(this.watch.x - me.x, this.watch.y - me.y), still = me.pin ? (this.watch.still += DT) : (this.watch.still = 0);
      if (left > 1.6 + me.r && still < 0.35 && s.race - this.watch.t < 3.2) return;
    }
    if (this.wait <= 0) this.plan(me);
  }

  call() {
    const s = this.s;
    if (s.kids.some((k) => k.own !== YOU && !k.drop)) return;
    this.calledAt ??= s.time;
    if (s.time - this.calledAt < this.o.react + 0.4) return;
    const free = s.free().map((id) => s.drop(id));
    const score = (d) => d.r * 10 - d.y * 0.05 + (this.o.look > 0.8 ? this.food(d.x, d.y, 5) * 0.4 : 0);
    free.sort((p, q) => score(q) - score(p));
    s.call(free[0].id);
  }
  // volume of stray beads in reach below a point
  food(x, y, span) {
    let v = 0;
    for (const d of this.s.drops) if (d.alive && d.fin < 0 && this.s.ownerOf(d.id) === NEUTRAL && d.y > y + 0.5 && d.y < y + span && Math.abs(d.x - x) < (d.y - y) * 0.6) v += d.V;
    return v * 40;
  }

  // ---------- planning a stroke ----------
  plan(me) {
    const s = this.s, o = this.o, r = me.r, v = Math.hypot(me.vx, me.vy);
    // big enough to run on the fog by itself: let it drink, unless something is in its way
    if (o.fogR && r >= o.fogR && !me.pin && v > 0.25 && this.clear(me, 3)) { this.wait = 0.15; this.watch = null; return; }
    const cone = Math.min(1.2, holdAngle(r) * 0.8) * (v > 2.5 ? 0.6 : 1);
    const lead = r + K.touch + o.safe + v * (o.react * 0.5 + 0.06);
    const called = s.kids.filter((k) => !k.out && k.drop).map((k) => s.drop(k.drop)).filter((d) => d && d.alive);
    const rivals = called.filter((d) => d !== me && d.fin < 0);
    const best = { score: -Infinity, ux: 0, uy: 1, len: 0, stop: 0 };
    const tryDir = (ux, uy, len, stopR, bonus, graze) => {
      // where the fingertip goes down and lifts
      const x0 = me.x + ux * lead, y0 = me.y + uy * lead;
      let L = Math.max(0.6, len - lead - stopR);
      let x1 = x0 + ux * L, y1 = y0 + uy * L;
      if (y1 > PH - 0.35) { const k = (PH - 0.35 - y0) / uy; if (k < 0.5) return; L = k; x1 = x0 + ux * L; y1 = y0 + uy * L; }
      if (x0 < 0.2 || x0 > PW - 0.2 || x1 < 0.2 || x1 > PW - 0.2) return;
      // the fingertip must not come near any called drop (nor the stray target it's heading for)
      for (const d of called) if (segDist(d.x, d.y, x0, y0, x1, y1) < d.r + K.touch + o.safe + (d === me ? 0 : 0.1)) return;
      if (graze && segDist(graze.x, graze.y, x0, y0, x1, y1) < graze.r + K.touch + 0.02) return;
      // the drop's road: no bigger rival on it, no sticker across it
      const ex = me.x + ux * (len + 0.2), ey = me.y + uy * (len + 0.2);
      for (const d of rivals) if (d.V >= me.V * 0.9 && segDist(d.x, d.y, me.x, me.y, ex, ey) < (r + d.r) * K.merge + 0.45) return;
      for (const st of s.sticks) if (this.crosses(st, me.x, me.y, ex, ey, r + 0.1)) return;
      // and a road that runs into one soon after is a road into a dead end
      let pen = 0;
      const fx = me.x + ux * (len + 4), fy = Math.min(PH, me.y + uy * (len + 4));
      for (const st of s.sticks) if (this.crosses(st, ex, ey, fx, fy, r + 0.15)) pen = 2.5;
      const down = uy * len, sc = down * 0.6 + bonus - Math.abs(ux) * 0.3 - pen;
      if (sc > best.score) Object.assign(best, { score: sc, ux, uy, x0, y0, x1, y1, len });
    };
    // aim at stray beads (and smaller rivals) inside the turn cone
    for (const d of s.drops) {
      if (!d.alive || d === me || d.fin >= 0) continue;
      const own = s.ownerOf(d.id), dx = d.x - me.x, dy = d.y - me.y, dist = Math.hypot(dx, dy);
      if (dy < r + d.r + 0.4 || dist > o.reach) continue;
      if (Math.atan2(Math.abs(dx), dy) > cone) continue;
      if (own === NEUTRAL && d.r < 0.09) continue;
      let bonus;
      if (own === NEUTRAL) bonus = (d.V / me.V) * 9 * o.look - dist * 0.25;
      else if (own !== YOU && d.V < me.V * 0.8) bonus = 7 * o.look - dist * 0.2;
      else continue;
      // graze it: the lane runs past its flank, it slides in and waits there to be swallowed
      const off = d.r + K.touch + (own === NEUTRAL ? 0.05 : o.safe + 0.12);
      for (const side of [-1, 1]) {
        const px = d.x + (dy / dist) * off * side, py = d.y - (dx / dist) * off * side;
        const qx = px - me.x, qy = py - me.y, q = Math.hypot(qx, qy);
        if (qy <= 0 || Math.atan2(Math.abs(qx), qy) > cone) continue;
        tryDir(qx / q, qy / q, q + 0.9, 0, bonus, own === NEUTRAL ? d : null);
      }
    }
    // or just a road down, as straight as the obstacles allow
    for (const a of [0, 0.12, -0.12, 0.25, -0.25, 0.4, -0.4, 0.6, -0.6]) {
      if (Math.abs(a) > cone) continue;
      const len = Math.min(o.reach * 0.75, PH - me.y);
      tryDir(Math.sin(a), Math.cos(a), len, 0, -Math.abs(a) * 2);
    }
    // perched on top of a sticker: a flat lane along its edge drags the drop off the nearer end
    const st = me.pin && s.sticks.find((q) => q.k === 'rect' && me.y < q.y && s.inStick(q, me.x, me.y, r + 0.06));
    if (st) {
      const ends = [[-1, st.x - r - 0.5], [1, st.x + st.w + r + 0.5]].filter(([, x]) => x > r + 0.1 && x < PW - r - 0.1);
      ends.sort((p, q) => Math.abs(p[1] - me.x) - Math.abs(q[1] - me.x));
      for (const [side, x] of ends) {
        // start as close as the finger dares, so the lane wets the drop's flank
        const x0 = me.x + side * (r + K.touch + 0.06), y0 = me.y, x1 = x, y1 = me.y + 0.25;
        if (called.some((d) => d !== me && segDist(d.x, d.y, x0, y0, x1, y1) < d.r + K.touch + o.safe + 0.1)) continue;
        this.path = { score: 0, ux: side, uy: 0, x0, y0, x1, y1, len: Math.abs(x1 - me.x) }; this.at = 0;
        return;
      }
    }
    if (best.score === -Infinity) { this.wait = 0.25; return; }
    this.path = best; this.at = 0;
  }
  // nothing bigger and nothing solid straight below for `len` cm
  clear(me, len) {
    const s = this.s, ex = me.x, ey = Math.min(PH, me.y + len);
    for (const k of s.kids) {
      const d = !k.out && k.drop ? s.drop(k.drop) : null;
      if (d && d !== me && d.alive && d.fin < 0 && d.V >= me.V * 0.9 && segDist(d.x, d.y, me.x, me.y, ex, ey) < (me.r + d.r) * K.merge + 0.3) return false;
    }
    for (const st of s.sticks) if (this.crosses(st, me.x, me.y, ex, ey, me.r + 0.1)) return false;
    return true;
  }
  crosses(st, ax, ay, bx, by, pad) {
    for (let k = 0; k <= 10; k++) { const u = k / 10; if (this.s.inStick(st, ax + (bx - ax) * u, ay + (by - ay) * u, pad)) return true; }
    return false;
  }

  // ---------- drawing it ----------
  draw() {
    const s = this.s, p = this.path, inp = s.input, me = s.you();
    const L = Math.hypot(p.x1 - p.x0, p.y1 - p.y0);
    const u = Math.min(1, this.at / L);
    this.at += this.o.speed * DT;
    const x = p.x0 + (p.x1 - p.x0) * u, y = p.y0 + (p.y1 - p.y0) * u;
    const px = inp.down ? inp.x : x, py = inp.down ? inp.y : y;
    // flinch: anything called that has come near the fingertip since the plan
    for (const k of s.kids) {
      const d = !k.out && k.drop ? s.drop(k.drop) : null;
      if (d && d.alive && segDist(d.x, d.y, px, py, x, y) < d.r + K.touch + 0.04 + Math.hypot(d.vx, d.vy) * DT * 3) { this.lift(); return; }
    }
    inp.down = true; inp.x = x; inp.y = y;
    if (u >= 1) { this.lift(); this.watch = { x: p.x1, y: p.y1, t: s.race, still: 0 }; if (me) this.wait = this.o.react; }
  }
  lift() { this.s.input.down = false; this.path = null; this.wait = this.o.react; }
}
