// What the film does on the screen besides the still itself: every shot effect named in the film
// scripts. Each effect may bend the camera before the still is drawn (pre) and paint over it
// afterwards (post). Particles are stateless (position = f(index, time)) so seeking, pausing and
// the title demo never desynchronise them.
import { clamp, lerp, hash, smooth, canvas } from './paint.js';

const TAU = Math.PI * 2;
// film-time noise: smooth random in [0, 1)
const n1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };

// a soft fog texture, generated once
let fogTex = null;
function fog() {
  if (fogTex) return fogTex;
  const w = 256, h = 128, c = canvas(w, h), x = c.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const cx = hash(i * 3.1) * w, cy = h * (0.3 + 0.5 * hash(i * 7.7)), r = 18 + 40 * hash(i * 1.3);
    for (const dx of [-w, 0, w]) {
      const gr = x.createRadialGradient(cx + dx, cy, 0, cx + dx, cy, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(cx + dx - r, cy - r, r * 2, r * 2);
    }
  }
  return (fogTex = c);
}

// shakes and flashes answer every explosion inside the shot, not just its first frame
function booms(F, a, b) {
  return F.cues.filter((c) => (c.k === 'boom' || c.k === 'stinger' || c.k === 'thunder' || c.k === 'bandhit') && c.t >= a - 0.01 && c.t < b).map((c) => c.t);
}
const since = (list, t) => { let s = Infinity; for (const x of list) if (x <= t) s = Math.min(s, t - x); return s; };

