// The picture you post. The photo from your moment, printed in the network's blue with only your
// yellow raincoat left in colour; under it the ticket: the steps you danced, how many «perdones» it
// cost, the three punches. Then the dare.
import { t } from './i18n.js';
import { FONT, DOTS, mark } from './gfx/station.js';
import { PAL } from './gfx/paint.js';
import { drawSteps } from './footprints.js';
import { clamp, hexToRgb, rgba } from './util.js';

export const BLUE = '#1e3f95', PAPER = '#f3f2ec';
const RED = PAL.stop, VIOLET = PAL.violet, INK = PAL.ink;

// luminance onto blue→paper, a little grain like newsprint; saturated yellows kept as they were
export function duotone(src) {
  const w = src.width, h = src.height, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  const im = g.getImageData(0, 0, w, h), d = im.data, [br, bg, bb] = hexToRgb(BLUE), [pr, pg, pb] = hexToRgb(PAPER);
  let s = 90210;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gr = d[i + 1], b = d[i + 2];
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    let l = (0.299 * r + 0.587 * gr + 0.114 * b) / 255;
    l = clamp((l - 0.1) / 0.82 + (((s >> 16) & 255) / 255 - 0.5) * 0.06);
    l = 0.55 * l * l * (3 - 2 * l) + 0.45 * l;
    const mx = Math.max(r, gr, b), mn = Math.min(r, gr, b), sat = mx ? (mx - mn) / mx : 0;
    let keep = 0;
    if (sat > 0.45 && mx > 90) {
      const q = mx - mn, hue = mx === r ? 60 * ((gr - b) / q) : mx === gr ? 60 * (2 + (b - r) / q) : 999;
      keep = clamp((hue - 34) / 6) * clamp((72 - hue) / 6) * clamp((sat - 0.45) / 0.2) * clamp((mx - 90) / 60);
    }
    const or = br + (pr - br) * l, og = bg + (pg - bg) * l, ob = bb + (pb - bb) * l;
    d[i] = or + (r - or) * keep; d[i + 1] = og + (gr - og) * keep; d[i + 2] = ob + (b - ob) * keep;
  }
  g.putImageData(im, 0, 0);
  return c;
}

function grain(g, x, y, w, h, seed, n, dark = 'rgba(29,34,51,0.05)', light = 'rgba(255,255,255,0.07)') {
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 16807) % 2147483647; const px = x + ((s % 10007) / 10007) * w;
    s = (s * 16807) % 2147483647; const py = y + ((s % 10007) / 10007) * h;
    g.fillStyle = s % 3 ? dark : light; g.fillRect(px, py, 2, 2);
  }
}
// a card with a semicircle bitten out of each side
export function ticketPath(g, x, y, w, h, r, ny, nr) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r);
  g.lineTo(x + w, ny - nr); g.arc(x + w, ny, nr, -Math.PI / 2, Math.PI / 2, true);
  g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r);
  g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r);
  g.lineTo(x, ny + nr); g.arc(x, ny, nr, Math.PI / 2, -Math.PI / 2, true);
  g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r);
  g.closePath();
}
// a star the validator punched through the card (on), or the faint guide of one it did not
const STAR = typeof Path2D !== 'undefined' ? new Path2D('M12 2.4l2.83 6.08 6.65.77-4.93 4.54 1.34 6.57L12 17.07l-5.89 3.29 1.34-6.57L2.52 9.25l6.65-.77z') : null;
export function starHole(g, x, y, S, on, under = PAPER) {
  if (!STAR) return;
  g.save(); g.translate(x - S / 2, y - S / 2); g.scale(S / 24, S / 24);
  if (on) {
    g.fillStyle = under; g.fill(STAR);
    g.clip(STAR); g.translate(0.4, 1.2); g.lineWidth = 2.4; g.strokeStyle = 'rgba(29,34,51,0.32)'; g.stroke(STAR);
  } else {
    g.setLineDash([0.9, 1.5]); g.lineCap = 'round'; g.lineWidth = 1.3; g.strokeStyle = rgba(VIOLET, 0.6); g.stroke(STAR);
  }
  g.restore();
}
// the font shorthand resets the stretch, so it is set again after every change of font
export function setFont(g, weight, size, family = FONT, str = 'normal') {
  g.font = `${weight} ${size}px ${family}`;
  if ('fontStretch' in g) g.fontStretch = str;
}
export function fitFont(g, text, weight, size, family, maxW, str = 'normal') {
  setFont(g, weight, size, family, str);
  const w = g.measureText(text).width;
  if (w > maxW) { size = Math.floor((size * maxW) / w); setFont(g, weight, size, family, str); }
  return size;
}
// a rubber stamp over the photo: red, a bit crooked, inked unevenly
function stamp(g, x, y, text, rot) {
  g.save(); g.translate(x, y); g.rotate(rot);
  const fs = fitFont(g, text, 900, 46, FONT, 500, 'expanded'), w = Math.ceil(g.measureText(text).width + 64), h = 84;
  const c = document.createElement('canvas'); c.width = w + 20; c.height = h + 20;
  const k = c.getContext('2d');
  k.translate(10, 10); k.strokeStyle = RED; k.fillStyle = RED;
  k.lineWidth = 6; k.strokeRect(3, 3, w - 6, h - 6); k.lineWidth = 2.5; k.strokeRect(12, 12, w - 24, h - 24);
  setFont(k, 900, fs, FONT, 'expanded'); k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(text, w / 2, h / 2 + 3);
  k.globalCompositeOperation = 'destination-out';
  grain(k, -10, -10, w + 20, h + 20, 7, 900, 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.25)');
  g.globalAlpha = 0.92; g.drawImage(c, -w / 2 - 10, -h / 2 - 10);
  g.restore();
}

