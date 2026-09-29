// The bowl. The ring of C seat columns runs round a rounded-rectangle (superellipse) pitch-side edge,
// one seat (0.8 m) per column, so a small ground is a small stadium. Rows step back and up. World
// metres, x right, y toward the viewer, z up; the view is a fixed 3/4 bird's eye. On a tall screen the
// whole thing is turned a quarter so its long side runs down the phone.
export const SEAT = 0.8, ROW = 0.85, RISE = 0.5, TILT = 0.73; // radians from straight down
export const FRONT = 2.2, Z0 = 0.6; // the stand's front wall: this far from the pitch-side edge, this high
const CT = Math.cos(TILT), ST = Math.sin(TILT);
const N = 3.2; // superellipse exponent: 2 is an ellipse, higher is boxier

// polar form: smooth in the angle, unlike the usual |cos|^(2/n) one
function sePoint(a, b, th) {
  const c = Math.cos(th), s = Math.sin(th);
  const r = (Math.abs(c / a) ** N + Math.abs(s / b) ** N) ** (-1 / N);
  return [r * c, r * s];
}

export class Bowl {
  constructor(C, rows) {
    this.C = C; this.rows = rows;
    // pitch-side edge long enough for C seats, 1.46:1 like a real ground
    const per = C * SEAT, k = 1.46;
    let a = per / 7.2, b = a / k;
    for (let it = 0; it < 6; it++) { const p = this.perimeter(a, b); a *= per / p; b = a / k; }
    this.a = a; this.b = b;
    // columns at equal arc length; index grows clockwise on screen (x right, y down)
    // column 0 is the middle of the near stand (bottom of the screen)
    const M = 4096, th = new Float64Array(M + 1), acc = new Float64Array(M + 1), T0 = Math.PI / 2;
    th[0] = T0;
    let prev = sePoint(a, b, T0), L = 0;
    for (let m = 1; m <= M; m++) {
      th[m] = T0 + (m / M) * Math.PI * 2; const p = sePoint(a, b, th[m]);
      L += Math.hypot(p[0] - prev[0], p[1] - prev[1]); acc[m] = L; prev = p;
    }
    this.ang = new Float64Array(C); this.px = new Float32Array(C); this.py = new Float32Array(C);
    this.nx = new Float32Array(C); this.ny = new Float32Array(C);
    let m = 0;
    for (let i = 0; i < C; i++) {
      const want = (i / C) * L;
      while (m < M - 1 && acc[m + 1] < want) m++;
      const f = (want - acc[m]) / Math.max(1e-9, acc[m + 1] - acc[m]);
      const t0 = th[m] + (th[m + 1] - th[m]) * f;
      this.ang[i] = t0;
      const [x, y] = sePoint(a, b, t0);
      // outward normal of the superellipse
      const e = 1e-3, [x1, y1] = sePoint(a, b, t0 - e), [x2, y2] = sePoint(a, b, t0 + e);
      let nx = y2 - y1, ny = -(x2 - x1); const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      if (nx * x + ny * y < 0) { nx = -nx; ny = -ny; }
      this.px[i] = x; this.py[i] = y; this.nx[i] = nx; this.ny[i] = ny;
    }
    this.depth = rows * ROW; this.height = rows * RISE;
  }
  perimeter(a, b) {
    let L = 0, prev = sePoint(a, b, 0);
    for (let m = 1; m <= 720; m++) { const p = sePoint(a, b, (m / 720) * Math.PI * 2); L += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; }
    return L;
  }
  // world position of the seat (column i may be fractional), row r (0 = front row)
  seat(i, r) {
    const C = this.C, i0 = Math.floor(i), f = i - i0, a = ((i0 % C) + C) % C, b = (a + 1) % C;
    const x = this.px[a] + (this.px[b] - this.px[a]) * f, y = this.py[a] + (this.py[b] - this.py[a]) * f;
    const nx = this.nx[a] + (this.nx[b] - this.nx[a]) * f, ny = this.ny[a] + (this.ny[b] - this.ny[a]) * f;
    const d = FRONT + (r + 0.5) * ROW;
    return [x + nx * d, y + ny * d, Z0 + r * RISE];
  }
  // a point on the ground at column c (fractional), d metres out from the pitch-side edge
  pt(c, d) {
    const C = this.C, i0 = Math.floor(c), f = c - i0, a = ((i0 % C) + C) % C, b = (a + 1) % C;
    const x = this.px[a] + (this.px[b] - this.px[a]) * f, y = this.py[a] + (this.py[b] - this.py[a]) * f;
    let nx = this.nx[a] + (this.nx[b] - this.nx[a]) * f, ny = this.ny[a] + (this.ny[b] - this.ny[a]) * f;
    const l = Math.hypot(nx, ny) || 1;
    return [x + (nx / l) * d, y + (ny / l) * d];
  }
  // extent of everything drawn, in world metres
  bounds() {
    const o = FRONT + this.depth + 3;
    return { x0: -this.a - o, x1: this.a + o, y0: -this.b - o, y1: this.b + o, z: this.height + 3 };
  }
}

