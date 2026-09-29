// The window itself, between the street and the drops. Bottom to top:
//   the street, sharp (clear glass)  →  the heater's shimmer  →  at night, the bus reflected in it  →
//   what drops and fingers leave behind (bead trails, streaks)  →  the fog  →  the bright rim where fog
//   meets clear glass  →  the stickers and the scratches, which live in the glass and on top of it.
// The fog is one layer: the street blurred (downscaled twice, no ctx.filter so Safari keeps up), a milky
// veil and a tile of micro-droplets, cut out by a 96 × 168 mask built from the sim's fog field and
// stretched smoothly over the pane — so every wipe, trail and regrowing patch comes straight from f.
import { GW, GH, PW, PH } from '../sim.js';
import { clamp, mulberry32, rgba, roundRect, TAU } from '../util.js';

const VEIL = {
  dawn: ['#c3cde3', 0.5], morning: ['#e4e9ef', 0.56], day: ['#eef1f3', 0.5],
  dusk: ['#ead3cf', 0.5], blue: ['#9aaed4', 0.46], night: ['#56617f', 0.5],
};
const STICK_TXT = {
  noapoyarse: { es: ['NO APOYARSE', 'EN EL CRISTAL'], en: ['DO NOT LEAN', 'ON THE GLASS'] },
  reservado: { es: ['RESERVADO'], en: ['PRIORITY'] },
  salida: { es: ['SALIDA DE', 'EMERGENCIA'], en: ['EMERGENCY', 'EXIT'] },
};
const SIGN = (w, px) => `${w} ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

export class Glass {
  constructor() {
    const mk = (w = 1, h = 1) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    this.fogC = mk(); this.fg = this.fogC.getContext('2d');
    this.blurA = mk(); this.blurB = mk();
    this.maskC = mk(GW, GH); this.mg = this.maskC.getContext('2d'); this.maskI = this.mg.createImageData(GW, GH);
    this.rimC = mk(GW, GH); this.rg = this.rimC.getContext('2d'); this.rimI = this.rg.createImageData(GW, GH);
    this.resC = mk(); this.res = this.resC.getContext('2d');
    this.stickC = mk(); this.nightC = mk();
    this.w = 1; this.h = 1; this.s = 1; this.mood = 'dawn'; this.lv = null; this.lang = 'es';
    this.grain = null; this.fadeT = 0; this.q = 1;
  }
  resize(w, h, dpr) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    if (w === this.w && h === this.h && this.dpr === dpr) return;
    this.w = w; this.h = h; this.s = w / PW; this.dpr = dpr;
    this.fogC.width = w; this.fogC.height = h;
    this.blurA.width = Math.max(2, Math.round(w / 4)); this.blurA.height = Math.max(2, Math.round(h / 4));
    this.blurB.width = Math.max(2, Math.round(w / 10)); this.blurB.height = Math.max(2, Math.round(h / 10));
    this.resC.width = w; this.resC.height = h;
    this.grain = this.makeGrain(dpr); this.pat = null;
    this.bake();
  }
  setLevel(lv, mood, lang) { this.lv = lv; this.mood = mood; this.lang = lang || 'es'; this.clearResidue(); this.bake(); }
  clearResidue() { this.res.clearRect(0, 0, this.resC.width, this.resC.height); }

  // ---------- once per size or level ----------
  makeGrain(dpr) {
    // micro-droplets: what fog is, up close. A seamless tile of tiny lenses, darker below, a glint above.
    const S = Math.round(160 * clamp(dpr, 1, 2)), c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), rng = mulberry32(99);
    for (let i = 0; i < S * S * 0.012; i++) {
      const x = rng() * S, y = rng() * S, r = (0.35 + Math.pow(rng(), 2.2) * 1.5) * dpr;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        const X = x + ox, Y = y + oy;
        if (X < -3 * r || X > S + 3 * r || Y < -3 * r || Y > S + 3 * r) continue;
        g.fillStyle = 'rgba(40,50,70,0.22)'; g.beginPath(); g.arc(X, Y + r * 0.25, r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(X - r * 0.3, Y - r * 0.35, r * 0.42, 0, TAU); g.fill();
      }
    }
    return c;
  }
  bake() {
    const lv = this.lv; if (!lv) return;
    const W = this.w, H = this.h, s = this.s;
    this.stickC.width = W; this.stickC.height = H;
    const g = this.stickC.getContext('2d');
    g.clearRect(0, 0, W, H);
    for (const seg of lv.scratches || []) this.scratch(g, seg, s);
    for (const st of lv.stickers || []) this.sticker(g, st, s);
    this.nightC.width = W; this.nightC.height = H;
    if (lv.night) this.reflection(this.nightC.getContext('2d'), W, H);
  }
  scratch(g, [ax, ay, bx, by], s) {
    // keys dragged across the glass by someone bored: three hairlines that wander a little, catching the light
    const rng = mulberry32(Math.round((ax * 31 + ay * 17 + bx * 7 + by) * 100));
    const L = Math.hypot(bx - ax, by - ay), n = Math.max(6, Math.round(L * 4)), nx = -(by - ay) / L, ny = (bx - ax) / L;
    for (let line = 0; line < 3; line++) {
      const off = (line - 1) * 0.045 + (rng() - 0.5) * 0.02, pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, w = (rng() - 0.5) * 0.05;
        pts.push([(ax + (bx - ax) * t + nx * (off + w)) * s, (ay + (by - ay) * t + ny * (off + w)) * s]);
      }
      const t0 = rng() * 0.08, t1 = 1 - rng() * 0.08;
      const path = () => { g.beginPath(); const i0 = Math.floor(t0 * n), i1 = Math.ceil(t1 * n); g.moveTo(...pts[i0]); for (let i = i0 + 1; i <= i1; i++) g.lineTo(...pts[i]); };
      g.lineCap = 'round'; g.lineJoin = 'round';
      path(); g.strokeStyle = 'rgba(20,24,34,0.28)'; g.lineWidth = Math.max(1, s * 0.03); g.save(); g.translate(0, Math.max(1, s * 0.015)); g.stroke(); g.restore();
      path(); g.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * rng()})`; g.lineWidth = Math.max(0.8, s * (line === 1 ? 0.028 : 0.018)); g.stroke();
    }
  }
  sticker(g, st, s) {
    const txt = (STICK_TXT[st.art] || {})[this.lang] || (STICK_TXT[st.art] || {}).es || [''];
    const x = st.x * s, y = st.y * s, w = st.w * s, h = st.h * s;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = s * 0.12; g.shadowOffsetY = s * 0.03;
    if (st.k === 'circ') {
      const cx = x + w / 2, cy = y + h / 2, R = w / 2;
      g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      g.shadowColor = 'transparent';
      g.fillStyle = '#1f5fbf'; g.beginPath(); g.arc(cx, cy, R * 0.9, 0, TAU); g.fill();
      // the priority-seat pictogram: someone with a stick, someone expecting, a wheelchair
      g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineCap = 'round'; g.lineJoin = 'round';
      const u = R * 0.2;
      const fig = (fx, fy, k) => {
        g.beginPath(); g.arc(fx, fy - u * 1.55, u * 0.36, 0, TAU); g.fill();
        g.lineWidth = u * 0.42; g.beginPath();
        if (k === 0) { g.moveTo(fx, fy - u * 1.05); g.quadraticCurveTo(fx + u * 0.3, fy - u * 0.3, fx, fy + u * 0.3); g.lineTo(fx - u * 0.2, fy + u * 1.2); g.moveTo(fx, fy + u * 0.3); g.lineTo(fx + u * 0.3, fy + u * 1.2); g.stroke(); g.lineWidth = u * 0.22; g.beginPath(); g.moveTo(fx + u * 0.55, fy - u * 0.5); g.lineTo(fx + u * 0.75, fy + u * 1.2); }
        else if (k === 1) { g.moveTo(fx, fy - u * 1.05); g.lineTo(fx, fy + u * 1.2); g.stroke(); g.beginPath(); g.arc(fx + u * 0.18, fy - u * 0.1, u * 0.45, -1.2, 1.2); }
        else { g.moveTo(fx - u * 0.1, fy - u * 1.05); g.lineTo(fx - u * 0.1, fy - u * 0.1); g.lineTo(fx + u * 0.6, fy - u * 0.1); g.lineTo(fx + u * 0.8, fy + u * 0.6); g.stroke(); g.lineWidth = u * 0.24; g.beginPath(); g.arc(fx - u * 0.05, fy + u * 0.45, u * 0.62, 0, TAU); }
        g.stroke();
      };
      fig(cx - u * 2.1, cy - u * 0.2, 0); fig(cx, cy - u * 0.2, 1); fig(cx + u * 1.9, cy - u * 0.2, 2);
      g.font = SIGN(800, Math.max(6, R * 0.2)); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt[0], cx, cy + R * 0.58);
      this.gloss(g, () => { g.beginPath(); g.arc(cx, cy, R, 0, TAU); }, x, y, w, h);
    } else {
      const red = st.art === 'salida', bg = red ? '#d8261c' : '#f5d130', fg = red ? '#ffffff' : '#141414';
      const rr = Math.min(w, h) * 0.12;
      g.fillStyle = bg; roundRect(g, x, y, w, h, rr); g.fill();
      g.shadowColor = 'transparent';
      g.strokeStyle = fg; g.lineWidth = Math.max(1, h * 0.04); roundRect(g, x + h * 0.07, y + h * 0.07, w - h * 0.14, h - h * 0.14, rr * 0.7); g.stroke();
      const ic = h * 0.72, ix = x + h * 0.16, iy = y + (h - ic) / 2;
      if (red) {
        // the little hammer: break the glass in an emergency (not for racing)
        g.save(); g.translate(ix + ic / 2, iy + ic / 2); g.rotate(-0.6); g.fillStyle = fg;
        g.fillRect(-ic * 0.06, -ic * 0.1, ic * 0.12, ic * 0.55); roundRect(g, -ic * 0.3, -ic * 0.32, ic * 0.6, ic * 0.22, ic * 0.05); g.fill();
        g.restore();
      } else {
        // the prohibition sign over someone leaning
        const cx = ix + ic / 2, cy = iy + ic / 2, R = ic / 2;
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
        g.strokeStyle = '#141414'; g.fillStyle = '#141414'; g.lineCap = 'round'; g.lineWidth = R * 0.16;
        g.beginPath(); g.arc(cx + R * 0.12, cy - R * 0.48, R * 0.14, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(cx + R * 0.05, cy - R * 0.3); g.lineTo(cx - R * 0.15, cy + R * 0.2); g.lineTo(cx + R * 0.05, cy + R * 0.62); g.moveTo(cx - R * 0.15, cy + R * 0.2); g.lineTo(cx - R * 0.35, cy + R * 0.62); g.stroke();
        g.lineWidth = R * 0.1; g.beginPath(); g.moveTo(cx + R * 0.42, cy - R * 0.72); g.lineTo(cx + R * 0.42, cy + R * 0.72); g.stroke();
        g.strokeStyle = '#d8261c'; g.lineWidth = R * 0.2; g.beginPath(); g.arc(cx, cy, R * 0.88, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(cx - R * 0.62, cy - R * 0.62); g.lineTo(cx + R * 0.62, cy + R * 0.62); g.stroke();
      }
      const tx = ix + ic + h * 0.14, tw = x + w - h * 0.16 - tx;
      g.fillStyle = fg; g.textAlign = 'left'; g.textBaseline = 'middle';
      let px = h * (txt.length > 1 ? 0.27 : 0.36);
      g.font = SIGN(800, px);
      const widest = Math.max(...txt.map((t) => g.measureText(t).width));
      if (widest > tw) { px *= tw / widest; g.font = SIGN(800, px); }
      txt.forEach((t, i) => g.fillText(t, tx, y + h / 2 + (i - (txt.length - 1) / 2) * px * 1.12));
      // a corner that someone has started to pick at
      const c = Math.min(w, h) * 0.2;
      g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(x + w - c, y + h); g.lineTo(x + w, y + h - c); g.lineTo(x + w, y + h + 2); g.lineTo(x + w - c - 2, y + h + 2); g.closePath(); g.fill(); g.restore();
      g.fillStyle = '#e9e6de'; g.beginPath(); g.moveTo(x + w - c, y + h); g.lineTo(x + w, y + h - c); g.lineTo(x + w - c * 0.72, y + h - c * 0.72); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; g.stroke();
      this.gloss(g, () => roundRect(g, x, y, w, h, rr), x, y, w, h);
    }
    g.restore();
  }
  gloss(g, path, x, y, w, h) {
    g.save(); path(); g.clip();
    const gr = g.createLinearGradient(x, y, x + w * 0.6, y + h);
    gr.addColorStop(0, 'rgba(255,255,255,0.28)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.restore();
  }
  reflection(g, W, H) {
    // night turns the window into a dim mirror: the strip lights and you in your hood, faint behind the street
    g.clearRect(0, 0, W, H);
    for (const [y0, a] of [[0.07, 0.5], [0.19, 0.3]]) {
      const gr = g.createLinearGradient(0, H * y0 - H * 0.02, 0, H * y0 + H * 0.02);
      gr.addColorStop(0, 'rgba(220,235,255,0)'); gr.addColorStop(0.5, `rgba(220,235,255,${a})`); gr.addColorStop(1, 'rgba(220,235,255,0)');
      g.fillStyle = gr; g.save(); g.translate(W / 2, H * y0); g.rotate(-0.05); g.fillRect(-W * 0.6, -H * 0.02, W * 1.2, H * 0.04); g.restore();
    }
    // you in your hood, a warm ghost, your face lit from below by a phone
    const cx = W * 0.3, cy = H * 0.64, u = W * 0.19;
    const hg = g.createRadialGradient(cx, cy, u * 0.2, cx, cy, u * 0.95);
    hg.addColorStop(0, 'rgba(255,214,160,0.12)'); hg.addColorStop(0.75, 'rgba(255,214,160,0.07)'); hg.addColorStop(1, 'rgba(255,214,160,0)');
    g.fillStyle = hg; g.beginPath(); g.ellipse(cx, cy, u * 0.8, u * 0.95, 0, 0, TAU); g.fill();
    const sg = g.createLinearGradient(0, cy + u * 0.7, 0, H);
    sg.addColorStop(0, 'rgba(255,214,160,0.08)'); sg.addColorStop(1, 'rgba(255,214,160,0)');
    g.fillStyle = sg; g.beginPath(); g.moveTo(cx - u * 1.7, H); g.bezierCurveTo(cx - u * 1.5, cy + u * 0.85, cx + u * 1.5, cy + u * 0.85, cx + u * 1.7, H); g.fill();
    const fg = g.createRadialGradient(cx + u * 0.05, cy + u * 0.45, u * 0.05, cx + u * 0.05, cy + u * 0.2, u * 0.6);
    fg.addColorStop(0, 'rgba(190,215,255,0.16)'); fg.addColorStop(1, 'rgba(190,215,255,0)');
    g.fillStyle = fg; g.beginPath(); g.ellipse(cx + u * 0.06, cy + u * 0.14, u * 0.44, u * 0.56, 0, 0, TAU); g.fill();
  }

  // ---------- what drops and fingers leave on clear glass (the fog grows back over it) ----------
  trail(d, s, rng) {
    // a running drop sheds tiny beads along its track
    const sp = Math.hypot(d.vx, d.vy); if (sp < 0.05) return;
    const ux = d.vx / sp, uy = d.vy / sp, g = this.res;
    const bx = (d.x - ux * d.r * 1.25 + -uy * (rng() - 0.5) * d.r * 1.1) * s, by = (d.y - uy * d.r * 1.25 + ux * (rng() - 0.5) * d.r * 1.1) * s;
    const r = Math.max(0.6, (0.3 + rng() * 0.9) * this.dpr);
    g.fillStyle = 'rgba(15,20,32,0.3)'; g.beginPath(); g.arc(bx, by + r * 0.3, r, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(bx - r * 0.25, by - r * 0.3, r * 0.5, 0, TAU); g.fill();
  }
  streak(ax, ay, bx, by, s, rng) {
    // a fingertip smears the fog's water into faint parallel lines along the stroke
    const L = Math.hypot(bx - ax, by - ay); if (L < 0.02) return;
    const nx = -(by - ay) / L, ny = (bx - ax) / L, g = this.res;
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const o = (i / 6 - 0.5) * 1.05 + (rng() - 0.5) * 0.05;
      g.strokeStyle = `rgba(255,255,255,${0.035 + rng() * 0.05})`; g.lineWidth = Math.max(0.6, this.dpr * (0.5 + rng()));
      g.beginPath(); g.moveTo((ax + nx * o) * s, (ay + ny * o) * s); g.lineTo((bx + nx * o) * s, (by + ny * o) * s); g.stroke();
    }
  }
  splat(x, y, r, s, rng, col = null) {
    // a drop squashed flat by a finger: a smudge of water and a ring of spray
    const g = this.res;
    g.fillStyle = col ? rgba(col, 0.22) : 'rgba(255,255,255,0.14)';
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU, d = rng() * r * 1.4, rr = r * (0.3 + rng() * 0.6);
      g.beginPath(); g.ellipse((x + Math.cos(a) * d) * s, (y + Math.sin(a) * d) * s, rr * s * 1.4, rr * s * 0.7, a, 0, TAU); g.fill();
    }
    for (let i = 0; i < 14; i++) {
      const a = rng() * TAU, d = r * (1.4 + rng() * 1.8), rr = Math.max(0.6, (0.4 + rng() * 1.3) * this.dpr);
      g.fillStyle = 'rgba(15,20,32,0.28)'; g.beginPath(); g.arc((x + Math.cos(a) * d) * s, (y + Math.sin(a) * d) * s + rr * 0.3, rr, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc((x + Math.cos(a) * d) * s - rr * 0.25, (y + Math.sin(a) * d) * s - rr * 0.3, rr * 0.5, 0, TAU); g.fill();
    }
  }

  // ---------- every frame ----------
  masks(sim) {
    const f = sim.f, m = this.maskI.data, rim = this.rimI.data, fx = this.fx || 0.85;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const k = j * GW + i, v = f[k], p = k * 4;
      // the mask: thin fog is nearly clear, then it thickens fast
      const a = clamp((v - 0.04) / (fx * 0.8));
      m[p] = m[p + 1] = m[p + 2] = 255; m[p + 3] = (a * a * (3 - 2 * a) * 255) | 0;
      // the rim: water piles up where the fog was pushed aside
      const gx = (i < GW - 1 ? f[k + 1] : v) - (i > 0 ? f[k - 1] : v), gy = (j < GH - 1 ? f[k + GW] : v) - (j > 0 ? f[k - GW] : v);
      const e = clamp(Math.sqrt(gx * gx + gy * gy) * 1.25 - 0.08) * (sim.wall[k] ? 0 : 1);
      rim[p] = rim[p + 1] = rim[p + 2] = 255; rim[p + 3] = (e * 255) | 0;
    }
    this.mg.putImageData(this.maskI, 0, 0);
    this.rg.putImageData(this.rimI, 0, 0);
  }
  draw(ctx, x0, y0, sim, cityC, t, dt) {
    const W = this.w, H = this.h, lv = this.lv || {}, [veil, va] = VEIL[this.mood] || VEIL.dawn;
    this.fx = sim.fog.max;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cityC, x0, y0, W, H);
    // the hot air over the vent wobbles the street behind it
    if (lv.heater) {
      const top = (PH - lv.heater) * this.s, strips = 18, sh = (H - top) / strips, cw = cityC.width / W;
      for (let i = 0; i < strips; i++) {
        const y = top + i * sh, u = i / strips, off = Math.sin(t * 7 + i * 1.7) * u * this.s * 0.06;
        ctx.drawImage(cityC, 0, y * cw, cityC.width, sh * cw + 1, x0 + off, y0 + y, W, sh + 1);
      }
      const gr = ctx.createLinearGradient(0, y0 + top, 0, y0 + H);
      gr.addColorStop(0, 'rgba(255,150,70,0)'); gr.addColorStop(1, 'rgba(255,140,60,0.22)');
      ctx.fillStyle = gr; ctx.fillRect(x0, y0 + top, W, H - top);
    }
    if (lv.night) ctx.drawImage(this.nightC, x0, y0);
    // the residue fades slowly by itself too
    this.fadeT += dt;
    if (this.fadeT > 0.25) { this.fadeT = 0; const g = this.res; g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.035)'; g.fillRect(0, 0, W, H); g.restore(); }
    ctx.drawImage(this.resC, x0, y0);
    // the fog
    this.masks(sim);
    const a = this.blurA.getContext('2d'), b = this.blurB.getContext('2d'), g = this.fg;
    a.imageSmoothingEnabled = b.imageSmoothingEnabled = g.imageSmoothingEnabled = true;
    a.drawImage(cityC, 0, 0, this.blurA.width, this.blurA.height);
    b.drawImage(this.blurA, 0, 0, this.blurB.width, this.blurB.height);
    // the veil goes on the tiny copy: same picture once scaled up, a full-size pass cheaper
    b.fillStyle = rgba(veil, va); b.fillRect(0, 0, this.blurB.width, this.blurB.height);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.drawImage(this.blurB, 0, 0, W, H);
    g.globalAlpha = this.mood === 'night' ? 0.55 : 0.8;
    g.fillStyle = this.pat || (this.pat = g.createPattern(this.grain, 'repeat')); g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(this.maskC, 0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.fogC, x0, y0);
    ctx.globalAlpha = this.mood === 'night' ? 0.28 : 0.42;
    ctx.drawImage(this.rimC, x0, y0, W, H);
    ctx.globalAlpha = 1;
  }
}
