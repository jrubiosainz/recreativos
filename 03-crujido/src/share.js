// The share cards (1080×1350): the poster with the verdict stamped on it, your film on the
// strip, the stars and the numbers; and the season sheet with all six posters.
import { canvas, text, fit, rr, gilt, giltFrame, bulb, starPath } from './gfx/paint.js';
import { drawCurve } from './gfx/curve.js';

const CW = 1080, CH = 1350, NAVY = '#0b1020', GOLD = '#ffd98a', CREAM = '#fbf3df';

function backdrop(g) {
  g.fillStyle = NAVY; g.fillRect(0, 0, CW, CH);
  const gr = g.createRadialGradient(CW / 2, CH * 0.3, 0, CW / 2, CH * 0.3, CH * 0.8);
  gr.addColorStop(0, 'rgba(142,21,32,0.55)'); gr.addColorStop(1, 'rgba(142,21,32,0)');
  g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
}
function cover(g, im, x, y, w, h, fy = 0.3) {
  if (!im) { g.fillStyle = '#1a1420'; g.fillRect(x, y, w, h); return; }
  const s = Math.max(w / im.width, h / im.height), sw = w / s, sh = h / s;
  g.drawImage(im, (im.width - sw) / 2, (im.height - sh) * fy, sw, sh, x, y, w, h);
}
function footer(g, t, y) {
  text(g, 'CRUJIDO', 90, y, { font: '76px Limelight, serif', fill: GOLD, stroke: '#2a0508', lw: 8, align: 'left', shadow: 'rgba(255,170,60,0.8)', blur: 26 });
  text(g, t('tagline'), CW - 90, y - 18, { font: '600 30px Oswald, sans-serif', fill: CREAM, align: 'right' });
  text(g, t('card.url'), CW - 90, y + 22, { font: '400 24px Atkinson, sans-serif', fill: 'rgba(251,243,223,0.7)', align: 'right' });
}
function starRow(g, set, cx, y, r) {
  set.forEach((on, i) => {
    const x = cx + (i - 1) * r * 2.6;
    g.save();
    starPath(g, x, y, r);
    if (on) { g.shadowColor = 'rgba(255,190,80,0.9)'; g.shadowBlur = r * 0.6; g.fillStyle = gilt(g, x, y - r, x, y + r); g.fill(); }
    else { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,217,138,0.35)'; g.stroke(); }
    g.restore();
  });
}
// a rubber stamp across the poster's corner; (right, y) is where its right edge sits
function stamp(g, s, right, y, col) {
  const size = fit(g, s, 430, 58, (z) => `${z}px Shrikhand, serif`);
  g.save(); g.font = `${size}px Shrikhand, serif`;
  const w = g.measureText(s).width + 60, h = size * 1.55;
  g.translate(right - w / 2, y); g.rotate(-0.16);
  g.fillStyle = 'rgba(14,6,10,0.3)'; rr(g, -w / 2, -h / 2, w, h, 16); g.fill();
  g.globalAlpha = 0.93; g.lineWidth = 7; g.strokeStyle = col; rr(g, -w / 2, -h / 2, w, h, 16); g.stroke();
  g.lineWidth = 2.5; rr(g, -w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 10); g.stroke();
  text(g, s, 0, size * 0.06, { font: `${size}px Shrikhand, serif`, fill: col });
  g.restore();
}

