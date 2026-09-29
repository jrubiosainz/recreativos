// Room + perspective: places the audience in the background image, draws desks, chairs,
// the projector beam, the wall clock, lights and depth fog.
import { clamp, lerp, mix, shade, rgba, roundRect, ellipse, noise1 } from './util.js';
import { SEAT_W } from './sim.js';

// image-space facts about every generated background (fractions of the image height)
export const ROOMS = {
  room_small: { base: 0.61, clock: [[0.5, 0.2], [0.31, 0.47], [0.69, 0.47], [0.47, 0.42]], clockR: 0.042, fog: '#7c8390', desk: '#8a6b52', light: '#fff6e0', dark: 0.0, chair: '#3a3f4a', fogK: 0.16 },
  room_evening: { base: 0.61, clock: [[0.5, 0.2], [0.31, 0.47], [0.69, 0.47], [0.47, 0.42]], clockR: 0.042, fog: '#9a7d74', desk: '#8a6450', light: '#ffc58a', dark: 0.05, warm: 1, chair: '#3d3540', fogK: 0.2 },
  room_training: { base: 0.62, clock: [[0.5, 0.29], [0.19, 0.5], [0.19, 0.42], [0.8, 0.3]], clockR: 0.04, fog: '#7f8a98', desk: '#a8adb4', deskTop: '#c7ccd2', light: '#f4f8ff', dark: 0.0, chair: '#2f3b52', fogK: 0.2 },
  room_auditorium: { base: 0.5, clock: [[0.5, 0.27], [0.33, 0.3], [0.67, 0.3], [0.21, 0.3]], clockR: 0.04, fog: '#6d5a4c', desk: '#6b4a33', light: '#ffd9a8', dark: 0.12, chair: '#7a2f36', fogK: 0.26 },
  room_keynote: { base: 0.52, clock: null, fog: '#1d1838', desk: '#2a2548', deskTop: '#3a3462', light: '#9f8cff', dark: 0.3, night: 1, chair: '#2b2848', fogK: 0.3 },
};
const IMG_AR = 1536 / 1024;

export class Stage {
  constructor(level, images) {
    this.level = level;
    this.room = ROOMS[level.room] || ROOMS.room_small;
    this.img = images[level.room] || null;
    this.baseCam = { camH: level.camH ?? 3.35, D0: level.D0 ?? 3.2, rake: level.rake ?? 0.06 };
    this.cam = { ...this.baseCam };
    this.rows = level.rows.length;
    this.W = 1; this.H = 1;
    this.t = 0;
    this.dust = Array.from({ length: 46 }, (_, i) => ({ u: Math.random(), v: Math.random(), s: 0.4 + Math.random(), p: Math.random() * 10 }));
  }

  // compute F, horizon and image placement so the audience fits the viewport
  layout(W, H, people, safe) {
    this.W = W; this.H = H;
    // portrait screens: a higher, farther camera spreads the rows vertically and keeps the back rows readable
    const port = H > W * 1.15, bc = this.baseCam;
    this.portrait = port;
    this.cam = port ? { camH: bc.camH * 2.05, D0: bc.D0 * 1.7, rake: bc.rake } : { ...bc };
    const { camH, D0, rake } = this.cam;
    const nR = this.rows;
    let maxW = 0;
    for (const p of people) maxW = Math.max(maxW, Math.abs(p.x) + SEAT_W * 0.75);
    const Db = D0 + (nR - 1) * 1.12;
    // unit-focal extents (F = 1, horizon = 0)
    const fhB = rake * (nR - 1);
    const topU = (camH - (fhB + 1.17 + 0.2)) / Db;            // back row head top
    const botU = (camH - 0.74) / (D0 - 0.55);                   // front desk front edge
    const band = safe.bottom - safe.top;
    let F = band / (botU - topU);
    const halfW = (safe.right - safe.left) / 2;
    F = Math.min(F, (halfW * D0) / Math.max(1.2, maxW + 0.1));
    F = Math.min(F, H * 1.6);
    // small rooms must not blow people up: cap the front-row head radius
    const Rmax = port ? W * 0.1 : Math.min(H * 0.056, W * 0.036);
    F = Math.min(F, (Rmax * D0) / 0.17);
    this.F = F;
    this.cx = (safe.left + safe.right) / 2;
    this.hor = safe.top - topU * F + (band - (botU - topU) * F) * 0.35;
    // background: baseboard sits on the floor line just behind the back row
    const Dw = Db + 1.25;
    const floorY = this.hor + camH * F / Dw;
    const room = this.room;
    // smallest image that covers the width and the wall; the floor below it is mirror-tiled carpet
    const ih = Math.max(W / IMG_AR, floorY / room.base);
    const top = floorY - room.base * ih;
    const iw = ih * IMG_AR;
    this.bg = { x: this.cx - iw / 2, y: top, w: iw, h: ih };
    if (this.bg.x > 0) { this.bg.x = 0; } else if (this.bg.x + iw < W) this.bg.x = W - iw;
    this.floorY = floorY;
    this.Dw = Dw;
    this.placeClock(people, safe);
  }

