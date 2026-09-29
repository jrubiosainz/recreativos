// The train: stainless cars with a line-colour stripe, four doors a side and windows full of commuters.
// Drawn in four passes so doors can slide into their pockets and faces can press against the glass:
//   interior (through every opening)  →  door leaves  →  body panels  →  glass.
// Car 0 is the head car; its cab nose leads the train in from the right.
import { TAU, clamp, lerp, shade, rgba, mulberry32 } from './util.js';
import { CAR_Z, DOOR_W, DOOR_H } from './cam.js';
import { crowdLook } from './look.js';
import { drawCrowdHead } from './person.js';

export const LINE = '#16b89c';
const STEEL = '#d4d9df', STEEL_D = '#b3bac3', STEEL_L = '#eef1f4';
const RUBBER = '#2a2c33';
const INSIDE = '#ddd6c8';
const SEAT = '#46689e';

export const CAR = { len: 20, gap: 0.6, doors: [-4.8, 0, 4.8, 9.6], x0: -7.6, x1: 12.4, top: 2.95, bottom: -0.95, wy0: 0.92, wy1: 1.84, floor: 0.03, cars: 10, nose: 1.15 };
export const PITCH = CAR.len + CAR.gap;
const HALF = DOOR_W / 2;
const FAR = -2.95; // the far side of the car

// window openings along one car, relative to its reference door (x = 0). The head car's first bay is the cab.
function windows(c) {
  const d = CAR.doors, P = 0.45, w = [];
  if (c !== 0) w.push([CAR.x0 + 0.45, d[0] - HALF - P]);
  for (let i = 0; i < d.length - 1; i++) w.push([d[i] + HALF + P, d[i + 1] - HALF - P]);
  w.push([d[d.length - 1] + HALF + P, CAR.x1 - 0.45]);
  return w;
}
const WIN = [windows(0), windows(1)];
const winOf = (c) => WIN[c === 0 ? 0 : 1];

// crowd rows inside a car: depth and spacing
const ROWS = [
  { z: -0.16, dx: 0.4 },
  { z: -0.55, dx: 0.42 },
  { z: -1.05, dx: 0.46 },
  { z: -1.7, dx: 0.5 },
  { z: -2.4, dx: 0.56 },
];

export class Train {
  constructor(seed = 1) {
    this.seed = seed;
    this.cache = new Map();
  }

  crowd(c) {
    let m = this.cache.get(c);
    if (m) return m;
    const r = mulberry32((this.seed * 7919 + c * 104729 + 17) >>> 0);
    m = [];
    const xmin = c === 0 ? CAR.doors[0] - HALF - 0.1 : CAR.x0 + 0.2;
    ROWS.forEach((row, ri) => {
      for (let x = xmin + r() * row.dx * 0.5; x < CAR.x1 - 0.2; x += row.dx * (0.85 + r() * 0.3)) {
        const L = crowdLook((r() * 2 ** 31) | 0);
        const inDoor = CAR.doors.some((d) => Math.abs(x - d) < HALF + 0.15);
        m.push({
          L, x, z: row.z + (r() - 0.5) * 0.08, row: ri, glass: ri === 0,
          hy: (L.h - 0.19) * (0.97 + r() * 0.05), order: r(), ph: r() * TAU,
          back: ri > 0 && r() < 0.3, phone: L.phone && r() < 0.8, sleepy: L.sleepy,
          look: (r() - 0.5) * 2, inDoor,
        });
      }
    });
    m.sort((a, b) => a.z - b.z);
    this.cache.set(c, m);
    return m;
  }

  // visible car indices for a train offset (the train is CAR.cars long, head first)
  cars(cam, ox) {
    const xl = cam.edge(-1, CAR_Z) - 1.5, xr = cam.edge(1, CAR_Z) + 1.5;
    const out = [];
    for (let c = 0; c < CAR.cars; c++) {
      const o = ox + c * PITCH;
      if (o + CAR.x1 < xl || o + CAR.x0 - CAR.nose > xr) continue;
      out.push(c);
    }
    return out;
  }

