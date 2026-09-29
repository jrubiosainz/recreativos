// The share card, 1080×1350 (the portrait every feed crops to). On the left, the real window a beat after
// the finish: your drop at the rubber (or somebody else's), the tags, the wiped lanes. On the right the
// logo written in fog and the ticket of the trip, stamped by the validator: the line and the time, who
// won and by how much, the holes punched. Along the bottom, the dare.
import { t, getLang } from './i18n.js';
import { F } from './fonts.js';
import { verdict } from './ui/result.js';
import { starsOf } from './save.js';
import { fmtCm } from './i18n.js';
import { KID_COL } from './gfx/drops.js';

const W = 1080, H = 1350;
const WALL = ['#3a3e4b', '#1c1f27'], FOG = '#e9eef3', TICKET = '#f3ead3', INK = '#1d4e9e', VIOLET = '#5b3fa8', YOU = '#ffc23d';
const WX = 64, WY = 64, WW = 548, WH = Math.round((WW * 21) / 12);

function fit(ctx, text, px, maxW, font) { ctx.font = font(px); const w = ctx.measureText(text).width; return w > maxW ? Math.floor((px * maxW) / w) : px; }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

function windowShot(ctx, shot) {
  // the aluminium frame and the rubber, then the glass itself
  const fr = 18;
  const g = ctx.createLinearGradient(WX - fr, 0, WX + WW + fr, 0); g.addColorStop(0, '#c9ced6'); g.addColorStop(0.5, '#8d949f'); g.addColorStop(1, '#b7bdc6');
  ctx.fillStyle = g; rr(ctx, WX - fr, WY - fr, WW + fr * 2, WH + fr * 2, 26); ctx.fill();
  ctx.fillStyle = '#121317'; rr(ctx, WX - 6, WY - 6, WW + 12, WH + 12, 14); ctx.fill();
  ctx.save(); rr(ctx, WX, WY, WW, WH, 9); ctx.clip();
  ctx.fillStyle = '#5d6878'; ctx.fillRect(WX, WY, WW, WH);
  if (shot) { const b = shot.box; ctx.drawImage(shot, b.x, b.y, b.w, b.h, WX, WY, WW, WH); }
  ctx.restore();
}
function holeAt(ctx, x, y, r, on) {
  if (on) {
    // punched through: the dark behind the ticket shows, with a torn paper rim
    ctx.fillStyle = '#23262f'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3; ctx.stroke();
  } else {
    ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(29,78,158,.45)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
}

export function makeCard({ level, sim, shot }) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), e = sim.end, lang = getLang(), st = starsOf(level, e);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, WALL[0]); bg.addColorStop(1, WALL[1]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  windowShot(ctx, shot);
  // the logo, written in fog
  const cx = WX + WW + 50, cw = W - cx - 48;
  ctx.save(); ctx.fillStyle = FOG; ctx.shadowColor = 'rgba(233,238,243,.45)'; ctx.shadowBlur = 24; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const [l1, l2] = t('title').split(' ');
  const lp = fit(ctx, l2 || l1, 150, cw, F.wipe);
  ctx.font = F.wipe(lp); ctx.fillText(l1, cx, 70 + lp * 0.82); if (l2) ctx.fillText(l2, cx, 70 + lp * 1.7);
  ctx.restore();
  ctx.fillStyle = YOU; ctx.font = F.hand(fit(ctx, t('tagline'), 44, cw, (px) => F.hand(px, 800)), 800); ctx.fillText(t('tagline'), cx, 70 + lp * 1.7 + 70);
  // the ticket, slightly askew
  const ty = 470, th = 560;
  ctx.save(); ctx.translate(cx + cw / 2, ty + th / 2); ctx.rotate(-0.035); ctx.translate(-cw / 2, -th / 2);
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  ctx.fillStyle = TICKET; rr(ctx, 0, 0, cw, th, 18); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#3b2a20'; ctx.fillRect(0, th - 58, cw, 34);
  const pad = 28, name = (level.name[lang] || level.name.es).toUpperCase();
  ctx.fillStyle = VIOLET; ctx.font = F.led(fit(ctx, `L${level.line || '27'} ${level.clock} ${t('trip', { n: level.n })}`, 34, cw - pad * 2, F.led));
  ctx.textBaseline = 'alphabetic'; ctx.fillText(`L${level.line || '27'} ${level.clock} ${t('trip', { n: level.n })}`, pad, 58);
  ctx.fillStyle = INK; ctx.font = F.hand(fit(ctx, name, 40, cw - pad * 2, (px) => F.hand(px, 800)), 800); ctx.fillText(name, pad, 116);
  ctx.fillStyle = 'rgba(29,78,158,.35)'; ctx.fillRect(pad, 138, cw - pad * 2, 3);
  const { head, sub } = verdict(sim), big = e.win ? t('card.won') : t('card.lost');
  ctx.fillStyle = e.win ? '#d8342c' : INK; ctx.font = F.wipe(fit(ctx, big, 76, cw - pad * 2, F.wipe)); ctx.fillText(big, pad, 230);
  ctx.fillStyle = '#2a2f3a'; ctx.font = F.hand(fit(ctx, e.win ? (sub || head) : head, 36, cw - pad * 2, (px) => F.hand(px, 700)), 700);
  ctx.fillText(e.win ? (sub || head) : head, pad, 288);
  if (!e.win && e.left != null && e.why !== 'squash') { ctx.font = F.hand(30, 500); ctx.fillText(t('res.stat.left', { cm: fmtCm(e.left) }), pad, 332); }
  for (let i = 0; i < 3; i++) holeAt(ctx, pad + 34 + i * 92, 420, 30, st[i]);
  ctx.restore();
  // the dare, with the kids' colours as drops
  const dy = H - 118;
  ctx.fillStyle = 'rgba(233,238,243,.14)'; ctx.fillRect(64, dy - 76, W - 128, 3);
  ['you', 'dani', 'lucia', 'iker', 'vega'].forEach((k, i) => {
    const x = 84 + i * 40, y = dy - 10;
    ctx.fillStyle = KID_COL[k]; ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.bezierCurveTo(x + 4, y - 14, x + 14, y - 6, x + 14, y + 4); ctx.arc(x, y + 4, 14, 0, Math.PI); ctx.bezierCurveTo(x - 14, y - 6, x - 4, y - 14, x, y - 26); ctx.fill();
  });
  ctx.fillStyle = FOG; ctx.font = F.wipe(fit(ctx, t('card.cta'), 84, W - 128 - 230, F.wipe)); ctx.fillText(t('card.cta'), 300, dy + 20);
  return cv;
}

const blobOf = (cv) => new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.9));

export async function shareResult({ level, sim, shot, toast }) {
  const lang = getLang(), e = sim.end, name = level.name[lang] || level.name.es;
  const text = e.win ? t('share.text', { cm: fmtCm(Math.min(e.margin, 21)), lv: name }) : t('share.lose', { lv: name });
  const url = location.href.split('#')[0].split('?')[0];
  try {
    const blob = await blobOf(makeCard({ level, sim, shot }));
    const file = new File([blob], `la-gota-${level.id}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: `${text} ${url}`, title: 'LA GOTA' }); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast(`${t('share.saved')} · ${t('share.copied')}`); } catch { toast(t('share.saved')); }
  } catch (err) {
    if (err?.name !== 'AbortError') toast(t('share.err'));
  }
}
