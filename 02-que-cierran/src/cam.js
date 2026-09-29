// The platform camera. One pinhole looking straight at the car: the car side is (nearly) the z = 0 plane,
// the platform comes toward you (z > 0), the inside of the car goes away (z < 0). Units are metres.
export const CAR_Z = -0.08; // the car side sits a hand's width behind the platform edge
export const DOOR_W = 1.3;
export const DOOR_H = 1.86;

export class Cam {
  constructor() {
    this.D = 2.4; // camera to the platform edge: just behind the pusher's shoulders
    this.Hc = 1.55; // eye height
    this.S = 250; // px per metre at z = 0
    this.cx = 0; this.eyeY = 0;
    this.W = 1; this.H = 1; this.port = false;
    this.bob = 0; // vertical nudge (bows, bumps), px
  }

  // frame the doorway: its top and the platform edge land on fixed fractions of the screen
  layout(W, H, top = 0, bottom = 0) {
    this.W = W; this.H = H;
    this.port = H > W * 1.05;
    const usable = Math.max(240, H - top - bottom);
    const doorTop = top + usable * (this.port ? 0.3 : 0.2);
    const edge = top + usable * (this.port ? 0.72 : 0.74);
    const kd = this.k(CAR_Z);
    // edge - doorTop = S * (Hc + (DOOR_H - Hc) * kd)
    const span = this.Hc + (DOOR_H - this.Hc) * kd;
    const sH = (edge - doorTop) / span;
    const sW = W / (this.port ? 1.92 : 2.3); // keep the doorway plus a little car either side
    this.S = Math.min(sH, sW);
    // if the width limited us, keep the edge where it was and let the door top drop a bit
    this.eyeY = edge - this.Hc * this.S;
    this.cx = W / 2;
  }

  k(z) { return this.D / Math.max(0.2, this.D - z); }
  s(z = 0) { return this.S * this.k(z); }
  X(x, z = 0) { return this.cx + x * this.S * this.k(z); }
  Y(y, z = 0) { return this.eyeY + this.bob + (this.Hc - y) * this.S * this.k(z); }
  // world x at the screen edge, for a given depth
  edge(side, z = 0) { return (side > 0 ? this.W - this.cx : -this.cx) / (this.S * this.k(z)); }
  // world z of the floor at a screen row (y = 0)
  floorZ(sy) { const d = (sy - this.eyeY - this.bob) / (this.Hc * this.S); return d > 0 ? this.D - this.D / d : -1e9; }
}