// world → screen. On a tall screen the ground is turned a quarter first (clockwise, so the ring still
// runs clockwise), and height stays up the screen, so people still stand up and not sideways.
export class View {
  constructor() { this.s = 1; this.cx = 0; this.cy = 0; this.zo = 0; this.rot = false; }
  // box: where the whole ground must fit; top: metres of sky to keep above the far stand
  fit(bowl, W, H, box, rot = H > W * 1.12) {
    const b = bowl.bounds();
    this.rot = rot;
    const [gx0, gx1, gy0, gy1] = rot ? [-b.y1, -b.y0, b.x0, b.x1] : [b.x0, b.x1, b.y0, b.y1];
    const top = gy0 * CT - b.z * ST, bot = gy1 * CT;
    this.s = Math.min(box.w / (gx1 - gx0), box.h / (bot - top));
    this.cx = box.x + box.w / 2 - ((gx0 + gx1) / 2) * this.s;
    this.cy = box.y + box.h / 2; this.zo = -(top + bot) / 2;
    this.wide = { x0: this.cx + gx0 * this.s, x1: this.cx + gx1 * this.s, y0: this.cy + (top + this.zo) * this.s, y1: this.cy + (bot + this.zo) * this.s };
    return this;
  }
  g(x, y) { return this.rot ? [-y, x] : [x, y]; }
  p(x, y, z = 0) {
    const gx = this.rot ? -y : x, gy = this.rot ? x : y;
    return [this.cx + gx * this.s, this.cy + (gy * CT - z * ST + this.zo) * this.s];
  }
  // screen px → world ground at height h
  inv(sx, sy, h = 0) {
    const gx = (sx - this.cx) / this.s, gy = ((sy - this.cy) / this.s - this.zo + h * ST) / CT;
    return this.rot ? [gy, -gx] : [gx, gy];
  }
  // the seats, far to near, for this view
  order(bowl) {
    const C = bowl.C, rows = bowl.rows, n = C * rows, ord = new Int32Array(n), key = new Float32Array(n);
    for (let i = 0; i < C; i++) for (let r = 0; r < rows; r++) { const k = i * rows + r, q = bowl.seat(i, r); ord[k] = k; key[k] = this.p(q[0], q[1], 0)[1] + r * 1e-3; }
    ord.sort((u, v) => key[u] - key[v] || u - v);
    return ord;
  }
  // does a person in column i show us his back? (his stand lies between us and the pitch)
  backTo(bowl, i) { const [, gy] = this.g(bowl.nx[i], bowl.ny[i]); return gy > 0.25; }
}
export const PROJ = { CT, ST };

// the ring column nearest a point on the ground, by angle round the bowl
export function nearestCol(bowl, x, y) {
  let best = 0, bd = Infinity;
  const C = bowl.C, step = Math.max(1, (C / 64) | 0);
  for (let i = 0; i < C; i += step) { const d = (bowl.px[i] - x) ** 2 + (bowl.py[i] - y) ** 2; if (d < bd) { bd = d; best = i; } }
  for (let i = best - step; i <= best + step; i++) {
    const j = ((i % C) + C) % C, d = (bowl.px[j] - x) ** 2 + (bowl.py[j] - y) ** 2;
    if (d < bd) { bd = d; best = j; }
  }
  return best;
}