  // screen x-ranges of every opening in the near wall, for culling the crowd behind it
  openings(cam, V, cars) {
    const r = [];
    for (const c of cars) {
      const ox = V.x + c * PITCH;
      for (const dx of CAR.doors) r.push([cam.X(ox + dx - HALF, CAR_Z), cam.X(ox + dx + HALF, CAR_Z)]);
      for (const [a, b] of winOf(c)) r.push([cam.X(ox + a, CAR_Z), cam.X(ox + b, CAR_Z)]);
    }
    return r;
  }

  // ------------------------------------------------------------ pass 1: what you see through the openings
  drawInterior(g, cam, V) {
    const cars = this.cars(cam, V.x);
    if (!cars.length) return;
    const W = cam.W, H = cam.H;
    g.save();
    g.beginPath();
    for (const c of cars) {
      const ox = V.x + c * PITCH;
      for (const dx of CAR.doors) rectPath(g, cam, ox + dx - HALF, CAR.floor, ox + dx + HALF, DOOR_H, CAR_Z);
      for (const [a, b] of winOf(c)) rectPath(g, cam, ox + a, CAR.wy0, ox + b, CAR.wy1, CAR_Z);
    }
    g.clip();
    // the far wall, with its windows cut out so the view across the tracks shows through
    const wt = cam.Y(2.35, FAR), wb = cam.Y(CAR.floor, FAR);
    g.fillStyle = shade(INSIDE, 0.3); g.fillRect(0, 0, W, wt);
    g.beginPath();
    g.rect(0, wt, W, wb - wt);
    for (const c of cars) {
      const ox = V.x + c * PITCH;
      for (const [a, b] of winOf(c)) rectPathRev(g, cam, ox + a, CAR.wy0, ox + b, CAR.wy1, FAR);
      for (const dx of CAR.doors) for (const s of [-1, 1]) rectPathRev(g, cam, ox + dx + s * 0.12 - 0.26, 1.0, ox + dx + s * 0.12 + 0.26, 1.78, FAR);
    }
    const gw = g.createLinearGradient(0, wt, 0, wb);
    gw.addColorStop(0, shade(INSIDE, 0.12)); gw.addColorStop(0.6, INSIDE); gw.addColorStop(1, shade(INSIDE, -0.2));
    g.fillStyle = gw; g.fill('evenodd');
    // far bench and its backrest under the windows, far doors as darker panels
    for (const c of cars) {
      const ox = V.x + c * PITCH;
      for (const [a, b] of winOf(c)) {
        const X0 = cam.X(ox + a, FAR), X1 = cam.X(ox + b, FAR);
        g.fillStyle = SEAT; g.fillRect(X0, cam.Y(0.88, FAR), X1 - X0, cam.Y(0.46, FAR) - cam.Y(0.88, FAR));
        g.fillStyle = shade(SEAT, 0.2); g.fillRect(X0, cam.Y(0.5, FAR), X1 - X0, cam.Y(0.42, FAR) - cam.Y(0.5, FAR));
      }
      for (const dx of CAR.doors) {
        const X0 = cam.X(ox + dx - HALF, FAR), X1 = cam.X(ox + dx + HALF, FAR);
        g.strokeStyle = shade(INSIDE, -0.3); g.lineWidth = Math.max(1, cam.s(FAR) * 0.02);
        g.strokeRect(X0, cam.Y(DOOR_H, FAR), X1 - X0, cam.Y(CAR.floor, FAR) - cam.Y(DOOR_H, FAR));
        g.beginPath(); g.moveTo((X0 + X1) / 2, cam.Y(DOOR_H, FAR)); g.lineTo((X0 + X1) / 2, cam.Y(CAR.floor, FAR)); g.stroke();
      }
    }
    // floor
    const gf = g.createLinearGradient(0, wb, 0, cam.Y(CAR.floor, CAR_Z));
    gf.addColorStop(0, '#8d8577'); gf.addColorStop(1, '#6d665b');
    g.fillStyle = gf; g.fillRect(0, wb, W, H - wb);
    // grab poles by the doors, straps along the car
    for (const c of cars) {
      const ox = V.x + c * PITCH;
      for (const dx of CAR.doors) {
        for (const s of [-1, 1]) {
          const z = -0.3, px = cam.X(ox + dx + s * (HALF + 0.1), z), w = cam.s(z) * 0.034;
          g.fillStyle = '#c9d0d8'; g.fillRect(px - w / 2, cam.Y(2.25, z), w, cam.Y(0, z) - cam.Y(2.25, z));
          g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(px - w / 2, cam.Y(2.25, z), w * 0.3, cam.Y(0, z) - cam.Y(2.25, z));
        }
      }
      drawStraps(g, cam, ox, -2.1, V);
      drawStraps(g, cam, ox, -0.85, V);
    }
    // the crowd, back to front, with a little haze between rows
    const open = this.openings(cam, V, cars);
    const dens = density(V.fill);
    const lod = V.lod ?? 1;
    const rowsOf = [[], [], [], [], []];
    for (const c of cars) for (const m of this.crowd(c)) rowsOf[m.row].push([c, m]);
    for (let ri = ROWS.length - 1; ri >= 0; ri--) {
      g.fillStyle = rgba(INSIDE, ri >= 3 ? 0.2 : 0.14); g.fillRect(0, 0, W, H);
      // the people who just boarded stand in the doorway with the front row: no haze over them, so the
      // hand-over from the platform (drawn crisp) to the car keeps the same brightness
      if (ri === 0 && V.drawInside) V.drawInside(g);
      for (const [c, m] of rowsOf[ri]) {
        if (m.order > dens[ri]) continue;
        if (c === 0 && ri === 0 && Math.abs(m.x) < HALF + 0.25 && V.ownFront) continue;
        const ox = V.x + c * PITCH, wx = ox + m.x;
        const sway = (V.lean || 0) * (0.05 + 0.03 * Math.sin(m.ph)) + Math.sin(V.t * 0.8 + m.ph) * 0.008;
        const press = ri === 0 ? clamp((V.fill - 1.05) / 0.7) * (0.6 + 0.4 * Math.sin(m.ph * 3)) + (V.wave || 0) * 0.5 : ri === 1 ? (V.wave || 0) * 0.3 : 0;
        const z = m.z + press * 0.03;
        const s = cam.s(z), X = cam.X(wx + sway, z), hw = s * 0.34;
        let vis = false;
        for (const [a, b] of open) if (X + hw > a && X - hw < b) { vis = true; break; }
        if (!vis) continue;
        const Y = cam.Y(m.hy - (V.squash || 0) * 0.05, z);
        const k = 1 + press * 0.07 + (V.squash || 0) * 0.08;
        drawCrowdHead(g, m.L, X, Y, s, crowdFace(m, V, press), {
          back: m.back, phone: m.phone && ri > 0, hands: ri === 0 && V.fill > 1.55 && m.order < 0.3 ? 1 : 0,
          lod: ri < 2 ? lod : 0, sx: k, sy: 1 / k, t: V.t, rot: sway * 0.6,
          torso: m.inDoor && ri < 3 ? m.hy - CAR.floor : 0,
        });
      }
    }
    g.restore();
  }