// info: { level, res, kind, title, genre, poster, data, t }
export function buildCard({ res, kind, title, genre, poster, data, t }) {
  const c = canvas(CW, CH), g = c.getContext('2d');
  backdrop(g);
  const px = 90, py = 84, pw = CW - 180, ph = 560;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40; g.fillStyle = '#000'; g.fillRect(px, py, pw, ph); g.restore();
  cover(g, poster, px, py, pw, ph, 0.22);
  const fade = g.createLinearGradient(0, py + ph * 0.55, 0, py + ph);
  fade.addColorStop(0, 'rgba(6,4,8,0)'); fade.addColorStop(1, 'rgba(6,4,8,0.92)');
  g.fillStyle = fade; g.fillRect(px, py, pw, ph);
  giltFrame(g, px, py, pw, ph, 14);
  for (let i = 0; i <= 18; i++) { bulb(g, px + (pw * i) / 18, py - 7, 5.5, i % 2 ? 1 : 0.55); bulb(g, px + (pw * i) / 18, py + ph + 7, 5.5, i % 2 ? 0.55 : 1); }
  text(g, genre.toUpperCase(), CW / 2, py + ph - 116, { font: '600 28px Oswald, sans-serif', fill: CREAM });
  const ts = fit(g, title, pw - 80, 70, (z) => `${z}px Shrikhand, serif`);
  text(g, title, CW / 2, py + ph - 60, { font: `${ts}px Shrikhand, serif`, fill: GOLD, stroke: '#2a0508', lw: 8, shadow: 'rgba(0,0,0,0.7)', blur: 14 });
  const three = kind === 'full' && res.stars.every(Boolean);
  stamp(g, t('stamp.' + (three ? 'full3' : kind)), px + pw - 44, py + 112, kind === 'expelled' ? '#ff6b5e' : kind === 'hungry' ? '#cfe0ff' : GOLD);
  // the strip
  const sy = py + ph + 58, sh = 290;
  giltFrame(g, px, sy, pw, sh, 6);
  drawCurve(g, px, sy, pw, sh, data, { u: 1, labels: { film: t('card.film'), hid: t('card.hid'), heard: t('card.heard') } });
  starRow(g, res.stars, CW / 2, sy + sh + 104, 40);
  const stats = `${res.ate}/${res.total} ${t('result.ate')} · ${res.heard} ${t('result.heard')} · ${Math.round(res.hidden * 100)} % ${t('result.hidden')}`;
  const ss = fit(g, stats.toUpperCase(), pw, 32, (z) => `600 ${z}px Oswald, sans-serif`);
  text(g, stats.toUpperCase(), CW / 2, sy + sh + 178, { font: `600 ${ss}px Oswald, sans-serif`, fill: CREAM });
  footer(g, t, CH - 72);
  return c;
}

// posters: [{ title, img, set }]
export function buildSeasonCard({ posters, stars, max, t }) {
  const c = canvas(CW, CH), g = c.getContext('2d');
  backdrop(g);
  const hs = fit(g, t('done.title'), CW - 180, 92, (z) => `${z}px Shrikhand, serif`);
  text(g, t('done.title'), CW / 2, 112, { font: `${hs}px Shrikhand, serif`, fill: GOLD, stroke: '#2a0508', lw: 8, shadow: 'rgba(255,170,60,0.6)', blur: 24 });
  text(g, t('done.stars', { n: stars, m: max }).toUpperCase(), CW / 2, 186, { font: '600 40px Oswald, sans-serif', fill: CREAM });
  // two rows of three posters, each with its stars underneath, between the header and the footer
  const cols = 3, gx = 36, y0 = 236, rowGap = 86, bottom = CH - 170;
  const ch = Math.min((CW - 180 - gx * (cols - 1)) / cols * 1.5, (bottom - y0 - rowGap - 62) / 2), cw = ch / 1.5;
  const x0 = (CW - (cols * cw + (cols - 1) * gx)) / 2;
  posters.forEach((p, i) => {
    const x = x0 + (i % cols) * (cw + gx), y = y0 + Math.floor(i / cols) * (ch + rowGap);
    cover(g, p.img, x, y, cw, ch, 0.25);
    const fade = g.createLinearGradient(0, y + ch * 0.62, 0, y + ch);
    fade.addColorStop(0, 'rgba(6,4,8,0)'); fade.addColorStop(1, 'rgba(6,4,8,0.9)');
    g.fillStyle = fade; g.fillRect(x, y, cw, ch);
    giltFrame(g, x, y, cw, ch, 6);
    const ts = fit(g, p.title, cw - 28, 30, (z) => `${z}px Shrikhand, serif`);
    text(g, p.title, x + cw / 2, y + ch - 30, { font: `${ts}px Shrikhand, serif`, fill: GOLD, stroke: '#2a0508', lw: 5, shadow: 'rgba(0,0,0,0.7)', blur: 10 });
    p.set.forEach((on, k) => {
      const sx = x + cw / 2 + (k - 1) * 44, yy = y + ch + 40;
      starPath(g, sx, yy, 17);
      g.fillStyle = on ? GOLD : 'rgba(255,255,255,0.12)'; g.fill();
    });
  });
  footer(g, t, CH - 80);
  return c;
}

export function cardFile(cv, name = 'crujido.png') {
  if (cv.convertToBlob) return cv.convertToBlob({ type: 'image/png' }).then((b) => new File([b], name, { type: 'image/png' })).catch(() => null);
  return new Promise((res) => cv.toBlob((b) => res(b ? new File([b], name, { type: 'image/png' }) : null), 'image/png'));
}

export async function shareCard(file, text) {
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return 'shared'; }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
  if (file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  try { await navigator.clipboard.writeText(text); return file ? 'both' : 'copied'; } catch { return file ? 'downloaded' : 'error'; }
}
