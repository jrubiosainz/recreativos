// Everything that stays put: the view across the tracks (a painted backdrop per station) and our platform,
// with its tactile strip and the painted queue lanes either side of the door. Both are cached per layout.
import { TAU, clamp, lerp, shade, rgba, mulberry32 } from './util.js';
import { DOOR_W } from './cam.js';
import { LINE } from './car.js';

const HALF = DOOR_W / 2;

// per-station light and weather
export const MOODS = {
  s1: { floor: '#cbc5bb', sky: ['#ffd9b8', '#fff1df'], tint: 'rgba(255,196,140,0.10)', light: '#fff4e3' },
  s2: { floor: '#c3c7c9', sky: ['#dfe6ea', '#f3f5f5'], tint: 'rgba(225,235,240,0.10)', fog: 0.3, light: '#f4f7f8' },
  s3: { floor: '#9ea5ab', sky: ['#9fb0bf', '#c9d3db'], tint: 'rgba(90,110,140,0.12)', wet: 1, rain: 1, light: '#e4ebf1' },
  s4: { floor: '#d0c7c2', sky: ['#ffd6e2', '#fff3f5'], tint: 'rgba(255,190,210,0.08)', petals: 1, light: '#fff3f5' },
  s5: { floor: '#c9c0b3', sky: ['#bfe0f2', '#eef7fb'], tint: 'rgba(255,230,190,0.06)', light: '#fbf6ee' },
  s6: { floor: '#bebebe', sky: ['#c8ccd2', '#e7e8ea'], tint: 'rgba(120,120,140,0.08)', light: '#f2f2f2' },
  s7: { floor: '#c5c8cd', sky: ['#cfe3f5', '#f1f6fb'], tint: 'rgba(200,220,255,0.06)', light: '#f5f8fc' },
  s8: { floor: '#b8bbc3', sky: ['#9fc2e8', '#e2eefa'], tint: 'rgba(255,220,160,0.08)', light: '#fff8ea' },
};

export class Stage {
  constructor(level, image) {
    this.L = level;
    this.img = image || null;
    this.mood = MOODS[level.id] || MOODS.s1;
    this.bg = null; this.floor = null; this.key = '';
  }

  // where the backdrop image goes: its horizon (vertical centre) on the eye line, covering the view
  imageRect(cam) {
    const im = this.img;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    const needH = 2 * Math.max(cam.eyeY + 20, cam.Y(0, 0) - cam.eyeY + 20);
    const sc = Math.max(cam.W / iw, needH / ih);
    const w = iw * sc, h = ih * sc;
    return { x: (cam.W - w) / 2, y: cam.eyeY - h / 2, w, h };
  }

  build(cam, dpr) {
    const key = `${cam.W}x${cam.H}@${dpr}:${cam.S.toFixed(2)}:${cam.eyeY.toFixed(1)}`;
    if (key === this.key) return;
    this.key = key;
    const mk = () => { const c = document.createElement('canvas'); c.width = Math.ceil(cam.W * dpr); c.height = Math.ceil(cam.H * dpr); const g = c.getContext('2d'); g.scale(dpr, dpr); return [c, g]; };
    const [bc, bg] = mk();
    this.paintBackdrop(bg, cam);
    this.bg = bc;
    const [fc, fg] = mk();
    this.paintFloor(fg, cam);
    this.floor = fc;
  }

