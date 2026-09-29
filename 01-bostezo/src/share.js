// Share card: a 1080×1350 image built around a real frame of your meeting falling asleep.
import { FONT, drawStar } from './fx.js';
import { roundRect, fmtTime } from './util.js';

const INK = '#1d1733', CREAM = '#fff8ec', LAV = '#b9acdf', LILAC = '#c3b3ff', YOU = '#ffd166', DANGER = '#ff5a4f';

// copy of the game canvas at the money shot (the canvas is live, so it must be copied now)
export function snapshot(canvas, maxW = 1400) {
  const k = Math.min(1, maxW / canvas.width);
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k);
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

function greedy(g, words, maxW) {
  const out = [];
  let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur);
  return out;
}
// like CSS text-wrap: balance: keep greedy's line count, but at the narrowest width that allows it (no orphans)
function lines(g, text, maxW) {
  const words = text.split(/\s+/), base = greedy(g, words, maxW);
  if (base.length < 2) return base;
  let lo = 0, hi = maxW;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (greedy(g, words, mid).length > base.length) lo = mid; else hi = mid; }
  return greedy(g, words, hi);
}

function sticker(g, text, x, y, size, fill, shadow) {
  g.font = `700 ${size}px ${FONT}`;
  g.fillStyle = shadow; g.fillText(text, x, y + size * 0.09);
  g.fillStyle = fill; g.fillText(text, x, y);
}

function drawShot(g, shot, cx, top, maxW, maxH, fired) {
  if (!shot) return top;
  const a = shot.width / shot.height;
  let w = maxW, h = w / a;
  if (h > maxH) { h = maxH; w = h * a; }
  const x = cx - w / 2, y = top, portrait = a < 1;
  g.save();
  g.translate(cx, y + h / 2); g.rotate(portrait ? 0.02 : -0.022); g.translate(-cx, -(y + h / 2));
  const bw = portrait ? 18 : 16, r = portrait ? 44 : 26;
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 44; g.shadowOffsetY = 20;
  roundRect(g, x - bw, y - bw, w + bw * 2, h + bw * 2, r + bw * 0.6); g.fillStyle = portrait ? '#0d0a1c' : CREAM; g.fill();
  g.shadowColor = 'transparent';
  g.save(); roundRect(g, x, y, w, h, r * 0.7); g.clip(); g.drawImage(shot, x, y, w, h);
  if (fired) { g.fillStyle = 'rgba(40,6,10,0.28)'; g.fillRect(x, y, w, h); }
  g.restore();
  if (fired) {
    g.save(); g.translate(cx, y + h * 0.5); g.rotate(-0.2);
    const label = fired, fs = Math.min(150, w * 0.17);
    g.font = `700 ${fs}px ${FONT}`;
    const tw = g.measureText(label).width + fs * 0.7, th = fs * 1.3;
    g.strokeStyle = DANGER; g.lineWidth = fs * 0.1; roundRect(g, -tw / 2, -th / 2, tw, th, fs * 0.16); g.stroke();
    g.lineWidth = fs * 0.035; roundRect(g, -tw / 2 + fs * 0.13, -th / 2 + fs * 0.13, tw - fs * 0.26, th - fs * 0.26, fs * 0.08); g.stroke();
    g.fillStyle = DANGER; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 0, fs * 0.06);
    g.restore();
  }
  g.restore();
  return y + h + bw;
}

// info: { kind: 'win'|'fired', shot, levelName, when, time, chain, stars:[b,b,b], t }
export function buildCard(info) {
  const W = 1080, H = 1350, t = info.t;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 170, 30, W / 2, 170, 820);
  glow.addColorStop(0, info.kind === 'fired' ? '#4a1f3a' : '#3d2c80'); glow.addColorStop(1, 'rgba(29,23,51,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  // drifting z's, the house texture
  g.font = `700 64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 16; i++) {
    const x = ((i * 397) % 1000) + 40, y = ((i * 571) % 1200) + 70;
    g.fillStyle = `rgba(195,179,255,${0.04 + (i % 3) * 0.02})`; g.font = `700 ${38 + (i % 4) * 16}px ${FONT}`; g.fillText('z', x, y);
  }
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  // headline
  const top = info.kind === 'fired' ? t('shareCard.firedTop') : t('shareCard.top');
  g.font = `700 112px ${FONT}`;
  const hl = lines(g, top, 960);
  let y = 150;
  const hs = hl.length > 2 ? 92 : 112;
  for (const l of hl) { sticker(g, l, W / 2, y, hs, CREAM, '#6b4fd8'); y += hs * 1.02; }
  if (info.kind === 'win') {
    g.font = `700 76px ${FONT}`;
    sticker(g, `${t('shareCard.time')} ${fmtTime(info.time)}`, W / 2, y + 6, 76, YOU, '#8a5a12');
    y += 76;
  }
  // the frame
  const shotBottom = drawShot(g, info.shot, W / 2, y + 26, 940, 1325 - (y + 26) - 330, info.kind === 'fired' ? t('res.fired') : null);
  // stats
  let sy = Math.max(shotBottom + 110, 1000);
  sy = Math.min(sy, 1110);
  if (info.kind === 'win') {
    g.textAlign = 'left';
    g.font = `700 118px ${FONT}`; g.fillStyle = LILAC; g.fillText(`×${info.chain}`, 92, sy);
    const cw = g.measureText(`×${info.chain}`).width;
    g.font = `600 38px ${FONT}`; g.fillStyle = '#ddd4ff';
    const cl = lines(g, t('shareCard.chain'), 330);
    cl.forEach((l, i) => g.fillText(l, 92 + cw + 22, sy - 44 + i * 44 - (cl.length - 1) * 8));
    for (let i = 0; i < 3; i++) {
      const on = info.stars[i], x = 700 + i * 118, yy = sy - 40;
      drawStar(g, x, yy + 5, 54, -0.08 + i * 0.08, 'rgba(0,0,0,0.3)');
      drawStar(g, x, yy, 54, -0.08 + i * 0.08, on ? '#ffd35a' : '#3a3068');
    }
  } else {
    g.textAlign = 'center';
    g.font = `600 44px ${FONT}`; g.fillStyle = '#ffd9d6';
    lines(g, t('res.firedSub'), 900).forEach((l, i) => g.fillText(l, W / 2, sy - 30 + i * 54));
  }
  // meeting + footer
  g.textAlign = 'center';
  g.font = `600 38px ${FONT}`; g.fillStyle = LAV;
  g.fillText(`«${info.levelName}» · ${info.when}`, W / 2, 1228);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(92, 1262, W - 184, 2);
  g.textAlign = 'left'; g.font = `700 46px ${FONT}`; g.fillStyle = CREAM; g.fillText(t('title'), 92, 1318);
  g.textAlign = 'right'; g.font = `600 34px ${FONT}`; g.fillStyle = LAV;
  const host = /^(localhost|127\.|0\.0\.0\.0|\[)/.test(location.hostname) || !location.hostname ? '' : location.host + ' · ';
  g.fillText(host + t('shareCard.dare'), W - 92, 1316);
  return c;
}

// encode once when the card is built, so the share click can open the native sheet
// synchronously (Safari drops the user gesture across an await)
export function cardFile(canvas, name = 'bostezo.png') {
  return new Promise((res) => canvas.toBlob((b) => res(b ? new File([b], name, { type: 'image/png' }) : null), 'image/png'));
}

// native share sheet with the image when possible; otherwise download it and copy the text
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
