// The eye: yours, 1.6 m up, looking along the way you walk. A pinhole whose picture plane stays
// upright, so doors and walls stand straight: to look down into the trunk or at the bags on the
// floor, or up a flight, the horizon slides instead of the plane tilting (as an illustrator would
// draw it). It can glance aside (yaw) toward a switch or a button; it leans, dips and bobs with
// each step, and the roll is done by whoever draws the frame.
// Everything is placed in metres in the frame of the stretch being walked: x across (left negative),
// y up, z ahead. Geometry that reaches behind you is clipped at the near plane, never squashed.

export const EYE = 1.6, NEAR = 0.06;

export class Cam {
  constructor() {
    this.W = 1; this.H = 1; this.f0 = 1; this.f = 1; this.cx = 0; this.hy = 0;
    this.x = 0; this.y = EYE; this.z = 0; this.look = 0; this.vp = 0.46; this.yaw = 0; this.cs = 1; this.sn = 0;
    this.o = [0, 0, 0]; this.c = [0, 0];
    this.buf = []; this.M = null;
  }
  // a portrait phone sees a tall slice (lots of floor and ceiling), a laptop a wide one
  fit(W, H) {
    this.W = W; this.H = H;
    this.f0 = Math.min(W / 2 / Math.tan(0.7), H / 2 / Math.tan(0.52));
  }
  set(x, y, z, look = 0, zoom = 1, dx = 0, yaw = 0) {
    this.x = x; this.y = y; this.z = z; this.look = look; this.f = this.f0 * zoom;
    this.cx = this.W / 2 + dx; this.hy = this.H * this.vp + Math.tan(look) * this.f;
    this.yaw = yaw; this.cs = Math.cos(yaw); this.sn = Math.sin(yaw);
  }
  // world (x, z) to the eye's own axes: [across, ahead] (shared array)
  tc(x, z, o = this.c) {
    const dx = x - this.x, dz = z - this.z;
    o[0] = this.cs * dx - this.sn * dz; o[1] = this.sn * dx + this.cs * dz;
    return o;
  }
  // a point to the screen: [x, y, pixels per metre] (a shared array: copy it to keep it), or null
  p(x, y, z, o = this.o) {
    const dx = x - this.x, dz = z - this.z, d = this.sn * dx + this.cs * dz;
    if (d < NEAR) return null;
    const s = this.f / d;
    o[0] = this.cx + (this.cs * dx - this.sn * dz) * s; o[1] = this.hy - (y - this.y) * s; o[2] = s;
    return o;
  }
  depth(x, z) { return this.sn * (x - this.x) + this.cs * (z - this.z); }
  // pixels per metre at a point (0 behind you)
  ppm(x, z) { const d = this.depth(x, z); return d < NEAR ? 0 : this.f / d; }

  // a polygon of world points (a flat list x, y, z, x, y, z…) clipped at the near plane, as the
  // current path. False when nothing of it is in front of you
  poly(g, P, add = false) {
    const n = P.length / 3, out = this.buf, cs = this.cs, sn = this.sn;
    out.length = 0;
    let pa = null;
    for (let i = 0; i <= n; i++) {
      const k = i % n, dx = P[3 * k] - this.x, dz = P[3 * k + 2] - this.z;
      const xc = cs * dx - sn * dz, zc = sn * dx + cs * dz, y = P[3 * k + 1];
      if (pa) {
        const [ax, ay, az] = pa, ain = az >= NEAR, bin = zc >= NEAR;
        if (ain) out.push(ax, ay, az);
        if (ain !== bin) { const t = (NEAR - az) / (zc - az); out.push(ax + (xc - ax) * t, ay + (y - ay) * t, NEAR); }
      }
      pa = [xc, y, zc];
    }
    if (out.length < 9) return false;
    if (!add) g.beginPath();
    for (let i = 0; i < out.length; i += 3) {
      const s = this.f / out[i + 2], X = this.cx + out[i] * s, Y = this.hy - (out[i + 1] - this.y) * s;
      if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
    }
    g.closePath();
    return true;
  }
  fill(g, col, P) { if (this.poly(g, P)) { g.fillStyle = col; g.fill(); return true; } return false; }
  // the common patches: a wall in the plane x = X (heights may slope along z, for a flight), a floor
  // or ceiling at height Y (or sloping from Y0 at z0 to Y1 at z1), a face toward you at z = Z
  wallX(g, col, X, z0, z1, y0a, y1a, y0b = y0a, y1b = y1a) { return this.fill(g, col, [X, y0a, z0, X, y1a, z0, X, y1b, z1, X, y0b, z1]); }
  flat(g, col, x0, x1, z0, z1, Y0, Y1 = Y0) { return this.fill(g, col, [x0, Y0, z0, x1, Y0, z0, x1, Y1, z1, x0, Y1, z1]); }
  face(g, col, Z, x0, x1, y0, y1) { return this.fill(g, col, [x0, y0, Z, x1, y0, Z, x1, y1, Z, x0, y1, Z]); }
  // a segment, clipped, appended to the current path
  seg(g, x0, y0, z0, x1, y1, z1) {
    const a = this.tc(x0, z0), ax = a[0], az = a[1], b = this.tc(x1, z1);
    let bx = b[0], bz = b[1];
    if (az < NEAR && bz < NEAR) return false;
    let Ax = ax, Az = az;
    if (Az < NEAR) { const t = (NEAR - Az) / (bz - Az); Ax += (bx - Ax) * t; y0 += (y1 - y0) * t; Az = NEAR; }
    else if (bz < NEAR) { const t = (NEAR - bz) / (Az - bz); bx += (Ax - bx) * t; y1 += (y0 - y1) * t; bz = NEAR; }
    const s0 = this.f / Az, s1 = this.f / bz;
    g.moveTo(this.cx + Ax * s0, this.hy - (y0 - this.y) * s0);
    g.lineTo(this.cx + bx * s1, this.hy - (y1 - this.y) * s1);
    return true;
  }