export const FX = {
  shake: {
    pre(C) {
      const b = [C.shot.t, ...booms(C.F, C.shot.t, C.end)], s = since(b, C.t), amp = (C.shot.big ? 0.035 : 0.022) * Math.exp(-s * 2.6) + 0.002;
      C.dx += (n1(C.t * 31) - 0.5) * amp * C.w; C.dy += (n1(C.t * 29 + 7) - 0.5) * amp * C.h;
    },
  },
  flash: {
    post(g, C) {
      const b = [C.shot.t, ...booms(C.F, C.shot.t, C.end)], s = since(b, C.t), a = Math.exp(-s * (C.shot.big ? 3.2 : 4.5));
      if (a < 0.01) return;
      g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,236,200,${0.85 * a})`; g.fillRect(C.x, C.y, C.w, C.h);
      g.globalCompositeOperation = 'source-over';
      C.flash = Math.max(C.flash, a);
    },
  },
  multi: {},
  punch: {
    pre(C) { const u = C.t - C.shot.t; C.zoom *= 1 + 0.12 * Math.exp(-u * 9); C.dy += Math.sin(u * 40) * Math.exp(-u * 8) * C.h * 0.012; },
    post(g, C) {
      const u = C.t - C.shot.t, a = u < 0.05 ? 1 : Math.exp(-(u - 0.05) * 14);
      if (a < 0.01) return;
      g.fillStyle = `rgba(255,255,255,${0.7 * a})`; g.fillRect(C.x, C.y, C.w, C.h);
      C.flash = Math.max(C.flash, a * 0.8);
    },
  },
  heat: { strips: (C, k, n) => Math.sin(C.t * 5.2 + k * 0.9) * C.w * 0.0035 * smooth((k / n - 0.45) / 0.4) },
  speed: {
    pre(C) { C.dy += (n1(C.t * 22) - 0.5) * C.h * 0.008; },
    post(g, C) {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const y = C.y + C.h * (0.1 + 0.85 * hash(i * 5.3)), len = C.w * (0.12 + 0.25 * hash(i * 2.1));
        const x = C.x + C.w * 1.3 - ((C.t * (2.2 + 1.6 * hash(i)) + hash(i * 9.1)) % 1.6) * C.w * 1.1;
        const gr = g.createLinearGradient(x, 0, x + len, 0);
        gr.addColorStop(0, 'rgba(255,230,190,0)'); gr.addColorStop(0.7, 'rgba(255,230,190,0.16)'); gr.addColorStop(1, 'rgba(255,230,190,0)');
        g.fillStyle = gr; g.fillRect(x, y, len, Math.max(1, C.h * 0.004));
      }
      g.globalCompositeOperation = 'source-over';
    },
  },
  rotor: {
    pre(C) { C.dy += Math.sin(C.t * TAU * 2.4) * C.h * 0.002; },
    post(g, C) {
      const cx = C.x + C.w * 0.5, cy = C.y - C.h * 0.9, R = C.h * 2.2, a0 = C.t * TAU * 1.2;
      g.save(); g.beginPath(); g.rect(C.x, C.y, C.w, C.h); g.clip();
      for (let k = 0; k < 2; k++) {
        const a = a0 + k * Math.PI;
        g.fillStyle = 'rgba(10,6,4,0.16)';
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a - 0.05, a + 0.05); g.closePath(); g.fill();
      }
      g.restore();
    },
  },
  rain: {
    post(g, C) {
      const n = Math.round(90 * C.w / 400);
      g.strokeStyle = 'rgba(210,225,255,0.28)'; g.lineWidth = Math.max(0.6, C.w * 0.0018);
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const sp = 1.4 + hash(i * 1.7) * 0.9, x = C.x + ((hash(i) * 1.2 + C.t * 0.12) % 1.2 - 0.1) * C.w, y = C.y + ((C.t * sp + hash(i * 3.3)) % 1) * C.h * 1.1 - C.h * 0.05;
        const L = C.h * (0.035 + 0.03 * hash(i * 4.4));
        g.moveTo(x, y); g.lineTo(x - L * 0.18, y + L);
      }
      g.stroke();
    },
  },
  splash: {
    post(g, C) {
      const bs = C.beats;
      if (!bs) return;
      const s = C.t - bs.last;
      if (s > 0.45) return;
      g.fillStyle = `rgba(220,235,255,${0.6 * (1 - s / 0.45)})`;
      for (let i = 0; i < 14; i++) {
        const a = -Math.PI * (0.15 + 0.7 * hash(i + bs.n * 17)), v = C.h * (0.25 + 0.35 * hash(i * 2 + bs.n));
        const px = C.X(0.5) + Math.cos(a) * v * s, py = C.Y(0.9) + Math.sin(a) * v * s + 1.6 * C.h * s * s;
        g.beginPath(); g.arc(px, py, Math.max(1, C.w * 0.004), 0, TAU); g.fill();
      }
    },
  },
  dust: {
    post(g, C) {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 40; i++) {
        const x = C.x + ((hash(i) + C.t * 0.012 * (hash(i * 2) - 0.3)) % 1 + 1) % 1 * C.w, y = C.y + ((hash(i * 5) + C.t * 0.02 * (0.3 + hash(i * 7))) % 1) * C.h;
        const tw = 0.5 + 0.5 * Math.sin(C.t * (1 + hash(i * 3) * 2) + i);
        g.fillStyle = `rgba(255,240,210,${0.25 * tw})`;
        g.beginPath(); g.arc(x, y, Math.max(0.7, C.w * (0.0015 + 0.002 * hash(i * 9))), 0, TAU); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    },
  },
  fireflies: {
    post(g, C) {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const x = C.x + C.w * (hash(i) + 0.03 * Math.sin(C.t * 0.7 + i)), y = C.y + C.h * (0.5 + 0.45 * hash(i * 3) + 0.03 * Math.sin(C.t * 0.9 + i * 2));
        const on = clamp(Math.sin(C.t * (1.2 + hash(i * 5)) + i * 1.7) * 1.6 - 0.4);
        if (on <= 0) continue;
        const r = C.w * 0.012, gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(255,250,170,${0.9 * on})`); gr.addColorStop(1, 'rgba(200,255,90,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      g.globalCompositeOperation = 'source-over';
    },
  },
  fog: { post(g, C) { drift(g, C, 0.35, 0.02, 0.55); } },
  mist: { post(g, C) { drift(g, C, 0.45, -0.035, 0.65); } },
  steam: {
    post(g, C) {
      for (let i = 0; i < 12; i++) {
        const life = (C.t * 0.18 + hash(i * 1.9)) % 1, x = C.x + C.w * (0.1 + 0.8 * hash(i * 4.1)) + life * C.w * 0.08, y = C.y + C.h * (1.05 - life * 0.8);
        const r = C.w * (0.08 + 0.18 * life), gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(240,240,245,${0.28 * Math.sin(life * Math.PI)})`); gr.addColorStop(1, 'rgba(240,240,245,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    },
  },
  flicker: {
    post(g, C) {
      const f = n1(C.t * 9), dip = f < 0.22 ? 0.55 : f < 0.3 ? 0.25 : 0.05 * n1(C.t * 30);
      g.fillStyle = `rgba(0,0,0,${dip})`; g.fillRect(C.x, C.y, C.w, C.h);
      C.dim *= 1 - dip;
    },
  },
  dark: {
    post(g, C) {
      const a = 0.82 + 0.06 * Math.sin(C.t * 1.3);
      g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(C.x, C.y, C.w, C.h);
      C.dim *= 1 - a;
    },
  },
  red: {
    post(g, C) {
      const p = 0.5 + 0.5 * Math.sin(C.t * TAU * 1.4);
      g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(255,${Math.round(90 + 60 * (1 - p))},${Math.round(80 + 50 * (1 - p))},1)`; g.fillRect(C.x, C.y, C.w, C.h);
      g.globalCompositeOperation = 'source-over';
      C.tint = [255, 70, 50, 0.35 * p];
    },
  },
  spot: {
    post(g, C) {
      const cx = C.x + C.w * 0.5, cy = C.y + C.h * 0.5, r = Math.max(C.w, C.h) * 0.7;
      const gr = g.createRadialGradient(cx, cy, r * 0.25, cx, cy, r);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
      g.fillStyle = gr; g.fillRect(C.x, C.y, C.w, C.h);
    },
  },
  beat: {
    pre(C) { if (C.beats) C.zoom *= 1 + 0.018 * Math.exp(-(C.t - C.beats.last) * 10); },
    post(g, C) {
      if (!C.beats) return;
      const a = Math.exp(-(C.t - C.beats.last) * 9) * 0.22;
      g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,220,160,${a})`; g.fillRect(C.x, C.y, C.w, C.h);
      g.globalCompositeOperation = 'source-over';
      C.flash = Math.max(C.flash, a * 0.8);
    },
  },
  bloom: {
    post(g, C) {
      const S = C.small;
      if (!S) return;
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.28 + 0.06 * Math.sin(C.t * 2);
      g.imageSmoothingQuality = 'high';
      g.drawImage(S.c, S.sx, S.sy, S.sw, S.sh, C.x, C.y, C.w, C.h);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    },
  },
  // a lighthouse lamp turning on its vertical axis, seen from the side: each beam sweeps out to one
  // side and back, and flares when it points at the camera
  beams: {
    post(g, C) {
      const lx = C.X(0.54), ly = C.Y(0.41), th = C.t * (Math.PI * 2 / 5.5);
      g.save(); g.beginPath(); g.rect(C.x, C.y, C.w, C.h); g.clip(); g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 2; k++) {
        const ph = th + k * Math.PI, side = Math.sin(ph), toward = Math.cos(ph), dir = Math.sign(side) || 1, reach = Math.abs(side);
        const R = C.w * (0.12 + 0.95 * reach), spread = C.h * (0.035 + 0.14 * reach), a = 0.34 * (0.35 + 0.65 * reach) * (toward > 0 ? 1 : 0.55);
        const ex = lx + dir * R, gr = g.createLinearGradient(lx, 0, ex, 0);
        gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.6, `rgba(255,255,255,${a * 0.35})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(lx, ly - C.h * 0.03); g.lineTo(ex, ly - spread); g.lineTo(ex, ly + spread * 0.8); g.lineTo(lx, ly + C.h * 0.03); g.closePath(); g.fill();
        if (toward > 0.7) {
          const f = Math.pow((toward - 0.7) / 0.3, 3), r = C.w * (0.1 + 0.35 * f), fg = g.createRadialGradient(lx, ly, 0, lx, ly, r);
          fg.addColorStop(0, `rgba(255,255,255,${0.85 * f})`); fg.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = fg; g.fillRect(lx - r, ly - r, r * 2, r * 2);
          C.flash = Math.max(C.flash, f * 0.6);
        }
      }
      g.restore();
    },
  },
  bulbs: {
    post(g, C) {
      const pts = C.spots;
      if (!pts?.length) return;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < pts.length; i++) {
        const [u, v] = pts[i], tw = Math.pow(0.5 + 0.5 * Math.sin(C.t * 5 + i * 2.39 - Math.floor(C.t * 4 + i) % 3), 3);
        if (tw < 0.2) continue;
        const x = C.X(u), y = C.Y(v), r = C.w * 0.012 * C.zoomNow;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(255,245,200,${0.8 * tw})`); gr.addColorStop(1, 'rgba(255,180,80,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      g.globalCompositeOperation = 'source-over';
    },
  },
  bw: {
    pre(C) { C.dx += (n1(C.t * 18) - 0.5) * C.w * 0.002; C.dy += (n1(C.t * 16 + 3) - 0.5) * C.h * 0.003; },
    post(g, C) {
      const f = 0.06 + 0.08 * n1(C.t * 24);
      g.fillStyle = `rgba(0,0,0,${f})`; g.fillRect(C.x, C.y, C.w, C.h);
      // scratches live for a moment and wander; dust flecks last a single frame
      const fr = Math.floor(C.t * 24);
      g.lineWidth = Math.max(0.7, C.w * 0.0016);
      for (let k = 0; k < 2; k++) {
        const e = Math.floor(C.t * 1.1 + k * 0.43);
        if (hash(e * 7 + k * 3) < 0.62) continue;
        const x = C.x + C.w * (0.1 + 0.8 * hash(e * 13 + k)) + Math.sin(C.t * 2.3 + k) * C.w * 0.006, wob = C.w * 0.003 * Math.sin(C.t * 11 + k);
        g.strokeStyle = `rgba(235,235,235,${0.1 + 0.16 * hash(fr + k * 5)})`;
        g.beginPath(); g.moveTo(x, C.y); g.quadraticCurveTo(x + wob, C.y + C.h * 0.5, x - wob * 0.5, C.y + C.h); g.stroke();
      }
      for (let k = 0; k < 3; k++) {
        if (hash(fr * 11 + k) < 0.72) continue;
        g.fillStyle = hash(fr * 19 + k) > 0.5 ? 'rgba(12,12,12,0.7)' : 'rgba(240,240,240,0.5)';
        g.beginPath(); g.ellipse(C.x + C.w * hash(fr * 13 + k), C.y + C.h * hash(fr * 17 + k), C.w * (0.002 + 0.004 * hash(fr + k)), C.w * (0.0015 + 0.003 * hash(fr * 3 + k)), hash(fr * 5 + k) * 3, 0, TAU); g.fill();
      }
    },
  },
  // the telegraphs drawn in: a burning fuse, a bomb's display, the red button, a lever under strain
  fuse: {
    post(g, C) {
      const T = C.tele('fuse');
      if (!T) return;
      const u = clamp((C.t - T.t0) / (T.t1 - T.t0)), at = rope(u), X = (q) => C.X(q[0]), Y = (q) => C.Y(q[1]), z = C.zoomNow;
      // the burnt length chars black, the last stretch glows
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(28,16,10,0.82)'; g.lineWidth = C.w * 0.0105 * z;
      g.beginPath(); g.moveTo(X(ROPE[0]), Y(ROPE[0]));
      for (let k = 1; k <= at.i; k++) g.lineTo(X(ROPE[k]), Y(ROPE[k]));
      g.lineTo(X(at.p), Y(at.p)); g.stroke();
      const e = rope(Math.max(0, u - 0.06));
      g.globalCompositeOperation = 'lighter';
      const eg = g.createLinearGradient(X(e.p), Y(e.p), X(at.p), Y(at.p));
      eg.addColorStop(0, 'rgba(255,90,20,0)'); eg.addColorStop(1, 'rgba(255,150,60,0.75)');
      g.strokeStyle = eg; g.lineWidth = C.w * 0.006 * z;
      g.beginPath(); g.moveTo(X(e.p), Y(e.p));
      for (let k = e.i + 1; k <= at.i; k++) g.lineTo(X(ROPE[k]), Y(ROPE[k]));
      g.lineTo(X(at.p), Y(at.p)); g.stroke();
      const x = X(at.p), y = Y(at.p), r = C.w * (0.045 + 0.012 * Math.sin(C.t * 43) + 0.008 * Math.sin(C.t * 71)) * z;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,235,1)'); gr.addColorStop(0.22, 'rgba(255,205,100,0.85)'); gr.addColorStop(1, 'rgba(255,110,20,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      g.fillStyle = 'rgba(255,225,150,0.95)';
      for (let i = 0; i < 16; i++) {
        const life = (C.t * 3.4 + hash(i)) % 1, gen = Math.floor(C.t * 3.4 + hash(i)), ang = -Math.PI * (0.05 + 0.9 * hash(i * 7 + gen)), v = r * (1.2 + 1.6 * hash(i * 3 + gen));
        const px = x + Math.cos(ang) * v * life, py = y + Math.sin(ang) * v * life + r * 1.4 * life * life;
        g.globalAlpha = 1 - life;
        g.beginPath(); g.arc(px, py, Math.max(0.7, C.w * 0.0022 * z), 0, TAU); g.fill();
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      // smoke from what has burnt, thick over the lit end (it hides the spark painted in the still)
      for (let i = 0; i < 14; i++) {
        const life = (C.t * 0.35 + hash(i * 2.3)) % 1, born = hash(i * 5.1) * u, q = rope(born).p;
        if (u < 0.02) break;
        const px = X(q) + life * C.w * 0.05, py = Y(q) - life * C.h * 0.22, rr2 = C.w * (0.03 + 0.08 * life) * z;
        const sg = g.createRadialGradient(px, py, 0, px, py, rr2);
        sg.addColorStop(0, `rgba(96,84,74,${0.3 * Math.sin(life * Math.PI) * clamp(u * 8)})`); sg.addColorStop(1, 'rgba(96,84,74,0)');
        g.fillStyle = sg; g.fillRect(px - rr2, py - rr2, rr2 * 2, rr2 * 2);
      }
      const cover = clamp((u - 0.03) * 6), hx = C.X(0.2), hy = C.Y(0.715), hr = C.w * 0.1 * z;
      if (cover > 0) {
        const hg = g.createRadialGradient(hx, hy, 0, hx, hy, hr);
        hg.addColorStop(0, `rgba(70,50,36,${0.8 * cover})`); hg.addColorStop(0.5, `rgba(84,66,52,${0.55 * cover})`); hg.addColorStop(1, 'rgba(84,66,52,0)');
        g.fillStyle = hg; g.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
      }
    },
  },
  timer: {
    post(g, C) {
      const T = C.tele('timer');
      if (!T) return;
      const left = Math.max(0, Math.ceil(T.t1 - C.t - 1e-6)), frac = (T.t1 - C.t) % 1, blink = frac > 0.82 || C.t >= T.t1 ? 1 : 0.8;
      const x = C.X(0.495), y = C.Y(0.43), s = C.h * 0.1 * C.zoomNow;
      g.save();
      g.font = `600 ${Math.round(s)}px Oswald, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(255,40,20,0.95)'; g.shadowBlur = s * 0.5;
      g.fillStyle = `rgba(255,${Math.round(90 + 120 * (blink - 0.8) * 5)},70,${blink})`;
      g.fillText(`00:0${left}`, x, y);
      g.restore();
    },
  },
  button: {
    post(g, C) {
      const T = C.tele('button');
      if (!T) return;
      const u = clamp((C.t - T.t0) / (T.t1 - T.t0)), rate = lerp(1.4, 9, u * u), p = Math.pow(0.5 + 0.5 * Math.sin(C.t * TAU * rate), 2);
      const x = C.X(0.5), y = C.Y(0.52), r = C.w * 0.22 * C.zoomNow;
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,60,40,${0.25 + 0.45 * p})`); gr.addColorStop(1, 'rgba(255,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      g.globalCompositeOperation = 'source-over';
    },
  },
  lever: {
    pre(C) {
      const T = C.tele('lever');
      if (!T) return;
      const u = clamp((C.t - T.t0) / (T.t1 - T.t0));
      C.dx += (n1(C.t * 40) - 0.5) * C.w * 0.01 * u * u; C.dy += (n1(C.t * 37 + 5) - 0.5) * C.h * 0.01 * u * u;
    },
    post(g, C) {
      const T = C.tele('lever');
      if (!T) return;
      const u = clamp((C.t - T.t0) / (T.t1 - T.t0));
      for (let i = 0; i < 6; i++) {
        const life = (C.t * (0.6 + u) + hash(i * 3)) % 1, x = C.x + C.w * (0.15 + 0.7 * hash(i * 5)), y = C.Y(0.3) - life * C.h * 0.3, r = C.w * (0.04 + 0.1 * life);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(235,235,235,${0.35 * u * Math.sin(life * Math.PI)})`); gr.addColorStop(1, 'rgba(235,235,235,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const gr = g.createRadialGradient(C.x + C.w / 2, C.y + C.h / 2, C.h * lerp(0.9, 0.4, u), C.x + C.w / 2, C.y + C.h / 2, C.w * 0.8);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.6 * u})`);
      g.fillStyle = gr; g.fillRect(C.x, C.y, C.w, C.h);
    },
  },
};

