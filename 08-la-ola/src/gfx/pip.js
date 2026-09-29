// The PROGRAMA feed: what the camera sees, close up, as it goes out on the big screen. Five-odd seats
// across and three rows deep, drawn big enough to have faces: they spot themselves, point, jump up and
// wave the way the camera pans; the tired ones can't be bothered, the sleepers snore, the away end
// boos, the palco straightens its ties, and the kiss cam does what the kiss cam does.
import { Sim, UP, REST, TIRED, K, P as SP } from '../sim.js';
import { HOME, HOME2 } from './people.js';
import { shade, mix, clamp, TAU } from '../util.js';

const ACROSS = 5.4, LAG = 0.022;
const ROUND = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };

export class Feed {
  constructor() { this.c = document.createElement('canvas'); this.g = this.c.getContext('2d'); this.w = 1; this.h = 1; }
  resize(w, h) { this.c.width = this.w = Math.max(8, Math.round(w)); this.c.height = this.h = Math.max(8, Math.round(h)); }
  load(ring) {
    this.ring = ring; const C = ring.C;
    this.secOf = new Int16Array(C);
    ring.secs.forEach((s, j) => { for (let i = s.i0; i < s.i0 + s.n; i++) this.secOf[i] = j; });
  }
  // camX: the column in the middle of the shot; kissT: the kiss cam's heart is up
  draw(sim, crowd, camX, now, wx, kissT = 0) {
    const g = this.g, w = this.w, h = this.h, U = w / ACROSS, C = sim.C, rows = sim.rows, ring = this.ring;
    const night = wx.night > 0.5;
    // the stand behind them
    g.fillStyle = night ? '#23252e' : shade(wx.riser, -0.1); g.fillRect(0, 0, w, h);
    const rowY = (r) => h + U * 0.1 - r * U * 0.6;
    const nRows = Math.min(rows, Math.ceil((h + U) / (U * 0.6)) + 1);
    const c0 = Math.floor(camX - ACROSS / 2 - 1), c1 = Math.ceil(camX + ACROSS / 2 + 1);
    const X = (c) => w / 2 + (c - camX) * U;
    const panDir = Math.abs(sim.cam.v) > SP.dirMin ? Math.sign(sim.cam.v) : 0;
    for (let r = nRows - 1; r >= 0; r--) {
      const y = rowY(r), sc = 1 - r * 0.05, u = U * sc;
      // the tier: riser, then the tread they sit on
      g.fillStyle = night ? '#2c2f39' : wx.riser; g.fillRect(0, y - u * 0.62, w, u * 0.42);
      g.fillStyle = night ? '#3a3d48' : wx.tread; g.fillRect(0, y - u * 0.2, w, u * 0.24);
      for (let c = c0; c <= c1; c++) {
        const i = ((c % C) + C) % C, k = ring.kind[i], x = X(c), sec = ring.secs[this.secOf[i]];
        if (k === K.gap) { this.gapCol(g, x, y, u, sec, r, wx); continue; }
        // their seat back
        const seatC = k === K.vip ? wx.vip : k === K.away ? wx.away : wx.seat[this.secOf[i] % 2];
        g.fillStyle = shade(seatC, -0.05); ROUND(g, x - u * 0.3, y - u * 0.5, u * 0.6, u * 0.42, u * 0.08); g.fill();
        g.fillStyle = shade(seatC, 0.12); g.fillRect(x - u * 0.26, y - u * 0.47, u * 0.52, u * 0.05);
      }
      for (let c = c0; c <= c1; c++) {
        const i = ((c % C) + C) % C, kk = i * rows + r;
        if (ring.kind[i] === K.gap || !crowd.occ[kk]) continue;
        const L = crowd.atlas.looks[crowd.look[kk]];
        const m = this.mood(sim, i, r, kk, crowd, now, panDir);
        const x = X(c) + Math.sin(now * 0.7 + crowd.h[kk] * 40) * u * 0.02;
        if (ring.kind[i] === K.kiss && r === 0) { this.couple(g, x, y, u, L, m, now, kissT); continue; }
        fan(g, x, y, u, L, m, now);
      }
    }
    // the ribbon boards along the bottom, lit if a wave is passing under the shot
    const bh = U * 0.2;
    g.fillStyle = '#121418'; g.fillRect(0, h - bh, w, bh);
    for (let c = c0; c <= c1; c++) {
      const i = ((c % C) + C) % C, col = crowd.col[i], x = X(c);
      g.fillStyle = col || ['#5a2216', '#54460f', '#173a55', '#461830'][((i / 9) | 0) & 3];
      g.globalAlpha = col ? clamp(crowd.glow[i], 0.3, 1) : 0.8;
      g.fillRect(x - U / 2 + 1, h - bh * 0.78, U - 2, bh * 0.56);
    }
    g.globalAlpha = 1;
    if (wx.rain) {
      g.strokeStyle = 'rgba(220,230,245,0.35)'; g.lineWidth = Math.max(1, U * 0.012); g.beginPath();
      for (let j = 0; j < 40; j++) { const x = ((j * 97.3 + now * 90) % (w + 40)) - 20, y = ((j * 53.1 + now * 620) % (h + 60)) - 30; g.moveTo(x, y); g.lineTo(x - U * 0.04, y + U * 0.22); }
      g.stroke();
    }
    // the broadcast look: a little vignette
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
  }

