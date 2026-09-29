// The rooms, drawn from where you stand. The way up is a string of boxes (the street, the lobby,
// the lift, each flight and landing, your flat); you are always in one of them, looking along the
// way you walk. Whatever lies beyond its doorway is drawn first, clipped to the doorway, and then
// the room itself on top: a portal renderer in painter's order, with no depth buffer. Floors and
// ceilings are textured row by row and walls column by column, exact where it shows; distance
// sinks into the room's own air. Lights that must shine through the dark (a switch's pilot, the
// lift's display, a window) are kept as glows and drawn again over the stair light's veil.
import { PAL, tone, darker, lighter, ell, rrect, canvas, seg7, seg7w, rgba, TAU, FACE } from './paint.js';
import * as T from './tex.js';
import { NEAR } from './cam.js';
import { TREAD, RISER, NST, STOREY, ROAD, FLAT } from './world.js';
import { clamp, lerp, smooth, mulberry32 } from '../util.js';

// ---------- pictures as fills ----------
const pats = new WeakMap();
const pattern = (g, img) => {
  let m = pats.get(g);
  if (!m) pats.set(g, (m = new Map()));
  let p = m.get(img);
  if (!p) m.set(img, (p = g.createPattern(img, 'repeat')));
  return p;
};
// a picture turned to lie on the floor: 'v' flipped (to read from the near side), 'l' / 'r' a
// quarter turn (a mat in front of a door in the left or the right wall); 'h' mirrored
const turned = new WeakMap();
const turn = (img, how) => {
  let m = turned.get(img);
  if (!m) turned.set(img, (m = {}));
  if (m[how]) return m[how];
  const w = img.width, h = img.height, v = how === 'v' || how === 'h', c = canvas(v ? w : h, v ? h : w), g = c.getContext('2d');
  if (how === 'v') g.setTransform(1, 0, 0, -1, 0, h);
  else if (how === 'h') g.setTransform(-1, 0, 0, 1, w, 0);
  else if (how === 'l') g.setTransform(0, 1, 1, 0, 0, 0);
  else g.setTransform(0, -1, -1, 0, h, w);
  g.drawImage(img, 0, 0);
  return (m[how] = c);
};

// the air: how much of the room's haze lies in front of something d metres away
const DH = [2, 3.5, 6, 10, 15, 22, 40];
const fk = (d) => (d <= 2 ? 0 : Math.pow(clamp((d - 2) / 20), 0.9) * 0.6);
const HS = DH.map((d) => [(0.5 - 1 / d) / 0.475, fk(d)]);
const LETTERS = 'ABCD';
// the cars parked along the kerb (front end, colour, seed): a gap in the middle where you cross
const CARS = [[-13.6, '#b9b4aa', 2], [-9.3, '#7b2126', 3], [-5.0, '#e8e5dc', 4], [0.9, '#2d4157', 5], [5.2, '#6f7c52', 6]];
// a lift's display: red segments behind black glass, as a picture for any wall
const lcds = new Map();
function lcdTex(str, on = '#ff5b2e') {
  const key = str + on;
  let c = lcds.get(key);
  if (c) return c;
  c = canvas(110, 64);
  const g = c.getContext('2d'), dh = 38, dw = seg7w(str.length, dh) - dh * 0.26;
  g.fillStyle = '#231915'; rrect(g, 0, 0, 110, 64, 8); g.fill();
  g.fillStyle = '#0b0706'; rrect(g, 6, 6, 98, 52, 5); g.fill();
  seg7(g, str, (110 - dw) / 2, 13, dh, on, 'rgba(255,91,46,0.09)');
  lcds.set(key, c);
  return c;
}
// the lobby's tiles without their moulding, whole rows only, for a stair's sloping dado
let plainT = null;
const plainTiles = () => {
  if (plainT) return plainT;
  const src = T.tiles(1.2);
  plainT = canvas(360, 360);
  plainT.getContext('2d').drawImage(src, 0, src.height - 360, 360, 360, 0, 0, 360, 360);
  return plainT;
};
// what the community has taped up in each lobby
const NOTES = {
  bajo: ['COMUNIDAD', ['Se ruega', 'cerrar el portal.', 'Gracias.']],
  primero: ['AVISO', ['La luz de la', 'escalera se apaga', 'sola. Pulse LUZ.']],
  quinto: ['ASCENSOR', ['Revisión anual:', 'martes, 9 a 13 h.', 'Disculpen.']],
  tercero: ['JUNTA', ['Jueves, 20 h.', 'Orden del día:', 'el ascensor.']],
  mes: ['SE VENDE', ['Bicicleta', 'estática, casi', 'nueva. 2º B']],
  nochebuena: ['¡FELICES FIESTAS!', ['Les desea', 'Paco, el portero']],
};

export class Rooms {
  constructor(world) {
    this.world = world; this.W = world.W; this.lv = world.lv;
    this.glows = []; this.clips = []; this.sprites = {};
    this.hz = PAL.shade; this.hk = 1; this.xr = [0, 1];
    this.g = null; this.cam = null; this.sim = null; this.hooks = {}; this.M = null;
    this.street0 = this.W.rooms.find((r) => r.kind === 'street');
  }
  // how far along act i is (0 before it, 1 after), eased between t0 and t1 of its time
  actP(i, t0 = 0, t1 = 1) {
    const s = this.sim, A = s.act;
    if (i == null || i < 0) return 0;
    return s.si > i ? 1 : s.si === i && A ? smooth((A.t / A.T - t0) / (t1 - t0)) : 0;
  }
  lit(R) { return R.timer ? this.world.light : 1; }

  // ---------- the frame ----------
  draw(g, cam, sim, w = this.world.where(sim), hooks = {}) {
    this.g = g; this.cam = cam; this.sim = sim; this.hooks = hooks;
    this.glows.length = 0; this.clips.length = 0; this.xr = [-cam.W * 0.1, cam.W * 1.1];
    const rooms = w.L.rooms;
    let k = Math.max(0, rooms.indexOf(w.R));
    while (k > 0 && rooms[k].zIn != null && cam.z < rooms[k].zIn - 0.02) k--;
    const R = rooms[k], out = R.kind === 'street' || R.kind === 'trunk';
    this.hz = out ? (this.W.night ? '#1b2340' : PAL.skyLo) : PAL.shade; this.hk = out ? 0.45 : 1;
    g.fillStyle = PAL.shade; g.fillRect(-cam.W, -cam.H, cam.W * 3, cam.H * 3);
    if (R.kind === 'trunk') this.trunk(R);
    else { if (out) this.sky(); this.from(rooms, k); }
    return R;
  }
  // room k of a leg, and first whatever shows through its way out
  from(rooms, k) {
    const R = rooms[k], N = rooms[k + 1], g = this.g, cam = this.cam;
    if (N && this.seeThrough(R)) {
      const O = this.opening(R);
      if (!O) this.from(rooms, k + 1);
      else if (cam.z < O.Z) {
        const P = [O.x0, O.y0, O.Z, O.x1, O.y0, O.Z, O.x1, O.y1, O.Z, O.x0, O.y1, O.Z];
        g.save();
        if (cam.poly(g, P)) {
          const xr = this.xr, e = this.extent();
          g.clip(); this.clips.push(P);
          this.xr = [Math.max(xr[0], e[0]), Math.min(xr[1], e[1])];
          if (this.xr[1] > this.xr[0]) {
            this.from(rooms, k + 1);
            // a lit room seen into a dark one, or the other way round
            if (N.timer && !R.timer) {
              const a = (1 - this.world.light) * N.dark;
              if (a > 0.01) { g.fillStyle = rgba(PAL.night, a); g.fillRect(-cam.W, -cam.H, cam.W * 3, cam.H * 3); }
            } else if (R.timer && !N.timer) {
              const xr2 = this.xr;
              this.glow((gg, dark) => {
                if (dark < 0.02) return;
                const keep = this.glows, kx = this.xr;
                this.glows = []; this.xr = xr2; this.from(rooms, k + 1);
                if (R.kind === 'landing' && !R.corridor) this.landingBeyond(R);
                this.glows = keep; this.xr = kx;
              });
            }
          }
          this.xr = xr; this.clips.pop();
        }
        g.restore();
      }
    }
    this.room(R);
  }
  seeThrough(R) {
    const E = R.exit, L = this.world.lift;
    if (R.kind === 'flight' || (R.kind === 'lobby' && R.end === 'stairs')) return true;
    if (!E) return false;
    switch (E.kind) {
      case 'portal': return true;
      case 'flat': return this.world.doorOpen(R) > 0.001;
      case 'lift': return !!L.here && L.open > 0.01;
      case 'oldlift': return (L.door || 0) > 0.01;
      case 'liftOut': return L.outOpen > 0.01;
      case 'oldliftOut': return (L.outDoor || 0) > 0.01;
    }
    return false;
  }
  opening(R) {
    if (R.kind === 'flight') return null;
    if (R.kind === 'lobby' && R.end === 'stairs') return { Z: R.zE, x0: -0.6, x1: 0.6, y0: R.y0, y1: R.y0 + 2.45 };
    const E = R.exit;
    return { Z: E.Z, x0: E.x0, x1: E.x1, y0: R.y0, y1: R.y0 + E.h };
  }
  room(R) {
    switch (R.kind) {
      case 'street': return this.street(R);
      case 'lobby': return this.lobby(R);
      case 'cabin': return this.cabin(R);
      case 'cabinOut': return this.cabinOut(R);
      case 'flight': return this.flight(R);
      case 'half': return this.half(R);
      case 'landing': return R.corridor ? this.corridor(R) : this.landing(R);
      case 'home': return this.home(R);
    }
  }
  // the screen extent of the last polygon: [left, right, top, bottom]
  extent() {
    const cam = this.cam, b = cam.buf;
    let lf = Infinity, rt = -Infinity, top = Infinity, bot = -Infinity;
    for (let i = 0; i < b.length; i += 3) {
      const s = cam.f / b[i + 2], X = cam.cx + b[i] * s, Y = cam.hy - (b[i + 1] - cam.y) * s;
      if (X < lf) lf = X; if (X > rt) rt = X; if (Y < top) top = Y; if (Y > bot) bot = Y;
    }
    return [lf, rt, top, bot];
  }

