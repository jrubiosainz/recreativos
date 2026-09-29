// The share card, 1080×1350 (the portrait every feed crops to): the fridge door. Across the top, the logo in
// magnet letters and the two laws in biro (the whole joke, for anyone scrolling past); the Polaroid of the
// landing stuck on with a magnet, the verdict written under it; the star magnets beside it; and a sticky note
// with the room and the dare.
import { t, getLang, fmtNum } from './i18n.js';
import { F } from './fonts.js';
import { verdict, statsOf } from './ui/result.js';
import { magnetLetters } from './ui/title.js';
import { NOTE, STAR_PATH } from './ui/dom.js';
import { starsOf } from './save.js';

const W = 1080, H = 1350, INK = '#2a1c14', INK2 = '#6a5442', RED_INK = '#b3261e', BLUE_INK = '#1d4e9e';
const D = { x: 40, y: 40, w: 1000, h: 1270 };

function fit(ctx, text, px, maxW, font) { ctx.font = font(px); const w = ctx.measureText(text).width; return w > maxW ? Math.floor((px * maxW) / w) : px; }
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
let grainPat = null;
function grain(ctx) {
  if (!grainPat) {
    const g = document.createElement('canvas'); g.width = g.height = 128;
    const x = g.getContext('2d'), d = x.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i] = 42; d.data[i + 1] = 28; d.data[i + 2] = 20; d.data[i + 3] = Math.random() < 0.5 ? Math.random() * 26 : 0; }
    x.putImageData(d, 0, 0); grainPat = ctx.createPattern(g, 'repeat');
  }
  return grainPat;
}

// the photo: the stage at the landing, cropped around the cat. The crop may run past the canvas's edge, which
// Safari won't read from, so only the part inside is copied and the rest stays the photo's dark
export function drawShot(ctx, shot, dx, dy, dw, dh) {
  ctx.save();
  ctx.fillStyle = '#231914'; ctx.fillRect(dx, dy, dw, dh);
  if (shot) {
    const c = shot.crop || { x: 0, y: 0, w: shot.width, h: shot.height };
    const x0 = Math.max(0, c.x), y0 = Math.max(0, c.y), x1 = Math.min(shot.width, c.x + c.w), y1 = Math.min(shot.height, c.y + c.h);
    if (x1 > x0 && y1 > y0) {
      const kx = dw / c.w, ky = dh / c.h;
      ctx.drawImage(shot, x0, y0, x1 - x0, y1 - y0, dx + (x0 - c.x) * kx, dy + (y0 - c.y) * ky, (x1 - x0) * kx, (y1 - y0) * ky);
    }
  }
  ctx.restore();
}

// a round magnet: coloured plastic, an ink rim, a glint
function magnet(ctx, x, y, r, color) {
  ctx.save();
  ctx.shadowColor = 'rgba(42,28,20,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5;
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x - r, y + r * 0.62, r * 2, r);
  const g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.4, 0, x - r * 0.32, y - r * 0.4, r * 0.62);
  g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(0.45, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(3, r * 0.14); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}