  // what this one person is doing right now
  mood(sim, i, r, kk, crowd, now, panDir) {
    const k = sim.kind[i], st = sim.st[i], ph = crowd.h[kk] * 10;
    const framed = sim.cam.onAir && sim.framed(i);
    let lift = 0;
    if (st === UP && crowd.h[kk] < sim.amp[i] * (sim.fill[i] > 0.3 ? 1 : 1.2)) lift = Sim.liftAt(Math.max(0, sim.t[i] - r * LAG));
    const m = { lift, pose: 'rest', eyes: 0, mouth: 'flat', brows: 0, blink: ((now * 0.6 + ph) % 4) < 0.08, ph, tilt: 0, item: null, sweat: false, zz: false };
    // idle life: a smile here, a glance there
    m.eyes = Math.sin(now * 0.5 + ph * 3) * 0.6;
    if (((now * 0.25 + ph) % 3) < 1) m.mouth = 'smile';
    if (k === K.bocata) { m.item = 'bocata'; m.pose = 'eat'; }
    if (k === K.ultra) { m.pose = 'fist'; m.mouth = 'open'; m.brows = -1; }
    if (k === K.old) { m.pose = 'cross'; m.mouth = 'flat'; }
    if (k === K.vip) { m.pose = 'tie'; m.mouth = 'flat'; }
    if (k === K.away) { m.pose = 'cross'; m.mouth = 'frown'; m.brows = -1; }
    if (k === K.sleep && sim.woke[i] <= 0) { m.pose = 'sleep'; m.tilt = 0.35 * (ph % 2 < 1 ? 1 : -1); m.mouth = 'o'; m.eyesShut = true; m.zz = true; return m; }
    if (framed) {
      m.eyes = panDir * 0.9;
      if (k === K.away) { if (sim.seen[i] > 0.2) { m.pose = 'thumbs'; m.mouth = 'boo'; m.brows = -1; } return m; }
      if (st === REST && sim.seen[i] > 0) { m.pose = sim.seen[i] > sim.notice[i] * 0.45 ? 'point' : m.pose; m.mouth = 'o'; m.brows = 1; m.eyes = 0; }
      if (st === TIRED) { m.pose = 'slump'; m.mouth = 'flat'; m.sweat = true; m.brows = 0.5; }
    }
    if (lift > 0.05) {
      m.pose = k === K.vip ? 'polite' : k === K.ultra ? 'scarf' : k === K.bocata ? 'bocataUp' : 'up';
      m.mouth = k === K.vip ? 'smile' : 'grin'; m.brows = 1;
      m.wave = framed ? Math.sin(now * 9 + ph) : Math.sin(now * 6 + ph) * 0.4;
      m.lean = framed ? panDir * 0.6 : sim.dir[i] * 0.3;
      m.eyes = framed ? 0 : sim.dir[i];
    }
    return m;
  }