  // a picture standing upright between the floor points A (ax, az) and B (bx, bz), from height y0 to
  // y1 (plus a slope dy along it, for the wall of a flight): pasted in vertical slices, each one exact
  // at its edges, so it stays true in perspective on a side wall or on a door swinging open. A
  // vertical plane's projected height is linear in screen x, so the slices are spaced evenly across
  // the screen (only where it shows), as many as keep that height within about a pixel per slice,
  // and each one is trimmed to the rows that land on screen
  pic(g, img, ax, az, bx, bz, y0, y1, { sx = 0, sy = 0, sw = img.width, sh = img.height, dy = 0, alpha = 1 } = {}) {
    const A = this.tc(ax, az), Ax = A[0], Az = A[1], B = this.tc(bx, bz), Bx = B[0], Bz = B[1];
    if (Az < NEAR && Bz < NEAR) return;
    const f = this.f, cx = this.cx, hy = this.hy, ey = this.y, dX = Bx - Ax, dZ = Bz - Az;
    let ua = 0, ub = 1;
    if (Az < NEAR) ua = (NEAR - Az) / dZ; else if (Bz < NEAR) ub = (NEAR - Az) / dZ;
    const Xof = (u) => cx + ((Ax + dX * u) * f) / (Az + dZ * u);
    const uOf = (X) => { const q = (X - cx) / f, den = q * dZ - dX; return Math.abs(den) < 1e-12 ? 0 : (Ax - q * Az) / den; };
    // what shows: a margin round the frame for the roll and the shake
    const mx = this.W * 0.08, my = this.H * 0.08, Xa = Xof(ua), Xb = Xof(ub);
    const XL = Math.max(Math.min(Xa, Xb), -mx), XR = Math.min(Math.max(Xa, Xb), this.W + mx);
    if (XR - XL < 0.05) return;
    const square = Math.abs(dZ) < 1e-6;
    let n = 1, us = [ua, ub];
    if (!square) {
      const hOf = (u) => ((y1 - y0) * f) / (Az + dZ * u), uL = uOf(XL), uR = uOf(XR);
      n = Math.max(1, Math.min(300, Math.max(Math.ceil((XR - XL) / 6), Math.ceil(Math.abs(hOf(uR) - hOf(uL)) / 1.2))));
      us = new Array(n + 1);
      for (let i = 0; i <= n; i++) us[i] = Math.min(ub, Math.max(ua, uOf(XL + ((XR - XL) * i) / n)));
      if (us[0] > us[n]) us.reverse();
    } else if (XL > Math.min(Xa, Xb) || XR < Math.max(Xa, Xb)) {
      us = [Math.min(uOf(XL), uOf(XR)), Math.max(uOf(XL), uOf(XR))].map((u) => Math.min(ub, Math.max(ua, u)));
    }
    // compose each slice with whatever transform the frame is drawn under (device pixels, shake, roll)
    const M = g.getTransform(), { a, b, c, d, e, f: F } = M, H = this.H;
    if (alpha < 1) g.globalAlpha = alpha;
    const pad = n > 1 ? 0.6 : 0;
    for (let i = 0; i < us.length - 1; i++) {
      const u0 = us[i], u1 = us[i + 1];
      if (u1 - u0 < 1e-9) continue;
      const z0 = Az + dZ * u0, z1 = Az + dZ * u1, s0 = f / z0, s1 = f / z1;
      const X0 = cx + (Ax + dX * u0) * s0, X1 = cx + (Ax + dX * u1) * s1;
      const t0 = hy - (y1 + dy * u0 - ey) * s0, b0 = hy - (y0 + dy * u0 - ey) * s0;
      const t1 = hy - (y1 + dy * u1 - ey) * s1, b1 = hy - (y0 + dy * u1 - ey) * s1;
      const cu = sx + sw * u0, cw = Math.max(0.5, sw * (u1 - u0));
      // the slice as a parallelogram: its top edge exact, its height the mean of its two edges'
      const h = ((b0 - t0) + (b1 - t1)) / 2, kD = h / sh;
      const v0 = Math.max(0, Math.floor((-my - Math.max(t0, t1)) / kD) - 1), v1 = Math.min(sh, Math.ceil((H + my - Math.min(t0, t1)) / kD) + 1);
      if (v1 <= v0) continue;
      const kA = (X1 - X0 + pad * Math.sign(X1 - X0 || 1)) / cw, kB = (t1 - t0) / cw;
      g.setTransform(a * kA + c * kB, b * kA + d * kB, c * kD, d * kD, a * X0 + c * t0 + e, b * X0 + d * t0 + F);
      g.drawImage(img, cu, sy + v0, cw, v1 - v0, 0, v0, cw, v1 - v0);
    }
    g.setTransform(M);
    if (alpha < 1) g.globalAlpha = 1;
  }

