// The share card, 1080×1350 (the portrait every feed crops to). Top, the real frame of your stadium a
// beat after the final whistle, framed on the bowl and its big screen. Below, the scoreboard: the
// ground, three floodlight lamps, the longest wave in big LED dots lit in that wave's colour, how many
// people stood up, and the dare.
import { t, getLang, plural, fmtNum, fmtLaps } from './i18n.js';
import { F } from './fonts.js';
import { lapColour } from './gfx/crowd.js';

const W = 1080, H = 1350, PH = 790;
const AMBER = '#ffb31a', PAPER = '#f4f1ea', DIM = '#8a8f9c', BOARD = '#07080b', RED = '#ff3b30';

// the colour the crowd paints a wave on its n-th lap
export { lapColour };
function fit(ctx, text, px, maxW, font) { ctx.font = font(px); const w = ctx.measureText(text).width; return w > maxW ? Math.floor(px * maxW / w) : px; }

function photo(ctx, shot) {
  const g = ctx.createLinearGradient(0, 0, 0, PH); g.addColorStop(0, '#20263a'); g.addColorStop(1, '#0d0f16');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, PH);
  if (!shot) return;
  // the whole bowl in view, a touch closer than fitting it: the plaza around it fills the rest
  const b = shot.box || { x: 0, y: 0, w: shot.width, h: shot.height };
  const s = Math.min(W / b.w, PH / b.h) * 1.06, cw = W / s, ch = PH / s;
  const sx = b.x + b.w / 2 - cw / 2, sy = b.y + b.h / 2 - ch / 2;
  ctx.drawImage(shot, sx, sy, cw, ch, 0, 0, W, PH);
  // a floodlit vignette, darkest where the scoreboard begins
  const v = ctx.createRadialGradient(W / 2, PH * 0.45, PH * 0.35, W / 2, PH * 0.5, PH * 0.95);
  v.addColorStop(0, 'rgba(7,8,11,0)'); v.addColorStop(1, 'rgba(7,8,11,.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, PH);
  const f = ctx.createLinearGradient(0, PH - 140, 0, PH); f.addColorStop(0, 'rgba(7,8,11,0)'); f.addColorStop(1, BOARD);
  ctx.fillStyle = f; ctx.fillRect(0, PH - 140, W, 140);
}
function chip(ctx, x, y, h, text, font, fg, bg) {
  ctx.font = font; const w = ctx.measureText(text).width + h * 0.9;
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x, y, w, h, h * 0.2); ctx.fill();
  ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(text, x + h * 0.45, y + h * 0.54);
  return w;
}
function lampAt(ctx, x, y, r, on) {
  ctx.save();
  if (on) {
    ctx.shadowColor = AMBER; ctx.shadowBlur = r * 1.4;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, '#fff6d8'); g.addColorStop(0.45, '#ffd36b'); g.addColorStop(1, AMBER);
    ctx.fillStyle = g;
  } else ctx.fillStyle = '#23262e';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (!on) { ctx.lineWidth = 3; ctx.strokeStyle = '#353945'; ctx.stroke(); }
}

export function makeCard({ level, sim, shot }) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), e = sim.end, lang = getLang(), st = sim.stars();
  const laps = Math.floor(e.best * 10) / 10, col = lapColour(laps);
  ctx.fillStyle = BOARD; ctx.fillRect(0, 0, W, H);
  photo(ctx, shot);
  // over the photo: the logo, and the full-time score
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 18;
  ctx.font = F.sign(118); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = PAPER;
  ctx.fillText('LA OLA', 52, 146);
  ctx.restore();
  const ft = `${t('led.end')}  0 – 0`;
  ctx.font = F.led(40); const fw = ctx.measureText(ft).width + 40;
  chip(ctx, W - 52 - fw, 62, 64, ft, F.led(40), AMBER, 'rgba(7,8,11,.82)');
  // the scoreboard
  const y0 = PH + 18, name = (level.name[lang] || level.name.es).toUpperCase();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = PAPER; ctx.font = F.sign(fit(ctx, name, 64, W - 360, F.sign)); ctx.fillText(name, 60, y0 + 58);
  for (let i = 0; i < 3; i++) lampAt(ctx, W - 84 - (2 - i) * 78, y0 + 36, 26, st[i]);
  // the number, in dots
  const num = fmtLaps(laps), npx = 300;
  ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 44; ctx.fillStyle = col;
  ctx.font = F.led(npx); ctx.fillText(num, 44, y0 + 330);
  const nw = ctx.measureText(num).width;
  ctx.font = F.led(74); ctx.fillText(plural('card.laps', laps), 44 + nw + 26, y0 + 236);
  ctx.restore();
  ctx.fillStyle = DIM; ctx.font = F.body(40, 700);
  ctx.fillText(t('res.of', { n: plural('lapsN', level.goal) }), 44 + nw + 30, y0 + 318);
  ctx.fillStyle = PAPER; ctx.font = F.body(40, 500);
  ctx.fillText(t('card.people', { n: fmtNum(e.people) }), 60, y0 + 410);
  // the dare, under an amber rule
  ctx.fillStyle = AMBER; ctx.fillRect(60, H - 124, W - 120, 4);
  ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(76, H - 58, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = AMBER; ctx.font = F.sign(fit(ctx, t('card.cta'), 64, W - 160, F.sign)); ctx.fillText(t('card.cta'), 104, H - 36);
  return cv;
}

const blobOf = (cv) => new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.9));

export async function shareResult({ level, sim, shot, toast }) {
  const lang = getLang(), e = sim.end, name = level.name[lang] || level.name.es;
  const laps = Math.floor(e.best * 10) / 10;
  const text = laps >= 0.1 ? t('share.text', { laps: plural('lapsN', laps), lv: name, n: fmtNum(e.people) }) : t('share.zero', { lv: name });
  const url = location.href.split('#')[0].split('?')[0];
  try {
    const blob = await blobOf(makeCard({ level, sim, shot }));
    const file = new File([blob], `la-ola-${level.id}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: `${text} ${url}`, title: 'LA OLA' }); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast(`${t('share.saved')} · ${t('share.copied')}`); } catch { toast(t('share.saved')); }
  } catch (err) {
    if (err?.name !== 'AbortError') toast(t('share.err'));
  }
}