  gapCol(g, x, y, u, sec, r, wx) {
    if (sec.n <= 1) {
      // stairs, with the yellow nosing
      g.fillStyle = shade(wx.tread, 0.1); g.fillRect(x - u * 0.5, y - u * 0.62, u, u * 0.62);
      g.fillStyle = '#e8c547'; g.fillRect(x - u * 0.5, y - u * 0.2, u, u * 0.04);
    } else if (sec.n <= 3) {
      // the segregation fence round the away end
      g.strokeStyle = 'rgba(160,190,170,0.55)'; g.lineWidth = Math.max(1, u * 0.02);
      g.beginPath();
      for (let a = -0.5; a < 0.5; a += 0.12) { g.moveTo(x + a * u, y - u * 0.62); g.lineTo(x + (a + 0.3) * u, y); g.moveTo(x + (a + 0.3) * u, y - u * 0.62); g.lineTo(x + a * u, y); }
      g.stroke();
    } else {
      // the press box glass
      g.fillStyle = r ? '#1d2a36' : shade(wx.wall, -0.1); g.fillRect(x - u * 0.5 - 1, y - u * 0.62, u + 2, u * 0.62);
      if (r) { g.fillStyle = 'rgba(180,215,240,0.12)'; g.beginPath(); g.moveTo(x - u * 0.2, y - u * 0.62); g.lineTo(x + u * 0.05, y - u * 0.62); g.lineTo(x - u * 0.25, y); g.lineTo(x - u * 0.5, y); g.fill(); }
    }
  }

  couple(g, x, y, u, L, m, now, kissT) {
    const k = kissT > 0 ? Math.min(1, kissT * 3) : 0;
    const a = { ...m, lean: 0.9 * k, eyes: k ? 1 : m.eyes, mouth: k ? 'kiss' : 'smile', eyesShut: k > 0.5, pose: k ? 'hug' : 'rest' };
    const b = { ...m, lean: -0.9 * k, eyes: k ? -1 : m.eyes, mouth: k ? 'kiss' : 'smile', eyesShut: k > 0.5, pose: k ? 'hug' : 'rest', ph: m.ph + 3 };
    fan(g, x - u * 0.22 + k * u * 0.06, y, u * 0.86, { ...L, shirt: '#e85d8a', hair: '#3a2418', style: 2 }, a, now);
    fan(g, x + u * 0.22 - k * u * 0.06, y, u * 0.86, { ...L, shirt: HOME, hair: '#1f1a17', style: 0 }, b, now);
    if (k) {
      // the heart floats up between them
      const hy = y - u * (1.05 + ((now * 0.8) % 1) * 0.3), s = u * 0.12;
      g.fillStyle = '#ff4f7b'; g.beginPath(); g.moveTo(x, hy + s * 0.9);
      g.bezierCurveTo(x - s * 1.6, hy - s * 0.2, x - s * 0.6, hy - s * 1.3, x, hy - s * 0.4);
      g.bezierCurveTo(x + s * 0.6, hy - s * 1.3, x + s * 1.6, hy - s * 0.2, x, hy + s * 0.9); g.fill();
    }
  }
}

