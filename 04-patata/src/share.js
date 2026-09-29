// The card you post: the photo on an album page, marker and all, with the stars and the dare.
import { t } from './i18n.js';
import { FONT } from './hud.js';
import { drawMarks } from './print.js';
import { roundRect } from './util.js';

const INK = '#2a1a14', TAU = Math.PI * 2;
function paper(g, x, y, w, h, col, seed = 3) {
  g.fillStyle = col; g.fillRect(x, y, w, h);
  let s = seed;
  for (let i = 0; i < 2600; i++) {
    s = (s * 16807) % 2147483647; const px = x + (s % 10000) / 10000 * w; s = (s * 16807) % 2147483647; const py = y + (s % 10000) / 10000 * h;
    g.fillStyle = s % 3 ? 'rgba(90,60,30,0.035)' : 'rgba(255,255,255,0.05)'; g.fillRect(px, py, 2, 2);
  }
}
function sticker(g, x, y, s, rot, text) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.font = `${s}px ${FONT.display}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText(text).width + s * 0.9, h = s * 1.5;
  roundRect(g, -w / 2, -h / 2, w, h, h * 0.3); g.fillStyle = '#fbfaf6'; g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = s * 0.2; g.shadowOffsetY = s * 0.08; g.fill();
  g.shadowColor = 'transparent';
  roundRect(g, -w / 2 + s * 0.12, -h / 2 + s * 0.12, w - s * 0.24, h - s * 0.24, h * 0.24); g.fillStyle = '#e8b62c'; g.fill(); g.lineWidth = s * 0.06; g.strokeStyle = INK; g.stroke();
  g.lineWidth = s * 0.16; g.lineJoin = 'round'; g.strokeStyle = INK; g.strokeText(text, 0, s * 0.04);
  g.fillStyle = '#fbfaf6'; g.fillText(text, 0, s * 0.04);
  g.restore();
}
function star(g, x, y, r, on) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * TAU) / 10, rr = i % 2 ? r * 0.46 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.lineJoin = 'round';
  g.fillStyle = on ? '#e2b857' : 'rgba(42,26,20,0.12)'; g.fill();
  if (on) { g.lineWidth = r * 0.12; g.strokeStyle = INK; g.stroke(); }
}
// photo: the print canvas; spots: marker circles in its pixels; set: stars; ev; dare: bottom line
export function buildCard({ photo, spots, set, ev, won, url }) {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const vg = g.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H / 2, H * 0.8); vg.addColorStop(0, '#7a2632'); vg.addColorStop(1, '#3d0e16');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.setLineDash([14, 10]); g.lineWidth = 3; g.strokeStyle = 'rgba(226,184,87,0.6)'; roundRect(g, 22, 22, W - 44, H - 44, 26); g.stroke(); g.setLineDash([]);
  paper(g, 56, 56, W - 112, H - 112, '#f4ecd9');
  // the photo, in its corners
  // a portrait print is capped in height so the caption, stars and dare still fit under it
  const land = photo.width > photo.height, b = 22, maxH = 790 - 2 * b;
  let pw = land ? 880 : 600, ph = pw * photo.height / photo.width;
  if (ph > maxH) { ph = maxH; pw = ph * photo.width / photo.height; }
  const cx = W / 2, cy = land ? 560 : 140 + b + ph / 2;
  g.save(); g.translate(cx, cy); g.rotate(land ? -0.022 : 0.018);
  g.shadowColor = 'rgba(40,20,10,0.35)'; g.shadowBlur = 26; g.shadowOffsetY = 10;
  g.fillStyle = '#fbfaf6'; g.fillRect(-pw / 2 - b, -ph / 2 - b, pw + 2 * b, ph + 2 * b); g.shadowColor = 'transparent';
  g.drawImage(photo, -pw / 2, -ph / 2, pw, ph);
  if (spots?.length) { g.save(); g.translate(-pw / 2, -ph / 2); g.scale(pw / photo.width, pw / photo.width); drawMarks(g, spots, 1, photo.width); g.restore(); }
  const k = 70;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = sx * (pw / 2 + b), y = sy * (ph / 2 + b);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - sx * k, y); g.lineTo(x, y - sy * k); g.closePath(); g.fillStyle = '#1e1a18'; g.fill();
  }
  g.restore();
  // caption, handwritten under the photo
  const capY = cy + ph / 2 + b + 78;
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `700 50px ${FONT.hand}`; g.fillText(t('ev.' + ev.id + '.t'), W / 2, capY, W - 200);
  g.font = `400 36px ${FONT.hand}`; g.fillStyle = 'rgba(42,26,20,0.75)'; g.fillText(t('ev.' + ev.id + '.d'), W / 2, capY + 48);
  // stars and the dare
  const sy = Math.min(H - 190, capY + 128);
  for (let i = 0; i < 3; i++) star(g, W / 2 + (i - 1) * 92, sy, 38, set[i]);
  g.font = `800 32px ${FONT.ui}`; g.fillStyle = INK; g.fillText(won ? t('dare') : t('dareFail'), W / 2, H - 116, W - 180);
  g.font = `600 26px ${FONT.ui}`; g.fillStyle = 'rgba(42,26,20,0.6)'; g.fillText(url.replace(/^https?:\/\//, ''), W / 2, H - 76, W - 180);
  sticker(g, 230, 128, 64, -0.08, t('title'));
  return c;
}

export function cardFile(cv, name = 'patata.png') {
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
