// The film on the screen: stills with a Ken Burns camera, hard cuts, the shot effects and
// telegraphs, studio logos, silent-film intertitles and the end card. draw() also reports the
// light the picture throws into the room, so the audience is lit by what is actually showing.
import { FX, teleOverlay } from './screenfx.js';
import { clamp, lerp, smooth, easeOut, hash, canvas, grain, rgb, text, wrap, fit } from './paint.js';
import { CROPS } from './crops.js';

const SMALL = 12;
// the average colour of a still and its brightest warm points (for twinkling marquee bulbs)
// (only inside the sharp picture: some stills carry a letterbox painted in, see tools/crops.py)
function survey(img, crop) {
  const w = Math.max(8, Math.round(img.width / SMALL)), h = Math.max(8, Math.round(img.height / SMALL));
  const c = canvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  const cand = [], [u0, v0, u1, v1] = crop;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const pu = (p % w + 0.5) / w, pv = (Math.floor(p / w) + 0.5) / h;
    if (pu < u0 || pu > u1 || pv < v0 || pv > v1) continue;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    const L = (0.3 * d[i] + 0.6 * d[i + 1] + 0.1 * d[i + 2]) / 255;
    if (L > 0.78 && d[i] > d[i + 2] + 50) cand.push([L, (p % w + 0.5) / w, (Math.floor(p / w) + 0.5) / h]);
  }
  n = Math.max(1, n);
  cand.sort((a, b2) => b2[0] - a[0]);
  const spots = [];
  for (const [, u, v] of cand) {
    if (spots.length >= 42) break;
    if (spots.every(([a, b2]) => Math.hypot((a - u) * 1.5, b2 - v) > 0.035)) spots.push([u, v]);
  }
  return { c, avg: [r / n, g / n, b / n], spots, crop };
}

export class Screen {
  constructor(film, meta, images, { tr = (k) => k, title = '' } = {}) {
    this.F = film; this.meta = meta; this.images = images; this.tr = tr; this.title = title;
    this.info = new Map();
    // opening titles over the first picture, unless the film opens on its own title card
    this.firstImg = film.shots[0]?.k === 'card' ? null : film.shots.find((s) => s.img);
    this.light = { r: 0, g: 0, b: 0, a: 0, flash: 0 };
  }
  look(key) {
    const img = this.images[key];
    if (!img) return null;
    let i = this.info.get(key);
    if (!i) { i = survey(img, CROPS[key] || [0, 0, 1, 1]); this.info.set(key, i); }
    return i;
  }
  shotIndex(t) {
    const S = this.F.shots;
    let k = 0;
    for (let i = 0; i < S.length; i++) { if (S[i].t <= t) k = i; else break; }
    return k;
  }
  tele(t, k) { return this.F.tele.find((x) => x.k === k && t >= x.t0 - 0.3 && t <= x.t1 + 0.05) || null; }
  beats(t) {
    const G = this.F.grid?.find((s) => t >= s.t0 && t < s.t1 + 0.5);
    if (!G) return null;
    const n = Math.floor((t - G.t0) / G.B);
    return { last: G.t0 + n * G.B, n, B: G.B };
  }

  // draw the picture at film time t into the rect; returns the light it throws
  draw(g, t, x, y, w, h, dpr = 1) {
    const S = this.F.shots, k = this.shotIndex(t), shot = S[k], end = S[k + 1]?.t ?? this.F.dur;
    const C = { t, F: this.F, shot, end, x, y, w, h, dpr, dx: 0, dy: 0, zoom: 1.02, zoomNow: 1, flash: 0, dim: 1, tint: null, cool: 0, lean: 0,
      tele: (kk) => this.tele(t, kk), beats: this.beats(t), X: (u) => x + u * w, Y: (v) => y + v * h };
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = '#000'; g.fillRect(x, y, w, h);
    let avg = [0, 0, 0], bright = 0;
    if (!shot) { /* nothing yet */ }
    else if (shot.k === 'logo') bright = this.logo(g, C, t - shot.t, end - shot.t);
    else if (shot.k === 'card') bright = this.card(g, C, this.tr(shot.key), t - shot.t, end - shot.t);
    else if (shot.k === 'end') bright = this.endCard(g, C, t - shot.t, !!shot.q);
    else {
      const info = this.look(shot.img), img = this.images[shot.img];
      if (img && info) {
        this.still(g, C, img, info);
        avg = info.avg; bright = 1;
        if (shot === this.firstImg && this.title) this.titleOverlay(g, C, t - shot.t);
      }
    }
    teleOverlay(g, C);
    this.film(g, C);
    g.restore();
    // the light in the room: the picture's colour, its flashes, a cold lightning, a pulsing alarm
    const L = this.light, dimmed = bright * C.dim;
    let r = avg[0] * dimmed, gg = avg[1] * dimmed, b = avg[2] * dimmed;
    if (shot?.k) { const c = rgb(this.meta.grade.light); r = c[0] * bright * 0.5; gg = c[1] * bright * 0.5; b = c[2] * bright * 0.5; }
    const f = C.flash, cw = C.cool;
    r = lerp(r, 255, f * 0.8); gg = lerp(gg, 235 + 20 * cw, f * 0.8); b = lerp(b, 200 + 55 * cw, f * 0.8);
    if (C.tint) { r = lerp(r, C.tint[0], C.tint[3]); gg = lerp(gg, C.tint[1], C.tint[3]); b = lerp(b, C.tint[2], C.tint[3]); }
    const a = clamp(((0.3 * r + 0.6 * gg + 0.1 * b) / 255) * 1.3);
    Object.assign(L, { r, g: gg, b, a, flash: f, lean: C.lean });
    return L;
  }