// one fan from the waist up, y at the seat, u = one seat wide
export function fan(g, x, y, u, L, m, now) {
  const kid = L.kid ? 0.84 : 1, fat = L.fat ? 1.13 : 1;
  const hip = y - m.lift * 0.44 * u - u * 0.02;
  const tw = 0.27 * u * fat * kid, th = 0.42 * u * kid, sh = hip - th;
  const hr = 0.145 * u * (L.kid ? 1.12 : 1);
  const lean = (m.lean || 0) * u * 0.09;
  const hx = x + lean + Math.sin(m.tilt) * hr * 0.9, hy = sh - hr * 0.92 + Math.abs(Math.sin(m.tilt)) * hr * 0.3;
  const skin = L.skin, shirt = L.acc === 'poncho' ? L.shirt : L.shirt, sleeve = L.acc === 'bare' ? skin : shirt;
  const lw = Math.max(1.5, u * 0.085);
  const arm = (s, e, hnd, c = sleeve) => {
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = lw; g.strokeStyle = c;
    g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(e[0], e[1]); g.lineTo(hnd[0], hnd[1]); g.stroke();
    g.strokeStyle = skin; g.lineWidth = lw * 0.92;
    g.beginPath(); g.moveTo(e[0] + (hnd[0] - e[0]) * 0.45, e[1] + (hnd[1] - e[1]) * 0.45); g.lineTo(hnd[0], hnd[1]); g.stroke();
    g.fillStyle = skin; g.beginPath(); g.arc(hnd[0], hnd[1], lw * 0.72, 0, TAU); g.fill();
  };
  const sL = [x - tw * 0.86 + lean * 0.5, sh + u * 0.05], sR = [x + tw * 0.86 + lean * 0.5, sh + u * 0.05];
  // pose → elbows and hands
  let aL, aR, behind = false;
  const wv = (m.wave || 0) * u * 0.07, ln = (m.lean || 0) * u * 0.08;
  switch (m.pose) {
    case 'up': case 'scarf': case 'bocataUp':
      aL = [[sL[0] - u * 0.14 + ln, sL[1] - u * 0.2], [sL[0] - u * 0.1 + wv + ln * 2, sL[1] - u * 0.44]];
      aR = [[sR[0] + u * 0.14 + ln, sR[1] - u * 0.2], [sR[0] + u * 0.1 + wv + ln * 2, sR[1] - u * 0.44]];
      if (m.pose === 'scarf') { aL[1][0] = sL[0] - u * 0.18 + wv; aR[1][0] = sR[0] + u * 0.18 + wv; }
      behind = false; break;
    case 'polite':
      aL = [[sL[0] - u * 0.02, sL[1] + u * 0.14], [x - u * 0.02, sh + u * 0.1]];
      aR = [[sR[0] + u * 0.14, sR[1] - u * 0.02], [sR[0] + u * 0.12 + wv * 0.6, sR[1] - u * 0.24]]; break;
    case 'point':
      aL = [[sL[0] - u * 0.04, sL[1] + u * 0.16], [x - u * 0.06, hip - u * 0.04]];
      aR = [[sR[0] + u * 0.12, sR[1] + u * 0.02], [sR[0] + u * 0.1, sR[1] - u * 0.22]]; break;
    case 'thumbs':
      aL = [[sL[0] - u * 0.1, sL[1] + u * 0.12], [sL[0] - u * 0.04, sL[1] + u * 0.06]];
      aR = [[sR[0] + u * 0.1, sR[1] + u * 0.12], [sR[0] + u * 0.04, sR[1] + u * 0.06]]; break;
    case 'cross': case 'tie': case 'sleep':
      aL = [[sL[0] - u * 0.03, sL[1] + u * 0.2], [x + u * 0.12, sh + u * 0.26]];
      aR = [[sR[0] + u * 0.03, sR[1] + u * 0.2], [x - u * 0.12, sh + u * 0.29]];
      if (m.pose === 'tie') aR = [[sR[0] + u * 0.02, sR[1] + u * 0.2], [x + u * 0.03, sh + u * 0.06]]; break;
    case 'fist': {
      const pump = Math.max(0, Math.sin(now * 5 + m.ph)) * u * 0.12;
      aL = [[sL[0] - u * 0.04, sL[1] + u * 0.18], [x - u * 0.1, hip - u * 0.04]];
      aR = [[sR[0] + u * 0.14, sR[1] - u * 0.02 - pump * 0.5], [sR[0] + u * 0.08, sR[1] - u * 0.16 - pump]]; break;
    }
    case 'eat':
      aL = [[sL[0] - u * 0.02, sL[1] + u * 0.18], [x - u * 0.08, hip - u * 0.04]];
      aR = [[sR[0] + u * 0.06, sR[1] + u * 0.16], [hx + u * 0.08, hy + hr * 0.7]]; break;
    case 'slump':
      aL = [[sL[0] - u * 0.02, sL[1] + u * 0.2], [x - u * 0.14, hip]];
      aR = [[sR[0] + u * 0.02, sR[1] + u * 0.2], [x + u * 0.14, hip]]; break;
    case 'hug':
      aL = [[sL[0] - u * 0.02, sL[1] + u * 0.16], [x + u * 0.24 * Math.sign(m.lean || 1), sh + u * 0.1]];
      aR = [[sR[0] + u * 0.02, sR[1] + u * 0.16], [x + u * 0.28 * Math.sign(m.lean || 1), sh + u * 0.06]]; break;
    default:
      aL = [[sL[0] - u * 0.04, sL[1] + u * 0.2], [x - u * 0.1, hip - u * 0.02]];
      aR = [[sR[0] + u * 0.04, sR[1] + u * 0.2], [x + u * 0.1, hip - u * 0.02]];
  }
  // long hair hangs behind
  if (L.style === 2 && m.pose !== 'sleep') { g.fillStyle = L.hair; ROUND(g, hx - hr * 1.05, hy - hr * 0.4, hr * 2.1, hr * 2.2, hr * 0.8); g.fill(); }
  // torso
  g.fillStyle = shirt;
  g.beginPath();
  g.moveTo(x - tw + lean * 0.5, sh + u * 0.02); g.quadraticCurveTo(x + lean * 0.5, sh - u * 0.03, x + tw + lean * 0.5, sh + u * 0.02);
  g.lineTo(x + tw * 0.92, hip + u * 0.2); g.lineTo(x - tw * 0.92, hip + u * 0.2); g.closePath(); g.fill();
  if (L.acc === 'stripes') { g.fillStyle = L.trim; for (const f of [-0.55, 0, 0.55]) g.fillRect(x + f * tw - u * 0.03 + lean * 0.4, sh + u * 0.02, u * 0.06, th + u * 0.2); }
  if (L.acc === 'bare') { g.fillStyle = skin; g.fillRect(x - tw * 0.8 + lean * 0.5, sh + u * 0.03, tw * 1.6, th + u * 0.2); g.fillStyle = shade(skin, -0.15); g.fillRect(x - u * 0.004, sh + u * 0.12, u * 0.01, th * 0.6); }
  if (L.acc === 'tie') {
    g.fillStyle = '#f4f4f4'; g.beginPath(); g.moveTo(x - u * 0.07 + lean * 0.5, sh + u * 0.01); g.lineTo(x + u * 0.07 + lean * 0.5, sh + u * 0.01); g.lineTo(x + lean * 0.5, sh + u * 0.16); g.fill();
    g.fillStyle = '#b3243a'; g.beginPath(); g.moveTo(x - u * 0.022 + lean * 0.5, sh + u * 0.03); g.lineTo(x + u * 0.022 + lean * 0.5, sh + u * 0.03); g.lineTo(x + u * 0.03 + lean * 0.5, sh + u * 0.2); g.lineTo(x + lean * 0.5, sh + u * 0.24); g.lineTo(x - u * 0.03 + lean * 0.5, sh + u * 0.2); g.fill();
  }
  if (L.acc === 'poncho') { g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(x - tw * 1.05, hip + u * 0.2); g.lineTo(hx, sh - u * 0.02); g.lineTo(x - tw * 0.3, hip + u * 0.2); g.fill(); }
  // arms in front of the body
  arm(sL, aL[0], aL[1]); arm(sR, aR[0], aR[1]);
  // what they hold
  if (m.pose === 'scarf') { const [a, b] = [aL[1], aR[1]]; g.fillStyle = L.trim || HOME; g.fillRect(a[0], Math.min(a[1], b[1]) - u * 0.05, b[0] - a[0], u * 0.1); g.fillStyle = '#fff'; g.fillRect(a[0] + (b[0] - a[0]) * 0.3, Math.min(a[1], b[1]) - u * 0.05, (b[0] - a[0]) * 0.12, u * 0.1); g.fillRect(a[0] + (b[0] - a[0]) * 0.6, Math.min(a[1], b[1]) - u * 0.05, (b[0] - a[0]) * 0.12, u * 0.1); }
  if (m.item === 'bocata') { const hp = aR[1]; g.save(); g.translate(hp[0], hp[1] - u * 0.03); g.rotate(m.pose === 'bocataUp' ? -0.3 : -0.8); g.fillStyle = '#e0ad62'; ROUND(g, -u * 0.16, -u * 0.05, u * 0.32, u * 0.1, u * 0.05); g.fill(); g.fillStyle = '#b8472f'; g.fillRect(-u * 0.14, -u * 0.005, u * 0.28, u * 0.025); g.fillStyle = '#6ea84a'; g.fillRect(-u * 0.13, u * 0.018, u * 0.26, u * 0.012); g.restore(); }
  if (m.pose === 'thumbs') { g.strokeStyle = skin; g.lineWidth = lw * 0.6; for (const hp of [aL[1], aR[1]]) { g.beginPath(); g.moveTo(hp[0], hp[1]); g.lineTo(hp[0], hp[1] + u * 0.08); g.stroke(); } }
  if (m.pose === 'point') { const hp = aR[1]; g.strokeStyle = skin; g.lineWidth = lw * 0.5; g.beginPath(); g.moveTo(hp[0], hp[1]); g.lineTo(hp[0] - u * 0.02, hp[1] - u * 0.09); g.stroke(); }
  // scarf round the neck
  if (L.acc === 'scarf') { g.fillStyle = L.trim || HOME2; ROUND(g, x - tw * 0.72 + lean * 0.5, sh - u * 0.02, tw * 1.44, u * 0.075, u * 0.03); g.fill(); g.fillRect(x + tw * 0.25 + lean * 0.5, sh, u * 0.07, u * 0.2); }
  // neck and head
  g.fillStyle = shade(skin, -0.12); g.fillRect(hx - hr * 0.35, hy + hr * 0.6, hr * 0.7, hr * 0.6);
  g.fillStyle = skin; g.beginPath(); g.ellipse(hx, hy, hr * 0.92, hr, m.tilt, 0, TAU); g.fill();
  // ears
  g.beginPath(); g.arc(hx - hr * 0.9, hy + hr * 0.05, hr * 0.2, 0, TAU); g.arc(hx + hr * 0.9, hy + hr * 0.05, hr * 0.2, 0, TAU); g.fill();
  hair(g, hx, hy, hr, L, m);
  face(g, hx, hy, hr, m, L);
  if (m.sweat) { g.fillStyle = '#9fd4ff'; g.beginPath(); g.moveTo(hx + hr * 0.95, hy - hr * 0.5); g.quadraticCurveTo(hx + hr * 1.2, hy - hr * 0.1, hx + hr * 0.95, hy - hr * 0.05); g.quadraticCurveTo(hx + hr * 0.75, hy - hr * 0.15, hx + hr * 0.95, hy - hr * 0.5); g.fill(); }
  if (m.zz) {
    g.fillStyle = '#e9f1ff'; g.font = `900 ${Math.round(hr * 1.1)}px "Barlow Semi Condensed", sans-serif`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const p = (now * 0.6 + m.ph) % 1;
    g.globalAlpha = Math.sin(p * Math.PI); g.fillText('z', hx + hr * (0.9 + p * 0.8), hy - hr * (1 + p * 1.6)); g.globalAlpha = 1;
  }
}

