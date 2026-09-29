// The title: Gran Vía at night in the rain, and the cinema's facade. The marquee spells CRUJIDO in
// bulbs, the billboard shows the session you picked, the letter board (DOM, over the frame drawn
// here) is the level select, and the booth sells you the ticket.
import { clamp, lerp, easeOut, easeInOut, hash, canvas, bulb, gilt, giltFrame, text, fit, rr } from './paint.js';

const RED = '#8e1520', RED2 = '#5a0a12', NIGHT = '#0b1020';

export function layoutFacade(W, H, safeBottom = 0) {
  const port = H > W * 1.1, bottom = H - safeBottom;
  if (port) {
    const fw = Math.min(W * 0.86, H * 0.47), fx = (W - fw) / 2, top = Math.max(10, H * 0.022);
    const crestH = fw * 0.25, gap = fw * 0.025, boothH = Math.max(118, H * 0.17), tagH = Math.max(18, fw * 0.066);
    const boardH = Math.min(Math.max(fw * 0.62, 6 * 42 + 14), H * 0.34);
    const tagY = top + crestH + gap * 0.5, posterY = tagY + tagH + gap * 0.7, posterH = bottom - boothH - boardH - gap * 3 - posterY;
    const pw = Math.min(fw * 0.9, posterH / 1.2);
    return finishLayout({ W, H, port, fac: { x: fx, y: top, w: fw, h: H - top }, crest: { x: fx, y: top, w: fw, h: crestH },
      tag: { x: fx + fw * 0.1, y: tagY, w: fw * 0.8, h: tagH },
      poster: { x: fx + (fw - pw) / 2, y: posterY, w: pw, h: posterH },
      board: { x: fx + fw * 0.04, y: posterY + posterH + gap, w: fw * 0.92, h: boardH },
      booth: { x: fx + fw * 0.12, y: bottom - boothH, w: fw * 0.76, h: boothH + safeBottom } }, safeBottom);
  }
  // landscape: the crest across the top, the billboard and the letter board side by side, the booth below
  const fw = Math.min(W * 0.66, H * 1.3), fx = (W - fw) / 2, top = H * 0.02, gap = fw * 0.022;
  const crestH = Math.min(fw * 0.2, H * 0.17), boothH = Math.max(104, H * 0.2), tagH = Math.max(18, H * 0.034);
  const tagY = top + crestH + gap * 0.4, rowY = tagY + tagH + gap * 0.8, rowH = bottom - boothH - gap * 1.5 - rowY;
  const pw = Math.min(rowH / 1.35, fw * 0.36), bx = fx + fw * 0.05 + pw + gap * 1.6;
  return finishLayout({ W, H, port, fac: { x: fx, y: top, w: fw, h: H - top }, crest: { x: fx + fw * 0.08, y: top, w: fw * 0.84, h: crestH },
    tag: { x: fx + fw * 0.25, y: tagY, w: fw * 0.5, h: tagH },
    poster: { x: fx + fw * 0.05, y: rowY, w: pw, h: rowH },
    board: { x: bx, y: rowY + gap * 0.4, w: fx + fw * 0.95 - bx, h: rowH - gap * 0.8 },
    booth: { x: fx + fw * 0.3, y: bottom - boothH, w: fw * 0.4, h: boothH + safeBottom } }, safeBottom);
}
// the window and the buy button sit in the booth's visible part, above any home-indicator inset
function finishLayout(R, safe) {
  const b = R.booth, h = b.h - safe;
  R.safe = safe;
  const buyH = Math.max(40, h * 0.28);
  R.win = { x: b.x + b.w * 0.2, y: b.y + h * 0.1, w: b.w * 0.6, h: Math.max(h * 0.2, Math.min(h * 0.4, b.w * 0.3, h * 0.74 - buyH)) };
  R.buy = { x: b.x + b.w * 0.12, y: R.win.y + R.win.h + h * 0.08, w: b.w * 0.76, h: buyH };
  // on a phone the marquee spans the screen: language and sound go on the pilasters beside the booth
  if (R.port) {
    const s = clamp(b.x - 20, 34, 42), y = (R.win.y + R.buy.y + R.buy.h) / 2 - s / 2;
    R.lang = { x: (b.x - s) / 2, y, w: s, h: s };
    R.snd = { x: b.x + b.w + (R.W - b.x - b.w - s) / 2, y, w: s, h: s };
  }
  return R;
}

