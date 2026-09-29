// The ground itself, painted once per screen size: the plaza, the stands row by row with their seats,
// the stairs and the press box, the pitch with its stripes and lines, and the floodlights behind the
// far stand. Everything that moves (people, the ribbon boards, the players, the big screen) goes on top.
import { K } from '../sim.js';
import { ROW, RISE, FRONT, Z0 } from './geom.js';
import { shade, mix, rgba } from '../util.js';

export const WX = {
  sun: {
    bg: '#b8ae98', bg2: '#a39982', grass: '#3f8d3b', grass2: '#4b9a45', surround: '#3a8237', line: 'rgba(255,255,255,0.9)',
    tread: '#d9d3c7', riser: '#aaa396', wall: '#8d867b', facade: '#6f685f', rim: '#e8e3d9',
    seat: ['#c91f3a', '#b3182f'], vip: '#6e1626', away: '#2b5fb4', light: null, rain: 0, night: 0, sunX: -0.6,
  },
  rain: {
    bg: '#66737a', bg2: '#56626a', grass: '#2f6d3a', grass2: '#377a42', surround: '#2c6536', line: 'rgba(235,240,245,0.8)',
    tread: '#9ca3a6', riser: '#798185', wall: '#646b6f', facade: '#4c5357', rim: '#aeb5b8',
    seat: ['#a8233a', '#941d31'], vip: '#5a1522', away: '#2b5596', light: { c: '#27384a', a: 0.2 }, rain: 1, night: 0, sunX: 0,
  },
  dusk: {
    bg: '#6e4b58', bg2: '#5b3c4a', grass: '#3d7440', grass2: '#467f47', surround: '#386a3b', line: 'rgba(255,240,225,0.85)',
    tread: '#cfae9e', riser: '#9a776c', wall: '#7c5d57', facade: '#5a403f', rim: '#e0c2b0',
    seat: ['#c2263e', '#a91e35'], vip: '#5e1424', away: '#2d5aa8', light: { c: '#6b2f45', a: 0.16 }, rain: 0, night: 0.35, sunX: 0.8,
  },
  night: {
    bg: '#0d1120', bg2: '#080b15', grass: '#2f7a37', grass2: '#38863f', surround: '#2a6c32', line: 'rgba(245,250,255,0.92)',
    tread: '#5e6272', riser: '#41444f', wall: '#34363f', facade: '#1d1f27', rim: '#737888',
    seat: ['#a91f36', '#931a2f'], vip: '#4f1220', away: '#244d92', light: { c: '#0d1535', a: 0.3 }, rain: 0, night: 1, sunX: 0,
  },
};

// the pitch inside a bowl: 105 × 68 when there's room, a smaller ground's pitch otherwise
export function pitchSize(bowl) {
  const pw = Math.min(52.5, bowl.a * 0.84 - 3), ph = Math.min(34, pw * (68 / 105), bowl.b * 0.84 - 2.4);
  return { pw, ph, k: pw / 52.5 };
}