function hair(g, hx, hy, hr, L, m) {
  const c = L.hair, st = L.style;
  g.fillStyle = c;
  if (L.acc === 'flat') { g.fillStyle = '#6e604d'; g.beginPath(); g.ellipse(hx, hy - hr * 0.62, hr * 1.12, hr * 0.42, m.tilt, Math.PI, 0); g.fill(); g.fillRect(hx - hr * 1.2, hy - hr * 0.66, hr * 2.4, hr * 0.16); return; }
  if (L.acc === 'cap') { g.fillStyle = L.trim || HOME; g.beginPath(); g.arc(hx, hy - hr * 0.2, hr * 1.02, Math.PI, 0); g.fill(); g.fillRect(hx - hr * 1.02, hy - hr * 0.3, hr * 2.2, hr * 0.2); return; }
  if (L.acc === 'poncho') { g.fillStyle = mix(L.shirt, '#ffffff', 0.2); g.beginPath(); g.arc(hx, hy, hr * 1.22, Math.PI * 0.92, Math.PI * 2.08); g.lineTo(hx + hr * 1.1, hy + hr * 0.4); g.lineTo(hx + hr * 0.95, hy - hr * 0.1); g.arc(hx, hy + hr * 0.05, hr * 0.98, -0.1, Math.PI + 0.1, true); g.lineTo(hx - hr * 1.1, hy + hr * 0.4); g.closePath(); g.fill(); return; }
  if (L.acc === 'bald' || st === 3) { g.beginPath(); g.arc(hx - hr * 0.8, hy - hr * 0.1, hr * 0.28, 0, TAU); g.arc(hx + hr * 0.8, hy - hr * 0.1, hr * 0.28, 0, TAU); g.fill(); return; }
  if (st === 4) { for (let j = 0; j < 7; j++) { const a = Math.PI * (1.05 + j * 0.15); g.beginPath(); g.arc(hx + Math.cos(a) * hr * 0.85, hy + Math.sin(a) * hr * 0.85, hr * 0.34, 0, TAU); g.fill(); } return; }
  g.beginPath(); g.arc(hx, hy - hr * 0.08, hr * 1.02, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill();
  if (st === 1) { g.beginPath(); g.moveTo(hx - hr * 0.9, hy - hr * 0.3); g.quadraticCurveTo(hx - hr * 0.2, hy - hr * 0.2, hx + hr * 0.3, hy - hr * 0.75); g.lineTo(hx - hr * 0.6, hy - hr * 0.9); g.fill(); }
  if (st === 5) { g.beginPath(); g.arc(hx, hy - hr * 1.12, hr * 0.36, 0, TAU); g.fill(); }
  if (st === 2) { g.fillRect(hx - hr * 1.02, hy - hr * 0.35, hr * 0.28, hr * 1.1); g.fillRect(hx + hr * 0.74, hy - hr * 0.35, hr * 0.28, hr * 1.1); }
}

function face(g, hx, hy, hr, m, L) {
  const ex = m.eyes * hr * 0.12, dark = '#2a1a14';
  const eyeY = hy + hr * 0.02, gap = hr * 0.36;
  g.fillStyle = dark; g.strokeStyle = dark; g.lineCap = 'round';
  if (m.eyesShut || m.blink) {
    g.lineWidth = Math.max(1, hr * 0.1);
    g.beginPath(); g.arc(hx - gap, eyeY, hr * 0.13, 0.2, Math.PI - 0.2); g.moveTo(hx + gap + hr * 0.13, eyeY); g.arc(hx + gap, eyeY, hr * 0.13, 0.2, Math.PI - 0.2); g.stroke();
  } else {
    const er = Math.max(0.9, hr * (m.brows > 0 ? 0.13 : 0.11));
    g.beginPath(); g.arc(hx - gap + ex, eyeY, er, 0, TAU); g.arc(hx + gap + ex, eyeY, er, 0, TAU); g.fill();
    if (hr > 7) { g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(hx - gap + ex + er * 0.35, eyeY - er * 0.35, er * 0.35, 0, TAU); g.arc(hx + gap + ex + er * 0.35, eyeY - er * 0.35, er * 0.35, 0, TAU); g.fill(); g.fillStyle = dark; }
  }
  // brows
  if (hr > 4) {
    g.lineWidth = Math.max(1, hr * 0.09); g.strokeStyle = L.acc === 'bald' ? shade(L.skin, -0.4) : shade(L.hair, -0.1);
    const by = eyeY - hr * (m.brows > 0 ? 0.42 : 0.3), tilt = m.brows < 0 ? hr * 0.12 : m.brows > 0.4 && m.brows < 1 ? -hr * 0.1 : 0;
    g.beginPath(); g.moveTo(hx - gap - hr * 0.18, by - tilt); g.lineTo(hx - gap + hr * 0.16, by + tilt); g.moveTo(hx + gap - hr * 0.16, by + tilt); g.lineTo(hx + gap + hr * 0.18, by - tilt); g.stroke();
  }
  // cheeks when they're thrilled
  if (m.mouth === 'grin' && hr > 5) { g.fillStyle = 'rgba(255,90,90,0.22)'; g.beginPath(); g.arc(hx - hr * 0.55, hy + hr * 0.35, hr * 0.2, 0, TAU); g.arc(hx + hr * 0.55, hy + hr * 0.35, hr * 0.2, 0, TAU); g.fill(); }
  const my = hy + hr * 0.5;
  g.fillStyle = dark; g.strokeStyle = dark; g.lineWidth = Math.max(1, hr * 0.1);
  switch (m.mouth) {
    case 'grin': g.beginPath(); g.moveTo(hx - hr * 0.34, my - hr * 0.08); g.quadraticCurveTo(hx, my - hr * 0.02, hx + hr * 0.34, my - hr * 0.08); g.quadraticCurveTo(hx, my + hr * 0.5, hx - hr * 0.34, my - hr * 0.08); g.fill(); if (hr > 6) { g.fillStyle = '#d65a5a'; g.beginPath(); g.ellipse(hx, my + hr * 0.16, hr * 0.14, hr * 0.07, 0, 0, TAU); g.fill(); } break;
    case 'open': g.beginPath(); g.ellipse(hx, my, hr * 0.2, hr * 0.17, 0, 0, TAU); g.fill(); break;
    case 'o': g.beginPath(); g.ellipse(hx, my + hr * 0.02, hr * 0.1, hr * 0.13, 0, 0, TAU); g.fill(); break;
    case 'boo': g.beginPath(); g.ellipse(hx, my + hr * 0.04, hr * 0.17, hr * 0.2, 0, 0, TAU); g.fill(); break;
    case 'kiss': g.fillStyle = '#c2455a'; g.beginPath(); g.arc(hx + (m.lean > 0 ? 1 : -1) * hr * 0.25, my - hr * 0.04, hr * 0.1, 0, TAU); g.fill(); break;
    case 'smile': g.beginPath(); g.arc(hx, my - hr * 0.2, hr * 0.26, 0.5, Math.PI - 0.5); g.stroke(); break;
    case 'frown': g.beginPath(); g.arc(hx, my + hr * 0.18, hr * 0.22, Math.PI + 0.6, -0.6); g.stroke(); break;
    default: g.beginPath(); g.moveTo(hx - hr * 0.18, my); g.lineTo(hx + hr * 0.18, my); g.stroke();
  }
}