// the fuse rope as it lies in f1_fuse (normalised image coords), walked by arc length
const ROPE = [[0.245, 0.708], [0.3, 0.655], [0.35, 0.615], [0.4, 0.576], [0.45, 0.54], [0.5, 0.502], [0.55, 0.462], [0.6, 0.414], [0.65, 0.356], [0.7, 0.287], [0.745, 0.238], [0.775, 0.215]];
const SEG = ROPE.slice(1).map((q, k) => Math.hypot((q[0] - ROPE[k][0]) * 1.5, q[1] - ROPE[k][1]));
const LEN = SEG.reduce((a, b) => a + b, 0);
function rope(u) {
  let d = clamp(u) * LEN, k = 0;
  while (k < SEG.length - 1 && d > SEG[k]) { d -= SEG[k]; k++; }
  const f = clamp(d / SEG[k]), A = ROPE[k], B = ROPE[k + 1];
  return { i: k, p: [lerp(A[0], B[0], f), lerp(A[1], B[1], f)] };
}

function drift(g, C, a, speed, top) {
  const tex = fog(), w = C.w * 1.6, h = C.h * 0.8;
  g.globalAlpha = a;
  for (let k = 0; k < 2; k++) {
    const off = ((C.t * speed * (k ? 1.6 : 1) + k * 0.37) % 1 + 1) % 1, y = C.y + C.h * (top + k * 0.12) - h * 0.4;
    g.drawImage(tex, C.x - off * w, y, w, h); g.drawImage(tex, C.x - off * w + w, y, w, h);
  }
  g.globalAlpha = 1;
}