  still(g, C, img, info) {
    const { shot, t, end, x, y, w, h } = C, kb = shot.kb || [0.5, 0.5, 1, 0.5, 0.5, 1];
    const fx = shot.fx || [];
    if (fx.includes('shake') || fx.includes('lever') || fx.includes('punch') || fx.includes('bw')) C.zoom *= 1.04;
    for (const f of fx) FX[f]?.pre?.(C);
    const u = clamp((t - shot.t) / Math.max(0.1, end - shot.t));
    const cx = lerp(kb[0], kb[3], u), cy = lerp(kb[1], kb[4], u), z = lerp(kb[2], kb[5], u) * C.zoom;
    const iw = img.width, ih = img.height, [u0, v0, u1, v1] = info.crop;
    const X0 = u0 * iw, Y0 = v0 * ih, cw = (u1 - u0) * iw, ch = (v1 - v0) * ih;
    const s0 = Math.max(w / cw, h / ch), Sc = s0 * z, vw = w / Sc, vh = h / Sc;
    const px = clamp(cx * iw, X0 + vw / 2, X0 + cw - vw / 2), py = clamp(cy * ih, Y0 + vh / 2, Y0 + ch - vh / 2);
    const sx = px - vw / 2 - C.dx / Sc, sy = py - vh / 2 - C.dy / Sc;
    C.zoomNow = z;
    C.X = (uu) => x + (uu * iw - sx) * Sc; C.Y = (vv) => y + (vv * ih - sy) * Sc;
    if (fx.includes('heat')) {
      const N = 28;
      for (let k = 0; k < N; k++) {
        const off = FX.heat.strips(C, k, N) / Sc, y0 = (vh * k) / N;
        g.drawImage(img, sx + off, sy + y0, vw, vh / N + 0.5, x, y + (h * k) / N, w, h / N + 0.8);
      }
    } else g.drawImage(img, sx, sy, vw, vh, x, y, w, h);
    const kx = info.c.width / iw, ky = info.c.height / ih;
    C.small = { c: info.c, sx: sx * kx, sy: sy * ky, sw: vw * kx, sh: vh * ky };
    C.spots = info.spots;
    for (const f of fx) FX[f]?.post?.(g, C);
  }