  paintBackdrop(g, cam) {
    const m = this.mood;
    const edgeY = cam.Y(0, 0);
    if (this.img) {
      const r = this.imageRect(cam);
      g.drawImage(this.img, r.x, r.y, r.w, r.h);
    } else {
      // painted stand-in: sky, the far platform and its canopy
      const gr = g.createLinearGradient(0, 0, 0, edgeY);
      gr.addColorStop(0, m.sky[0]); gr.addColorStop(0.6, m.sky[1]); gr.addColorStop(1, shade(m.floor, -0.35));
      g.fillStyle = gr; g.fillRect(0, 0, cam.W, edgeY + 2);
      const z = -4.6;
      g.fillStyle = shade(m.floor, -0.1); g.fillRect(0, cam.Y(0, z), cam.W, cam.Y(-1.1, z) - cam.Y(0, z));
      g.fillStyle = shade(m.floor, -0.45); g.fillRect(0, cam.Y(-1.1, z), cam.W, edgeY - cam.Y(-1.1, z));
      g.fillStyle = shade(m.sky[0], -0.35); g.fillRect(0, cam.Y(3.6, z) - 4, cam.W, 8 + cam.S * 0.08);
      for (let x = -12; x <= 12; x += 3.6) { const X = cam.X(x, z); g.fillRect(X - 3, cam.Y(3.6, z), 6 + cam.S * 0.03, cam.Y(0, z) - cam.Y(3.6, z)); }
    }
    if (m.fog) {
      // morning mist over the tracks, thickest at the horizon
      const fg = g.createLinearGradient(0, 0, 0, edgeY);
      fg.addColorStop(0, `rgba(240,244,246,${m.fog * 0.5})`); fg.addColorStop(0.55, `rgba(240,244,246,${m.fog})`); fg.addColorStop(1, `rgba(240,244,246,${m.fog * 0.6})`);
      g.fillStyle = fg; g.fillRect(0, 0, cam.W, edgeY);
    }
    if (m.tint) { g.fillStyle = m.tint; g.fillRect(0, 0, cam.W, cam.H); }
  }