  // `k`: band height over distance from the horizon; the band error across a row grows as k·|x − cx|
  floorTex(g, pat, ppm, Y, x0, x1, z0, z1, { ox = 0, oz = 0, far = 40, k = 0.028 } = {}) {
    const h = this.y - Y;
    if (Math.abs(h) < 1e-3) return false;
    if (!this.poly(g, [x0, Y, z0, x1, Y, z0, x1, Y, z1, x0, Y, z1])) return false;
    // the outline's rows on screen
    let top = Infinity, bot = -Infinity, lf = Infinity, rt = -Infinity;
    const out = this.buf;
    for (let i = 0; i < out.length; i += 3) {
      const s = this.f / out[i + 2], X = this.cx + out[i] * s, Yy = this.hy - (out[i + 1] - this.y) * s;
      if (Yy < top) top = Yy; if (Yy > bot) bot = Yy; if (X < lf) lf = X; if (X > rt) rt = X;
    }
    const up = h < 0;                          // a ceiling: its rows lie above the horizon
    const lim = this.hy + (up ? -1 : 1) * Math.abs(h) * this.f / far;
    if (up) { bot = Math.min(bot, lim); top = Math.max(top, -this.H); } else { top = Math.max(top, lim); bot = Math.min(bot, this.H * 2); }
    lf = Math.max(lf, -this.W); rt = Math.min(rt, this.W * 2);
    if (bot <= top || rt <= lf) return true;
    g.save(); g.clip();
    const M = this.M || (this.M = new DOMMatrix()), f = this.f, cs = this.cs, sn = this.sn;
    g.fillStyle = pat;
    let y = up ? bot : top;
    for (let guard = 0; guard < 400; guard++) {
      const r = Math.abs(y - this.hy), step = Math.max(1.5, r * k);
      const ya = up ? y - step : y, yb = up ? y : y + step, ym = (ya + yb) / 2;
      const zc = (h * f) / (ym - this.hy);     // distance of the band's middle row
      if (zc > NEAR) {
        const wx = this.x + sn * zc - ox, wz = this.z + cs * zc - oz;
        const k = f / zc, q = (-h * f) / (zc * zc);
        const J00 = k * cs, J01 = -k * sn, J10 = q * sn, J11 = q * cs;
        M.a = J00 / ppm; M.c = J01 / ppm; M.b = J10 / ppm; M.d = J11 / ppm;
        M.e = this.cx - (J00 * wx + J01 * wz); M.f = ym - (J10 * wx + J11 * wz);
        pat.setTransform(M);
        g.fillRect(lf, ya, rt - lf, yb - ya + 0.6);
      }
      y = up ? ya : yb;
      if (up ? y <= top : y >= bot) break;
    }
    g.restore();
    return true;
  }
}