  // the wall clock goes on the first candidate spot that is fully visible, below the HUD
  // and clear of every head (candidates are image fractions)
  placeClock(people, safe) {
    const r = this.room;
    this.clockAt = null;
    if (!r.clock) return;
    const heads = people.map((p) => { const s = this.seat(p); return { x0: s.x - s.R * 1.6, x1: s.x + s.R * 1.6, y0: s.y - s.R * 2.9, y1: s.y }; });
    const R = r.clockR * this.bg.h, pad = R * 0.35;
    for (const [fx, fy] of r.clock) {
      const x = this.bg.x + fx * this.bg.w, y = this.bg.y + fy * this.bg.h;
      if (x - R < 6 || x + R > this.W - 6 || y - R < safe.top + 6 || y + R > this.floorY - R * 0.4) continue;
      if (heads.some((h) => x + R + pad > h.x0 && x - R - pad < h.x1 && y + R + pad > h.y0 && y - R - pad < h.y1)) continue;
      this.clockAt = { x, y, R };
      return;
    }
  }

  proj(x, h, D) { const k = this.F / D; return { x: this.cx + x * k, y: this.hor + (this.cam.camH - h) * k, k }; }

  // screen anchor for a seated person (neck base) + desk line in person units
  seat(p) {
    const fh = this.cam.rake * p.r, D = this.cam.D0 + p.z;
    const neck = this.proj(p.x, fh + 0.96, D);
    const R = 0.17 * neck.k;
    const deskBack = this.proj(p.x, fh + 0.74, D - 0.12), deskFront = this.proj(p.x, fh + 0.74, D - 0.55);
    return { x: neck.x, y: neck.y, R, D, fh, deskY: ((deskBack.y + deskFront.y) / 2 - neck.y) / R };
  }