// telegraphs every film has, whatever the shot: lightning before thunder, strings before a scare
export function teleOverlay(g, C) {
  for (const T of C.F.tele) {
    if (T.k === 'lightning' && C.t >= T.t0 - 0.02 && C.t < T.t0 + 0.6) {
      const s = C.t - T.t0, a = s < 0 ? 0 : s < 0.06 ? 0.85 : s < 0.12 ? 0.2 : s < 0.2 ? 0.7 : Math.exp(-(s - 0.2) * 9) * 0.55;
      g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(220,230,255,${a})`; g.fillRect(C.x, C.y, C.w, C.h);
      g.globalCompositeOperation = 'source-over';
      C.flash = Math.max(C.flash, a); C.cool = Math.max(C.cool, a);
    } else if (T.k === 'swell' && C.t >= T.t0 && C.t < T.t1) {
      const u = smooth((C.t - T.t0) / (T.t1 - T.t0)), cx = C.x + C.w / 2, cy = C.y + C.h / 2;
      const gr = g.createRadialGradient(cx, cy, C.h * lerp(0.8, 0.3, u), cx, cy, C.w * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.55 * u})`);
      g.fillStyle = gr; g.fillRect(C.x, C.y, C.w, C.h);
      C.lean = Math.max(C.lean, u);
    }
  }
}
