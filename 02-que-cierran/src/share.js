// Share card, 1080×1350: a page from a stamp-rally book. The station sign, the photo of your packed car
// with the eki stamp pressed half over it, the load, and the day's paperwork (on time, late, left behind).
import { FONT, JP } from './fx.js';
import { roundRect, mulberry32 } from './util.js';
import { LINE } from './car.js';
import { LEVELS } from './levels.js';
import { stampImage, textStamp, STAMP } from './stamp.js';

const INK = '#1b1d26', PAPER = '#f3eee2', PLATE = '#fdfcf8', GREY = '#5b5e6c', RED = '#d23a2c', GOLD = '#8f6809', OK = '#0c7864';
const KANA = { s1: 'しはつ', s2: 'あさぎり', s3: 'あめみや', s4: 'さくらざか', s5: 'すもうちょう', s6: 'ちえん', s7: 'のりかえ', s8: 'しんおしこみ' };
const TERMINUS = { kanji: '押込中央', romaji: 'Oshikomi-Chūō' };

// copy of the game canvas at the money shot; r is a crop in canvas pixels
export function snapshot(canvas, r = null) {
  const s = r || { x: 0, y: 0, w: canvas.width, h: canvas.height };
  const k = Math.min(1, 1100 / s.w);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(s.w * k)); c.height = Math.max(1, Math.round(s.h * k));
  c.getContext('2d').drawImage(canvas, s.x, s.y, s.w, s.h, 0, 0, c.width, c.height);
  return c;
}

function greedy(g, words, maxW) {
  const out = [];
  let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur);
  return out;
}
// like CSS text-wrap: balance
function lines(g, text, maxW) {
  const words = text.split(/\s+/), base = greedy(g, words, maxW);
  if (base.length < 2) return base;
  let lo = 0, hi = maxW;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (greedy(g, words, mid).length > base.length) lo = mid; else hi = mid; }
  return greedy(g, words, hi);
}
function fit(g, text, weight, family, size, maxW) {
  g.font = `${weight} ${size}px ${family}`;
  const w = g.measureText(text).width;
  if (w > maxW) { size = Math.floor(size * maxW / w); g.font = `${weight} ${size}px ${family}`; }
  return size;
}
const plain = (s) => String(s).replace(/<[^>]+>/g, '');
// a station ink pressed deeper, dark enough to carry white text
const deep = (h, k = 0.85) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');