// CRUJIDO in bulbs: the word is rendered once and sampled on a grid; each lit cell gets a bulb
const letterCache = new Map();
function bulbGrid(word, w, h, pitch) {
  const key = `${word}|${w | 0}|${h | 0}|${pitch | 0}`;
  if (letterCache.has(key)) return letterCache.get(key);
  const c = canvas(Math.ceil(w), Math.ceil(h)), x = c.getContext('2d');
  const size = fit(x, word, w * 0.96, h * 0.92, (s) => `${s}px Limelight, serif`);
  x.font = `${size}px Limelight, serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
  x.fillText(word, w / 2, h * 0.53);
  const d = x.getImageData(0, 0, c.width, c.height).data, pts = [];
  for (let y = pitch / 2; y < h; y += pitch) for (let X = pitch / 2; X < w; X += pitch) {
    const i = ((y | 0) * c.width + (X | 0)) * 4 + 3;
    if (d[i] > 150) pts.push({ x: X, y, k: X / w });
  }
  const out = { c, pts, size };
  letterCache.set(key, out);
  return out;
}

export class Facade {
  // img: { street_v, street_h, poster_<id>... }
  constructor(img) {
    this.img = img; this.rain = Array.from({ length: 150 }, (_, i) => ({ x: hash(i * 1.3), y: hash(i * 7.7), v: 0.7 + hash(i * 3.1) * 0.6, l: 0.5 + hash(i * 5.9) }));
    this.show = null; this.prev = null; this.flipT = -9; this.pend = null; this.pendT = 0;
  }
  // the sign only turns once the new poster is in (or after 2.5 s, so a missing file can't jam it)
  poster(id, t) { this.pend = id === this.show ? null : id; this.pendT = t; }
  turn(t) {
    if (!this.pend || (!this.img['poster_' + this.pend] && t - this.pendT < 2.5)) return;
    this.prev = this.show; this.show = this.pend; this.flipT = t; this.pend = null;
  }

  // rows: the letter board's contents, painted only when the DOM board is not over it
  draw(g, R, dpr, t, { title = '', genre = '', tagline = '', dim = 0, rows = null } = {}) {
    const { W, H, port } = R;
    this.street(g, R, t);
    this.front(g, R, dpr, t);
    this.crest(g, R.crest, dpr, t);
    this.reader(g, R.tag, tagline);
    this.billboard(g, R.poster, dpr, t, title, genre);
    this.boardFrame(g, R.board, dpr, t);
    if (rows) this.boardText(g, R.board, rows);
    this.booth(g, R.booth, R.win, dpr, t);
    this.rainFront(g, W, H, t);
    if (dim > 0) { g.fillStyle = `rgba(6,8,16,${dim})`; g.fillRect(0, 0, W, H); }
  }

  street(g, R, t) {
    const { W, H, port } = R, im = port ? this.img.street_v : this.img.street_h;
    g.fillStyle = NIGHT; g.fillRect(0, 0, W, H);
    if (im) {
      const s = Math.max(W / im.width, H / im.height), w = im.width * s, h = im.height * s;
      g.drawImage(im, (W - w) / 2, H - h, w, h);
    }
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(8,10,24,0.35)'); gr.addColorStop(0.6, 'rgba(8,10,24,0.1)'); gr.addColorStop(1, 'rgba(8,10,24,0.45)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  // the building: dark stone either side of the red-and-gold front, warm light spilling on the wet pavement
  front(g, R, dpr, t) {
    const f = R.fac, { H } = R;
    const glow = g.createRadialGradient(f.x + f.w / 2, H, 0, f.x + f.w / 2, H, f.w * 1.1);
    glow.addColorStop(0, 'rgba(255,170,80,0.35)'); glow.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = glow; g.fillRect(f.x - f.w, H - f.w * 1.1, f.w * 3, f.w * 1.1);
    g.fillStyle = '#140d10'; rr(g, f.x - f.w * 0.01, f.y + R.crest.h * 0.5, f.w * 1.02, f.h, 4); g.fill();
    const st = g.createLinearGradient(f.x, 0, f.x + f.w, 0);
    st.addColorStop(0, '#1d1316'); st.addColorStop(0.5, '#2c1a1c'); st.addColorStop(1, '#1d1316');
    g.fillStyle = st; g.fillRect(f.x + f.w * 0.02, f.y + R.crest.h * 0.5, f.w * 0.96, f.h);
    // fluted pilasters with a gilt line
    for (const x of [f.x + f.w * 0.02, f.x + f.w * 0.94]) {
      g.fillStyle = '#3a2224'; g.fillRect(x, f.y + R.crest.h, f.w * 0.04, f.h);
      g.fillStyle = gilt(g, x, 0, x + f.w * 0.04, 0, 0.8); g.fillRect(x + f.w * 0.017, f.y + R.crest.h, Math.max(1, f.w * 0.006), f.h);
    }
  }
  crest(g, r, dpr, t) {
    const { x, y, w, h } = r, pad = h * 0.1;
    // warm spill around the sign, as a gradient: a shadowBlur this wide gets truncated into a faint box
    g.save();
    const rx = w / 2 + h * 0.7, ry = h / 2 + h * 0.7;
    g.translate(x + w / 2, y + h / 2); g.scale(1, ry / rx);
    const spill = g.createRadialGradient(0, 0, rx * 0.5, 0, 0, rx);
    spill.addColorStop(0, 'rgba(255,140,60,0.34)'); spill.addColorStop(0.5, 'rgba(255,140,60,0.12)'); spill.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = spill; g.fillRect(-rx, -rx, rx * 2, rx * 2);
    g.restore();
    g.fillStyle = gilt(g, x, y, x, y + h); rr(g, x, y, w, h, h * 0.18); g.fill();
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#a3202b'); gr.addColorStop(0.55, RED); gr.addColorStop(1, RED2);
    g.fillStyle = gr; rr(g, x + pad * 0.5, y + pad * 0.5, w - pad, h - pad, h * 0.14); g.fill();
    // the chase around the rim
    const n = Math.max(14, Math.round(w / (h * 0.16))), rim = h * 0.045;
    for (let i = 0; i < n; i++) {
      const u = i / n, on = 0.25 + 0.75 * ((Math.floor(t * 6) + i) % 3 === 0 ? 1 : 0.15);
      const bx = x + pad * 0.5 + u * (w - pad), top = y + pad * 0.5 + rim * 0.2, bot = y + h - pad * 0.5 - rim * 0.2;
      bulb(g, bx, top, rim, on, { dpr }); bulb(g, x + w - pad * 0.5 - u * (w - pad), bot, rim, on, { dpr });
    }
    // the letters: gold plate under the bulbs
    const lw = w - pad * 3, lh = h - pad * 3.2, pitch = Math.max(4, lh / 9), G = bulbGrid('CRUJIDO', lw, lh, pitch), ox = x + pad * 1.5, oy = y + pad * 1.6;
    g.save();
    g.globalAlpha = 0.95; g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowOffsetY = h * 0.02; g.shadowBlur = h * 0.03;
    text(g, 'CRUJIDO', x + w / 2, oy + lh * 0.53, { font: `${G.size}px Limelight, serif`, fill: '#f6d58c', stroke: '#3a0a08', lw: Math.max(2, G.size * 0.06) });
    g.restore();
    const flick = hash(Math.floor(t * 9)) < 0.1 ? Math.floor(hash(Math.floor(t * 9) + 3) * 7) : -1;
    for (const p of G.pts) {
      const col = Math.floor(p.k * 7), wave = 0.72 + 0.28 * Math.sin(t * 3 - p.k * 9);
      bulb(g, ox + p.x, oy + p.y, pitch * 0.34, col === flick ? 0.3 : wave, { dpr, halo: false });
    }
    // the glow off the letters: an ellipse that has faded to nothing by the edge of the rect it fills
    g.save(); g.globalCompositeOperation = 'lighter';
    const hr = w * 0.6; g.translate(x + w / 2, y + h / 2); g.scale(1, h / hr);
    const halo = g.createRadialGradient(0, 0, 0, 0, 0, hr);
    halo.addColorStop(0, 'rgba(255,190,90,0.2)'); halo.addColorStop(0.6, 'rgba(255,190,90,0.07)'); halo.addColorStop(1, 'rgba(255,190,90,0)');
    g.fillStyle = halo; g.fillRect(-hr, -hr, hr * 2, hr * 2);
    g.restore();
  }
  // the reader board under the crest: black glass, cream letters slotted in by hand
  reader(g, r, s) {
    if (!s) return;
    const { x, y, w, h } = r;
    g.fillStyle = gilt(g, x, y - 2, x, y + h + 2); rr(g, x - 2, y - 2, w + 4, h + 4, 3); g.fill();
    g.fillStyle = '#0c0a0c'; rr(g, x, y, w, h, 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, y, w, h * 0.45);
    const str = s.toUpperCase().split('').join('\u200a'), size = fit(g, str, w * 0.92, Math.round(h * 0.66), (z) => `600 ${z}px Oswald, sans-serif`);
    text(g, str, x + w / 2, y + h * 0.54, { font: `600 ${size}px Oswald, sans-serif`, fill: '#fbf3df', shadow: 'rgba(255,220,160,0.35)', blur: 4 });
  }
  billboard(g, r, dpr, t, title, genre) {
    const { x, y, w, h } = r, fw = Math.max(5, w * 0.035);
    this.turn(t);
    g.fillStyle = '#0a0808'; g.fillRect(x, y, w, h);
    const draw = (id, a, sq) => {
      const im = this.img['poster_' + id]; if (!im || a <= 0) return;
      const s = Math.max(w / im.width, (h / im.height)), iw = im.width * s, ih = im.height * s;
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.globalAlpha = a;
      g.translate(x + w / 2, y + h / 2); g.scale(1, sq); g.drawImage(im, -iw / 2, -h / 2 - (ih - h) * 0.12, iw, ih); g.restore();
    };
    const u = clamp((t - this.flipT) / 0.5);
    if (u < 1 && this.prev) {                                 // the billboard turns like a louvred sign
      if (u < 0.5) draw(this.prev, 1, 1 - easeInOut(u * 2)); else draw(this.show, 1, easeInOut(u * 2 - 1));
    } else draw(this.show, 1, 1);
    // the title painted over the poster's dark foot
    if (title && u >= 0.5 && !this.pend) {
      const a = clamp((t - this.flipT - 0.45) / 0.3);
      const sh = g.createLinearGradient(0, y + h * 0.6, 0, y + h); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.75)');
      g.fillStyle = sh; g.fillRect(x, y + h * 0.6, w, h * 0.4);
      g.save(); g.globalAlpha = a;
      const size = fit(g, title, w * 0.86, h * 0.1, (s) => `${s}px Shrikhand, serif`);
      text(g, title, x + w / 2, y + h * 0.88, { font: `${size}px Shrikhand, serif`, fill: '#ffd98a', stroke: '#2a0906', lw: Math.max(2, size * 0.14) });
      if (genre) text(g, genre.toUpperCase(), x + w / 2, y + h * 0.88 - size * 0.95, { font: `600 ${Math.round(clamp(size * 0.36, 10, 16))}px Oswald, sans-serif`, fill: 'rgba(255,240,215,0.9)' });
      g.restore();
    }
    giltFrame(g, x, y, w, h, fw, { glow: 0.5 });
    const n = Math.round((w + h) * 2 / (fw * 3.2));
    for (let i = 0; i < n; i++) {
      const p = this.perim(r, fw, i / n), on = (Math.floor(t * 5) + i) % 4 === 0 ? 1 : 0.35;
      bulb(g, p[0], p[1], fw * 0.3, on, { dpr });
    }
  }
  perim({ x, y, w, h }, fw, u) {
    const P = 2 * (w + h), d = u * P, o = fw * 0.5;
    if (d < w) return [x + d, y - o]; if (d < w + h) return [x + w + o, y + d - w];
    if (d < 2 * w + h) return [x + w - (d - w - h), y + h + o]; return [x - o, y + h - (d - 2 * w - h)];
  }
  // the letter board's frame; the rows are DOM buttons laid over it
  boardFrame(g, r, dpr, t) {
    const { x, y, w, h } = r, e = Math.max(6, w * 0.035);
    g.fillStyle = gilt(g, x, y, x, y + h); rr(g, x - e, y - e, w + e * 2, h + e * 2, e); g.fill();
    g.fillStyle = RED2; rr(g, x - e * 0.55, y - e * 0.55, w + e * 1.1, h + e * 1.1, e * 0.7); g.fill();
    const n = Math.round(w / (e * 1.6));
    for (let i = 0; i <= n; i++) {
      const on = (Math.floor(t * 4) + i) % 2 ? 0.95 : 0.45, bx = x + (w * i) / n;
      bulb(g, bx, y - e * 0.28, e * 0.2, on, { dpr }); bulb(g, x + w - (w * i) / n, y + h + e * 0.28, e * 0.2, on, { dpr });
    }
    const pg = g.createLinearGradient(0, y, 0, y + h); pg.addColorStop(0, '#fbf3df'); pg.addColorStop(1, '#e9dcbd');
    g.fillStyle = pg; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(80,60,40,0.14)'; g.lineWidth = 1;
    for (let yy = y + h / 18; yy < y + h; yy += h / 18) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
  }
  // the same slotted letters the DOM board uses, for the screens that cover it
  boardText(g, r, { head, list }) {
    const u = r.h / 6.8, fs = Math.min(u * 0.52, r.w * 0.05), pad = fs * 1.4;
    g.save(); g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillStyle = '#8e1520'; g.font = `600 ${fs * 0.8}px Oswald, sans-serif`;
    if ('letterSpacing' in g) g.letterSpacing = `${(fs * 0.8 * 0.22).toFixed(1)}px`;
    g.fillText(head, r.x + fs * 0.9, r.y + u * 0.4);
    list.forEach((row, i) => {
      const y = r.y + u * (0.8 + i + 0.5);
      g.fillStyle = row.locked ? 'rgba(27,18,16,0.3)' : row.lit ? '#8e1520' : '#1b1210';
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      g.font = `600 ${fs}px Oswald, sans-serif`; g.fillText(row.time, r.x + pad, y);
      if ('letterSpacing' in g) g.letterSpacing = `${(fs * 0.06).toFixed(1)}px`;
      g.font = `500 ${fs}px Oswald, sans-serif`; g.fillText(row.name, r.x + pad + fs * 3.5, y, r.w - pad * 2 - fs * 5.6);
    });
    g.restore();
  }
  booth(g, b, win, dpr, t) {
    const { x, y, w, h } = b;
    g.fillStyle = gilt(g, x, y, x + w, y); rr(g, x, y, w, h + 4, w * 0.06); g.fill();
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, RED); gr.addColorStop(1, RED2);
    g.fillStyle = gr; rr(g, x + w * 0.025, y + w * 0.025, w * 0.95, h, w * 0.05); g.fill();
    // the window: warm light, the cashier waiting behind the glass
    const wg = g.createLinearGradient(0, win.y, 0, win.y + win.h); wg.addColorStop(0, '#ffcf86'); wg.addColorStop(1, '#b8663a');
    g.fillStyle = wg; rr(g, win.x, win.y, win.w, win.h, win.w * 0.08); g.fill();
    const cx = win.x + win.w * 0.5 + Math.sin(t * 0.7) * win.w * 0.02, cy = win.y + win.h * 0.5, s = win.h * 0.3;
    g.fillStyle = '#3a1c14';
    g.beginPath(); g.ellipse(cx, cy, s * 0.72, s * 0.86, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(cx - s * 2, win.y + win.h); g.quadraticCurveTo(cx - s * 1.9, cy + s * 0.9, cx, cy + s * 0.85); g.quadraticCurveTo(cx + s * 1.9, cy + s * 0.9, cx + s * 2, win.y + win.h); g.fill();
    g.fillStyle = '#1b0c08';                                                                             // the cap
    g.beginPath(); g.ellipse(cx, cy - s * 0.52, s * 0.74, s * 0.46, 0, Math.PI, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx + s * 0.25, cy - s * 0.52, s * 0.62, s * 0.12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.moveTo(win.x + win.w * 0.1, win.y); g.lineTo(win.x + win.w * 0.3, win.y); g.lineTo(win.x + win.w * 0.12, win.y + win.h); g.lineTo(win.x - win.w * 0.08, win.y + win.h); g.fill();
    g.lineWidth = Math.max(2, w * 0.012); g.strokeStyle = gilt(g, win.x, win.y, win.x, win.y + win.h); rr(g, win.x, win.y, win.w, win.h, win.w * 0.08); g.stroke();
    g.fillStyle = 'rgba(20,6,6,0.55)'; rr(g, win.x + win.w * 0.36, win.y + win.h - 3, win.w * 0.28, 6, 3); g.fill();   // the slot
  }
  rainFront(g, W, H, t) {
    g.strokeStyle = 'rgba(200,215,255,0.22)'; g.lineWidth = 1;
    g.beginPath();
    for (const d of this.rain) {
      const yy = ((d.y + t * d.v * 1.1) % 1) * (H + 80) - 40, xx = ((d.x + t * 0.03) % 1) * W, l = 12 + d.l * 16;
      g.moveTo(xx, yy); g.lineTo(xx - l * 0.18, yy + l);
    }
    g.stroke();
  }
}