export function paintStadium(g, bowl, view, ring, lv, W, H) {
  const wx = WX[lv.weather] || WX.sun, C = bowl.C, rows = bowl.rows;
  const P = (x, y, z) => view.p(x, y, z);
  const at = (c, d, z) => { const q = bowl.pt(c, d); return P(q[0], q[1], z); };
  const quad = (a, b, c, d, fill) => { g.fillStyle = fill; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); };
  const ring0 = (d, z) => { g.beginPath(); for (let i = 0; i <= C; i += 1) { const q = at(i % C, d, z); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.closePath(); };
  const out = FRONT + rows * ROW + 1.6, zTop = Z0 + rows * RISE + 0.25;

  // the plaza, darker toward the edges of the screen
  const bgG = g.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
  bgG.addColorStop(0, wx.bg); bgG.addColorStop(1, wx.bg2);
  g.fillStyle = bgG; g.fillRect(0, 0, W, H);
  // the stadium's shadow on the plaza
  g.save(); g.filter = `blur(${Math.max(2, view.s * 1.6)}px)`;
  g.fillStyle = 'rgba(0,0,0,0.28)'; ring0(out + 1.2, 0); g.save(); g.translate(view.s * 1.2 * (wx.sunX || 0.3), view.s * 1.5); g.fill(); g.restore();
  g.restore();
  // the outside wall, then the concourse on top of it
  g.fillStyle = wx.facade; ring0(out, 0); g.fill();
  // the facade's panels, on the near side where we see it
  g.strokeStyle = rgba('#000000', 0.18); g.lineWidth = Math.max(1, view.s * 0.12);
  for (let i = 0; i < C; i += 6) { const a = at(i, out, 0), b = at(i, out, zTop); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  g.fillStyle = wx.rim; ring0(out, zTop); g.fill();
  // the grass all the way to the stands (the part round the pitch too)
  g.fillStyle = wx.surround; ring0(FRONT, 0); g.fill();

  // the stands, column slice by slice, far to near; inside a slice, the row nearest us last
  const secOf = new Int16Array(C);
  ring.secs.forEach((s, j) => { for (let i = s.i0; i < s.i0 + s.n; i++) secOf[i] = j; });
  const cols = [...Array(C).keys()].map((i) => [i, at(i, FRONT + (rows * ROW) / 2, 0)[1]]).sort((a, b) => a[1] - b[1]);
  const lightOf = (i) => { const [gx] = view.g(bowl.nx[i], bowl.ny[i]); return gx * (wx.sunX || 0) * 0.08; };
  for (const [i] of cols) {
    const back = view.backTo(bowl, i), k = ring.kind[i], sec = ring.secs[secOf[i]], L = lightOf(i);
    const c0 = i - 0.5, c1 = i + 0.5;
    const tread = shade(wx.tread, L), riser = shade(wx.riser, L);
    const stairs = k === K.gap && sec.n <= 1, press = k === K.gap && sec.n > 1;
    const rowsOrder = back ? [...Array(rows).keys()] : [...Array(rows).keys()].reverse();
    // the front wall
    quad(at(c0, FRONT, 0), at(c1, FRONT, 0), at(c1, FRONT, Z0), at(c0, FRONT, Z0), shade(wx.wall, L));
    for (const r of rowsOrder) {
      const d0 = FRONT + r * ROW, d1 = d0 + ROW, z = Z0 + r * RISE, zp = r ? z - RISE : 0;
      if (r) quad(at(c0, d0, zp), at(c1, d0, zp), at(c1, d0, z), at(c0, d0, z), stairs ? shade(riser, 0.1) : riser);
      quad(at(c0, d0, z), at(c1, d0, z), at(c1, d1, z), at(c0, d1, z), stairs ? shade(tread, 0.12) : press ? shade(tread, -0.06) : tread);
      if (stairs) { const a = at(c0 + 0.1, d0 + 0.04, z), b = at(c1 - 0.1, d0 + 0.04, z); g.strokeStyle = '#e8c547'; g.lineWidth = Math.max(0.8, view.s * 0.08); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); continue; }
      if (k === K.gap) continue;
      // the seat: its back against the next riser, its pan in front
      const col = k === K.vip ? wx.vip : k === K.away ? wx.away : wx.seat[(secOf[i] + (r > rows * 0.6 ? 1 : 0)) % 2];
      const sb = d0 + ROW * 0.78, sp = d0 + ROW * 0.36, h = k === K.vip ? 0.55 : 0.42;
      quad(at(i - 0.33, sp, z + 0.2), at(i + 0.33, sp, z + 0.2), at(i + 0.33, sb, z + 0.2), at(i - 0.33, sb, z + 0.2), shade(col, -0.18 + L));
      quad(at(i - 0.34, sb, z), at(i + 0.34, sb, z), at(i + 0.34, sb, z + h), at(i - 0.34, sb, z + h), shade(col, L));
    }
    // the walkway along the top
    quad(at(c0, FRONT + rows * ROW, zTop - 0.25), at(c1, FRONT + rows * ROW, zTop - 0.25), at(c1, out, zTop), at(c0, out, zTop), shade(wx.rim, L - 0.04));
  }
  // the press box and the directors' box: glass boxes on the top rows of their sections
  for (const s of ring.secs) {
    if (!((s.k === K.gap && s.n >= 8) || (s.k === K.vip && s.n >= 8))) continue;
    const c0 = s.i0 + 0.5, c1 = s.i0 + s.n - 1.5, r0 = s.k === K.vip ? rows - 2 : Math.floor(rows * 0.45);
    const d0 = FRONT + r0 * ROW, d1 = FRONT + rows * ROW, z0 = Z0 + r0 * RISE, z1 = zTop + 1.8;
    const glass = s.k === K.vip ? 'rgba(40,24,30,0.92)' : 'rgba(34,48,62,0.94)';
    const back = view.backTo(bowl, (s.i0 + s.n / 2) | 0);
    // front face (toward the pitch), then the roof
    if (!back) quad(at(c0, d0, z0), at(c1, d0, z0), at(c1, d0, z1), at(c0, d0, z1), glass);
    quad(at(c0, d0, z1), at(c1, d0, z1), at(c1, d1, z1), at(c0, d1, z1), shade(wx.rim, -0.12));
    if (!back) {
      g.strokeStyle = 'rgba(190,220,240,0.22)'; g.lineWidth = Math.max(1, view.s * 0.15);
      for (let c = c0 + 1.5; c < c1; c += 3) { const a = at(c, d0, z0), b = at(c, d0, z1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      const a = at(c0, d0, z1 - 0.3), b = at(c1, d0, z1 - 0.3);
      g.strokeStyle = s.k === K.vip ? '#d4a93c' : '#8fb8d0'; g.lineWidth = Math.max(1, view.s * 0.2);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
  }
  paintPitch(g, bowl, view, wx);
  return { wx };
}

function paintPitch(g, bowl, view, wx) {
  const { pw, ph, k } = pitchSize(bowl);
  const P = (x, y) => view.p(x, y, 0);
  const poly = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach((q, j) => { const s = P(q[0], q[1]); j ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); }); g.closePath(); g.fill(); };
  // mown stripes across the long axis
  const n = 12;
  for (let j = 0; j < n; j++) {
    const x0 = -pw + (2 * pw * j) / n, x1 = x0 + (2 * pw) / n;
    poly([[x0, -ph], [x1, -ph], [x1, ph], [x0, ph]], j % 2 ? wx.grass : wx.grass2);
  }
  // the lines
  g.strokeStyle = wx.line; g.lineWidth = Math.max(1, view.s * 0.16); g.lineJoin = 'round';
  const line = (pts, close = false) => { g.beginPath(); pts.forEach((q, j) => { const s = P(q[0], q[1]); j ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); }); if (close) g.closePath(); g.stroke(); };
  const circ = (cx, cy, r, a0 = 0, a1 = Math.PI * 2) => { const pts = []; for (let m = 0; m <= 40; m++) { const a = a0 + ((a1 - a0) * m) / 40; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } line(pts); };
  line([[-pw, -ph], [pw, -ph], [pw, ph], [-pw, ph]], true);
  line([[0, -ph], [0, ph]]);
  circ(0, 0, 9.15 * k);
  const dot = (x, y) => { const s = P(x, y); g.fillStyle = wx.line; g.beginPath(); g.ellipse(s[0], s[1], Math.max(1.2, view.s * 0.3), Math.max(1, view.s * 0.22), 0, 0, 7); g.fill(); };
  dot(0, 0);
  for (const sgn of [-1, 1]) {
    const x = sgn * pw, bx = x - sgn * 16.5 * k, sx = x - sgn * 5.5 * k;
    line([[x, -20.16 * k], [bx, -20.16 * k], [bx, 20.16 * k], [x, 20.16 * k]]);
    line([[x, -9.16 * k], [sx, -9.16 * k], [sx, 9.16 * k], [x, 9.16 * k]]);
    dot(x - sgn * 11 * k, 0);
    const a = Math.acos(5.5 / 9.15);
    circ(x - sgn * 11 * k, 0, 9.15 * k, sgn > 0 ? Math.PI - a : -a, sgn > 0 ? Math.PI + a : a);
    // the goal: posts, crossbar and a hint of net
    const gw = 3.66 * k, gh = 2.44 * Math.max(0.7, k), gd = 1.6 * k;
    const p = (xx, yy, zz) => view.p(xx, yy, zz);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath(); const n1 = p(x, -gw, gh), n2 = p(x, gw, gh), n3 = p(x + sgn * gd, gw, 0), n4 = p(x + sgn * gd, -gw, 0);
    g.moveTo(n1[0], n1[1]); g.lineTo(n2[0], n2[1]); g.lineTo(n3[0], n3[1]); g.lineTo(n4[0], n4[1]); g.closePath(); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1.2, view.s * 0.18);
    const a1 = p(x, -gw, 0), a2 = p(x, -gw, gh), a3 = p(x, gw, gh), a4 = p(x, gw, 0);
    g.beginPath(); g.moveTo(a1[0], a1[1]); g.lineTo(a2[0], a2[1]); g.lineTo(a3[0], a3[1]); g.lineTo(a4[0], a4[1]); g.stroke();
  }
  // under the lights at night the grass glows; by day a soft shade from the stands
  if (wx.night > 0.5) {
    const c = P(0, 0), r = view.s * pw * 1.2;
    const gl = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
    gl.addColorStop(0, 'rgba(255,255,240,0.16)'); gl.addColorStop(1, 'rgba(255,255,240,0)');
    g.fillStyle = gl; g.fillRect(c[0] - r, c[1] - r, r * 2, r * 2);
  }
  if (wx.rain) {
    g.fillStyle = 'rgba(200,215,230,0.07)';
    for (let j = 0; j < 9; j++) { const q = P(-pw * 0.8 + j * pw * 0.2, ((j * 37) % 11) * ph * 0.15 - ph * 0.7); g.beginPath(); g.ellipse(q[0], q[1], view.s * (5 + (j % 3) * 3), view.s * (1.4 + (j % 2)), 0, 0, 7); g.fill(); }
  }
}