function starMagnet(ctx, x, y, size, on, rot) {
  const p = new Path2D(STAR_PATH), k = size / 24;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k); ctx.translate(-12, -12);
  ctx.lineJoin = 'round';
  if (on) {
    ctx.save(); ctx.shadowColor = 'rgba(42,28,20,.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 7;
    ctx.translate(0, 0.9); ctx.fillStyle = INK; ctx.fill(p); ctx.restore();
    ctx.fillStyle = '#f2c230'; ctx.fill(p);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(p);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(9.6, 10, 1.7, 1.1, -Math.PI / 6, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.setLineDash([1.9, 1.5]); ctx.strokeStyle = INK2; ctx.lineWidth = 1.1; ctx.stroke(p);
  }
  ctx.restore();
}
// the logo in magnet letters, as on the door: each its own colour, tilt and height, an ink rim and a thickness
function logo(ctx, text, x0, y0, maxW) {
  const words = magnetLetters(text), lines = words.length > 1 ? [words.slice(0, -1), words.slice(-1)] : [words];
  const lineText = (ln) => ln.map((w) => w.map((l) => l.ch).join('')).join(' ');
  let px = 140; ctx.font = F.logo(px);
  const widest = Math.max(...lines.map((ln) => ctx.measureText(lineText(ln)).width));
  if (widest > maxW) px = Math.floor((px * maxW) / widest);
  ctx.font = F.logo(px); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
  const space = ctx.measureText(' ').width;
  lines.forEach((ln, j) => {
    let x = x0; const base = y0 + px * (0.86 + j * 0.98);
    ln.forEach((w) => {
      for (const l of w) {
        const cw = ctx.measureText(l.ch).width;
        ctx.save(); ctx.translate(x + cw / 2, base + l.y * px - px * 0.35); ctx.rotate((l.r * Math.PI) / 180); ctx.translate(-cw / 2, px * 0.35);
        ctx.save(); ctx.shadowColor = 'rgba(42,28,20,.3)'; ctx.shadowBlur = px * 0.12; ctx.shadowOffsetY = px * 0.12;
        ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = px * 0.2; ctx.strokeText(l.ch, 0, px * 0.07); ctx.fillText(l.ch, 0, px * 0.07);
        ctx.restore();
        ctx.strokeStyle = INK; ctx.lineWidth = px * 0.2; ctx.strokeText(l.ch, 0, 0);
        ctx.fillStyle = l.color; ctx.fillText(l.ch, 0, 0);
        ctx.restore();
        x += cw - px * 0.02;
      }
      x += space;
    });
  });
  return y0 + px * (0.86 + (lines.length - 1) * 0.98) + px * 0.2;
}
function wrap(ctx, text, maxW) {
  const out = []; let line = '';
  for (const w of text.split(' ')) { const s = line ? `${line} ${w}` : w; if (line && ctx.measureText(s).width > maxW) { out.push(line); line = w; } else line = s; }
  if (line) out.push(line);
  return out;
}