  // projector light: grain, a breathing hotspot, the corners falling off
  film(g, C) {
    const { x, y, w, h, t } = C;
    const tiles = grain(), tile = tiles[Math.floor(t * 24) % tiles.length];
    g.globalAlpha = this.meta.bw ? 0.1 : 0.05; g.globalCompositeOperation = 'overlay';
    const ts = 160 / Math.max(1, C.dpr), ox = hash(Math.floor(t * 24)) * ts;
    for (let yy = y - ox; yy < y + h; yy += ts) for (let xx = x - ox; xx < x + w; xx += ts) g.drawImage(tile, xx, yy, ts, ts);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const cx = x + w / 2, cy = y + h / 2, gr = g.createRadialGradient(cx, cy, h * 0.35, cx, cy, Math.hypot(w, h) * 0.56);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.42 + 0.03 * Math.sin(t * 50)})`);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  }

  titleOverlay(g, C, s) {
    if (s > 3.4) return;
    const { x, y, w, h } = C, a = smooth(s / 0.5) * (1 - smooth((s - 2.7) / 0.7)), k = 0.92 + 0.08 * easeOut(s / 1.2);
    const G = this.meta.grade, font = (px) => `${px}px Shrikhand, serif`, size = fit(g, this.title, w * 0.84, Math.round(h * 0.17), font);
    g.save(); g.globalAlpha = a; g.translate(x + w / 2, y + h * 0.8); g.scale(k, k); g.rotate(-0.04);
    g.font = font(size);
    const grd = g.createLinearGradient(0, -size / 2, 0, size / 2); grd.addColorStop(0, G.light); grd.addColorStop(1, G.sky);
    text(g, this.title, 3, 4, { font: font(size), fill: 'rgba(0,0,0,0.55)' });
    text(g, this.title, 0, 0, { font: font(size), fill: grd, stroke: G.low, lw: Math.max(2, size * 0.12) });
    g.restore();
  }

  card(g, C, str, s, dur) {
    const { x, y, w, h } = C, a = smooth(s / 0.35) * (1 - smooth((s - dur + 0.35) / 0.35));
    g.fillStyle = '#0b0b0b'; g.fillRect(x, y, w, h);
    g.save(); g.globalAlpha = a;
    const m = h * 0.08;
    g.strokeStyle = '#e9e6de'; g.lineWidth = Math.max(1, h * 0.008); g.strokeRect(x + m, y + m, w - m * 2, h - m * 2);
    g.lineWidth = Math.max(0.6, h * 0.003); g.strokeRect(x + m * 1.35, y + m * 1.35, w - m * 2.7, h - m * 2.7);
    for (const [cx, cy] of [[x + m, y + m], [x + w - m, y + m], [x + m, y + h - m], [x + w - m, y + h - m]]) {
      g.beginPath(); g.arc(cx, cy, m * 0.35, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(cx, cy, m * 0.14, 0, Math.PI * 2); g.fillStyle = '#e9e6de'; g.fill();
    }
    const size = Math.round(h * 0.085), font = `${size}px Limelight, serif`;
    g.font = font;
    const lines = String(str).split('\n').flatMap((l) => wrap(g, l, w * 0.7, 3));
    lines.forEach((l, i) => text(g, l, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * size * 1.35, { font, fill: '#ece8df' }));
    g.restore();
    return 0.35 * a;
  }

  endCard(g, C, s, q) {
    const { x, y, w, h } = C, a = smooth(s / 0.8);
    g.fillStyle = '#050505'; g.fillRect(x, y, w, h);
    const size = Math.round(h * 0.2), font = `${size}px Limelight, serif`, str = this.tr(q ? 'endQ' : 'end');
    g.save(); g.globalAlpha = a;
    const G = this.meta.grade, wob = q ? Math.sin(s * 3) * 0.03 : 0;
    g.translate(x + w / 2, y + h / 2); g.rotate(wob);
    text(g, str, 0, 0, { font, fill: this.meta.bw ? '#e9e6de' : G.light, shadow: this.meta.bw ? 'transparent' : G.sky, blur: size * 0.4 });
    g.restore();
    return 0.25 * a;
  }

  logo(g, C, s, dur) {
    const { x, y, w, h } = C, G = this.meta.grade, id = this.meta.studio, fade = smooth(s / 0.5) * (1 - smooth((s - dur + 0.6) / 0.6));
    const bg = g.createLinearGradient(0, y, 0, y + h); bg.addColorStop(0, G.low); bg.addColorStop(1, '#000');
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.save();
    const cx = x + w / 2, cy = y + h * 0.42, R = h * 0.22;
    if (id === 'sol') {
      const rise = easeOut(s / 2.4), sy = lerp(y + h * 0.78, cy, rise);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const a = s * 0.25 + (i * Math.PI) / 7;
        g.fillStyle = `rgba(255,190,90,${0.07 * rise})`;
        g.beginPath(); g.moveTo(cx, sy); g.arc(cx, sy, h * 1.2, a - 0.06, a + 0.06); g.closePath(); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      const gr = g.createRadialGradient(cx, sy, 0, cx, sy, R); gr.addColorStop(0, '#fff3c4'); gr.addColorStop(0.6, G.light); gr.addColorStop(1, G.sky);
      g.fillStyle = gr; g.beginPath(); g.arc(cx, sy, R, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#120806'; g.beginPath(); g.moveTo(x, y + h * 0.66);
      [[0.18, 0.56], [0.3, 0.62], [0.46, 0.5], [0.6, 0.6], [0.78, 0.52], [1, 0.64]].forEach(([u, v]) => g.lineTo(x + u * w, y + v * h));
      g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.fill();
    } else if (id === 'estrella') {
      const tw = 0.8 + 0.2 * Math.sin(s * 6), k = easeOut(s / 1.2) * R * 1.4 * tw;
      g.globalCompositeOperation = 'lighter';
      for (const [a, L] of [[0, 1], [Math.PI / 2, 1], [Math.PI / 4, 0.45], [-Math.PI / 4, 0.45]]) {
        g.save(); g.translate(cx, cy); g.rotate(a + s * 0.1);
        const gr = g.createLinearGradient(-k * L, 0, k * L, 0); gr.addColorStop(0, 'rgba(255,220,200,0)'); gr.addColorStop(0.5, 'rgba(255,240,230,0.95)'); gr.addColorStop(1, 'rgba(255,220,200,0)');
        g.fillStyle = gr; g.fillRect(-k * L, -h * 0.006, k * L * 2, h * 0.012); g.restore();
      }
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.6); gr.addColorStop(0, 'rgba(255,245,235,1)'); gr.addColorStop(1, 'rgba(255,180,190,0)');
      g.fillStyle = gr; g.fillRect(cx - R, cy - R, R * 2, R * 2);
      g.globalCompositeOperation = 'source-over';
    } else if (id === 'noche') {
      g.fillStyle = '#dfe8f0'; g.beginPath(); g.arc(cx, cy, R * 0.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = G.low; g.beginPath(); g.arc(cx + R * 0.34, cy - R * 0.12, R * 0.72, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(12,16,24,0.75)';
      for (let i = 0; i < 3; i++) { const off = ((s * 0.05 + i * 0.33) % 1) * w * 1.4 - w * 0.2; g.beginPath(); g.ellipse(x + off, cy + R * (0.2 + 0.25 * i), w * 0.22, h * 0.05, 0, 0, Math.PI * 2); g.fill(); }
    } else if (id === 'luces') {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + Math.sin(s * 1.1 + i * 2.1) * 0.55, ox = x + w * (0.25 + 0.25 * i), oy = y + h;
        const gr = g.createLinearGradient(ox, oy, ox + Math.cos(a) * h, oy + Math.sin(a) * h); gr.addColorStop(0, 'rgba(255,230,170,0.5)'); gr.addColorStop(1, 'rgba(255,230,170,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, h * 1.2, a - 0.07, a + 0.07); g.closePath(); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    } else if (id === 'tierra') {
      const gr = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R); gr.addColorStop(0, '#9fd3c7'); gr.addColorStop(0.6, '#2e6f6a'); gr.addColorStop(1, '#0c2328');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
      g.strokeStyle = 'rgba(230,255,240,0.35)'; g.lineWidth = Math.max(0.8, h * 0.004);
      for (let i = 0; i < 6; i++) { const p = ((s * 0.12 + i / 6) % 1) * Math.PI, rx = Math.abs(Math.cos(p)) * R; g.beginPath(); g.ellipse(cx, cy, rx, R, 0, 0, Math.PI * 2); g.stroke(); }
      for (const v of [-0.5, 0, 0.5]) { g.beginPath(); g.ellipse(cx, cy + v * R, R * Math.sqrt(1 - v * v), R * 0.12, 0, 0, Math.PI * 2); g.stroke(); }
      g.restore();
    }
    const name = { sol: 'SOL FILMS', estrella: 'ESTRELLA', noche: 'NOCHE', luces: 'LUCES', tierra: 'TIERRA' }[id] || '';
    const k = smooth((s - 0.8) / 0.8), size = Math.round(h * 0.13);
    g.globalAlpha = k;
    text(g, name, cx, y + h * 0.8, { font: `${size}px Limelight, serif`, fill: G.light, shadow: G.sky, blur: size * 0.35 });
    text(g, this.tr('presents'), cx, y + h * 0.91, { font: `${Math.round(size * 0.36)}px Oswald, sans-serif`, fill: 'rgba(255,255,255,0.7)' });
    g.globalAlpha = 1;
    if (fade < 1) { g.fillStyle = `rgba(0,0,0,${1 - fade})`; g.fillRect(x, y, w, h); }
    g.restore();
    return 0.5 * fade;
  }
}