// r: { photo (canvas, colour), dance, perdones, set, n, name, won, rumba, margin, url }
export function buildCard(r) {
  const W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H); grain(g, 0, 0, W, H, 3, 5200);
  const X = 40, CW = W - 2 * X;
  // header band: the game's name, and the station where the photo was taken
  g.fillStyle = PAL.band; g.fillRect(X, 40, CW, 116);
  g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const st = t('world.station').split(' '), l1 = st.slice(0, -1).join(' ') || st[0], l2 = st.length > 1 ? st[st.length - 1] : '';
  setFont(g, 800, 23);
  const tw = Math.max(g.measureText(l1).width, g.measureText(l2).width), tx = X + CW - 34 - tw;
  g.fillText(l1, tx, l2 ? 92 : 106); if (l2) g.fillText(l2, tx, 120);
  mark(g, tx - 50, 98, 64, '#fff');
  fitFont(g, t('title'), 900, 66, FONT, tx - 110 - (X + 36), 'expanded');
  g.fillText(t('title'), X + 36, 122);
  // the photo, cover-fitted into its window
  const py = 156, ph = 690, im = r.photo;
  g.fillStyle = BLUE; g.fillRect(X, py, CW, ph);
  if (im) {
    const duo = r.duo || duotone(im), k = Math.max(CW / duo.width, ph / duo.height), sw = CW / k, sh = ph / k;
    g.drawImage(duo, (duo.width - sw) / 2, (duo.height - sh) * 0.45, sw, sh, X, py, CW, ph);
  }
  if (r.rumba) stamp(g, X + CW - 250, py + ph - 90, t('res.rumba').toUpperCase(), -0.12);
  else if (!r.won) stamp(g, X + CW - 290, py + ph - 90, t('res.missed').toUpperCase(), -0.1);
  // the ticket
  const ty = 866, th = 356, ny = ty + th * 0.6;
  g.save();
  g.shadowColor = 'rgba(29,34,51,0.22)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
  ticketPath(g, X, ty, CW, th, 22, ny, 22); g.fillStyle = PAL.pink; g.fill();
  g.restore();
  g.save(); ticketPath(g, X, ty, CW, th, 22, ny, 22); g.clip();
  grain(g, X, ty, CW, th, 11, 1800, 'rgba(100,57,145,0.06)', 'rgba(255,255,255,0.12)');
  g.fillStyle = '#1d1f24'; g.fillRect(X, ty + 22, CW, 44);
  g.restore();
  drawSteps(g, X + 42, ty + 88, 560, 222, r.dance, { ink: VIOLET, rumba: t('res.rumba').toUpperCase() });
  g.save(); g.strokeStyle = VIOLET; g.lineWidth = 3; g.lineCap = 'round'; g.setLineDash([0.01, 9]);
  g.beginPath(); g.moveTo(X + 626, ty + 92); g.lineTo(X + 626, ty + 306); g.stroke();
  g.beginPath(); g.moveTo(X + 30, ty + 322); g.lineTo(X + CW - 30, ty + 322); g.stroke();
  g.restore();
  const nx = X + 626 + (CW - 626) / 2;
  g.fillStyle = VIOLET; g.textAlign = 'center';
  setFont(g, 900, r.perdones > 99 ? 118 : 160, DOTS); g.fillText(String(r.perdones), nx, ty + 212);
  setFont(g, 800, 26);
  g.fillText((r.perdones === 1 ? t('res.one') : t('res.many')).toUpperCase(), nx, ty + 250);
  for (let i = 0; i < 3; i++) starHole(g, nx + (i - 1) * 74, ty + 286, 56, r.set[i]);
  // fine print along the bottom edge
  setFont(g, 700, 21); g.textAlign = 'left';
  g.fillText(`${t('brief.trip', { n: r.n }).split(' ').slice(0, 2).join(' ')} · ${r.name}`.toUpperCase(), X + 36, ty + th - 10);
  g.textAlign = 'right';
  g.fillText(howText(r).toUpperCase(), X + CW - 36, ty + th - 10);
  // the dare
  g.textAlign = 'center'; g.fillStyle = INK;
  fitFont(g, t('share.dare'), 800, 38, FONT, CW - 60); g.fillText(t('share.dare'), W / 2, 1284);
  setFont(g, 600, 25); g.fillStyle = rgba(INK, 0.66); g.fillText(r.url.replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, 1322);
  return c;
}

// «¡Tren cogido! · con 6 s de sobra» / «el próximo, en 40 minutos»
export const howText = (r) => (r.won ? `${t('res.caught')} · ${r.margin >= 1 ? t('res.spare', { s: Math.floor(r.margin) }) : t('res.tight')}` : t('res.later'));

export function shareText(sim) {
  const P = sim.P, won = sim.end?.why === 'arrive';
  const s = P.rumbas.length ? t('share.rumba') : !won ? t('share.missed', { n: P.perdones }) : P.perdones ? t('share.caught', { n: P.perdones }) : t('share.zero');
  return `${s} ${t('share.dare')}`;
}

export function cardFile(cv, name = 'perdon.png') {
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