function paper(g, W, H) {
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  const r = mulberry32(2024);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '90,70,40' : '255,255,255'},${0.025 + r() * 0.05})`; g.fillRect(r() * W, r() * H, 1 + r() * 2.2, 1 + r() * 2.2); }
  // the book's printed frame
  g.strokeStyle = 'rgba(27,29,38,0.14)'; g.lineWidth = 2; roundRect(g, 26, 26, W - 52, H - 52, 26); g.stroke();
}

// 駅名標, the station sign: number badge, kana, the name, romaji, and the neighbours on the line band
function drawSign(g, L, x, y, w, h) {
  const i = LEVELS.indexOf(L), prev = LEVELS[i - 1], next = LEVELS[i + 1] || TERMINUS;
  g.save(); g.shadowColor = 'rgba(60,40,10,0.22)'; g.shadowBlur = 28; g.shadowOffsetY = 12;
  roundRect(g, x, y, w, h, 20); g.fillStyle = PLATE; g.fill(); g.restore();
  const bh = Math.round(h * 0.26), top = h - bh;
  g.save(); roundRect(g, x, y, w, h, 20); g.clip();
  g.fillStyle = LINE; g.fillRect(x, y + top, w, bh);
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x, y + top, w, 3);
  g.restore();
  const bs = Math.round(top * 0.6), bx = x + 34, by = y + (top - bs) / 2, lw = bs * 0.085;
  roundRect(g, bx, by, bs, bs, bs * 0.18); g.fillStyle = '#ffffff'; g.fill();
  g.lineWidth = lw; g.strokeStyle = LINE; roundRect(g, bx + lw / 2, by + lw / 2, bs - lw, bs - lw, bs * 0.15); g.stroke();
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(bs * 0.27)}px ${FONT}`; g.fillText(L.code.slice(0, 2), bx + bs / 2, by + bs * 0.32);
  g.font = `700 ${Math.round(bs * 0.45)}px ${FONT}`; g.fillText(L.code.slice(2), bx + bs / 2, by + bs * 0.67);
  const cx = x + w / 2 + bs * 0.32, room = w - bs * 2 - 120;
  g.font = `700 ${Math.round(top * 0.15)}px ${JP}`; g.fillStyle = GREY; g.fillText(KANA[L.id] || '', cx, y + top * 0.19);
  const name = [...L.kanji].join(L.kanji.length <= 2 ? '\u2002' : '\u2009');
  fit(g, name, 700, JP, Math.round(top * 0.44), room); g.fillStyle = INK; g.fillText(name, cx, y + top * 0.53);
  fit(g, L.romaji, 600, FONT, Math.round(top * 0.15), room); g.fillStyle = GREY; g.fillText(L.romaji, cx, y + top * 0.86);
  const ty = y + top + bh / 2 + 1, side = (st, dir) => {
    const k = `${dir < 0 ? '◀ ' : ''}${st.kanji}${dir > 0 ? ' ▶' : ''}`;
    g.font = `700 ${Math.round(bh * 0.42)}px ${JP}`; const kw = g.measureText(k).width;
    g.font = `600 ${Math.round(bh * 0.27)}px ${FONT}`; const rw = g.measureText(st.romaji).width, gap = 12;
    let x0 = dir < 0 ? x + 28 : x + w - 28 - kw - gap - rw;
    g.textAlign = 'left'; g.fillStyle = INK;
    g.font = `700 ${Math.round(bh * 0.42)}px ${JP}`;
    if (dir < 0) { g.fillText(k, x0, ty); g.font = `600 ${Math.round(bh * 0.27)}px ${FONT}`; g.fillText(st.romaji, x0 + kw + gap, ty + 2); }
    else { g.font = `600 ${Math.round(bh * 0.27)}px ${FONT}`; g.fillText(st.romaji, x0, ty + 2); g.font = `700 ${Math.round(bh * 0.42)}px ${JP}`; g.fillText(k, x0 + rw + gap, ty); }
    g.globalAlpha = 1;
  };
  if (prev) side(prev, -1);
  side(next, 1);
}

function drawPhoto(g, shot, x, y, w, h, rot, dim) {
  g.save();
  g.translate(x + w / 2, y + h / 2); g.rotate(rot); g.translate(-(x + w / 2), -(y + h / 2));
  const b = 18;
  g.save(); g.shadowColor = 'rgba(60,40,10,0.34)'; g.shadowBlur = 42; g.shadowOffsetY = 18;
  g.fillStyle = '#ffffff'; g.fillRect(x - b, y - b, w + b * 2, h + b * 2); g.restore();
  if (shot) {
    const a = shot.width / shot.height, A = w / h;
    let sw = shot.width, sh = shot.height, sx = 0, sy = 0;
    if (a > A) { sw = sh * A; sx = (shot.width - sw) / 2; } else { sh = sw / A; sy = (shot.height - sh) / 2; }
    g.drawImage(shot, sx, sy, sw, sh, x, y, w, h);
  } else { g.fillStyle = '#d9d3c4'; g.fillRect(x, y, w, h); }
  if (dim) { g.fillStyle = 'rgba(30,10,14,0.3)'; g.fillRect(x, y, w, h); }
  // washi tape holding it into the book
  g.save(); g.translate(x + w / 2, y - b * 0.4); g.rotate(-rot * 1.6 - 0.02);
  g.fillStyle = 'rgba(22,184,156,0.55)'; g.fillRect(-92, -24, 184, 48);
  g.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = -80; i < 92; i += 28) g.fillRect(i, -24, 10, 48);
  g.restore();
  g.restore();
}

