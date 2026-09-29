// The camera: a pinhole a few metres behind and above you, level (its picture plane is vertical, so
// whatever stands up stays upright, as in the illustrations), looking up the corridor. Things grow as
// they come at you, and that looming is the clock of every encounter. The stair flights climb.
import { LW } from '../route.js';
import { clamp, damp } from '../util.js';

export const RISE = 0.24;            // how much a stair flight climbs per metre walked (drawn, not simulated)
export const FOG0 = 12.5, FOG1 = 17.5; // metres ahead of you: the far end of the station fades into the haze
export const FAR = 30;               // nothing further than this from the camera is drawn
export const laneX = (l) => (l - 3) * LW;

export function floorAt(route, z) {
  let h = 0;
  for (const [a, b] of route.stairs) { if (z <= a) break; h += (Math.min(z, b) - a) * RISE; }
  return h;
}
// 0 in the clear, 1 lost in the haze, for something at z
export const fogAt = (cam, z) => clamp((z - cam.pz - FOG0) / (FOG1 - FOG0));

export class Cam {
  constructor() {
    Object.assign(this, { W: 1, H: 1, f: 1, hy: 0, back: 4, up: 4, x: 0, y: 4, z: -4, pz: 0, follow: 0.5, shakeT: 0, sh: 0, feet: 1 });
    this.o = [0, 0, 0];
  }
  // top: where the ticket ends; the vanishing point sits just below it. Your shoes near the bottom
  // (or higher, over `bottom`), and `zoom` < 1 steps back when there is little room above them.
  fit(W, H, top, bottom = 0, zoom = 1) {
    const portrait = H > W * 1.05;
    this.W = W; this.H = H; this.portrait = portrait;
    this.feet = H - Math.max(bottom + 18, H * (portrait ? 0.125 : 0.095));
    this.hy = top + H * (portrait ? 0.05 : 0.04);
    let f = (H * (portrait ? 0.235 : 0.3) * this.back) / 1.72;
    f = Math.min(f, (W * this.back) / 3.9);   // a corridor's five lanes fit across at your depth
    this.f = f * zoom;
    this.up = ((this.feet - this.hy) * this.back) / this.f;
    this.follow = portrait ? 0.75 : 0.45;
  }
  track(P, route, dt, snap = false) {
    const tx = ((P.x - 3) * LW) * this.follow, ty = floorAt(route, P.z) + this.up;
    this.x = snap ? tx : damp(this.x, tx, 5.5, dt);
    this.y = snap ? ty : damp(this.y, ty, 7, dt);
    this.pz = P.z; this.z = P.z - this.back;
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.sh = this.shakeT > 0 ? Math.sin(this.shakeT * 90) * this.shakeT * 22 : 0;
  }
  bump(a = 1) { this.shakeT = 0.28 * a; }
  // world (x lateral metres, y height metres, z metres along the route) to the screen: [sx, sy, px per metre]
  p(x, y, z, o = this.o) {
    const d = z - this.z;
    if (d < 0.25) return null;
    const s = this.f / d;
    o[0] = this.W / 2 + (x - this.x) * s + this.sh; o[1] = this.hy + (this.y - y) * s; o[2] = s;
    return o;
  }
  // the same, clamped at the near plane, into a fresh array (for geometry that reaches behind you)
  v(x, y, z) {
    const d = Math.max(0.3, z - this.z), s = this.f / d;
    return [this.W / 2 + (x - this.x) * s + this.sh, this.hy + (this.y - y) * s, s];
  }
}
