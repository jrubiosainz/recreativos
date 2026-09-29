// The share card, 1080×1350 (the portrait every feed crops to): the real frame of your splash on
// top, captured a beat after impact when the crown of water is at its tallest, and the yellow bottom
// of the summer poster under it with ¡BOMBA!, the splash in the red roundel and the PREMIO sticks.
import { t, getLang, metres } from './i18n.js';
import { F } from './fonts.js';
import { INK, rr, paperCanvas } from './gfx/paint.js';
import { mss } from './ui/dom.js';

const W = 1080, H = 1350, PH = 820;

function extruded(ctx, text, x, y, px, face, side, depth = 10) {
  ctx.font = F.letter(px); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  for (let i = depth; i > 0; i--) { ctx.fillStyle = side; ctx.fillText(text, x + i * 0.45, y + i); }
  ctx.lineWidth = px * 0.085; ctx.strokeStyle = INK.navy; ctx.strokeText(text, x, y);
  ctx.fillStyle = face; ctx.fillText(text, x, y);
  ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.rect(x - W, y - px * 0.72, W * 2, px * 0.18); ctx.clip(); ctx.fillText(text, x, y); ctx.restore();
}
function fit(ctx, text, px, maxW, font = F.letter) { ctx.font = font(px); const w = ctx.measureText(text).width; return w > maxW ? Math.floor(px * maxW / w) : px; }

function stickShape(ctx, x, y, w, h, on) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.06);
  ctx.beginPath(); rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  if (on) {
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#F2D9A6'); g.addColorStop(1, '#D9B274');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#8A5A2B'; ctx.stroke();
    ctx.fillStyle = '#8A5A2B'; ctx.font = F.body(h * 0.5, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★ PREMIO ★', 0, 2);
  } else {
    ctx.setLineDash([12, 9]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(138,90,43,.45)'; ctx.stroke();
  }
  ctx.restore();
}

export function makeCard({ level, sim, shot }) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), e = sim.end, bomba = e.why === 'bomba', lang = getLang(), st = sim.stars();
  // the photo: the captured frame, cropped to cover
  ctx.fillStyle = INK.sky; ctx.fillRect(0, 0, W, PH);
  if (shot) {
    const s = Math.max(W / shot.width, PH / shot.height), cw = W / s, ch = PH / s;
    const [fx, fy] = shot.focus || [0.5, 0.5], cl = (v, hi) => Math.max(0, Math.min(hi, v));
    ctx.drawImage(shot, cl(fx * shot.width - cw / 2, shot.width - cw), cl(fy * shot.height - ch * 0.55, shot.height - ch), cw, ch, 0, 0, W, PH);
  }
  // the logo in the corner, as on the poster
  ctx.save(); ctx.translate(40, 40);
  extruded(ctx, 'HIPO', 130, 120, 118, INK.yellow, INK.blue, 8);
  ctx.restore();
  // the yellow bottom, with blue splash rays
  const by = PH - 24;
  ctx.fillStyle = INK.yellow; ctx.beginPath(); ctx.moveTo(0, by + 18); ctx.lineTo(W, by - 6); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(43,79,163,.28)'; ctx.lineCap = 'round';
  for (let i = 0; i < 18; i++) { const a = Math.PI + (i / 17) * Math.PI, r0 = 330, r1 = 420 + (i % 3) * 40; ctx.lineWidth = 14 - (i % 3) * 3; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0, by + 250 + Math.sin(a) * r0 * 0.55); ctx.lineTo(W / 2 + Math.cos(a) * r1, by + 250 + Math.sin(a) * r1 * 0.55); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = INK.navy; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, by + 18); ctx.lineTo(W, by - 6); ctx.stroke();
  // the word
  const word = t(bomba ? 'res.bomba' : 'res.planchazo');
  const wpx = fit(ctx, word, 170, W - 120);
  extruded(ctx, word, W / 2, by + 172, wpx, bomba ? INK.red : INK.pink, INK.blue, 12);
  // the roundel
  const rx = 250, ry = by + 322, R = 124;
  if (bomba) {
    ctx.fillStyle = INK.red; ctx.beginPath(); ctx.arc(rx, ry, R, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(rx, ry, R - 12, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = F.body(fit(ctx, t('card.splash'), 34, R * 1.5, (p) => F.body(p, 700)), 700); ctx.fillText(t('card.splash'), rx, ry - 46);
    const [v] = metres(e.splash).split(' ');
    ctx.fillStyle = INK.yellow; ctx.font = F.letter(fit(ctx, `${v}m`, 104, R * 1.6)); ctx.fillText(`${v}m`, rx, ry + 44);
    ctx.fillStyle = '#fff'; ctx.font = F.body(26, 600); ctx.fillText(t('card.from', { m: metres(level.h) }), rx, ry + 88);
  } else {
    // a belly flop gets a pink roundel with the slap in it
    ctx.fillStyle = INK.pink; ctx.beginPath(); ctx.arc(rx, ry, R, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(rx, ry, R - 12, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const w = t('fx.plaf');
    ctx.fillStyle = INK.yellow; ctx.font = F.letter(fit(ctx, w, 84, R * 1.6)); ctx.fillText(w, rx, ry + 22);
    ctx.fillStyle = '#fff'; ctx.font = F.body(26, 600); ctx.fillText(t('card.from', { m: metres(level.h) }), rx, ry + 76);
  }
  // the sticks
  for (let i = 0; i < 3; i++) stickShape(ctx, 740, by + 214 + i * 70, 400, 56, st[i]);
  // the foot: level, time, the dare
  ctx.fillStyle = INK.navy; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = F.body(30, 600);
  ctx.fillText(`${level.name[lang] || level.name.es} · ${mss(e.t)}`, 740, by + 452);
  ctx.font = F.shout(fit(ctx, t('card.cta'), 46, W - 160, F.shout)); ctx.fillStyle = INK.red;
  ctx.fillText(t('card.cta'), W / 2, H - 34);
  // sun-faded paper over everything
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; ctx.drawImage(paperCanvas(512, 7), 0, 0, W, H); ctx.restore();
  return cv;
}

const blobOf = (cv) => new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.9));

export async function shareResult({ level, sim, shot, toast }) {
  const lang = getLang(), e = sim.end, name = level.name[lang] || level.name.es;
  const text = e.why === 'bomba'
    ? t('share.text', { what: t('res.bomba').replace(/[¡!]/g, '').toLowerCase(), m: metres(e.splash), lv: name })
    : t('share.flop', { lv: name });
  const url = location.href.split('#')[0].split('?')[0];
  try {
    const blob = await blobOf(makeCard({ level, sim, shot }));
    const file = new File([blob], `hipo-${level.id}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: `${text} ${url}`, title: 'HIPO' }); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast(`${t('share.saved')} · ${t('share.copied')}`); } catch { toast(t('share.saved')); }
  } catch (err) {
    if (err?.name !== 'AbortError') toast(t('share.err'));
  }
}