export function makeCard({ level, sim, shot }) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), e = sim.end, lang = getLang(), st = starsOf(level, e), n = (level.n - 1) % 6, R = [56, 56, 40, 40];
  // the kitchen behind, the fridge door in front: enamel, a sheen, a little grain, the chrome handle
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
  const bg = ctx.createLinearGradient(0, D.y, 0, D.y + D.h); bg.addColorStop(0, '#fcfaf5'); bg.addColorStop(0.38, '#f6f2e9'); bg.addColorStop(1, '#e4dccb');
  ctx.fillStyle = bg; rrect(ctx, D.x, D.y, D.w, D.h, R); ctx.fill(); ctx.restore();
  ctx.save(); rrect(ctx, D.x, D.y, D.w, D.h, R); ctx.clip();
  const sh = ctx.createLinearGradient(D.x, D.y, D.x + D.w, D.y + D.h * 0.25);
  sh.addColorStop(0.28, 'rgba(255,255,255,0)'); sh.addColorStop(0.4, 'rgba(255,255,255,.6)'); sh.addColorStop(0.52, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(D.x, D.y, D.w, D.h); ctx.fillStyle = grain(ctx); ctx.fillRect(D.x, D.y, D.w, D.h);
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 6; rrect(ctx, D.x, D.y, D.w, D.h, R); ctx.stroke();
  const hx = D.x + 22, hy = D.y + D.h * 0.22, hh = D.h * 0.48, hg = ctx.createLinearGradient(hx, 0, hx + 28, 0);
  [['#767c84', 0], ['#e9edf1', 0.28], ['#fff', 0.4], ['#b8bdc4', 0.62], ['#6f757d', 1]].forEach(([c, s]) => hg.addColorStop(s, c));
  ctx.save(); ctx.shadowColor = 'rgba(42,28,20,.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 7;
  ctx.fillStyle = hg; rrect(ctx, hx, hy, 28, hh, 14); ctx.fill(); ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 4; rrect(ctx, hx, hy, 28, hh, 14); ctx.stroke();
  // the logo and the two laws: the joke in two lines
  const x0 = D.x + 92, cw = D.w - 92 - 48;
  let y = logo(ctx, t('title'), x0, D.y + 34, cw);
  const laws = [t('law1'), t('law2')];
  let lp = 40; for (const l of laws) lp = Math.min(lp, fit(ctx, `2. ${l}`, 40, cw - 24, F.hand));
  ctx.save(); ctx.translate(x0 + 6, y + 6); ctx.rotate(-0.02); ctx.font = F.hand(lp); ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  laws.forEach((l, k) => ctx.fillText(`${k + 1}. ${l}`, 0, lp * (0.9 + k * 1.15)));
  ctx.restore();
  y += 6 + lp * 2.1 + 34;
  // the Polaroid, magnet on top, the verdict in biro under the photo
  const ph = 480, pad = 24, capH = 108, pw = ph + pad * 2, pH = pad + ph + capH, px = x0 + 8, py = y + 12;
  const { head } = verdict(sim);
  ctx.save(); ctx.translate(px + pw / 2, py + pH / 2); ctx.rotate(-0.052); ctx.translate(-pw / 2, -pH / 2);
  ctx.save(); ctx.shadowColor = 'rgba(20,12,8,.45)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 14;
  const pg = ctx.createLinearGradient(0, 0, 0, pH); pg.addColorStop(0, '#fffefb'); pg.addColorStop(1, '#f1eee6');
  ctx.fillStyle = pg; ctx.fillRect(0, 0, pw, pH); ctx.restore();
  ctx.strokeStyle = 'rgba(42,28,20,.2)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, pw - 2, pH - 2);
  drawShot(ctx, shot, pad, pad, ph, ph);
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.strokeRect(pad + 1, pad + 1, ph - 2, ph - 2);
  ctx.fillStyle = e.win ? INK : RED_INK; ctx.font = F.hand(fit(ctx, head, 66, pw - 44, F.hand)); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(head, pw / 2, pad + ph + capH * 0.68);
  magnet(ctx, pw / 2, 4, 26, '#e0463b');
  ctx.restore();
  // what it cost, in biro under the photo
  ctx.font = F.hand(fit(ctx, statsOf(sim).join(' · '), 34, pw + 10, F.hand)); ctx.fillStyle = INK2; ctx.textAlign = 'left';
  ctx.fillText(statsOf(sim).join(' · '), px + 4, py + pH + 64);
  // the star magnets down the right-hand side
  const sx = (px + pw + D.x + D.w) / 2;
  st.forEach((on, k) => starMagnet(ctx, sx + [6, -10, 8][k], py + 70 + k * 150, 124, on, [0.17, -0.12, 0.2][k]));
  // the sticky note: the room and the dare
  const nw = 300, nh = 272, nx = D.x + D.w - 44 - nw, ny = D.y + D.h - 40 - nh, tag = (t('share.text').match(/#\w+/) || ['#GatoConTostada'])[0];
  ctx.save(); ctx.translate(nx + nw / 2, ny + nh / 2); ctx.rotate(0.04); ctx.translate(-nw / 2, -nh / 2);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 12; ctx.fillStyle = NOTE.paper[n]; ctx.fillRect(0, 0, nw, nh); ctx.restore();
  ctx.fillStyle = grain(ctx); ctx.fillRect(0, 0, nw, nh);
  ctx.strokeStyle = 'rgba(42,28,20,.55)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, nw - 2, nh - 2);
  const name = level.name[lang] || level.name.es, num = String(level.n);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.font = F.logo(38); const nwid = ctx.measureText(num).width;
  ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.strokeText(num, 24, 76); ctx.fillStyle = NOTE.mag[n]; ctx.fillText(num, 24, 76);
  ctx.fillStyle = INK; ctx.font = F.hand(fit(ctx, name, 36, nw - 60 - nwid, F.hand)); ctx.fillText(name, 36 + nwid, 76);
  ctx.font = F.hand(44); const cta = wrap(ctx, t('card.cta'), nw - 44);
  const cp = cta.length > 2 ? 36 : 44; ctx.font = F.hand(cp);
  cta.slice(0, 3).forEach((l, k) => ctx.fillText(l, 22, 134 + k * cp * 1.05));
  ctx.fillStyle = BLUE_INK; ctx.font = F.hand(fit(ctx, tag, 36, nw - 44, F.hand)); ctx.fillText(tag, 22, nh - 26);
  magnet(ctx, nw / 2, 4, 20, NOTE.mag[n]);
  ctx.restore();
  return cv;
}

const blobOf = (cv) => new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.9));

export async function shareResult({ level, sim, shot, toast }) {
  const lang = getLang(), e = sim.end, name = level.name[lang] || level.name.es;
  const text = e.win ? t('share.text', { stars: fmtNum(e.stars ?? starsOf(level, e).filter(Boolean).length), lv: name }) : t('share.lose', { lv: name });
  const url = location.href.split('#')[0].split('?')[0];
  try {
    const blob = await blobOf(makeCard({ level, sim, shot }));
    const file = new File([blob], `gato-con-tostada-${level.id}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: `${text} ${url}`, title: t('title') }); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast(`${t('share.saved')} · ${t('share.copied')}`); } catch { toast(t('share.saved')); }
  } catch (err) {
    if (err?.name !== 'AbortError') toast(t('share.err'));
  }
}