  // ---------- glows: lights drawn again over the dark ----------
  glow(fn) { const c = this.cam; this.glows.push({ fn, clips: this.clips.slice(), st: [c.x, c.y, c.z, c.yaw] }); }
  runGlows(g, dark = 0) {
    const cam = this.cam;
    if (!cam || !this.glows.length) return;
    const st = [cam.x, cam.y, cam.z, cam.yaw];
    for (const G of this.glows) {
      this.setCam(G.st);
      g.save();
      let ok = true;
      for (const P of G.clips) { if (!cam.poly(g, P)) { ok = false; break; } g.clip(); }
      if (ok) G.fn(g, dark);
      g.restore();
    }
    this.setCam(st);
  }
  setCam(st) { const c = this.cam; c.x = st[0]; c.y = st[1]; c.z = st[2]; c.yaw = st[3]; c.cs = Math.cos(c.yaw); c.sn = Math.sin(c.yaw); }
  // a soft round light at a point, r metres across its core
  halo(g, x, y, z, r, col, a, core = '#ffffff') {
    const p = this.cam.p(x, y, z);
    if (!p || a <= 0.005) return;
    const X = p[0], Y = p[1], R = Math.max(1.2, r * p[2]), H = R * 5 + 3;
    const gr = g.createRadialGradient(X, Y, 0, X, Y, H);
    gr.addColorStop(0, rgba(core, Math.min(1, a))); gr.addColorStop(R / H, rgba(col, Math.min(1, a * 0.9)));
    gr.addColorStop(Math.min(0.99, (R / H) * 2.2), rgba(col, a * 0.28)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(X - H, Y - H, H * 2, H * 2);
  }

  // ---------- surfaces ----------
  // a level floor or ceiling: its colour, its texture laid row by row, the air over it
  plane(x0, x1, z0, z1, Y, col, img, ppm, o, deco) {
    const g = this.g, cam = this.cam;
    if (!cam.flat(g, col, x0, x1, z0, z1, Y)) return false;
    if (img) cam.floorTex(g, pattern(g, img), ppm, Y, x0, x1, z0, z1, o);
    if (deco) deco([x0, Y, z0, x1, Y, z0, x1, Y, z1, x0, Y, z1]);
    this.hazeY(x0, x1, z0, z1, Y);
    return true;
  }
  hazeY(x0, x1, z0, z1, Y) {
    const cam = this.cam, g = this.g, h = cam.y - Y;
    if (Math.abs(h) < 0.01) return;
    const dm = Math.max(cam.depth(x0, z0), cam.depth(x1, z0), cam.depth(x0, z1), cam.depth(x1, z1));
    if (dm <= 2) return;
    if (!cam.poly(g, [x0, Y, z0, x1, Y, z0, x1, Y, z1, x0, Y, z1])) return;
    const r0 = cam.hy + (h * cam.f) / 2, r1 = cam.hy + (h * cam.f) / 40;
    const gr = g.createLinearGradient(0, r0, 0, r1);
    for (const [t, a] of HS) gr.addColorStop(t, rgba(this.hz, a * this.hk));
    g.fillStyle = gr; g.fill();
  }
  // the air in front of an upright surface standing between floor points A and B
  hazeW(P, ax, az, bx, bz) {
    const cam = this.cam, g = this.g, da = cam.depth(ax, az), db = cam.depth(bx, bz);
    if (Math.max(da, db) <= 2) return;
    let t0 = 0, t1 = 1;
    if (da < 0.3) t0 = (0.3 - da) / (db - da);
    else if (db < 0.3) t1 = (0.3 - da) / (db - da);
    const q = [];
    let amax = 0;
    for (let i = 0; i < 7; i++) {
      const t = t0 + ((t1 - t0) * i) / 6, c = cam.tc(ax + (bx - ax) * t, az + (bz - az) * t), a = fk(c[1]) * this.hk;
      q.push(cam.cx + (c[0] * cam.f) / c[1], a);
      if (a > amax) amax = a;
    }
    if (amax < 0.01 || !cam.poly(g, P)) return;
    const X0 = q[0], X1 = q[12];
    if (Math.abs(X1 - X0) < 1) { g.fillStyle = rgba(this.hz, (q[1] + q[13]) / 2); g.fill(); return; }
    const gr = g.createLinearGradient(X0, 0, X1, 0);
    for (let i = 0; i < 14; i += 2) gr.addColorStop(clamp((q[i] - X0) / (X1 - X0)), rgba(this.hz, q[i + 1]));
    g.fillStyle = gr; g.fill();
  }
  hazeAt(x, z) { return fk(this.cam.depth(x, z)) * this.hk; }
  hazeFill(P, x, z) {
    const a = this.hazeAt(x, z);
    if (a > 0.01) this.cam.fill(this.g, rgba(this.hz, a), P);
  }
  // a periodic texture on an upright wall from floor point A to B, heights y0..y1, filled in narrow
  // vertical bands (a column of a wall is all at one distance), each exact at its edges along the
  // wall's middle row. `u0`: where A falls along the pattern, in metres; `vTop`: the height of the
  // pattern's top row
  vtex(img, ppm, ax, az, bx, bz, y0, y1, u0 = 0, vTop = y1) {
    const cam = this.cam, g = this.g;
    if (!cam.poly(g, [ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az])) return;
    let [lf, rt, top, bot] = this.extent();
    lf = Math.max(lf, this.xr[0]); rt = Math.min(rt, this.xr[1]);
    top = Math.max(top, -cam.H * 0.1); bot = Math.min(bot, cam.H * 1.1);
    if (rt - lf < 0.25 || bot <= top) return;
    g.save(); g.clip();
    const pat = pattern(g, img), f = cam.f, cx = cam.cx, hy = cam.hy, ey = cam.y;
    const A = cam.tc(ax, az), Ax = A[0], Az = A[1], B = cam.tc(bx, bz), Dx = B[0] - Ax, Dz = B[1] - Az;
    const L = Math.hypot(bx - ax, bz - az), M = this.M || (this.M = new DOMMatrix());
    const tAt = (X) => { const k = (X - cx) / f, den = Dx - k * Dz; return Math.abs(den) < 1e-9 ? 0 : (k * Az - Ax) / den; };
    // the scale changes at a steady rate across a wall's picture: bands narrow enough that the rows
    // at its top and bottom stay within a pixel
    const c = Dz * Ax - Dx * Az, ds = Math.abs(c) < 1e-9 ? 0 : Math.abs(Dz / c);
    const bw = ds < 1e-6 ? rt - lf + 1 : clamp(1.6 / (Math.max(0.05, (y1 - y0) / 2) * ds), 1, 96);
    const yr = (y0 + y1) / 2, pvr = (vTop - yr) * ppm;
    g.fillStyle = pat;
    for (let X0 = lf, n = 0; X0 < rt && n < 4000; X0 += bw, n++) {
      const X1 = Math.min(rt, X0 + bw), t0 = tAt(X0), t1 = tAt(X1);
      const za = Math.max(NEAR, Az + t0 * Dz), zb = Math.max(NEAR, Az + t1 * Dz), zm = Math.max(NEAR, Az + tAt((X0 + X1) / 2) * Dz);
      const pu0 = (u0 + t0 * L) * ppm, pu1 = (u0 + t1 * L) * ppm;
      if (Math.abs(pu1 - pu0) < 1e-6) continue;
      const Ra = hy - (yr - ey) * (f / za), Rb = hy - (yr - ey) * (f / zb);
      const a = (X1 - X0) / (pu1 - pu0), b = (Rb - Ra) / (pu1 - pu0), d = f / zm / ppm;
      M.a = a; M.b = b; M.c = 0; M.d = d; M.e = X0 - pu0 * a; M.f = Ra - pu0 * b - pvr * d;
      pat.setTransform(M);
      g.fillRect(X0, top, X1 - X0 + 0.6, bot - top);
    }
    g.restore();
  }
  // the skin of an upright wall (P its outline, A→B along it): 'tile' glazed to the top, 'dado'
  // paint over tiles to 1.2 m, 'paint' with a skirting, or a plain colour
  skin(P, skin, ax, az, bx, bz, y0, y1, u0) {
    const cam = this.cam, g = this.g;
    if (skin === 'tile') {
      cam.fill(g, PAL.tile, P);
      this.vtex(T.tiles(Math.round((y1 - y0) * 20) / 20), 360, ax, az, bx, bz, y0, y1, u0, y1);
    } else if (skin === 'dado') {
      cam.fill(g, PAL.paint, P);
      const h = Math.min(1.2, y1 - y0);
      this.vtex(T.tiles(1.2), 360, ax, az, bx, bz, y0, y0 + h, u0, y0 + 1.2);
    } else if (skin === 'kitchen') {
      // tiled to the ceiling, as a Spanish kitchen should be
      cam.fill(g, PAL.kitchen, P);
      this.vtex(T.kitchenTiles(), 300, ax, az, bx, bz, y0, y1, u0, y1);
    } else if (skin === 'paint') {
      cam.fill(g, PAL.paint, P);
      cam.fill(g, PAL.woodDk, [ax, y0, az, bx, y0, bz, bx, y0 + 0.08, bz, ax, y0 + 0.08, az]);
    } else cam.fill(g, skin, P);
  }
  // a side wall in the plane x = X: side −1 the left one (seen from its right), +1 the right one
  sideWall(X, z0, z1, y0, y1, skin, side, fit) {
    const cam = this.cam;
    if (side < 0 ? cam.x <= X : cam.x >= X) return false;
    const P = [X, y0, z0, X, y1, z0, X, y1, z1, X, y0, z1];
    if (!cam.poly(this.g, P)) return false;
    if (side < 0) this.skin(P, skin, X, z0, X, z1, y0, y1, z0);
    else this.skin(P, skin, X, z1, X, z0, y0, y1, -z1);
    if (fit) fit();
    this.hazeW(P, X, z0, X, z1);
    return true;
  }
  // the wall facing you at z = Z, with holes (doorways, a window) cut through it
  endWall(Z, x0, x1, y0, y1, skin, holes = [], fit) {
    const cam = this.cam, g = this.g;
    if (cam.z >= Z) return false;
    const P = [x0, y0, Z, x1, y0, Z, x1, y1, Z, x0, y1, Z];
    g.save();
    if (!cam.poly(g, P)) { g.restore(); return false; }
    for (const h of holes) cam.poly(g, [h.x0, h.y0, Z, h.x0, h.y1, Z, h.x1, h.y1, Z, h.x1, h.y0, Z], true);
    g.clip('evenodd');
    this.skin(P, skin, x0, Z, x1, Z, y0, y1, x0);
    if (fit) fit();
    const a = this.hazeAt((x0 + x1) / 2, Z);
    if (a > 0.01 && cam.poly(g, P)) { g.fillStyle = rgba(this.hz, a); g.fill(); }
    g.restore();
    for (const h of holes) if (h.fw !== 0) this.ring(Z - 0.004, h);
    return true;
  }
  // the architrave round a doorway (or a window, with its sill)
  ring(Z, h, fw = h.fw ?? 0.07, col = h.frame ?? PAL.woodDk) {
    const cam = this.cam, g = this.g, b = h.sill ? fw : 0;
    if (!cam.poly(g, [h.x0 - fw, h.y0 - b, Z, h.x1 + fw, h.y0 - b, Z, h.x1 + fw, h.y1 + fw, Z, h.x0 - fw, h.y1 + fw, Z])) return;
    cam.poly(g, [h.x0, h.y0, Z, h.x0, h.y1, Z, h.x1, h.y1, Z, h.x1, h.y0, Z], true);
    g.fillStyle = col; g.fill('evenodd');
    const a = this.hazeAt((h.x0 + h.x1) / 2, Z);
    if (a > 0.01) { g.fillStyle = rgba(this.hz, a); g.fill('evenodd'); }
  }
  // the thickness of the wall round a hole: the jambs, the head, a window's sill
  reveals(Z, h, dep = 0.12, col = PAL.paintDk) {
    const cam = this.cam, g = this.g, Z1 = Z + dep;
    if (cam.x > h.x0) cam.wallX(g, darker(col, 0.06), h.x0, Z, Z1, h.y0, h.y1);
    if (cam.x < h.x1) cam.wallX(g, darker(col, 0.06), h.x1, Z, Z1, h.y0, h.y1);
    if (cam.y < h.y1) cam.flat(g, darker(col, 0.16), h.x0, h.x1, Z, Z1, h.y1);
    if (h.sill && cam.y > h.y0) cam.flat(g, lighter(col, 0.12), h.x0, h.x1, Z, Z1, h.y0);
  }
  // a picture flat on an upright wall: a side wall {X, z} (centred at z) or the end wall {Z, x}
  onWall(img, at, w, y0, y1, alpha = 1) {
    const cam = this.cam, g = this.g;
    if (at.Z != null) {
      if (cam.z >= at.Z) return false;
      const Z = at.Z - 0.004;
      cam.pic(g, img, at.x - w / 2, Z, at.x + w / 2, Z, y0, y1, { alpha });
      return true;
    }
    const L = at.X < 0;
    if (L ? cam.x <= at.X : cam.x >= at.X) return false;
    const X = at.X + (L ? 0.004 : -0.004);
    if (L) cam.pic(g, img, X, at.z - w / 2, X, at.z + w / 2, y0, y1, { alpha });
    else cam.pic(g, img, X, at.z + w / 2, X, at.z - w / 2, y0, y1, { alpha });
    return true;
  }
  // a picture lying on the floor (a doormat): turned so it reads from where you come
  onFloor(img, how, ppm, Y, x0, x1, z0, z1) {
    const cam = this.cam, g = this.g, im = how ? turn(img, how) : img;
    if (cam.y - Y < 0.05) return;
    const p = g.createPattern(im, 'no-repeat');
    cam.floorTex(g, p, ppm, Y, x0, x1, z0, z1, { ox: x0, oz: z0 });
  }

  // ---------- things ----------
  // a door leaf on its hinges: o 0 shut … 1 open (83°), swinging away from you (push) or toward you
  leaf({ img, backImg, xh, Z, w, y0, h, o, push = true, hinge, thick = 0.045, back = PAL.woodDk, dz = 0.04 }) {
    const cam = this.cam, g = this.g;
    const phi = clamp(o) * 1.45, sig = push ? 1 : -1, s = -hinge;
    const ux = s * Math.cos(phi), uz = sig * Math.sin(phi);
    const hx = xh, hz = Z + dz, fx = hx + w * ux, fz = hz + w * uz, y1 = y0 + h;
    const al = s * sig * phi, nx = Math.sin(al), nz = -Math.cos(al), ex = -nx * thick, ez = -nz * thick;
    const mx = (hx + fx) / 2, mz = (hz + fz) / 2;
    if (ux * (cam.x - fx) + uz * (cam.z - fz) > 0) cam.fill(g, darker(back, 0.12), [fx, y0, fz, fx + ex, y0, fz + ez, fx + ex, y1, fz + ez, fx, y1, fz]);
    let P;
    if (nx * (cam.x - mx) + nz * (cam.z - mz) > 0) {
      P = [hx, y0, hz, fx, y0, fz, fx, y1, fz, hx, y1, hz];
      if (s > 0) cam.pic(g, img, hx, hz, fx, fz, y0, y1); else cam.pic(g, img, fx, fz, hx, hz, y0, y1);
    } else {
      const ax = hx + ex, az = hz + ez, bx = fx + ex, bz = fz + ez;
      P = [ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az];
      if (backImg) {
        if (s > 0) cam.pic(g, backImg, bx, bz, ax, az, y0, y1); else cam.pic(g, backImg, ax, az, bx, bz, y0, y1);
        this.hazeW(P, hx, hz, fx, fz);
        return;
      }
      cam.fill(g, back, P);
      const k0 = 0.14, k1 = 0.86;
      cam.fill(g, darker(back, 0.18), [ax + (bx - ax) * k0, y0 + h * 0.08, az + (bz - az) * k0, ax + (bx - ax) * k1, y0 + h * 0.08, az + (bz - az) * k1, ax + (bx - ax) * k1, y0 + h * 0.46, az + (bz - az) * k1, ax + (bx - ax) * k0, y0 + h * 0.46, az + (bz - az) * k0]);
      cam.fill(g, darker(back, 0.18), [ax + (bx - ax) * k0, y0 + h * 0.54, az + (bz - az) * k0, ax + (bx - ax) * k1, y0 + h * 0.54, az + (bz - az) * k1, ax + (bx - ax) * k1, y0 + h * 0.92, az + (bz - az) * k1, ax + (bx - ax) * k0, y0 + h * 0.92, az + (bz - az) * k0]);
    }
    this.hazeW(P, hx, hz, fx, fz);
  }
  // a flat's front door in its frame on the end wall at Z: the doorway's hole and its leaf
  flatHole(Z, y0, x0 = -FLAT.x, x1 = FLAT.x) { return { x0, x1, y0, y1: y0 + FLAT.h }; }
  flatLeaf(E, Z, y0, o, x0 = E.x0 ?? -FLAT.x, tint) {
    const img = T.flatDoor(E.letter, E.locks || 1, E.hinge < 0 ? 'L' : 'R', tint);
    this.leaf({ img, xh: E.hinge < 0 ? x0 : x0 + 0.9, Z, w: 0.9, y0, h: FLAT.h, o, push: true, hinge: E.hinge });
  }
  // a ceiling lamp: an opal dome in a brass ring
  lamp(x, z, Y, lvl) {
    const cam = this.cam, g = this.g, p = cam.p(x, Y, z);
    if (!p) return;
    const d = Math.max(0.3, cam.depth(x, z)), rx = 0.17 * p[2], ry = Math.max(0.8, (rx * Math.abs(Y - cam.y)) / d), X = p[0], Yy = p[1];
    const drop = 0.07 * p[2];
    g.fillStyle = PAL.brassDk; ell(g, X, Yy, rx * 1.12, ry * 1.12); g.fill();
    const gr = g.createRadialGradient(X - rx * 0.25, Yy + drop * 0.4, 0, X, Yy + drop * 0.3, rx);
    if (lvl > 0.05) { gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, tone('#e9dcc0', PAL.lamp, lvl)); gr.addColorStop(1, tone('#bfb49c', '#f3d9a2', lvl)); }
    else { gr.addColorStop(0, '#d9d4c8'); gr.addColorStop(1, '#8f897c'); }
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(X, Yy, rx, ry, 0, 0, Math.PI); g.ellipse(X, Yy, rx, ry + drop, 0, Math.PI, 0, true); g.fill();
    g.fillStyle = PAL.brass; ell(g, X, Yy + drop + ry * 0.2, rx * 0.12, rx * 0.08); g.fill();
    const a = this.hazeAt(x, z);
    if (a > 0.01) { g.fillStyle = rgba(this.hz, a); ell(g, X, Yy + drop * 0.5, rx * 1.12, ry + drop); g.fill(); }
  }
  // light from a lamp pooled on the floor below it (added, so it lifts whatever is there)
  pool(x, z, Y, lvl, r = 1.6, col = '#ffe7b8', clipP) {
    if (lvl < 0.02) return;
    const cam = this.cam, g = this.g, p = cam.p(x, Y, z);
    if (!p) return;
    const d = Math.max(0.3, cam.depth(x, z)), rx = r * p[2], ry = Math.max(1, (rx * Math.abs(cam.y - Y)) / d);
    g.save();
    if (clipP) { if (!cam.poly(g, clipP)) { g.restore(); return; } g.clip(); }
    g.globalCompositeOperation = 'lighter';
    g.translate(p[0], p[1]); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, rgba(col, 0.13 * lvl)); gr.addColorStop(0.5, rgba(col, 0.06 * lvl)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx * 2);
    g.restore();
  }
  // the stair light's push button and its pilot: on a side wall {X, z, y} or the end wall {x, y, Z}
  switchAt(sw, y0) {
    const S = T.SWITCH, yb = y0 + sw.y - S.h / 2, yt = yb + S.h;
    if (!this.onWall(T.switchPlate(), sw, S.w, yb, yt)) return;
    const px = sw.Z != null ? sw.x : sw.X + (sw.X < 0 ? 0.006 : -0.006), pz = sw.Z != null ? sw.Z - 0.006 : sw.z, py = yt - S.h * 0.2;
    this.glow((g, dark) => this.halo(g, px, py, pz, 0.007, PAL.pilot, 0.4 + 0.6 * dark, PAL.pilotHot));
  }
  // a notice taped up: {Z, x} or {X, z}
  noticeAt(at, title, lines, y0, o = {}) {
    const w = o.w || 0.21, h = o.h || 0.28, img = T.notice(title, lines, o), yc = y0 + (o.y || 1.5);
    this.onWall(img, at, w, yc - h / 2, yc + h / 2);
  }
  // somebody at a door: her picture if there is one, else a figure drawn here. Feet at (x, Y, z)
  person(who, x, Y, z, k = 1) {
    const cam = this.cam, g = this.g, p = cam.p(x, Y, z);
    if (!p || k < 0.01) return;
    const s = p[2], img = this.sprites[who];
    g.save();
    if (k < 1) g.globalAlpha = k;
    if (img && img.width) {
      const h = 1.62 * s, w = (h * img.width) / img.height;
      g.drawImage(img, p[0] - w / 2, p[1] - h, w, h);
    } else {
      g.translate(p[0], p[1]); g.scale(s, s);
      if (who === 'suegra') this.suegra(g); else this.vecina(g);
    }
    g.restore();
    const a = this.hazeAt(x, z);
    if (a > 0.01) this.cam.fill(g, rgba(this.hz, a * k), [x - 0.3, Y, z, x + 0.3, Y, z, x + 0.3, Y + 1.65, z, x - 0.3, Y + 1.65, z]);
  }
  // (metres, feet at the origin, up is −y) the neighbour from the second: a quilted blue dressing
  // gown, slippers, curlers under a hairnet
  vecina(g) {
    const Y = (m) => -m;
    g.fillStyle = '#3a2c2a'; rrect(g, -0.17, Y(0.07), 0.14, 0.07, 0.03); g.fill(); rrect(g, 0.03, Y(0.07), 0.14, 0.07, 0.03); g.fill();
    g.fillStyle = PAL.skinDk; g.fillRect(-0.12, Y(0.2), 0.07, 0.14); g.fillRect(0.05, Y(0.2), 0.07, 0.14);
    g.fillStyle = '#4f78b8';
    g.beginPath(); g.moveTo(-0.24, Y(0.18)); g.lineTo(-0.2, Y(1.28)); g.quadraticCurveTo(0, Y(1.36), 0.2, Y(1.28)); g.lineTo(0.24, Y(0.18)); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.012;
    for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(-0.22, Y(0.3 + k * 0.14)); g.lineTo(0.22, Y(0.3 + k * 0.14)); g.stroke(); }
    g.fillStyle = '#e8eef6'; g.beginPath(); g.moveTo(-0.08, Y(1.3)); g.lineTo(0, Y(1.12)); g.lineTo(0.08, Y(1.3)); g.closePath(); g.fill();
    g.fillStyle = '#3f64a0'; g.fillRect(-0.24, Y(0.82), 0.48, 0.05);
    g.fillStyle = '#4f78b8'; rrect(g, -0.31, Y(1.25), 0.1, 0.5, 0.05); g.fill(); rrect(g, 0.21, Y(1.25), 0.1, 0.5, 0.05); g.fill();
    g.fillStyle = PAL.skin; ell(g, -0.26, Y(0.72), 0.045, 0.05); g.fill(); ell(g, 0.26, Y(0.72), 0.045, 0.05); g.fill();
    g.fillRect(-0.045, Y(1.4), 0.09, 0.1);
    ell(g, 0, Y(1.5), 0.1, 0.12); g.fill();
    g.fillStyle = '#b7aaa0'; ell(g, 0, Y(1.58), 0.12, 0.08); g.fill();
    for (const [cx, cy, c] of [[-0.08, 1.6, '#e98bb0'], [0, 1.64, '#8fc3e8'], [0.08, 1.6, '#e98bb0'], [-0.04, 1.55, '#f4e27a'], [0.05, 1.55, '#8fc3e8']]) { g.fillStyle = c; rrect(g, cx - 0.03, Y(cy + 0.022), 0.06, 0.044, 0.02); g.fill(); }
    g.fillStyle = '#2b2320'; ell(g, -0.035, Y(1.5), 0.01, 0.012); g.fill(); ell(g, 0.035, Y(1.5), 0.01, 0.012); g.fill();
    g.strokeStyle = '#8c4a3e'; g.lineWidth = 0.012; g.beginPath(); g.arc(0, Y(1.43), 0.035, 0.2, Math.PI - 0.2); g.stroke();
  }
  // your mother-in-law: a red jumper, a flowery apron, a grey bob, glasses, a wooden spoon
  suegra(g) {
    const Y = (m) => -m;
    g.fillStyle = '#2a2224'; rrect(g, -0.16, Y(0.07), 0.13, 0.07, 0.03); g.fill(); rrect(g, 0.03, Y(0.07), 0.13, 0.07, 0.03); g.fill();
    g.fillStyle = '#4a3d44'; g.beginPath(); g.moveTo(-0.2, Y(0.12)); g.lineTo(-0.18, Y(0.8)); g.lineTo(0.18, Y(0.8)); g.lineTo(0.2, Y(0.12)); g.closePath(); g.fill();
    g.fillStyle = '#b42a2e'; g.beginPath(); g.moveTo(-0.21, Y(0.72)); g.lineTo(-0.2, Y(1.3)); g.quadraticCurveTo(0, Y(1.38), 0.2, Y(1.3)); g.lineTo(0.21, Y(0.72)); g.closePath(); g.fill();
    g.fillStyle = '#f2ead8'; g.beginPath(); g.moveTo(-0.15, Y(0.3)); g.lineTo(-0.13, Y(1.22)); g.lineTo(0.13, Y(1.22)); g.lineTo(0.15, Y(0.3)); g.closePath(); g.fill();
    const R = mulberry32(7);
    for (let i = 0; i < 26; i++) { g.fillStyle = ['#d8506a', '#6aa35a', '#e8b33a'][i % 3]; ell(g, -0.12 + R() * 0.24, Y(0.35 + R() * 0.85), 0.014, 0.014); g.fill(); }
    g.fillStyle = '#b42a2e'; rrect(g, -0.29, Y(1.26), 0.1, 0.46, 0.05); g.fill(); rrect(g, 0.19, Y(1.26), 0.1, 0.46, 0.05); g.fill();
    g.fillStyle = PAL.skin; ell(g, -0.24, Y(0.78), 0.045, 0.05); g.fill(); ell(g, 0.24, Y(0.78), 0.045, 0.05); g.fill();
    g.strokeStyle = '#a8753f'; g.lineWidth = 0.025; g.beginPath(); g.moveTo(0.25, Y(0.74)); g.lineTo(0.3, Y(1.12)); g.stroke();
    g.fillStyle = '#a8753f'; ell(g, 0.305, Y(1.16), 0.03, 0.05); g.fill();
    g.fillStyle = PAL.skin; g.fillRect(-0.045, Y(1.42), 0.09, 0.1); ell(g, 0, Y(1.52), 0.1, 0.12); g.fill();
    g.fillStyle = '#c9c6c2'; g.beginPath(); g.moveTo(-0.12, Y(1.42)); g.quadraticCurveTo(-0.14, Y(1.7), 0, Y(1.67)); g.quadraticCurveTo(0.14, Y(1.7), 0.12, Y(1.42)); g.lineTo(0.08, Y(1.48)); g.quadraticCurveTo(0, Y(1.6), -0.08, Y(1.48)); g.closePath(); g.fill();
    g.strokeStyle = '#2b2527'; g.lineWidth = 0.01;
    g.beginPath(); g.arc(-0.04, Y(1.52), 0.028, 0, TAU); g.moveTo(0.068, Y(1.52)); g.arc(0.04, Y(1.52), 0.028, 0, TAU); g.moveTo(-0.012, Y(1.52)); g.lineTo(0.012, Y(1.52)); g.stroke();
    g.strokeStyle = '#8c3a3a'; g.lineWidth = 0.012; g.beginPath(); g.arc(0, Y(1.45), 0.04, 0.25, Math.PI - 0.25); g.stroke();
  }

  // ---------- outside ----------
  sky() {
    const g = this.g, cam = this.cam, n = this.W.night, hy = cam.hy;
    const gr = g.createLinearGradient(0, hy - cam.f, 0, hy);
    gr.addColorStop(0, n ? '#05070f' : '#8db8d6'); gr.addColorStop(0.7, n ? '#111730' : PAL.sky); gr.addColorStop(1, n ? '#1b2340' : PAL.skyLo);
    g.fillStyle = gr; g.fillRect(-cam.W, -cam.H, cam.W * 3, hy + cam.H);
    g.fillStyle = this.hz; g.fillRect(-cam.W, hy - 1, cam.W * 3, cam.H * 3);
  }
  // 16 m of a building's front centred at x = c in the plane z = Z: `dir` +1 faces −z (our side of
  // the street), −1 faces +z (across the road). Ours has the portal's bay open, the others a door shut in it
  facadeAt(c, Z, dir, seed, tint, own = false) {
    const cam = this.cam, g = this.g, n = this.W.night;
    if (dir > 0 ? cam.z >= Z : cam.z <= Z) return;
    const [b0, b1, bh] = T.FACADE.bay, img = T.facade(n, this.W.xmas, seed), x0 = c - 8, x1 = c + 8;
    if (!own) cam.face(g, n ? '#242129' : '#4d3b2b', Z + dir * 0.2, dir > 0 ? c + b0 : c - b1, dir > 0 ? c + b1 : c - b0, 0, bh);
    if (dir > 0) cam.pic(g, img, x0, Z, x1, Z, 0, 13); else cam.pic(g, img, x1, Z, x0, Z, 0, 13);
    const P = [x0, 0, Z, x1, 0, Z, x1, 13, Z, x0, 13, Z];
    if (tint) cam.fill(g, tint, P);
    this.hazeW(P, x0, Z, x1, Z);
  }
  // the street: `back` is the view down it from the car's boot (no portal, no lobby behind)
  street(R, back = false) {
    const g = this.g, cam = this.cam, n = this.W.night, zc = R.zc, zF = R.zF, zP = R.zP, E = R.exit, X0 = -40, X1 = 40;
    if (back) {
      cam.wallX(g, tone(n ? '#5d5a6a' : PAL.stucco, this.hz, 0.6), X0, -6.5, zF, ROAD, 13);
      for (const [c, s, t] of [[-32, 64, 'rgba(120,70,40,0.10)'], [-16, 65, 'rgba(255,255,255,0.10)'], [0, 66, 'rgba(90,110,140,0.12)'], [16, 67, null]]) this.facadeAt(c, -6.5, -1, s, t);
      for (const [c, s, t] of [[-32, 68, 'rgba(160,110,70,0.12)'], [-16, 62, 'rgba(90,110,140,0.10)'], [0, 61, null, true]]) this.facadeAt(c, zF, 1, s, t, c === 0);
      this.plane(X0, X1, -6.5, -4.6, 0, PAL.pave, T.pavement(), 500);
      cam.face(g, darker(PAL.curb, 0.1), -4.6, X0, X1, ROAD, 0);
    }
    this.plane(X0, X1, -4.6, zc - 0.15, ROAD, PAL.asph, T.asphalt(), 128);
    for (let x = X0; x < X1; x += 2.2) cam.flat(g, rgba('#ecebe4', 0.85), x, x + 1.2, 1.05, 1.15, ROAD);
    cam.flat(g, '#77736b', X0, X1, zc - 0.45, zc - 0.15, ROAD);
    if (cam.z < zc - 0.15) cam.face(g, darker(PAL.curb, 0.14), zc - 0.15, X0, X1, ROAD, 0);
    cam.flat(g, PAL.curb, X0, X1, zc - 0.15, zc, 0);
    this.plane(X0, X1, zc, zF, 0, PAL.pave, T.pavement(), 500);
    if (!back) {
      const o = this.world.doorOpen(R), img = T.portal(n), L = { img, backImg: img, xh: E.x0, Z: zP, w: E.x1 - E.x0, y0: 0, h: E.h, o, hinge: -1, thick: 0.06, back: PAL.woodDk };
      if (!E.pull) this.leaf({ ...L, push: true });
      // the recess: a stone surround set back from the facade, its reveals and head, the entryphone
      const stone = n ? '#6d6975' : '#cfc4ae';
      this.endWall(zP, -1.05, 0.8, 0, 3, stone, [{ x0: E.x0, x1: E.x1, y0: 0, y1: E.h, fw: 0.05, frame: PAL.woodDk }], () => {
        this.onWall(T.intercom(3), { Z: zP, x: -0.86 }, T.INTERCOM.w, 1.05, 1.45);
        this.onWall(T.houseNumber(14), { Z: zP, x: 0 }, 0.26, 2.75, 2.95);
      });
      cam.flat(g, n ? '#5a5761' : PAL.stone, -1.05, 0.8, zF, zP, 0);
      if (cam.y < 3) cam.flat(g, darker(stone, 0.22), -1.05, 0.8, zF, zP, 3);
      if (cam.x > -1.05) cam.wallX(g, darker(stone, 0.1), -1.05, zF, zP, 0, 3);
      if (cam.x < 0.8) cam.wallX(g, darker(stone, 0.16), 0.8, zF, zP, 0, 3);
      this.glow((gg, dark) => { if (n) this.halo(gg, -0.86, 1.42, zP - 0.01, 0.01, '#9fd0ff', 0.5); });
      this.facadeAt(-16, zF, 1, 62, 'rgba(90,110,140,0.10)');
      this.facadeAt(16, zF, 1, 63, 'rgba(160,110,70,0.12)');
      this.facadeAt(0, zF, 1, 61, null, true);
      if (E.pull) this.leaf({ ...L, push: false });
    }
    const lampFirst = cam.z < 3.2;
    if (lampFirst && !back) this.lampPost(2.4, 3.45);
    const cars = CARS.slice().sort((a, b) => Math.abs(b[0] + 2.05 - cam.x) - Math.abs(a[0] + 2.05 - cam.x));
    for (const [x0, col, s] of cars) this.car(x0, col, s);
    if (!lampFirst && !back) this.lampPost(2.4, 3.45);
    if (!back) {
      // yours, double-parked with the hazards on: its back, and the roof over it
      const col = '#4a6d8c';
      cam.flat(g, lighter(col, 0.1), -4.4, -1.35, -0.62, 0.62, ROAD + 1.42);
      cam.fill(g, lighter(col, 0.04), [-1.35, ROAD + 1.42, -0.62, -0.48, ROAD + 0.97, -0.74, -0.48, ROAD + 0.97, 0.74, -1.35, ROAD + 1.42, 0.62]);
      if (cam.x > -0.45) cam.pic(g, T.carEnd(col, false, !!this.world.hazard), -0.45, -0.875, -0.45, 0.875, ROAD, ROAD + 1.45);
    }
    if (this.W.xmas) this.garlands(zF);
  }
  // a parked car, pointing −x, its near side at z = zA: the tops seen from above, the side, an end
  car(x0, col, seed, zA = 1.2, zB = 2.95) {
    const cam = this.cam, g = this.g, x1 = x0 + 4.1, Y = ROAD, top = lighter(col, 0.12), gl = '#27313a';
    const q = [
      [x0 + 0.02, 0.9, x0 + 0.85, 0.97, top], [x0 + 0.85, 0.97, x0 + 1.35, 1.4, gl], [x0 + 1.35, 1.4, x1 - 1.25, 1.42, top],
      [x1 - 1.25, 1.42, x1 - 0.85, 0.96, gl], [x1 - 0.85, 0.96, x1 - 0.02, 0.94, top],
    ];
    q.sort((a, b) => Math.abs((b[0] + b[2]) / 2 - cam.x) - Math.abs((a[0] + a[2]) / 2 - cam.x));
    for (const [xa, ya, xb, yb, c] of q) cam.fill(g, c, [xa, Y + ya, zA, xb, Y + yb, zA, xb, Y + yb, zB, xa, Y + ya, zB]);
    const cut = { sy: 0.49 * 110, sh: 0.96 * 110 };
    if (cam.x > x1) cam.pic(g, T.carEnd(col, false), x1, zA, x1, zB, Y, Y + 0.96, cut);
    if (cam.x < x0) cam.pic(g, T.carEnd(col, true), x0, zB, x0, zA, Y, Y + 0.96, cut);
    if (cam.z < zA) cam.pic(g, T.carSide(col, seed), x1, zA, x0, zA, Y, Y + 1.45);
  }
  // a street lamp: an iron post and a lantern, lit at night
  lampPost(x, z) {
    const cam = this.cam, g = this.g, n = this.W.night, ir = '#2c3533';
    if (cam.z >= z) return;
    cam.fill(g, ir, [x - 0.07, 0, z, x + 0.07, 0, z, x + 0.035, 3.72, z, x - 0.035, 3.72, z]);
    cam.face(g, darker(ir, 0.25), z, x - 0.1, x + 0.1, 0, 0.42);
    cam.fill(g, ir, [x - 0.13, 3.7, z, x + 0.13, 3.7, z, x + 0.1, 3.78, z, x - 0.1, 3.78, z]);
    cam.fill(g, n ? '#ffe3a3' : '#c9d2d2', [x - 0.12, 3.78, z, x + 0.12, 3.78, z, x + 0.19, 4.24, z, x - 0.19, 4.24, z]);
    g.strokeStyle = ir; g.lineWidth = Math.max(1, 0.025 * cam.ppm(x, z)); g.beginPath();
    cam.seg(g, x, 3.78, z, x, 4.24, z); cam.seg(g, x - 0.12, 3.78, z, x - 0.19, 4.24, z); cam.seg(g, x + 0.12, 3.78, z, x + 0.19, 4.24, z); g.stroke();
    cam.fill(g, ir, [x - 0.25, 4.24, z, x + 0.25, 4.24, z, x + 0.06, 4.46, z, x - 0.06, 4.46, z]);
    cam.face(g, ir, z, x - 0.02, x + 0.02, 4.46, 4.62);
    if (n) this.halo(g, x, 4.0, z - 0.01, 0.16, '#ffcf7a', 0.75, '#fff6e0');
  }
  // Christmas lights strung across the street, sagging
  garlands(zF) {
    const cam = this.cam, g = this.g, B = ['#ffd36b', '#ff6b5a', '#8fd4ff', '#b8f28a'], N = 26;
    for (const x of [-25, -15, -5, 5, 15]) {
      const Yt = (t) => 6.5 - 2.4 * t * (1 - t), Zt = (t) => lerp(zF, -6.5, t);
      g.beginPath();
      let any = false;
      for (let i = 0; i < N; i++) any = cam.seg(g, x, Yt(i / N), Zt(i / N), x, Yt((i + 1) / N), Zt((i + 1) / N)) || any;
      if (!any) continue;
      g.strokeStyle = '#16301f'; g.lineWidth = 1.5; g.stroke();
      for (let i = 1; i < N; i++) this.halo(g, x, Yt(i / N) - 0.05, Zt(i / N), 0.035, B[i % 4], 0.95, '#ffffff');
    }
  }

  // ---------- the boot of your car, from behind it ----------
  trunk(R) {
    const g = this.g, cam = this.cam, Y = (y) => y + ROAD, col = '#4a6d8c', body = lighter(col, 0.08);
    // behind the car: the street, looking down it (the car's frame turned a quarter to the street's)
    const st = [cam.x, cam.y, cam.z, cam.yaw];
    this.setCam([-st[2], st[1], st[0], st[3] - Math.PI / 2]);
    this.sky(); this.street(this.street0, true);
    this.setCam(st);
    cam.flat(g, 'rgba(0,0,0,0.28)', -1.02, 1.02, 0.25, 4.7, ROAD + 0.002);
    for (const s of [-1, 1]) cam.face(g, '#141518', 0.95, s * 0.6, s * 0.87, Y(0), Y(0.34));
    cam.face(g, '#18191c', 0.6, -0.8, 0.8, Y(0.08), Y(0.3));
    cam.flat(g, lighter(col, 0.14), -0.8, 0.8, 1.35, 3.2, Y(1.42));
    for (const s of [-1, 1]) cam.fill(g, body, [s * 0.62, Y(0.96), 0.45, s * 0.88, Y(0.96), 0.45, s * 0.8, Y(1.42), 1.35, s * 0.62, Y(1.42), 1.35]);
    // inside: the carpet, the sides, the back of the seat, the little lamp
    const hex = [-0.62, Y(0.72), 0.45, 0.62, Y(0.72), 0.45, 0.62, Y(0.96), 0.45, 0.62, Y(1.42), 1.35, -0.62, Y(1.42), 1.35, -0.62, Y(0.96), 0.45];
    g.save();
    if (cam.poly(g, hex)) {
      g.clip();
      g.fillStyle = '#1d1f22'; g.fillRect(-cam.W, -cam.H, cam.W * 3, cam.H * 3);
      cam.flat(g, '#393b40', -0.62, 0.62, 0.5, 1.4, Y(0.58));
      for (const s of [-1, 1]) if (s < 0 ? cam.x > -0.62 : cam.x < 0.62) cam.wallX(g, '#2a2c30', s * 0.62, 0.45, 1.35, Y(0.58), Y(1.42));
      cam.face(g, '#34363b', 1.35, -0.62, 0.62, Y(0.58), Y(1.12));
      cam.face(g, '#2b2d31', 1.36, -0.62, 0.62, Y(1.12), Y(1.42));
      const p = cam.p(0, Y(1.3), 1.2);
      if (p) {
        const r = 0.9 * p[2], gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
        gr.addColorStop(0, 'rgba(255,236,196,0.30)'); gr.addColorStop(1, 'rgba(255,236,196,0)');
        g.fillStyle = gr; g.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
      }
      if (this.hooks.bags) this.hooks.bags(g, cam, R);
    }
    g.restore();
    // the back of the car, with the boot's mouth cut out of it
    g.save();
    if (cam.poly(g, [-0.88, Y(0.28), 0.45, 0.88, Y(0.28), 0.45, 0.88, Y(0.96), 0.45, 0.62, Y(0.96), 0.45, 0.62, Y(0.72), 0.45, -0.62, Y(0.72), 0.45, -0.62, Y(0.96), 0.45, -0.88, Y(0.96), 0.45])) {
      g.clip();
      cam.pic(g, T.carEnd(col, false, !!this.world.hazard), -0.875, 0.45, 0.875, 0.45, Y(0.28), Y(0.96), { sy: 0.49 * 110, sh: 0.68 * 110 });
    }
    g.restore();
    // the lid, swinging down on its hinge at the roof: glass above, the tailgate below
    const a = R.acts.find((x) => x.what === 'trunk'), cp = a ? this.actP(a.i) : 0;
    const th = lerp(0.607, -0.477, cp), be = -(th + 0.477), cb = Math.cos(be), sb = Math.sin(be), Hz = 1.35, Hy = 1.45;
    const rot = (z, y) => { const dz = z - Hz, dy = y - Hy; return [Hz + dz * cb - dy * sb, Hy + dz * sb + dy * cb]; };
    const [e1z, e1y] = rot(0.418, 0.968), [e2z, e2y] = rot(0.47, 0.72);
    const out = (az, ay, bz, by) => { const dz = bz - az, dy = by - ay, mz = (az + bz) / 2, my = (ay + by) / 2; return dy * (cam.z - mz) - dz * (cam.y - ROAD - my) > 0; };
    const Q = (az, ay, bz, by, w = 0.64) => [-w, Y(ay), az, w, Y(ay), az, w, Y(by), bz, -w, Y(by), bz];
    const o1 = out(Hz, Hy, e1z, e1y), o2 = out(e1z, e1y, e2z, e2y);
    cam.fill(g, o1 ? body : '#2b2d31', Q(Hz, Hy, e1z, e1y, 0.66));
    const gi = (t) => [lerp(Hz, e1z, t), lerp(Hy, e1y, t)], [gaz, gay] = gi(0.08), [gbz, gby] = gi(0.9);
    cam.fill(g, rgba('#1a2229', 0.8), Q(gaz, gay, gbz, gby, 0.56));
    if (o1) cam.fill(g, 'rgba(188,214,230,0.16)', Q(gaz, gay, lerp(gaz, gbz, 0.45), lerp(gay, gby, 0.45), 0.5));
    cam.fill(g, o2 ? body : '#2b2d31', Q(e1z, e1y, e2z, e2y, 0.64));
    if (!o2) cam.fill(g, '#232428', Q(lerp(e1z, e2z, 0.15), lerp(e1y, e2y, 0.15), lerp(e1z, e2z, 0.85), lerp(e1y, e2y, 0.85), 0.5));
    if (cp < 0.97) {
      const [sz, sy] = gi(0.6);
      g.strokeStyle = '#5d6063'; g.lineWidth = Math.max(1, 0.022 * cam.ppm(0.6, 0.6)); g.lineCap = 'round'; g.beginPath();
      for (const s of [-1, 1]) cam.seg(g, s * 0.6, Y(1.0), 0.6, s * 0.6, Y(sy), sz);
      g.stroke(); g.lineCap = 'butt';
    }
  }

  // ---------- the lobby ----------
  // two steel leaves parting from the middle of a lift's doorway (o 0 shut … 1 open), just behind Z
  slide(Z, y0, h, o) {
    const cam = this.cam, img = T.steelLeaf(), y1 = y0 + h, k = 0.45 * clamp(o);
    if (cam.z >= Z) return;
    for (const [a, b] of [[-0.45 - k, -k], [0.45 + k, k]]) {
      cam.pic(this.g, img, a, Z, b, Z, y0, y1);
      this.hazeFill([a, y0, Z, b, y0, Z, b, y1, Z, a, y1, Z], (a + b) / 2, Z);
    }
  }
  // a lift in a side wall, shut: its steel frame, two leaves, the call button, what it says
  sideLift(S, y0) {
    const cam = this.cam, g = this.g, X = S.X + (S.X < 0 ? 0.003 : -0.003), zm = (S.za + S.zb) / 2, img = T.steelLeaf();
    cam.wallX(g, PAL.steelDk, X, S.za - 0.06, S.zb + 0.06, y0, y0 + 2.11);
    const X2 = S.X + (S.X < 0 ? 0.005 : -0.005);
    cam.pic(g, img, X2, S.za, X2, zm, y0, y0 + 2.05); cam.pic(g, img, X2, S.zb, X2, zm, y0, y0 + 2.05);
    const full = S.state === 'full', C = T.CALL;
    this.onWall(T.callPlate(full), { X: S.X, z: S.za - 0.22 }, C.w, y0 + C.y - C.h / 2, y0 + C.y + C.h / 2);
    if (full) {
      // somebody else has it: up and down all evening
      const fl = [3, 4, 5, 6, 5, 4, 3, 2, 1, 2][Math.floor(this.world.t / 1.3) % 10], lcd = lcdTex(String(fl)), at = { X: S.X, z: zm };
      this.onWall(lcd, at, 0.22, y0 + 2.2, y0 + 2.33);
      const px = S.X + (S.X < 0 ? 0.006 : -0.006);
      this.glow((gg, dark) => {
        if (dark > 0.02) this.onWall(lcd, at, 0.22, y0 + 2.2, y0 + 2.33, Math.min(1, dark * 1.2));
        this.halo(gg, px, y0 + C.y - 0.015, S.za - 0.22, 0.012, PAL.pilot, 0.35 + 0.6 * dark, PAL.pilotHot);
      });
    } else this.noticeAt({ X: S.X, z: zm }, 'AVERIADO', ['Disculpen las', 'molestias.', 'Ya está avisado.'], y0, { y: 1.45 });
  }
  lobby(R) {
    const g = this.g, cam = this.cam, W = this.world, L = W.lift, sim = this.sim, E = R.exit, end = R.end;
    const y0 = R.y0, y1 = y0 + R.hc, zI = R.zIn, zE = R.zE, x0 = R.w[0], x1 = R.w[1], lit = this.lit(R);
    const hole = end === 'stairs' ? { x0: -0.6, x1: 0.6, y0, y1: y0 + 2.45, fw: 0 }
      : end === 'door' ? { x0: -FLAT.x, x1: FLAT.x, y0, y1: y0 + FLAT.h, fw: 0.07, frame: PAL.woodDk }
      : { x0: -0.45, x1: 0.45, y0, y1: y0 + 2.05, fw: 0.06, frame: end === 'lift' ? PAL.steelDk : PAL.woodDk };
    // whatever stands in the doorway, behind the wall's face
    if (end === 'door') { this.reveals(zE, hole, 0.12, PAL.tileDk); this.flatLeaf(E, zE, y0, W.doorOpen(R)); }
    else if (end === 'lift') this.slide(zE + 0.02, y0, 2.05, L.here ? L.open : 0);
    else if (end === 'oldlift') this.reveals(zE, hole, 0.1, PAL.woodDk);
    else if (cam.y < hole.y1) cam.flat(g, darker(PAL.tile, 0.2), -0.6, 0.6, zE, zE + 0.2, hole.y1);
    // the shell: pink terrazo in brass strips, sage tiles to the ceiling
    this.plane(x0, x1, zI, zE, y0, PAL.terr, T.terrazo(), 400, undefined, (P) => {
      for (const x of [-0.4, 0.4]) cam.flat(g, PAL.brassDk, x - 0.008, x + 0.008, zI, zE, y0);
      for (let z = zI + 0.8; z < zE - 0.1; z += 0.8) cam.flat(g, PAL.brassDk, x0, x1, z - 0.008, z + 0.008, y0);
      if (end === 'door') this.onFloor(T.doormat('HOLA'), 'v', 300, y0, -0.35, 0.35, zE - 0.55, zE - 0.1);
      for (const z of R.lamps) this.pool(0, z, y0, lit, 1.7, '#ffe7b8', P);
    });
    this.plane(x0, x1, zI, zE, y1, PAL.ceil);
    const mX = R.sw && R.sw.X === R.mail.X ? -R.mail.X : R.mail.X, N = NOTES[this.lv.id], xm = this.W.xmas;
    const fit = (X) => () => {
      if (X === mX) this.onWall(T.mailboxes(), { X, z: (R.mail.za + R.mail.zb) / 2 }, R.mail.zb - R.mail.za, y0 + 1.05, y0 + 1.77);
      else if (N) this.noticeAt({ X, z: zI + 1.0 }, N[0], N[1], y0, xm ? { col: '#fff4e0', ink: '#9c1f24' } : {});
      if (R.sw && R.sw.X === X) this.switchAt(R.sw, y0);
      if (R.sideLift && R.sideLift.X === X) this.sideLift(R.sideLift, y0);
    };
    this.sideWall(x0, zI, zE, y0, y1, 'tile', -1, fit(x0));
    this.sideWall(x1, zI, zE, y0, y1, 'tile', 1, fit(x1));
    this.endWall(zE, x0, x1, y0, y1, 'tile', [hole], () => {
      if (end !== 'lift' && end !== 'oldlift') return;
      const ca = R.acts.find((a) => a.what === 'call'), cx = R.call.x, cy = y0 + R.call.y, C = T.CALL;
      const on = !!ca && (sim.si > ca.i || this.actP(ca.i) > 0.45) && !L.here;
      this.onWall(T.callPlate(on), { Z: zE, x: cx }, C.w, cy - C.h / 2, cy + C.h / 2);
      if (on) this.glow((gg, dark) => this.halo(gg, cx, cy - 0.015, zE - 0.01, 0.012, PAL.pilot, 0.5 + 0.5 * dark, PAL.pilotHot));
      if (end === 'lift') {
        const lcd = lcdTex(String(L.floor)), at = { Z: zE, x: 0 };
        this.onWall(lcd, at, 0.22, y0 + 2.2, y0 + 2.33);
        this.glow((gg, dark) => { if (dark > 0.02) this.onWall(lcd, at, 0.22, y0 + 2.2, y0 + 2.33, Math.min(1, dark * 1.2)); });
      } else {
        // the old one's lamp: amber while it travels
        const busy = R.arrive && sim.si === R.arrive.i && !L.here, p = cam.p(0, y0 + 2.28, zE - 0.01);
        if (p) {
          const r = 0.035 * p[2];
          g.fillStyle = PAL.brassDk; ell(g, p[0], p[1], r * 1.3, r * 1.3); g.fill();
          g.fillStyle = busy ? '#ffb347' : '#6b5a3c'; ell(g, p[0], p[1], r, r); g.fill();
        }
        if (busy) this.glow((gg, dark) => this.halo(gg, 0, y0 + 2.28, zE - 0.012, 0.02, '#ffab3d', 0.55 + 0.4 * dark, '#fff1cf'));
      }
    });
    for (const z of R.lamps) this.lamp(0, z, y1 - 0.005, lit);
    if (end === 'oldlift') this.leaf({ img: T.woodLift(!!L.here), xh: -0.45, Z: zE, w: 0.9, y0, h: 2.05, o: L.door || 0, push: false, hinge: -1, thick: 0.05, dz: -0.02 });
  }

  // ---------- the lift ----------
  // the cabin's box from za to zb: the floor, the lit ceiling, the side walls and their rail
  cabinBox(za, zb, y0, old) {
    const cam = this.cam, g = this.g, y1 = y0 + 2.2;
    if (old) this.plane(-0.55, 0.55, za, zb, y0, PAL.parq, T.parquet(), 380, { k: 0.008 });
    else this.plane(-0.55, 0.55, za, zb, y0, '#3a3d40');
    this.plane(-0.55, 0.55, za, zb, y1, old ? '#d8c7a4' : PAL.ceil);
    if (cam.y < y1) {
      cam.flat(g, old ? '#fff1cf' : '#fff8e2', -0.4, 0.4, za + 0.12, zb - 0.12, y1 - 0.002);
      cam.flat(g, 'rgba(255,255,255,0.7)', -0.3, 0.3, za + 0.2, zb - 0.2, y1 - 0.003);
    }
    for (const s of [-1, 1]) {
      const X = s * 0.55, Xf = X - s * 0.003, step = old ? 0.13 : 0.4;
      this.sideWall(X, za, zb, y0, y1, old ? PAL.wood : PAL.steel, s, () => {
        if (!old) cam.wallX(g, 'rgba(255,255,255,0.16)', Xf, za, zb, y0 + 1.2, y0 + 1.9);
        for (let z = za + step; z < zb - 0.02; z += step) cam.wallX(g, old ? rgba(PAL.woodDk, 0.55) : PAL.steelDk, Xf, z - 0.004, z + 0.004, y0, y1);
        if (old) cam.wallX(g, PAL.woodDk, Xf, za, zb, y0 + 0.86, y0 + 0.9);
        cam.wallX(g, old ? PAL.brass : PAL.steelLt, X - s * 0.04, za + 0.08, zb - 0.08, y0 + 0.88, y0 + 0.93);
      });
    }
  }
  // the mirror on the cabin's back wall at Z: the lift reflected in it, and you in the middle of it
  mirror(Z, y0, zI) {
    const cam = this.cam, g = this.g, x0 = -0.4, x1 = 0.4, ya = y0 + 0.9, yb = y0 + 2.0, Zm = Z - 0.004, zr = 2 * Z;
    cam.face(g, PAL.steelDk, Zm, x0 - 0.03, x1 + 0.03, ya - 0.03, yb + 0.03);
    g.save();
    if (cam.poly(g, [x0, ya, Zm, x1, ya, Zm, x1, yb, Zm, x0, yb, Zm])) {
      g.clip();
      g.fillStyle = '#7b8286'; g.fillRect(-cam.W, -cam.H, cam.W * 3, cam.H * 3);
      cam.flat(g, '#34373a', -0.55, 0.55, Z, zr - zI, y0);
      cam.flat(g, '#d9dcd6', -0.55, 0.55, Z, zr - zI, y0 + 2.2);
      cam.flat(g, '#fff6df', -0.4, 0.4, Z + 0.12, zr - zI - 0.12, y0 + 2.199);
      cam.face(g, '#9fae8a', zr - zI, -0.45, 0.45, y0, y0 + 2.05);
      const p = cam.p(cam.x, cam.y, zr - cam.z);
      if (p) {
        // you: a tired silhouette with a bag in each hand
        const s = p[2], X = p[0], Y = p[1];
        g.fillStyle = 'rgba(38,42,46,0.78)';
        rrect(g, X - 0.23 * s, Y + 0.2 * s, 0.46 * s, 1.3 * s, 0.12 * s); g.fill();
        rrect(g, X - 0.3 * s, Y + 0.26 * s, 0.1 * s, 0.62 * s, 0.05 * s); g.fill(); rrect(g, X + 0.2 * s, Y + 0.26 * s, 0.1 * s, 0.62 * s, 0.05 * s); g.fill();
        ell(g, X, Y - 0.01 * s, 0.1 * s, 0.125 * s); g.fill();
        for (const k of [-1, 1]) {
          g.fillStyle = 'rgba(214,218,210,0.8)'; ell(g, X + k * 0.33 * s, Y + 1.08 * s, 0.17 * s, 0.22 * s); g.fill();
          g.fillStyle = 'rgba(47,125,69,0.7)'; g.fillRect(X + k * 0.33 * s - 0.14 * s, Y + 1.0 * s, 0.28 * s, 0.05 * s);
        }
      }
      g.fillStyle = 'rgba(190,210,222,0.14)'; g.fillRect(-cam.W, -cam.H, cam.W * 3, cam.H * 3);
      for (const [a, w] of [[-0.3, 0.07], [-0.12, 0.03]]) cam.fill(g, 'rgba(255,255,255,0.13)', [a, yb, Zm, a + w, yb, Zm, a + w + 0.35, ya, Zm, a + 0.35, ya, Zm]);
    }
    g.restore();
  }
  // a folding scissor gate at Z: o 0 drawn across … 1 folded against its post (anchor ±1)
  reja(Z, y0, o, anchor, x0 = -0.45, x1 = 0.45) {
    const cam = this.cam, g = this.g;
    if (cam.z >= Z - 0.02) return;
    const span = (x1 - x0) * (1 - 0.85 * clamp(o)), a = anchor > 0 ? x1 - span : x0, b = anchor > 0 ? x1 : x0 + span, h = 2.0, n = 9;
    g.strokeStyle = '#1e1f21'; g.lineWidth = Math.max(1, 0.018 * cam.ppm(0, Z)); g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i < n; i++) { const x = lerp(a, b, i / (n - 1)); cam.seg(g, x, y0 + 0.05, Z, x, y0 + h - 0.04, Z); }
    for (let i = 0; i < n - 1; i++) {
      const xa = lerp(a, b, i / (n - 1)), xb = lerp(a, b, (i + 1) / (n - 1));
      for (let y = y0 + 0.08; y < y0 + h - 0.3; y += 0.25) { cam.seg(g, xa, y, Z, xb, y + 0.25, Z); cam.seg(g, xb, y, Z, xa, y + 0.25, Z); }
    }
    g.stroke(); g.lineCap = 'butt';
    cam.face(g, PAL.brass, Z, a, b, y0 + h - 0.05, y0 + h); cam.face(g, PAL.brassDk, Z, a, b, y0, y0 + 0.05);
    const k = anchor > 0 ? a : b;
    cam.face(g, PAL.brass, Z - 0.005, k - 0.02, k + 0.02, y0 + 0.95, y0 + 1.15);
  }
  // walking into the cabin: its back wall, the mirror, the buttons
  cabin(R) {
    const W = this.world, sim = this.sim, y0 = R.y0, y1 = y0 + R.hc, zI = R.zIn, zE = R.zE, old = R.old;
    this.cabinBox(zI, zE, y0, old);
    this.endWall(zE, -0.55, 0.55, y0, y1, old ? PAL.wood : PAL.steel, [], () => this.mirror(zE, y0, zI));
    const b = R.acts.find((a) => a.what === 'floor'), on = !!b && (sim.si > b.i || this.actP(b.i) > 0.5);
    this.onWall(T.cabinPanel(on ? R.to : -1), { X: 0.55, z: zE - 0.31 }, 0.2, y0 + 0.95, y0 + 1.45);
    if (old) this.reja(zI + 0.14, y0, W.lift.reja || 0, 1);
  }
  // turned round in the cabin, facing its doors: the ride, and the floor you get out on
  cabinOut(R) {
    const g = this.g, cam = this.cam, L = this.world.lift, C = R.cab, old = C.old, Z = R.zE, z0 = R.z0, to = C.to ?? 0;
    const y0 = R.y0, y1 = y0 + R.hc;
    if (old) {
      // through the gate, the shaft slides by: each floor's door, its slab, its number
      const yc = ((1 - Math.cos(Math.PI * clamp(L.rideP || 0))) / 2) * to * STOREY, dy = y0 - yc, near = Math.abs(dy) < 2;
      const door = turn(T.woodLift(true), 'h');
      if (near) this.leaf({ img: door, xh: 0.45, Z, w: 0.9, y0: y0 + dy, h: 2.05, o: L.outDoor || 0, push: true, hinge: 1, thick: 0.05, dz: 0.03 });
      this.endWall(Z, -0.6, 0.6, y0 - 0.6, y1 + 0.6, '#4d4942', near ? [{ x0: -0.45, x1: 0.45, y0: y0 + dy, y1: y0 + dy + 2.05, fw: 0 }] : [], () => {
        for (let k = 0; k <= 8; k++) {
          const yb = k * STOREY + dy;
          if (yb > y1 + 0.6 || yb + STOREY < y0 - 0.6) continue;
          cam.face(g, '#2e2b27', Z - 0.002, -0.6, 0.6, yb - 0.22, yb);
          cam.face(g, PAL.woodDk, Z - 0.0025, -0.56, 0.56, yb, yb + 2.3);
          g.beginPath(); cam.seg(g, -0.56, yb + 2.3, Z - 0.0026, 0.56, yb + 2.3, Z - 0.0026);
          g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; g.stroke();
          if (!(k === to && near)) cam.pic(g, door, -0.45, Z - 0.003, 0.45, Z - 0.003, yb, yb + 2.05);
          const p = cam.p(0, yb + 2.4, Z - 0.003);
          if (p) { g.fillStyle = 'rgba(230,224,208,0.55)'; g.font = `800 ${Math.round(0.2 * p[2])}px ${FACE}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k ? String(k) : 'B', p[0], p[1]); }
        }
      });
      this.cabinBox(z0, Z, y0, true);
      for (const s of [-1, 1]) cam.face(g, PAL.woodDk, Z - 0.15, s < 0 ? -0.55 : 0.45, s < 0 ? -0.45 : 0.55, y0, y1);
      cam.face(g, PAL.woodDk, Z - 0.15, -0.55, 0.55, y0 + 2.05, y1);
      this.reja(Z - 0.14, y0, L.outReja || 0, -1);
    } else {
      this.slide(Z + 0.02, y0, 2.05, L.outOpen || 0);
      this.cabinBox(z0, Z, y0, false);
      const lcd = lcdTex(String(L.floor)), at = { Z, x: 0 };
      this.endWall(Z, -0.55, 0.55, y0, y1, PAL.steel, [{ x0: -0.45, x1: 0.45, y0, y1: y0 + 2.05, fw: 0.03, frame: PAL.steelDk }], () => this.onWall(lcd, at, 0.15, y0 + 2.08, y0 + 2.17));
      this.glow((gg, dark) => { if (dark > 0.02) this.onWall(lcd, at, 0.15, y0 + 2.08, y0 + 2.17, Math.min(1, dark * 1.2)); });
    }
    this.onWall(T.cabinPanel(to), { X: -0.55, z: (R.panel.za + R.panel.zb) / 2 }, 0.2, y0 + 0.95, y0 + 1.45);
  }

  // ---------- the stairs ----------
  // the return flight across the well, dy above or below this one's top: its underside or its
  // treads, and the parapet along the well with the handrail on it
  flightAt(R, dy) {
    const cam = this.cam, g = this.g, sg = R.sg, zT = R.zT, zr0 = R.zr0, yb = R.yTop + dy, sl = RISER / TREAD;
    const xi = -sg * 0.9, xo = -sg * 2.1, xa = Math.min(xi, xo), xb = Math.max(xi, xo);
    const nose = (z) => yb + RISER + (zT - z) * sl, sof = (z) => yb + (zT - z) * sl - 0.18;
    // the slab's underside if you are below its plane (past its high end, below the landing it
    // meets), else the treads you are above
    if (cam.y < sof(Math.max(zr0, cam.z))) cam.flat(g, PAL.ceilDk, xa, xb, zT, zr0, sof(zT), sof(zr0));
    else for (let j = 0; j < NST - 1; j++) {
      const Y = yb + (j + 1) * RISER;
      if (cam.y > Y) cam.flat(g, PAL.step, xa, xb, zT - (j + 1) * TREAD, zT - j * TREAD, Y);
    }
    const P = [xi, sof(zT), zT, xi, nose(zT) + 0.95, zT, xi, nose(zr0) + 0.95, zr0, xi, sof(zr0), zr0];
    if (cam.fill(g, PAL.paintDk, P)) this.hazeW(P, xi, zT, xi, zr0);
    const xc = xi - sg * 0.07;
    if (cam.y > nose((zT + zr0) / 2) + 0.97) cam.flat(g, PAL.rail, Math.min(xi, xc), Math.max(xi, xc), zr0, zT, nose(zr0) + 0.98, nose(zT) + 0.98);
    cam.wallX(g, PAL.railLt, xi + sg * 0.004, zr0, zT, nose(zr0) + 0.93, nose(zr0) + 0.99, nose(zT) + 0.93, nose(zT) + 0.99);
  }
  // a flight of ten risers between the wall and the parapet over the well
  flight(R) {
    const g = this.g, cam = this.cam, sg = R.sg, y0 = R.y0, zr0 = R.zr0, zT = R.zT, z0 = R.z0, yTop = R.yTop, sl = RISER / TREAD;
    const xw = sg * 0.6, xp = -sg * 0.6, xl = Math.min(xw, xp), xr = Math.max(xw, xp), xf = -sg * 2.1;
    const nose = (z) => y0 + RISER + (z - zr0) * sl;
    const bot = (z) => (z <= zr0 ? y0 : y0 + (z - zr0) * sl), ceil = (z) => y0 + 2.82 + Math.max(0, z - zr0) * sl;
    const band = (X, lo, hi) => [X, lo(z0), z0, X, lo(zr0), zr0, X, lo(zT), zT, X, hi(zT), zT, X, hi(zr0), zr0, X, hi(z0), z0];
    const skirt = (z) => (z <= zr0 ? y0 + 0.25 : nose(z) + 0.1), top = (z) => y0 + 1.2 + Math.max(0, z - zr0) * sl;
    const ptop = (z) => (z <= zr0 ? y0 + 1.1 : nose(z) + 0.95);
    // the stairwell: its far wall, the floor at its foot, the flights across the well
    const yLo = yTop < STOREY ? y0 : y0 - 3.2, Pf = [xf, yLo, zr0 - 1.3, xf, y0 + 12, zr0 - 1.3, xf, y0 + 12, zT + 0.2, xf, yLo, zT + 0.2];
    if (cam.fill(g, PAL.paint, Pf)) this.hazeW(Pf, xf, zr0 - 1.3, xf, zT + 0.2);
    if (yTop < STOREY) this.plane(Math.min(xf, xp), Math.max(xf, xp), zr0 - 1.3, zT + 0.2, y0, PAL.terr, T.terrazo(), 400);
    const dys = (yTop >= STOREY ? [-3, 0, 3] : [0, 3]).sort((a, b) => Math.abs(yTop + b + 0.75 - cam.y) - Math.abs(yTop + a + 0.75 - cam.y));
    for (const d of dys) this.flightAt(R, d);
    // overhead: the landing above, then the underside of the flight above
    if (cam.y < y0 + 2.82) cam.flat(g, PAL.ceil, Math.min(xf, xw), Math.max(xf, xw), z0, zr0, y0 + 2.82);
    if (cam.y < ceil(Math.max(zr0, cam.z))) cam.flat(g, PAL.ceilDk, xl, xr, zr0, zT, ceil(zr0), ceil(zT));
    // the wall: paint over a sloping dado of the lobby's tiles, a marble skirting, the handrail
    const side = xw < 0 ? -1 : 1, xs = xw - side * 0.002;
    if (side < 0 ? cam.x > xw : cam.x < xw) {
      const Pw = band(xw, bot, ceil);
      cam.fill(g, PAL.paint, Pw);
      const D = band(xw, bot, top);
      g.save();
      if (cam.poly(g, D)) {
        g.clip();
        cam.fill(g, PAL.tile, D);
        if (side < 0) this.vtex(plainTiles(), 360, xw, z0, xw, zT, y0, top(zT), z0, y0 + 1);
        else this.vtex(plainTiles(), 360, xw, zT, xw, z0, y0, top(zT), -zT, y0 + 1);
      }
      g.restore();
      cam.fill(g, darker(PAL.tile, 0.28), band(xs, (z) => top(z) - 0.05, top));
      cam.fill(g, rgba('#ffffff', 0.22), band(xs, (z) => top(z) - 0.03, (z) => top(z) - 0.02));
      cam.fill(g, PAL.stepDk, band(xs, bot, skirt));
      this.hazeW(Pw, xw, z0, xw, zT);
      const xh = xw - side * 0.05, za = zr0 - 0.25, zb = zT + 0.1;
      cam.wallX(g, PAL.rail, xh, za, zb, nose(za) + 0.87, nose(za) + 0.93, nose(zb) + 0.87, nose(zb) + 0.93);
    }
    // the parapet over the well, capped in wood
    const pside = -side, xq = xp + side * 0.07 * -1;
    if (pside < 0 ? cam.x > xp : cam.x < xp) {
      const Pp = band(xp, bot, ptop);
      cam.fill(g, PAL.paint, Pp);
      cam.fill(g, PAL.stepDk, band(xp + side * 0.002, bot, skirt));
      this.hazeW(Pp, xp, z0, xp, zT);
      if (cam.y > ptop(zr0)) {
        cam.flat(g, PAL.rail, Math.min(xp, xq), Math.max(xp, xq), z0, zr0, ptop(z0) + 0.04, ptop(zr0) + 0.04);
        cam.flat(g, PAL.rail, Math.min(xp, xq), Math.max(xp, xq), zr0, zT, ptop(zr0) + 0.04, ptop(zT) + 0.04);
      }
      cam.fill(g, PAL.railLt, band(xp + side * 0.006, (z) => ptop(z) - 0.02, (z) => ptop(z) + 0.04));
    }
    // the steps, far to near: each tread with its dark nosing strip, then the riser under it
    const tr = T.terrazo(PAL.step, 7);
    for (let k = NST - 1; k >= 0; k--) {
      const zk = zr0 + k * TREAD, yk = y0 + k * RISER, Y = yk + RISER;
      if (k < NST - 1 && cam.y > Y + 0.01) {
        this.plane(xl, xr, zk, zk + TREAD, Y, PAL.step, tr, 420);
        cam.flat(g, PAL.nose, xl, xr, zk, zk + 0.035, Y + 0.001);
      }
      const P = [xl, yk, zk, xr, yk, zk, xr, Y, zk, xl, Y, zk];
      if (cam.z < zk && cam.fill(g, PAL.stepDk, P)) this.hazeFill(P, 0, zk);
    }
    this.plane(xl, xr, z0, zr0, y0, PAL.terr, T.terrazo(), 400);
  }

  // ---------- landings ----------
  // a landing's front edge over the well, seen from the flight below: the slab, its parapet
  wellEdge(R) {
    const cam = this.cam, g = this.g, sg = R.sg, zI = R.zIn, y0 = R.y0;
    if (cam.z >= zI) return;
    const xa = Math.min(-sg * 0.9, -sg * 0.6), xb = Math.max(-sg * 0.9, -sg * 0.6);
    cam.face(g, PAL.paintDk, zI, xa, xb, y0 - 0.2, y0 + 1.1);
    if (cam.y > y0 + 1.14) cam.flat(g, PAL.rail, xa, xb, zI - 0.07, zI, y0 + 1.14);
    cam.face(g, PAL.railLt, zI - 0.07, xa, xb, y0 + 1.08, y0 + 1.14);
  }
  // looking up the well from the flight below: past this ceiling's edge, the edges of the landings
  // above across the gap, and their walls (painted first: everything nearer covers them)
  wellUp(R) {
    const cam = this.cam, g = this.g, sg = R.sg, y0 = R.y0, zI = R.zIn;
    if (cam.z >= zI) return;
    const xa = Math.min(-sg * 0.9, -sg * 0.6), xb = Math.max(-sg * 0.9, -sg * 0.6);
    cam.face(g, PAL.paint, R.zE, R.w[0], R.w[1], y0 + 2.82, y0 + 12);
    for (const d of [STOREY, 2 * STOREY]) {
      cam.face(g, PAL.paintDk, zI, xa, xb, y0 + d - 0.2, y0 + d + 1.1);
      cam.face(g, PAL.railLt, zI - 0.07, xa, xb, y0 + d + 1.08, y0 + d + 1.14);
    }
  }
  half(R) {
    const g = this.g, cam = this.cam, n = this.W.night, sg = R.sg, y0 = R.y0, y1 = y0 + 2.82, zI = R.zIn, zE = R.zE, x0 = R.w[0], x1 = R.w[1], lit = this.lit(R);
    const win = { x0: R.win.x0, x1: R.win.x1, y0: y0 + R.win.y0, y1: y0 + R.win.y1, fw: 0.06, frame: '#ebe6d8', sill: true };
    const lx = -sg * 0.75, lz = (zI + zE) / 2, img = T.lightWell(n, 51 + Math.round(y0 * 2));
    // through the window, the light well: the wall across, its windows, the washing
    const view = (a = 1) => {
      g.globalAlpha = a; cam.face(g, n ? '#27304a' : '#d9ccb0', zE + 0.7, -1.4, 1.4, y0, y0 + 3.2); g.globalAlpha = 1;
      cam.pic(g, img, -0.8, zE + 0.4, 0.8, zE + 0.4, y0 + 0.6, y0 + 2.56, { alpha: a });
      g.globalAlpha = a;
      cam.face(g, 'rgba(214,228,235,0.12)', zE + 0.1, win.x0, win.x1, win.y0, win.y1);
      cam.face(g, '#ebe6d8', zE + 0.1, -0.022, 0.022, win.y0, win.y1);
      g.globalAlpha = 1;
    };
    view();
    this.wellUp(R);
    this.reveals(zE, win, 0.22, PAL.paintDk);
    this.plane(x0, x1, zI, zE, y0, PAL.terr, T.terrazo(), 400, undefined, (P) => this.pool(lx, lz, y0, lit, 1.6, '#ffe7b8', P));
    this.plane(x0, x1, zI, zE, y1, PAL.ceil);
    const fitS = (X) => () => { if (R.sw && R.sw.X === X) this.switchAt(R.sw, y0); };
    this.sideWall(x0, zI, zE, y0, y1, 'dado', -1, fitS(x0));
    this.sideWall(x1, zI, zE, y0, y1, 'dado', 1, fitS(x1));
    this.endWall(zE, x0, x1, y0, y1, 'dado', [win], () => { if (R.sw && R.sw.Z != null) this.switchAt(R.sw, y0); });
    this.lamp(lx, lz, y1 - 0.005, lit);
    this.wellEdge(R);
    // daylight (or the neighbours' windows) still comes in when the stair light is out
    this.glow((gg, dark) => {
      if (dark < 0.02 || !cam.poly(gg, [win.x0, win.y0, zE, win.x1, win.y0, zE, win.x1, win.y1, zE, win.x0, win.y1, zE])) return;
      gg.save(); gg.clip(); view(Math.min(1, dark * 0.85)); gg.restore();
    });
  }
  // what is behind a landing's door: a neighbour's lit hall and whoever opened it, the leaf itself
  landingBeyond(R) {
    const cam = this.cam, g = this.g, W = this.world, E = R.exit, y0 = R.y0, Z = R.zE, o = W.doorOpen(R);
    if (o > 0.001) {
      if (E.neighbour) {
        const zb = Z + 2.2, yT = y0 + 2.5;
        cam.flat(g, '#5d4130', -0.9, 0.9, Z, zb, y0);
        cam.flat(g, '#d9ccb2', -0.9, 0.9, Z, zb, yT);
        cam.wallX(g, '#cdb994', -0.9, Z, zb, y0, yT); cam.wallX(g, '#c4b08a', 0.9, Z, zb, y0, yT);
        cam.face(g, '#b9a37c', zb, -0.9, 0.9, y0, yT);
        cam.face(g, '#f3d9a0', zb - 0.002, -0.35, 0.3, y0, y0 + 2.0);
        this.halo(g, 0, yT - 0.12, Z + 1.1, 0.07, '#ffd89a', 0.55);
      }
      if (E.who) this.person(E.who, 0, y0, Z + (E.neighbour ? 0.38 : 0.32), W.who[E.who]);
    }
    this.reveals(Z, this.flatHole(Z, y0), 0.12, PAL.paintDk);
    this.flatLeaf(E, Z, y0, o);
  }
  landing(R) {
    const g = this.g, cam = this.cam, sg = R.sg, y0 = R.y0, y1 = y0 + 2.82, zI = R.zIn, zE = R.zE, x0 = R.w[0], x1 = R.w[1], lit = this.lit(R), E = R.exit;
    const main = this.flatHole(zE, y0), lx = -sg * 0.75, lz = (zI + zE) / 2, S = R.side;
    this.wellUp(R);
    this.landingBeyond(R);
    if (E.neighbour) this.glow((gg, dark) => {
      if (dark < 0.02 || this.world.doorOpen(R) < 0.001 || !cam.poly(gg, [main.x0, y0, zE, main.x1, y0, zE, main.x1, main.y1, zE, main.x0, main.y1, zE])) return;
      gg.save(); gg.clip(); this.landingBeyond(R); gg.restore();
    });
    this.plane(x0, x1, zI, zE, y0, PAL.terr, T.terrazo(), 400, undefined, (P) => {
      this.onFloor(T.doormat(E.mine ? 'HOLA' : '', E.mine ? PAL.mat : E.who === 'suegra' ? '#8a2a2a' : '#6f4a3a'), 'v', 300, y0, -0.35, 0.35, zE - 0.5, zE - 0.05);
      this.onFloor(T.doormat('', '#56606a'), 'v', 300, y0, S.x - 0.35, S.x + 0.35, zE - 0.5, zE - 0.05);
      this.pool(lx, lz, y0, lit, 1.6, '#ffe7b8', P);
    });
    this.plane(x0, x1, zI, zE, y1, PAL.ceil);
    const fitS = (X) => () => { if (R.sw && R.sw.X === X) this.switchAt(R.sw, y0); };
    this.sideWall(x0, zI, zE, y0, y1, 'dado', -1, fitS(x0));
    this.sideWall(x1, zI, zE, y0, y1, 'dado', 1, fitS(x1));
    this.endWall(zE, x0, x1, y0, y1, 'dado', [{ ...main, fw: 0.07, frame: PAL.woodDk }], () => {
      // the other flat on this landing, shut
      cam.face(g, PAL.woodDk, zE - 0.003, S.x - 0.52, S.x + 0.52, y0, y0 + FLAT.h + 0.07);
      this.onWall(T.flatDoor(S.letter, 1, S.x < 0 ? 'L' : 'R', '#5b4636'), { Z: zE, x: S.x }, 0.9, y0, y0 + FLAT.h);
      this.onWall(T.plaque(R.plaque), { Z: zE, x: -sg * 0.72 }, 0.2, y0 + 1.68, y0 + 1.82);
      if (R.sw && R.sw.Z != null) this.switchAt(R.sw, y0);
      if (R.bell) this.onWall(T.bellPlate(), { Z: zE, x: R.bell.x }, 0.06, y0 + R.bell.y - 0.045, y0 + R.bell.y + 0.045);
    });
    this.lamp(lx, lz, y1 - 0.005, lit);
    this.wellEdge(R);
  }
  // out of the lift: a short corridor, a neighbour's door on each side, yours at the end
  corridor(R) {
    const g = this.g, cam = this.cam, W = this.world, y0 = R.y0, y1 = y0 + R.hc, zI = R.zIn, zE = R.zE, x0 = R.w[0], x1 = R.w[1], lit = this.lit(R), E = R.exit;
    const main = this.flatHole(zE, y0);
    this.reveals(zE, main, 0.12, PAL.paintDk);
    this.flatLeaf(E, zE, y0, W.doorOpen(R));
    this.plane(x0, x1, zI, zE, y0, PAL.terr, T.terrazo(), 400, undefined, (P) => {
      this.onFloor(T.doormat('HOLA'), 'v', 300, y0, -0.35, 0.35, zE - 0.5, zE - 0.05);
      for (const S of R.sides) {
        const L = S.X < 0;
        this.onFloor(T.doormat('', L ? '#6f4a3a' : '#56606a'), L ? 'l' : 'r', 300, y0, L ? S.X : S.X - 0.45, L ? S.X + 0.45 : S.X, S.z - 0.35, S.z + 0.35);
      }
      for (const z of R.lamps) this.pool(0, z, y0, lit, 1.6, '#ffe7b8', P);
    });
    this.plane(x0, x1, zI, zE, y1, PAL.ceil);
    const fitS = (X) => () => {
      for (const S of R.sides) if (S.X === X) {
        cam.wallX(g, PAL.woodDk, X + (X < 0 ? 0.003 : -0.003), S.z - 0.52, S.z + 0.52, y0, y0 + FLAT.h + 0.07);
        this.onWall(T.flatDoor(S.letter, 1, 'L', X < 0 ? '#5b4636' : '#6a4a2c'), { X, z: S.z }, 0.9, y0, y0 + FLAT.h);
      }
    };
    this.sideWall(x0, zI, zE, y0, y1, 'dado', -1, fitS(x0));
    this.sideWall(x1, zI, zE, y0, y1, 'dado', 1, fitS(x1));
    this.endWall(zE, x0, x1, y0, y1, 'dado', [{ ...main, fw: 0.07, frame: PAL.woodDk }], () => this.onWall(T.plaque(R.plaque), { Z: zE, x: -0.72 }, 0.2, y0 + 1.68, y0 + 1.82));
    for (const z of R.lamps) this.lamp(0, z, y1 - 0.005, lit);
  }

  // ---------- home ----------
  // your own flat (or hers): a short hall, parquet and the photo from the beach, and at its end the
  // kitchen, tiled to the ceiling, the worktop where the bags go down, a window onto the light well
  home(R) {
    const g = this.g, cam = this.cam, n = this.W.night, y0 = R.y0, y1 = y0 + R.hc, zI = R.zIn, zK = R.zK, zE = R.zE;
    const hx = R.w[1], kx = R.wk[1], zc = zE - 0.6, yw = y0 + 0.9;
    const win = { x0: -0.5, x1: 0.5, y0: y0 + 1.1, y1: y0 + 2.1, fw: 0.05, frame: '#f4f1ea', sill: true };
    // through the window, the light well
    cam.face(g, n ? '#1f273d' : '#cfc2a6', zE + 0.9, -1.8, 1.8, y0 - 0.5, y0 + 3.4);
    cam.pic(g, T.lightWell(n, 91), -0.75, zE + 0.5, 0.75, zE + 0.5, y0 + 0.5, y0 + 2.33);
    cam.face(g, 'rgba(214,228,235,0.14)', zE + 0.06, win.x0, win.x1, win.y0, win.y1);
    cam.face(g, '#f4f1ea', zE + 0.06, -0.02, 0.02, win.y0, win.y1);
    this.reveals(zE, win, 0.2, PAL.kitchenDk);
    // the kitchen
    this.plane(-kx, kx, zK, zE, y0, '#cfc7b8', T.terrazo('#cfc7b8', 11), 400);
    this.plane(-kx, kx, zK, zE, y1, PAL.ceil);
    this.sideWall(-kx, zK, zE, y0, y1, 'kitchen', -1);
    this.sideWall(kx, zK, zE, y0, y1, 'kitchen', 1);
    this.endWall(zE, -kx, kx, y0, y1, 'kitchen', [win]);
    // the counter: white doors over a dark kick plate, a granite top, the sink under the window
    const cx0 = -kx, cx1 = 0.9;
    this.plane(cx0, cx1, zc - 0.03, zE, yw, '#6d6a66', T.terrazo('#6d6a66', 12), 700);
    cam.flat(g, '#aeb5b8', -0.42, 0.42, zE - 0.52, zE - 0.08, yw + 0.002);
    cam.flat(g, '#737b80', -0.38, -0.02, zE - 0.48, zE - 0.12, yw + 0.003);
    cam.flat(g, '#737b80', 0.02, 0.38, zE - 0.48, zE - 0.12, yw + 0.003);
    const tp = cam.p(0, yw, zE - 0.06);
    if (tp) {
      g.strokeStyle = '#c3cacd'; g.lineWidth = Math.max(1, 0.024 * tp[2]); g.lineCap = 'round';
      g.beginPath(); cam.seg(g, 0, yw, zE - 0.06, 0, yw + 0.28, zE - 0.06); cam.seg(g, 0, yw + 0.28, zE - 0.06, 0, yw + 0.23, zE - 0.25); g.stroke();
    }
    cam.face(g, '#3d3934', zc + 0.06, cx0, cx1, y0, y0 + 0.1);
    cam.face(g, '#f1ede4', zc, cx0, cx1, y0 + 0.1, yw - 0.03);
    for (let x = cx0 + 0.5; x < cx1 - 0.05; x += 0.5) cam.face(g, '#d2ccbf', zc - 0.001, x - 0.004, x + 0.004, y0 + 0.1, yw - 0.03);
    cam.face(g, '#d2ccbf', zc - 0.001, cx0, cx1, yw - 0.2, yw - 0.192);
    for (let x = cx0; x < cx1 - 0.05; x += 0.5) {
      const m = (x + Math.min(cx1, x + 0.5)) / 2;
      cam.face(g, '#9aa1a3', zc - 0.02, m - 0.06, m + 0.06, yw - 0.12, yw - 0.105);
      cam.face(g, '#9aa1a3', zc - 0.02, m - 0.06, m + 0.06, yw - 0.3, yw - 0.285);
    }
    cam.face(g, '#5c5955', zc - 0.03, cx0, cx1, yw - 0.03, yw);
    this.hazeFill([cx0, y0, zc, cx1, y0, zc, cx1, yw, zc, cx0, yw, zc], 0, zc);
    // the fridge, with the magnets and a child's drawing
    const fx0 = 0.9, fx1 = kx, zf = zE - 0.65, fy = y0 + 1.8;
    if (cam.x < fx0) cam.wallX(g, '#d6d9d9', fx0, zf, zE, y0, fy);
    cam.face(g, '#f3f5f4', zf, fx0, fx1, y0, fy);
    cam.face(g, '#c9cecd', zf - 0.001, fx0, fx1, y0 + 1.14, y0 + 1.155);
    cam.face(g, '#b3babb', zf - 0.02, fx0 + 0.05, fx0 + 0.075, y0 + 0.72, y0 + 1.06);
    cam.face(g, '#b3babb', zf - 0.02, fx0 + 0.05, fx0 + 0.075, y0 + 1.2, y0 + 1.45);
    cam.face(g, '#ffffff', zf - 0.003, 1.1, 1.3, y0 + 1.28, y0 + 1.54);
    cam.face(g, '#e0493a', zf - 0.004, 1.14, 1.26, y0 + 1.33, y0 + 1.36);
    cam.face(g, '#3b7bd0', zf - 0.004, 1.15, 1.2, y0 + 1.4, y0 + 1.47);
    cam.face(g, '#f2b632', zf - 0.004, 1.21, 1.25, y0 + 1.43, y0 + 1.49);
    for (const [x, y, c] of [[1.2, 1.55, '#e0493a'], [1.38, 1.62, '#35a05a'], [1.02, 1.66, '#f2b632'], [1.4, 1.3, '#3b7bd0']]) cam.face(g, c, zf - 0.006, x - 0.017, x + 0.017, y0 + y - 0.017, y0 + y + 0.017);
    if (cam.y > fy) cam.flat(g, '#e6e9e8', fx0, fx1, zf, zE, fy);
    this.hazeFill([fx0, y0, zf, fx1, y0, zf, fx1, fy, zf, fx0, fy, zf], fx0, zf);
    // the wall cupboards either side of the window
    const ya = y0 + 1.5, yb = y0 + 2.2, zu = zE - 0.35;
    for (const [a, b] of [[-kx, -0.62], [0.62, 0.9]]) {
      if (a < 0 ? cam.x > b : cam.x < a) cam.wallX(g, '#e1dccf', a < 0 ? b : a, zu, zE, ya, yb);
      if (cam.y < ya) cam.flat(g, '#d8d2c6', a, b, zu, zE, ya);
      cam.face(g, '#f1ede4', zu, a, b, ya, yb);
      for (let x = a + 0.45; x < b - 0.05; x += 0.45) cam.face(g, '#d2ccbf', zu - 0.001, x - 0.004, x + 0.004, ya, yb);
      for (let x = a; x < b - 0.05; x += 0.45) {
        const m = (x + Math.min(b, x + 0.45)) / 2;
        cam.face(g, '#9aa1a3', zu - 0.02, m - 0.05, m + 0.05, ya + 0.05, ya + 0.065);
      }
      this.hazeFill([a, ya, zu, b, ya, zu, b, yb, zu, a, yb, zu], (a + b) / 2, zu);
    }
    // the tube light, and at Christmas a string of bulbs over the window
    const tz = (zK + zE) / 2 - 0.1;
    cam.flat(g, '#fffef6', -0.5, 0.5, tz - 0.05, tz + 0.05, y1 - 0.05);
    cam.face(g, '#e2dfd3', tz - 0.05, -0.5, 0.5, y1 - 0.05, y1);
    for (const x of [-0.33, 0, 0.33]) this.halo(g, x, y1 - 0.06, tz, 0.06, '#eef8ff', 0.22);
    if (R.xmas) {
      const cols = ['#ff5a4f', '#ffd35a', '#6ad37a', '#5aa8ff'], Z = zE - 0.02, t = this.world.t;
      const yg = (x) => y0 + 2.3 - 0.09 * (1 - (x / 0.62) ** 2);
      g.strokeStyle = '#27402c'; g.lineWidth = 1.2; g.beginPath();
      for (let i = 0; i < 12; i++) { const xa = -0.62 + i * 0.1033, xb = xa + 0.1033; cam.seg(g, xa, yg(xa), Z, xb, yg(xb), Z); }
      g.stroke();
      for (let i = 0; i <= 12; i++) {
        const x = -0.62 + i * 0.1033, a = 0.45 + 0.4 * Math.max(0, Math.sin(t * 2.6 + i * 1.7));
        this.halo(g, x, yg(x) - 0.02, Z, 0.012, cols[i % 4], a);
      }
    }
    if (cam.z >= zK) return;
    // the hall
    this.reveals(zK, { x0: -hx, x1: hx, y0, y1: y0 + 2.2 }, 0.1, PAL.paintDk);
    this.plane(-hx, hx, zI, zK, y0, PAL.parq, T.parquet(), 380, { k: 0.008 });
    this.plane(-hx, hx, zI, zK, y1, PAL.ceil);
    this.sideWall(-hx, zI, zK, y0, y1, 'paint', -1, () => this.onWall(T.photo(), { X: -hx, z: zI + 1.0 }, 0.4, y0 + 1.4, y0 + 1.7));
    this.sideWall(hx, zI, zK, y0, y1, 'paint', 1, () => {
      // pegs by the door, a coat and a scarf on them
      const X = hx - 0.006, zp = zI + 0.75;
      cam.fill(g, PAL.woodDk, [X, y0 + 1.72, zp - 0.35, X, y0 + 1.78, zp - 0.35, X, y0 + 1.78, zp + 0.35, X, y0 + 1.72, zp + 0.35]);
      cam.fill(g, '#5e3f33', [X, y0 + 1.75, zp - 0.05, X, y0 + 1.62, zp - 0.2, X, y0 + 0.95, zp - 0.25, X, y0 + 0.92, zp + 0.18, X, y0 + 1.62, zp + 0.17, X, y0 + 1.75, zp + 0.05]);
      cam.fill(g, '#b8453a', [X - 0.001, y0 + 1.75, zp + 0.14, X - 0.001, y0 + 1.1, zp + 0.18, X - 0.001, y0 + 1.1, zp + 0.28, X - 0.001, y0 + 1.75, zp + 0.24]);
    });
    cam.face(g, PAL.paint, zK, -hx, hx, y0 + 2.2, y1);
    this.lamp(0, (zI + zK) / 2, y1 - 0.005, 1);
  }
}