  drawBackground(g, t, mood) {
    this.t = t;
    const { W, H } = this, r = this.room;
    if (this.img) {
      const b = this.bg, img = this.img;
      g.drawImage(img, b.x, b.y, b.w, b.h);
      let y = b.y + b.h;
      if (y < H) {
        const nw = img.naturalWidth, nh = img.naturalHeight, sh = Math.round(nh * 0.12), dh = sh * (b.h / nh);
        for (let k = 0; y < H && k < 40; k++, y += dh) {
          if (k % 2 === 0) { g.save(); g.translate(0, y + dh); g.scale(1, -1); g.drawImage(img, 0, nh - sh, nw, sh, b.x, 0, b.w, dh + 0.5); g.restore(); }
          else g.drawImage(img, 0, nh - sh, nw, sh, b.x, y - 0.5, b.w, dh + 0.5);
        }
        const y0 = b.y + b.h, gr = g.createLinearGradient(0, y0 - dh * 0.5, 0, H);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(10,12,22,${r.night ? 0.5 : 0.32})`);
        g.fillStyle = gr; g.fillRect(0, y0 - dh * 0.5, W, H - y0 + dh * 0.5);
      }
    } else { g.fillStyle = '#cfc6b8'; g.fillRect(0, 0, W, H); }
    // meeting mood: the room slowly darkens as it gets later
    const dim = clamp(r.dark + (mood.late || 0) * 0.08, 0, 0.6);
    if (dim > 0.001) { g.fillStyle = rgba('#141626', dim); g.fillRect(0, 0, W, H); }
    this.drawClock(g, mood);
  }

  drawClock(g, mood) {
    const r = this.room;
    if (!this.clockAt) return;
    const { x, y, R } = this.clockAt;
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,0.12)'; ellipse(g, R * 0.08, R * 0.1, R * 1.08, R * 1.08); g.fill();
    g.fillStyle = '#3a3f4b'; ellipse(g, 0, 0, R * 1.08, R * 1.08); g.fill();
    g.fillStyle = '#f7f3ea'; ellipse(g, 0, 0, R * 0.94, R * 0.94); g.fill();
    g.fillStyle = '#3a3f4b';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const l = i % 3 ? 0.07 : 0.14; g.save(); g.rotate(a); g.fillRect(-R * 0.025, -R * 0.86, R * 0.05, R * l); g.restore(); }
    // meeting time: minutes since start mapped from the level clock
    const mins = mood.minutes || 0, hour = mood.hour || 9;
    const mA = (mins / 60) * Math.PI * 2, hA = ((hour % 12) + mins / 60) / 12 * Math.PI * 2;
    g.strokeStyle = '#2a2d36'; g.lineCap = 'round';
    g.lineWidth = R * 0.09; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(hA) * R * 0.5, -Math.cos(hA) * R * 0.5); g.stroke();
    g.lineWidth = R * 0.06; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(mA) * R * 0.78, -Math.cos(mA) * R * 0.78); g.stroke();
    if (mood.seconds != null) {
      const sA = mood.seconds / 60 * Math.PI * 2;
      g.strokeStyle = '#c9463d'; g.lineWidth = R * 0.025; g.beginPath(); g.moveTo(-Math.sin(sA) * R * 0.15, Math.cos(sA) * R * 0.15); g.lineTo(Math.sin(sA) * R * 0.82, -Math.cos(sA) * R * 0.82); g.stroke();
    }
    g.fillStyle = '#2a2d36'; ellipse(g, 0, 0, R * 0.07, R * 0.07); g.fill();
    g.restore();
    this.clockPos = { x, y, R };
  }

  drawDesk(g, row, people, tone) {
    const r = this.room, fh = this.cam.rake * row, D = this.cam.D0 + row * 1.12;
    let minX = Infinity, maxX = -Infinity;
    for (const p of people) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); }
    const x0 = minX - SEAT_W * 0.56, x1 = maxX + SEAT_W * 0.56;
    const h = fh + 0.74;
    const a = this.proj(x0, h, D - 0.08), b = this.proj(x1, h, D - 0.08), c = this.proj(x1, h, D - 0.6), d = this.proj(x0, h, D - 0.6);
    const floor = this.proj(0, fh, D - 0.6);
    const top = mix(r.deskTop || shade(r.desk, 0.12), r.fog, tone), side = mix(r.desk, r.fog, tone), front = mix(shade(r.desk, -0.18), r.fog, tone);
    g.fillStyle = top;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath(); g.fill();
    g.fillStyle = rgba('#ffffff', 0.1); g.fillRect(d.x, d.y - 2, c.x - d.x, 2);
    const th = Math.max(3, (c.y - a.y) * 0.18);
    g.fillStyle = side; g.fillRect(d.x, d.y, c.x - d.x, th);
    g.fillStyle = front; g.fillRect(d.x + (c.x - d.x) * 0.015, d.y + th, (c.x - d.x) * 0.97, Math.max(0, floor.y - d.y - th));
    g.fillStyle = rgba('#000000', 0.12); g.fillRect(d.x + (c.x - d.x) * 0.015, d.y + th, (c.x - d.x) * 0.97, Math.max(2, th * 0.7));
    return { y: d.y };
  }

  // light from the projector at the back of the room, shining towards the screen behind the camera
  drawBeam(g, t, slideTint, on) {
    if (on <= 0.01) return;
    const { W, H } = this;
    const src = this.proj(0, this.cam.camH + 0.35, this.Dw - 0.3);
    g.save();
    g.globalCompositeOperation = 'screen';
    const grad = g.createLinearGradient(src.x, src.y, src.x, H);
    grad.addColorStop(0, rgba(slideTint, 0.18 * on)); grad.addColorStop(1, rgba(slideTint, 0.0));
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(src.x - 4, src.y); g.lineTo(src.x + 4, src.y); g.lineTo(W * 1.1, -H * 0.1); g.lineTo(-W * 0.1, -H * 0.1); g.closePath();
    g.globalAlpha = 0.9; g.fill();
    // dust motes floating in the beam
    g.fillStyle = rgba('#ffffff', 0.35 * on);
    for (const m of this.dust) {
      const k = (m.v + t * 0.012 * m.s) % 1, x = lerp(src.x, lerp(-W * 0.1, W * 1.1, m.u), k), y = lerp(src.y, -H * 0.1, k);
      const s = (0.6 + k * 2.2) * m.s * (0.6 + 0.4 * Math.sin(t * 1.3 + m.p));
      g.globalAlpha = Math.sin(k * Math.PI) * 0.8;
      ellipse(g, x + noise1(t * 0.2, m.p) * 12, y, s, s); g.fill();
    }
    g.restore();
    // the lens
    g.fillStyle = rgba('#ffffff', 0.7 * on); ellipse(g, src.x, src.y, 3.5, 2.5); g.fill();
  }

  vignette(g, k, color = '#0d0f1a') {
    const { W, H } = this;
    const grad = g.createRadialGradient(W * 0.55, H * 0.5, Math.min(W, H) * 0.35, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    grad.addColorStop(0, rgba(color, 0)); grad.addColorStop(1, rgba(color, k));
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
  }
}