  // ------------------------------------------------------------ pass 2: door leaves (the active one can stall)
  drawLeaves(g, cam, V) {
    for (const c of this.cars(cam, V.x)) {
      const ox = V.x + c * PITCH;
      for (let i = 0; i < CAR.doors.length; i++) {
        const active = c === 0 && i === 1;
        const p = active ? V.doorP : V.otherP;
        const cx = ox + CAR.doors[i];
        if (cam.X(cx + DOOR_W, CAR_Z) < -5 || cam.X(cx - DOOR_W, CAR_Z) > cam.W + 5) continue;
        for (const side of [-1, 1]) {
          const inner = cx + side * HALF * (1 - p);
          drawLeaf(g, cam, Math.min(inner, inner + side * HALF), Math.max(inner, inner + side * HALF), side, active ? V : null);
        }
      }
    }
  }

  // ------------------------------------------------------------ pass 3: body panels with their holes, stripes, lamps
  drawBody(g, cam, V) {
    const z = CAR_Z, s = cam.s(z);
    const cars = this.cars(cam, V.x);
    // gangway bellows between cars, set back a little
    for (const c of cars) {
      const ox = V.x + c * PITCH;
      if (c === CAR.cars - 1) continue;
      const zb = z - 0.2, a = cam.X(ox + CAR.x1 - 0.1, zb), b = cam.X(ox + CAR.x1 + CAR.gap + 0.1, zb);
      if (b < 0 || a > cam.W) continue;
      g.fillStyle = '#3b3e46'; g.fillRect(a, cam.Y(2.5, zb), b - a, cam.Y(0.02, zb) - cam.Y(2.5, zb));
      g.strokeStyle = '#2a2c33'; g.lineWidth = Math.max(1, s * 0.012);
      g.beginPath();
      for (let k = 1; k < 6; k++) { const x = lerp(a, b, k / 6); g.moveTo(x, cam.Y(2.5, zb)); g.lineTo(x, cam.Y(0.02, zb)); }
      g.stroke();
    }
    for (const c of cars) {
      const ox = V.x + c * PITCH;
      const X0 = cam.X(ox + CAR.x0, z), X1 = cam.X(ox + CAR.x1, z);
      const Yt = cam.Y(CAR.top, z), Yb = cam.Y(CAR.bottom, z);
      const gr = g.createLinearGradient(0, Yt, 0, Yb);
      gr.addColorStop(0, shade(STEEL, -0.08)); gr.addColorStop(0.1, STEEL_L); gr.addColorStop(0.36, STEEL);
      gr.addColorStop(0.62, shade(STEEL, 0.1)); gr.addColorStop(1, shade(STEEL, -0.22));
      if (c === 0) this.drawNose(g, cam, ox, gr, V);
      if (X1 < 0 || X0 > cam.W) continue;
      g.save();
      g.beginPath();
      g.roundRect(X0, Yt, X1 - X0, Yb - Yt, [s * 0.18, s * 0.18, 0, 0]);
      for (const dx of CAR.doors) rectPath(g, cam, ox + dx - HALF, CAR.floor, ox + dx + HALF, DOOR_H, z);
      for (const [a, b] of winOf(c)) roundPath(g, cam, ox + a, CAR.wy0, ox + b, CAR.wy1, z, 0.05);
      g.fillStyle = gr;
      g.fill('evenodd');
      g.clip('evenodd');
      // corrugation beads below the windows
      g.strokeStyle = rgba(STEEL_D, 0.35); g.lineWidth = Math.max(1, s * 0.004);
      g.beginPath();
      const ya = cam.Y(CAR.wy0 - 0.04, z), yb = cam.Y(-0.4, z);
      for (let x = CAR.x0 + 0.06; x < CAR.x1; x += 0.11) { const X = cam.X(ox + x, z); if (X < -2 || X > cam.W + 2) continue; g.moveTo(X, ya); g.lineTo(X, yb); }
      g.stroke();
      // line stripes
      g.fillStyle = V.line || LINE;
      g.fillRect(X0, cam.Y(0.8, z), X1 - X0, cam.Y(0.6, z) - cam.Y(0.8, z));
      g.fillRect(X0, cam.Y(2.3, z), X1 - X0, cam.Y(2.24, z) - cam.Y(2.3, z));
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(X0, cam.Y(0.8, z), X1 - X0, Math.max(1, s * 0.012));
      g.fillStyle = shade(STEEL, -0.3); g.fillRect(X0, Yt, X1 - X0, s * 0.05);
      if (c === 0) {
        // cab side window and crew door (the destination lives on the HUD's departure board)
        const x0 = ox + CAR.x0;
        g.fillStyle = '#26303d'; roundFill(g, cam, x0 + 0.15, 1.2, x0 + 0.95, 1.85, z, 0.06);
        g.strokeStyle = rgba('#5f6670', 0.7); g.lineWidth = Math.max(1, s * 0.01);
        g.strokeRect(cam.X(x0 + 1.1, z), cam.Y(1.92, z), cam.X(x0 + 1.72, z) - cam.X(x0 + 1.1, z), cam.Y(0.05, z) - cam.Y(1.92, z));
        g.fillStyle = '#26303d'; roundFill(g, cam, x0 + 1.22, 1.25, x0 + 1.6, 1.8, z, 0.04);
      }
      g.restore();
      // door frames: rubber lining, the door-closing lamp, the threshold plate
      for (let i = 0; i < CAR.doors.length; i++) {
        const cx = ox + CAR.doors[i];
        const a = cam.X(cx - HALF, z), b = cam.X(cx + HALF, z), top = cam.Y(DOOR_H, z), bot = cam.Y(CAR.floor, z);
        if (b < -40 || a > cam.W + 40) continue;
        g.strokeStyle = RUBBER; g.lineWidth = Math.max(2, s * 0.03);
        g.beginPath(); g.moveTo(a, bot); g.lineTo(a, top); g.lineTo(b, top); g.lineTo(b, bot); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = Math.max(1, s * 0.008);
        g.beginPath(); g.moveTo(a - s * 0.02, bot); g.lineTo(a - s * 0.02, top - s * 0.02); g.lineTo(b + s * 0.02, top - s * 0.02); g.lineTo(b + s * 0.02, bot); g.stroke();
        const on = V.lamp > 0.5 && (c === 0 && i === 1 ? true : V.otherLamp);
        for (const side of [-1, 1]) {
          const lx = cam.X(cx + side * (HALF + 0.2), z), ly = cam.Y(DOOR_H + 0.16, z), lr = s * 0.045;
          g.fillStyle = '#6b6f78'; g.beginPath(); g.roundRect(lx - lr * 1.3, ly - lr * 0.9, lr * 2.6, lr * 1.8, lr * 0.5); g.fill();
          g.fillStyle = on ? '#ff4b3e' : '#8e3b3b';
          g.beginPath(); g.roundRect(lx - lr, ly - lr * 0.6, lr * 2, lr * 1.2, lr * 0.4); g.fill();
          if (on) {
            const gl = g.createRadialGradient(lx, ly, 0, lx, ly, lr * 5);
            gl.addColorStop(0, 'rgba(255,90,70,0.55)'); gl.addColorStop(1, 'rgba(255,90,70,0)');
            g.fillStyle = gl; g.fillRect(lx - lr * 5, ly - lr * 5, lr * 10, lr * 10);
          }
        }
        g.fillStyle = '#9aa1a9'; g.fillRect(a, bot - s * 0.03, b - a, s * 0.045);
        g.fillStyle = V.line || LINE; g.fillRect(a, bot - s * 0.032, b - a, s * 0.008);
      }
      // car number sticker on the pillar beside the reference door, at eye level
      const nx = cam.X(ox + CAR.doors[1] - HALF - 0.2, z), ny = cam.Y(1.72, z), ns = s * 0.12;
      if (nx > -60 && nx < cam.W + 60) {
        g.fillStyle = '#20262f'; g.beginPath(); g.roundRect(nx - ns * 0.9, ny - ns * 0.5, ns * 1.8, ns, ns * 0.18); g.fill();
        g.fillStyle = '#ffffff'; g.font = `700 ${ns * 0.62}px 'Fredoka', system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(c + 1), nx - ns * 0.36, ny + ns * 0.04);
        g.font = `700 ${ns * 0.3}px 'Zen Maru', 'Hiragino Sans', system-ui, sans-serif`; g.fillStyle = 'rgba(255,255,255,0.8)';
        g.fillText('号車', nx + ns * 0.46, ny + ns * 0.06);
      }
    }
  }

  drawNose(g, cam, ox, grad, V) {
    const z = CAR_Z, x0 = ox + CAR.x0, s = cam.s(z);
    if (cam.X(x0, z) < -s * 2 || cam.X(x0 - CAR.nose, z) > cam.W + s) return;
    const P = (x, y) => [cam.X(x0 + x, z), cam.Y(y, z)];
    const pts = [[0.05, CAR.top], [-0.32, 2.9], [-0.98, 1.38], [-1.1, 0.95], [-1.12, -0.25], [-1.02, CAR.bottom], [0.05, CAR.bottom]];
    g.save();
    g.beginPath();
    pts.forEach(([x, y], i) => { const p = P(x, y); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
    g.closePath();
    g.fillStyle = grad; g.fill();
    g.clip();
    // windscreen seen edge-on, the stripe wrapping round the nose, the skirt
    g.fillStyle = '#243040';
    g.beginPath();
    [[-0.26, 2.84], [-0.92, 1.44], [-0.62, 1.44], [0.02, 2.84]].forEach(([x, y], i) => { const p = P(x, y); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
    g.fill();
    g.fillStyle = V.line || LINE;
    const a = P(-1.3, 0.8), b = P(0.05, 0.6); g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    g.fillStyle = '#2a2c33';
    const k0 = P(-1.3, -0.35), k1 = P(0.05, CAR.bottom); g.fillRect(k0[0], k0[1], k1[0] - k0[0], k1[1] - k0[1]);
    g.restore();
    // headlight
    const h = P(-1.06, 1.05), r = s * 0.07;
    const gl = g.createRadialGradient(h[0], h[1], 0, h[0], h[1], r * 9);
    gl.addColorStop(0, 'rgba(255,248,220,0.75)'); gl.addColorStop(0.3, 'rgba(255,244,210,0.25)'); gl.addColorStop(1, 'rgba(255,244,210,0)');
    g.fillStyle = gl; g.fillRect(h[0] - r * 9, h[1] - r * 9, r * 18, r * 18);
    g.fillStyle = '#fffbe8'; g.beginPath(); g.ellipse(h[0], h[1], r * 0.55, r, 0, 0, TAU); g.fill();
  }

  // ------------------------------------------------------------ pass 4: glass sheen over windows and door windows
  drawGlass(g, cam, V) {
    const z = CAR_Z;
    const sweep = V.sheen ?? 0;
    for (const c of this.cars(cam, V.x)) {
      const ox = V.x + c * PITCH;
      for (const [a, b] of winOf(c)) glassSheen(g, cam, ox + a, CAR.wy0, ox + b, CAR.wy1, z, sweep, c * 3 + a);
      for (let i = 0; i < CAR.doors.length; i++) {
        const active = c === 0 && i === 1;
        const p = active ? V.doorP : V.otherP;
        if (p < 0.02) continue;
        const cx = ox + CAR.doors[i];
        for (const side of [-1, 1]) {
          const inner = cx + side * HALF * (1 - p);
          const x0 = Math.min(inner, inner + side * HALF), x1 = Math.max(inner, inner + side * HALF);
          const wx0 = Math.max(cx - HALF, side < 0 ? x0 + 0.12 : x0 + 0.08), wx1 = Math.min(cx + HALF, side < 0 ? x1 - 0.08 : x1 - 0.12);
          if (wx1 > wx0 + 0.01) glassSheen(g, cam, wx0, 1.0, wx1, 1.78, z + 0.012, sweep, c * 7 + i + side);
        }
      }
      // mullions, over the faces
      const s = cam.s(z);
      for (const [a, b] of winOf(c)) {
        const n = b - a > 1.6 ? 3 : b - a > 0.95 ? 2 : 1;
        for (let k = 1; k < n; k++) {
          const X = cam.X(ox + lerp(a, b, k / n), z);
          if (X < -10 || X > cam.W + 10) continue;
          g.fillStyle = STEEL_D; g.fillRect(X - s * 0.022, cam.Y(CAR.wy1, z), s * 0.044, cam.Y(CAR.wy0, z) - cam.Y(CAR.wy1, z));
          g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(X - s * 0.022, cam.Y(CAR.wy1, z), s * 0.01, cam.Y(CAR.wy0, z) - cam.Y(CAR.wy1, z));
        }
      }
    }
  }
}

// how full each crowd row looks: the glass row fills first, then the deeper ones
function density(fill) {
  const f = clamp((fill - 0.55) / 1.1);
  return [clamp(f * 1.6 + 0.1), clamp(f * 1.3 + 0.05), clamp(f * 1.15), clamp(f * 1.05 - 0.05), clamp(f - 0.1)];
}

function crowdFace(m, V, press) {
  if (m.back) return {};
  const hi = V.fill > 1.45;
  const mood = V.mood || 0; // +1 relieved (doors shut), -1 annoyed (incident)
  if (mood < -0.5 && m.order < 0.7) return { eyes: 'dot', mouth: 'wavy', brow: 1.3, look: 0 };
  if (press > 0.55) return { eyes: m.order < 0.5 ? 'squeeze' : 'closed', mouth: m.order < 0.3 ? 'grit' : 'wavy', press: clamp(press), blush: 0.3, look: m.look };
  if (m.sleepy) return { eyes: 'half', mouth: 'o', mouthK: 0.5, look: 0 };
  if (m.phone) return { eyes: 'dot', lookY: 1, mouth: 'flat' };
  return { eyes: hi && m.order < 0.4 ? 'closed' : 'dot', mouth: hi ? 'wavy' : 'flat', look: V.lookAt != null && m.order < 0.5 ? V.lookAt : m.look, press: press * 0.6, brow: hi ? 0.6 : 0 };
}

function rectPath(g, cam, x0, y0, x1, y1, z) {
  const X0 = cam.X(x0, z), X1 = cam.X(x1, z), Y0 = cam.Y(y1, z), Y1 = cam.Y(y0, z);
  g.rect(X0, Y0, X1 - X0, Y1 - Y0);
}
// the same rectangle wound the other way round, for holes
function rectPathRev(g, cam, x0, y0, x1, y1, z) {
  const X0 = cam.X(x0, z), X1 = cam.X(x1, z), Y0 = cam.Y(y1, z), Y1 = cam.Y(y0, z);
  g.moveTo(X0, Y0); g.lineTo(X0, Y1); g.lineTo(X1, Y1); g.lineTo(X1, Y0); g.closePath();
}
function roundPath(g, cam, x0, y0, x1, y1, z, r) {
  const X0 = cam.X(x0, z), X1 = cam.X(x1, z), Y0 = cam.Y(y1, z), Y1 = cam.Y(y0, z);
  g.roundRect(X0, Y0, X1 - X0, Y1 - Y0, r * cam.s(z));
}
function roundFill(g, cam, x0, y0, x1, y1, z, r) { g.beginPath(); roundPath(g, cam, x0, y0, x1, y1, z, r); g.fill(); }

function drawStraps(g, cam, ox, z, V) {
  const s = cam.s(z);
  const bar = cam.Y(2.1, z);
  const x0 = cam.X(ox + CAR.x0, z), x1 = cam.X(ox + CAR.x1, z);
  if (x1 < 0 || x0 > cam.W) return;
  g.strokeStyle = '#b9c0c8'; g.lineWidth = Math.max(1, s * 0.02);
  g.beginPath(); g.moveTo(Math.max(-10, x0), bar); g.lineTo(Math.min(cam.W + 10, x1), bar); g.stroke();
  const len = s * 0.24;
  for (let x = CAR.x0 + 0.3; x < CAR.x1; x += 0.36) {
    if (CAR.doors.some((d) => Math.abs(x - d) < 0.9)) continue;
    const X = cam.X(ox + x, z);
    if (X < -20 || X > cam.W + 20) continue;
    const ang = (V.lean || 0) * 0.35 + Math.sin(V.t * 1.3 + x * 3) * 0.04;
    const ex = X + Math.sin(ang) * len, ey = bar + Math.cos(ang) * len;
    g.strokeStyle = '#e8e2d4'; g.lineWidth = Math.max(1, s * 0.022);
    g.beginPath(); g.moveTo(X, bar); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = Math.abs(x - 5.5) < 1.6 ? '#f2c14e' : '#f5f2ea'; g.lineWidth = Math.max(1, s * 0.016);
    g.beginPath(); g.ellipse(ex, ey + s * 0.045, s * 0.04, s * 0.05, ang, 0, TAU); g.stroke();
  }
}

function drawLeaf(g, cam, x0, x1, side, V) {
  const z = CAR_Z + 0.012;
  const X0 = cam.X(x0, z), X1 = cam.X(x1, z), Yt = cam.Y(DOOR_H, z), Yb = cam.Y(CAR.floor, z), s = cam.s(z);
  if (X1 < -5 || X0 > cam.W + 5) return;
  const wx0 = side < 0 ? x0 + 0.12 : x0 + 0.08, wx1 = side < 0 ? x1 - 0.08 : x1 - 0.12;
  const WX0 = cam.X(wx0, z), WX1 = cam.X(wx1, z), WY0 = cam.Y(1.78, z), WY1 = cam.Y(1.0, z);
  g.beginPath();
  g.rect(X0, Yt, X1 - X0, Yb - Yt);
  g.roundRect(WX0, WY0, WX1 - WX0, WY1 - WY0, s * 0.05);
  const gr = g.createLinearGradient(X0, 0, X1, 0);
  gr.addColorStop(0, shade(STEEL, side < 0 ? 0.12 : -0.05)); gr.addColorStop(1, shade(STEEL, side < 0 ? -0.05 : 0.12));
  g.fillStyle = gr; g.fill('evenodd');
  g.strokeStyle = 'rgba(95,102,112,0.55)'; g.lineWidth = Math.max(1, s * 0.008);
  g.beginPath(); g.roundRect(WX0, WY0, WX1 - WX0, WY1 - WY0, s * 0.05); g.stroke();
  // kick plate and the "mind your fingers" sticker
  g.fillStyle = 'rgba(141,148,157,0.35)'; g.fillRect(X0, cam.Y(0.28, z), X1 - X0, Yb - cam.Y(0.28, z));
  const stx = cam.X(side < 0 ? x1 - 0.18 : x0 + 0.18, z), sty = cam.Y(0.86, z), sr = s * 0.045;
  g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(stx, sty, sr, 0, TAU); g.fill();
  g.fillStyle = '#e0473a'; g.beginPath(); g.roundRect(stx - sr * 0.28, sty - sr * 0.62, sr * 0.56, sr * 1.0, sr * 0.28); g.fill();
  g.fillStyle = '#1f1f28'; g.fillRect(stx - sr * 0.7, sty + sr * 0.22, sr * 1.4, sr * 0.16);
  // rubber nose on the leading edge, bulging when it hits someone
  const edge = side < 0 ? X1 : X0;
  const hit = V ? V.doorHit || 0 : 0;
  const w = s * (0.035 + hit * 0.025);
  g.fillStyle = RUBBER;
  g.beginPath();
  if (side < 0) g.roundRect(edge - w, Yt, w, Yb - Yt, w * 0.5);
  else g.roundRect(edge, Yt, w, Yb - Yt, w * 0.5);
  g.fill();
}

function glassSheen(g, cam, x0, y0, x1, y1, z, sweep, seed) {
  const X0 = cam.X(x0, z), X1 = cam.X(x1, z), Y0 = cam.Y(y1, z), Y1 = cam.Y(y0, z);
  if (X1 < 0 || X0 > cam.W) return;
  g.save();
  g.beginPath(); g.rect(X0, Y0, X1 - X0, Y1 - Y0); g.clip();
  g.fillStyle = 'rgba(210,232,240,0.13)'; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  const w = X1 - X0, h = Y1 - Y0;
  const off = (((seed * 0.37) % 1) + 1) % 1 * w + sweep * cam.S;
  g.fillStyle = 'rgba(255,255,255,0.2)';
  for (const [a, b] of [[0.1, 0.22], [0.3, 0.36]]) {
    const span = w * 1.4 + h;
    const xa = X0 - h + ((((a * w + off) % span) + span) % span);
    g.beginPath(); g.moveTo(xa, Y1); g.lineTo(xa + h * 0.5, Y0); g.lineTo(xa + h * 0.5 + (b - a) * w, Y0); g.lineTo(xa + (b - a) * w, Y1); g.closePath(); g.fill();
  }
  g.restore();
}