function pressStamp(g, img, cx, cy, w, h, rot, alpha = 0.92) {
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = alpha;
  g.translate(cx, cy); g.rotate(rot); g.drawImage(img, -w / 2, -h / 2, w, h);
  g.restore();
}

function marks(g, L, set, x, y, w, t) {
  const labels = [t('res.star1', { n: Math.round(L.target * 100) }), t('res.star2'), t('res.star3', { n: Math.round(L.gold * 100) })];
  const jp = ['', '定時', '満員'], r = 34, step = w / 3, ink = STAMP[L.id]?.ink || LINE;
  for (let i = 0; i < 3; i++) {
    const cx = x + step * (i + 0.5), on = set[i];
    g.lineWidth = 4; g.strokeStyle = on ? ink : 'rgba(27,29,38,0.22)'; g.setLineDash(on ? [] : [7, 7]);
    g.beginPath(); g.arc(cx, y, r, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    if (on) {
      if (i === 0) pressStamp(g, stampImage(L, 120), cx, y, r * 1.9, r * 1.9, -0.12, 1);
      else { g.fillStyle = i === 2 ? GOLD : deep(ink); g.beginPath(); g.arc(cx, y, r - 7, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffffff'; g.font = `700 24px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(jp[i], cx, y + 1); }
    }
    g.fillStyle = on ? INK : 'rgba(27,29,38,0.4)'; g.font = `600 21px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    fit(g, plain(labels[i]), 600, FONT, 21, step - 8);
    g.fillText(plain(labels[i]), cx, y + r + 32);
  }
}

// info: { L, res, set:[b,b,b], shot, cause, t, num }
export function buildCard(info) {
  const { L, res, t } = info, W = 1080, H = 1350;
  const kind = !res.pass ? 'fail' : res.onTime ? 'pass' : 'late';
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  paper(g, W, H);
  drawSign(g, L, 64, 62, W - 128, 236);
  // the photo, and the column of numbers beside it
  const px = 96, py = 350, pw = 560, ph = 700, rot = -0.022;
  drawPhoto(g, info.shot, px, py, pw, ph, rot, kind === 'fail');
  if (kind === 'fail') {
    const img = textStamp('乗り残し', plain(t('res.leftSub')).toUpperCase(), 560, RED);
    pressStamp(g, img, px + pw / 2 + 10, py + ph * 0.5, 560, 280, -0.2, 0.95);
  } else {
    pressStamp(g, stampImage(L, 320), px + pw - 150, py + ph - 150, 290, 290, -0.16, 0.9);
    if (kind === 'late') { const img = textStamp('遅延', 'DELAY', 250, RED); pressStamp(g, img, px + 90, py + ph - 70, 250, 125, 0.12, 0.92); }
  }
  const cx0 = 708, cw = W - 64 - cx0, ccx = cx0 + cw / 2;
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `700 50px ${JP}`; g.fillStyle = INK; g.fillText('乗車率', ccx, 420);
  g.font = `600 26px ${FONT}`; g.fillStyle = GREY; g.fillText(plain(t('shareCard.load')).toUpperCase(), ccx, 458);
  const col = kind === 'fail' ? RED : res.goldOk ? GOLD : OK;
  const big = `${res.fill}`, bs = fit(g, big + '%', 700, FONT, 150, cw);
  g.font = `700 ${bs}px ${FONT}`; const bw = g.measureText(big).width;
  g.font = `700 ${Math.round(bs * 0.5)}px ${FONT}`; const pw2 = g.measureText('%').width;
  const bx = ccx - (bw + pw2) / 2;
  g.textAlign = 'left'; g.fillStyle = 'rgba(27,29,38,0.12)';
  g.font = `700 ${bs}px ${FONT}`; g.fillText(big, bx + 4, 598 + 6);
  g.fillStyle = col; g.fillText(big, bx, 598);
  g.font = `700 ${Math.round(bs * 0.5)}px ${FONT}`; g.fillText('%', bx + bw + 4, 598);
  // a little gauge: where the car ended against the target and the gold line
  const gx = cx0 + 10, gw = cw - 20, gy = 632, a = 80, b = Math.max(L.gold * 100 + 30, 160), X = (v) => gx + gw * Math.min(1, Math.max(0, (v - a) / (b - a)));
  roundRect(g, gx, gy, gw, 14, 7); g.fillStyle = 'rgba(27,29,38,0.12)'; g.fill();
  roundRect(g, gx, gy, Math.max(14, X(res.fill) - gx), 14, 7); g.fillStyle = col; g.fill();
  for (const [v, cc] of [[res.target, INK], [res.gold, GOLD]]) { g.fillStyle = cc; g.fillRect(X(v) - 2, gy - 8, 4, 30); }
  g.textAlign = 'center'; g.font = `600 24px ${FONT}`; g.fillStyle = GREY;
  g.fillText(plain(t('res.target', { n: res.target })), ccx, gy + 58);
  if (kind === 'late') {
    // the delay certificate, in miniature
    const dx = cx0 + 6, dy = 730, dw = cw - 12, dh = 270;
    g.save(); g.translate(dx + dw / 2, dy + dh / 2); g.rotate(0.03); g.translate(-(dx + dw / 2), -(dy + dh / 2));
    g.save(); g.shadowColor = 'rgba(60,40,10,0.25)'; g.shadowBlur = 20; g.shadowOffsetY = 8; g.fillStyle = '#fffdf6'; g.fillRect(dx, dy, dw, dh); g.restore();
    g.fillStyle = RED; g.fillRect(dx, dy, dw, 54);
    g.fillStyle = '#ffffff'; g.font = `700 30px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('遅延証明書', dx + dw / 2, dy + 28);
    g.textBaseline = 'alphabetic'; g.fillStyle = RED; g.font = `700 64px ${FONT}`; g.fillText(`+${info.num(res.delay, 1)} s`, dx + dw / 2, dy + 124);
    g.fillStyle = INK; g.font = `600 24px ${FONT}`;
    const cl = lines(g, `${plain(t('cert.cause'))}: ${info.cause}`, dw - 36);
    cl.slice(0, 2).forEach((l, i) => g.fillText(l, dx + dw / 2, dy + 164 + i * 28));
    // the stationmaster's seal in the corner
    g.save(); g.translate(dx + dw - 44, dy + dh - 42); g.rotate(-0.12); g.globalCompositeOperation = 'multiply';
    g.strokeStyle = RED; g.lineWidth = 4; roundRect(g, -25, -25, 50, 50, 6); g.stroke();
    g.fillStyle = RED; g.font = `700 20px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('駅', 0, -10); g.fillText('長', 0, 12);
    g.restore();
    g.fillStyle = 'rgba(27,29,38,0.25)'; g.fillRect(dx + 18, dy + dh - 24, dw - 108, 2);
    g.fillStyle = GREY; g.font = `600 17px ${FONT}`; g.textAlign = 'left'; g.fillText(plain(t('cert.master')), dx + 18, dy + dh - 34);
    g.restore();
  } else if (kind === 'fail') {
    g.fillStyle = RED; g.font = `700 44px ${JP}`; g.fillText('乗り残し', ccx, 790);
    g.fillStyle = INK; g.font = `600 26px ${FONT}`;
    lines(g, plain(t('res.failSub', { fill: res.fill, target: res.target })), cw - 10).slice(0, 5).forEach((l, i) => g.fillText(l, ccx, 846 + i * 34));
  } else {
    g.font = `700 38px ${JP}`; g.fillStyle = OK; g.fillText('定時発車', ccx, 790);
    g.font = `600 26px ${FONT}`; g.fillStyle = GREY; g.fillText(`${L.dep[0]}:${String(L.dep[1]).padStart(2, '0')}:${String(L.dep[2]).padStart(2, '0')} · ${plain(t('res.onTime'))}`, ccx, 832);
  }
  if (kind !== 'fail') marks(g, L, info.set, cx0, 1010 + (kind === 'late' ? 30 : 0) - 0, cw, t);
  // the dare, in the house sticker type
  const dare = plain(t(kind === 'fail' ? 'shareCard.dareFail' : kind === 'late' ? 'shareCard.dareLate' : res.goldOk ? 'shareCard.dareGold' : 'shareCard.dare', { fill: res.fill }));
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const ds = fit(g, dare, 700, FONT, 66, W - 180);
  g.fillStyle = LINE; g.fillText(dare, W / 2, 1172 + ds * 0.08);
  g.fillStyle = INK; g.fillText(dare, W / 2, 1172);
  g.fillStyle = 'rgba(27,29,38,0.14)'; g.fillRect(84, 1222, W - 168, 2);
  g.textAlign = 'left'; g.font = `700 44px ${FONT}`; g.fillStyle = INK; g.fillText(plain(t('title')), 84, 1284);
  g.textAlign = 'right'; g.font = `600 30px ${FONT}`; g.fillStyle = GREY;
  const host = /^(localhost|127\.|0\.0\.0\.0|\[)/.test(location.hostname) || !location.hostname ? '' : location.host;
  g.fillText(host || plain(t('line')), W - 84, 1282);
  return c;
}

// the whole line stamped: the rally sheet as a card
export function buildRallyCard({ levels, save, stars, maxStars, t }) {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  paper(g, W, H);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `700 64px ${JP}`; g.fillStyle = INK; g.fillText('スタンプラリー', W / 2, 150);
  const ts = fit(g, plain(t('done.title')), 700, FONT, 54, W - 200); g.fillStyle = LINE; g.fillText(plain(t('done.title')), W / 2, 150 + ts * 1.3);
  const cols = 4, cell = 220, gx = (W - cols * cell) / 2, gy = 300;
  levels.forEach((L, i) => {
    const x = gx + (i % cols) * cell + cell / 2, y = gy + Math.floor(i / cols) * 330 + cell / 2, won = save.levels[L.id]?.won;
    g.strokeStyle = 'rgba(27,29,38,0.2)'; g.lineWidth = 3; g.setLineDash([9, 9]); g.beginPath(); g.arc(x, y, cell * 0.43, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    if (won) pressStamp(g, stampImage(L, 260), x, y, cell * 0.92, cell * 0.92, (((i * 37) % 11) - 5) * 0.02, 0.95);
    g.fillStyle = INK; g.font = `700 30px ${JP}`; g.fillText(L.kanji, x, y + cell * 0.62);
    g.fillStyle = GREY; g.font = `600 22px ${FONT}`; g.fillText(L.romaji, x, y + cell * 0.62 + 32);
  });
  g.font = `700 120px ${FONT}`; g.fillStyle = INK; g.fillText(`${stars}/${maxStars}`, W / 2, 1110);
  g.font = `600 30px ${FONT}`; g.fillStyle = GREY; g.fillText(plain(t('board.stamps')), W / 2, 1156);
  g.fillStyle = 'rgba(27,29,38,0.14)'; g.fillRect(84, 1222, W - 168, 2);
  g.textAlign = 'left'; g.font = `700 44px ${FONT}`; g.fillStyle = INK; g.fillText(plain(t('title')), 84, 1284);
  g.textAlign = 'right'; g.font = `600 30px ${FONT}`; g.fillStyle = GREY;
  const host = /^(localhost|127\.|0\.0\.0\.0|\[)/.test(location.hostname) || !location.hostname ? '' : location.host;
  g.fillText(host || plain(t('line')), W - 84, 1282);
  return c;
}

// encode once when the card is built, so the share click can open the native sheet synchronously
export function cardFile(canvas, name = 'que-cierran.png') {
  return new Promise((res) => canvas.toBlob((b) => res(b ? new File([b], name, { type: 'image/png' }) : null), 'image/png'));
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