  paintFloor(g, cam) {
    const m = this.mood;
    const y0 = cam.Y(0, 0), H = cam.H, W = cam.W;
    const zMax = Math.max(0.3, cam.floorZ(H + 4));
    const zLim = Math.min(zMax, cam.D - 0.25);
    const fy = (z) => cam.Y(0, z), fx = (x, z) => cam.X(x, z);
    // concrete, lit from the canopy
    const gr = g.createLinearGradient(0, y0, 0, H);
    gr.addColorStop(0, shade(m.floor, 0.12)); gr.addColorStop(0.35, m.floor); gr.addColorStop(1, shade(m.floor, -0.16));
    this.bottom = shade(m.floor, -0.16);
    g.fillStyle = gr; g.fillRect(0, y0, W, H - y0);
    // speckle so it reads as concrete, not paint
    const r = mulberry32(7);
    for (let i = 0; i < 900; i++) {
      const z = 0.05 + r() * (zLim - 0.05), x = cam.edge(-1, z) + r() * (cam.edge(1, z) - cam.edge(-1, z));
      const s = cam.s(z) * 0.006 * (0.5 + r());
      g.fillStyle = r() < 0.5 ? rgba('#ffffff', 0.18) : rgba('#3a3530', 0.12);
      g.fillRect(fx(x, z), fy(z), s * 2, s);
    }
    // tile seams parallel to the car, and converging ones toward the vanishing point
    g.strokeStyle = rgba(shade(m.floor, -0.3), 0.35); g.lineWidth = 1;
    g.beginPath();
    for (let z = 0.3; z < zLim; z += 0.3) { const Y = fy(z); g.moveTo(0, Y); g.lineTo(W, Y); }
    for (let x = -12; x <= 12; x += 0.6) { g.moveTo(fx(x, 0.06), fy(0.06)); g.lineTo(fx(x, zLim), fy(zLim)); }
    g.stroke();
    // the edge: a light kerb and the drop-off shadow
    g.fillStyle = shade(m.floor, 0.3); g.fillRect(0, y0, W, fy(0.05) - y0);
    g.fillStyle = rgba('#000000', 0.25); g.fillRect(0, y0 - 1, W, 2);
    g.fillStyle = '#f4f1ea'; g.fillRect(0, fy(0.05), W, Math.max(1.5, fy(0.09) - fy(0.05)));
    // the yellow tactile strip with its dots
    const z0 = 0.82, z1 = Math.min(zLim, 1.12);
    if (z0 < zLim) {
      g.fillStyle = '#f4c21c'; g.fillRect(0, fy(z0), W, fy(z1) - fy(z0));
      g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(0, fy(z0), W, Math.max(1, (fy(z1) - fy(z0)) * 0.08));
      g.fillStyle = '#d9a90c';
      for (let z = z0 + 0.04; z < z1; z += 0.065) {
        const s = cam.s(z), Y = fy(z), rr = s * 0.014;
        for (let x = cam.edge(-1, z) - 0.05; x < cam.edge(1, z) + 0.05; x += 0.065) {
          g.beginPath(); g.ellipse(fx(x, z), Y, rr, rr * 0.45, 0, 0, TAU); g.fill();
        }
      }
    }
    // queue lanes either side of the door: painted lines, chevrons and the door number
    const lane = (side) => {
      const xa = side * (HALF + 0.12), xb = side * (HALF + 0.86);
      g.fillStyle = rgba('#ffffff', 0.9);
      for (const x of [xa, xb]) {
        const w = 0.035;
        g.beginPath();
        g.moveTo(fx(x - w, 0.14), fy(0.14)); g.lineTo(fx(x + w, 0.14), fy(0.14));
        g.lineTo(fx(x + w, zLim), fy(zLim)); g.lineTo(fx(x - w, zLim), fy(zLim)); g.closePath(); g.fill();
      }
      const xm = (xa + xb) / 2;
      g.fillStyle = LINE;
      for (let i = 0; i < 2; i++) {
        const zc = 0.24 + i * 0.16, hw = 0.2;
        g.beginPath();
        g.moveTo(fx(xm, zc - 0.07), fy(zc - 0.07)); g.lineTo(fx(xm + hw, zc + 0.05), fy(zc + 0.05)); g.lineTo(fx(xm - hw, zc + 0.05), fy(zc + 0.05)); g.closePath(); g.fill();
      }
      // "1-2": car 1 (the head car, the one that stops here), door 2, painted flat on the floor
      const zc = 0.62, s = cam.s(zc);
      g.save(); g.translate(fx(xm, zc), fy(zc)); g.scale(1, 0.34 * cam.k(zc) / cam.k(0.3));
      g.fillStyle = LINE; g.beginPath(); g.roundRect(-s * 0.2, -s * 0.12, s * 0.4, s * 0.24, s * 0.04); g.fill();
      g.fillStyle = '#ffffff'; g.font = `700 ${s * 0.17}px 'Fredoka', system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('1-2', 0, s * 0.012);
      g.restore();
    };
    lane(-1); lane(1);
    // a sheen of rain
    if (m.wet) {
      const gw = g.createLinearGradient(0, y0, 0, H);
      gw.addColorStop(0, 'rgba(210,225,240,0.28)'); gw.addColorStop(0.5, 'rgba(210,225,240,0.08)'); gw.addColorStop(1, 'rgba(40,60,90,0.12)');
      g.fillStyle = gw; g.fillRect(0, y0, W, H - y0);
      const r2 = mulberry32(3);
      for (let i = 0; i < 9; i++) {
        const z = 0.3 + r2() * (zLim - 0.3), x = cam.edge(-1, z) * 0.9 + r2() * (cam.edge(1, z) - cam.edge(-1, z)) * 0.9;
        const s = cam.s(z) * (0.25 + r2() * 0.35);
        g.fillStyle = 'rgba(190,210,232,0.35)'; g.beginPath(); g.ellipse(fx(x, z), fy(z), s, s * 0.12, 0, 0, TAU); g.fill();
      }
    }
    if (m.petals) {
      const r3 = mulberry32(11);
      for (let i = 0; i < 70; i++) {
        const z = 0.1 + r3() * (zLim - 0.1), x = cam.edge(-1, z) + r3() * (cam.edge(1, z) - cam.edge(-1, z));
        const s = cam.s(z) * 0.012;
        g.fillStyle = r3() < 0.5 ? '#ffc6d9' : '#ffe0ea';
        g.beginPath(); g.ellipse(fx(x, z), fy(z), s * 1.4, s * 0.6, r3() * TAU, 0, TAU); g.fill();
      }
    }
  }

  drawBackdrop(g, cam) { if (this.bg) g.drawImage(this.bg, 0, 0, cam.W, cam.H); }
  drawFloor(g, cam) { if (this.floor) g.drawImage(this.floor, 0, 0, cam.W, cam.H); }
}
