// The picture you post: the striped plastic bag it all came home in, with the photo of your finest
// moment taped to it and the scale's label for what you carried stuck beside it. The round seal
// says one trip or two. Then the dare.
import { t, getLang, num } from './i18n.js';
import { BAG, totalKg } from './levels.js';
import { ean13, mss, mssUp } from './ui/dom.js';
import { netKg, BAG_D } from './ui/result.js';

const FACE = "'Sofia Sans Extra Condensed', 'Arial Narrow', sans-serif";
const BODY = "'Sofia Sans Condensed', 'Arial Narrow', sans-serif";
const SEG = "'DSEG7 Classic', ui-monospace, monospace";
export const C = {
  bag: '#f4f3ee', stripe: '#3f8a52', label: '#f5f2ea', ink: '#1c1d1a', soft: '#55574f',
  brand: '#2f6b3f', red: '#c8372d', tape: 'rgba(236, 226, 196, 0.78)',
};
const R = (d) => (d * Math.PI) / 180;

function font(g, w, px, fam = BODY, style = '') { g.font = `${style} ${w} ${px}px ${fam}`.trim(); }
function fit(g, text, w, px, fam, maxW) {
  font(g, w, px, fam);
  const m = g.measureText(text).width;
  if (m > maxW) font(g, w, Math.floor((px * maxW) / m), fam);
}
let bagImg = null;
function bagTexture() {
  return (bagImg ||= new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = new URL('../assets/img/bolsa.svg', import.meta.url).href;
  }));
}
function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// the check the printer ticks: a filled disc with a tick, or an empty ring
function check(g, x, y, r, on) {
  g.save();
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
  if (on) { g.fillStyle = C.brand; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = r * 0.24; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x - r * 0.42, y + r * 0.03); g.lineTo(x - r * 0.12, y + r * 0.33); g.lineTo(x + r * 0.45, y - r * 0.3); g.stroke(); }
  else { g.strokeStyle = C.soft; g.lineWidth = r * 0.14; g.stroke(); }
  g.restore();
}
// the round seal, text all the way round
export function drawSeal(g, x, y, R0, won, text) {
  const col = won ? C.brand : C.red, rt = R0 * (44 / 57);
  g.save(); g.translate(x, y); g.rotate(won ? R(-12) : R(9));
  g.beginPath(); g.arc(0, 0, R0, 0, Math.PI * 2); g.fillStyle = col; g.fill();
  g.strokeStyle = C.label; g.lineWidth = R0 * 0.035;
  g.beginPath(); g.arc(0, 0, R0 * (53.5 / 57), 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, R0 * (34 / 57), 0, Math.PI * 2); g.stroke();
  g.fillStyle = C.label; font(g, 800, Math.round(R0 * 0.2), FACE);
  const chars = [...text], ws = chars.map((c) => g.measureText(c).width), tot = ws.reduce((a, b) => a + b, 0);
  const gap = (2 * Math.PI * rt - tot) / chars.length;
  let s = 0;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  chars.forEach((c, i) => {
    const a = Math.PI + (s + ws[i] / 2) / rt;
    g.save(); g.rotate(a); g.translate(rt, 0); g.rotate(Math.PI / 2); g.fillText(c, 0, 0); g.restore();
    s += ws[i] + gap;
  });
  if (typeof Path2D !== 'undefined') {
    const k = R0 / 37;
    g.translate(-12 * k, -12.8 * k); g.scale(k, k);
    g.strokeStyle = C.label; g.lineWidth = 1.7; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const d of BAG_D) g.stroke(new Path2D(d));
  }
  g.restore();
}

// r: { photo (canvas), sim, lv, floor, name, set, url }
export async function buildCard(r) {
  const W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'), sim = r.sim, lv = r.lv, won = sim.end.why === 'arrive', lang = getLang();
  // the bag: white plastic, green stripes, crumpled
  g.fillStyle = C.bag; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H / 2); g.rotate(R(14)); g.fillStyle = C.stripe;
  for (let x = -1100; x < 1100; x += 86) g.fillRect(x, -1100, 22, 2200);
  g.restore();
  const tex = await bagTexture();
  if (tex) { g.save(); g.globalCompositeOperation = 'multiply'; g.drawImage(tex, 0, 0, W, H); g.restore(); }
  // the photo, a print taped on
  g.save(); g.translate(318, 400); g.rotate(R(-3.5));
  g.shadowColor = 'rgba(28,29,26,0.34)'; g.shadowBlur = 26; g.shadowOffsetY = 12;
  g.fillStyle = '#fbfaf6'; g.fillRect(-258, -330, 516, 660);
  g.shadowColor = 'transparent';
  const ph = r.photo;
  if (ph) {
    const iw = 476, ih = 595, k = Math.max(iw / ph.width, ih / ph.height), sw = iw / k, sh = ih / k;
    g.drawImage(ph, (ph.width - sw) / 2, (ph.height - sh) / 2, sw, sh, -238, -310, iw, ih);
  } else { g.fillStyle = '#2b2d27'; g.fillRect(-238, -310, 476, 595); }
  g.rotate(R(5)); g.fillStyle = C.tape; g.fillRect(-92, -352, 184, 50);
  g.restore();
  // what you carried: a long list keeps what went wrong and the first of the rest
  const lost = won ? -1 : sim.end.bag, broken = new Set(sim.stats.broken), bags = lv.bags;
  let rows = bags.map((k, i) => i);
  if (rows.length > 7) {
    const bad = rows.filter((i) => i === lost || broken.has(i));
    rows = [...bad, ...rows.filter((i) => !bad.includes(i))].slice(0, 6).sort((a, b) => a - b);
  }
  // the label, as long as its list (seven lines fill it), centred where the longest one sits
  const lines = rows.length + (rows.length < bags.length ? 1 : 0), lh = 1000 - 38 * Math.max(0, 7 - lines);
  const lx = 548, ly = 146 + (1000 - lh) / 2, lw = 480, px = lx + 32, pw = lw - 64;
  g.save(); g.translate(lx + lw / 2, ly + lh / 2); g.rotate(R(1.6)); g.translate(-(lx + lw / 2), -(ly + lh / 2));
  g.shadowColor = 'rgba(28,29,26,0.3)'; g.shadowBlur = 22; g.shadowOffsetY = 10;
  rrect(g, lx, ly, lw, lh, 16); g.fillStyle = C.label; g.fill();
  g.shadowColor = 'transparent';
  let y = ly + 104;
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const title = won ? t('title') : t('res.lose');
  g.fillStyle = won ? C.ink : C.red; fit(g, title, 800, 108, FACE, pw); g.fillText(title, px, y);
  y += 24;
  g.fillStyle = C.brand; g.fillRect(lx, y, lw, 50);
  const b1 = `${r.floor} · ${r.name}`, b2 = t('res.band');
  let bf = 25; font(g, 700, bf);
  while (bf > 14 && g.measureText(b1).width + g.measureText(b2).width + 24 > pw) font(g, 700, --bf);
  g.fillStyle = '#fff'; g.fillText(b1, px, y + 34); g.textAlign = 'right'; g.fillText(b2, px + pw, y + 34); g.textAlign = 'left';
  y += 92;
  for (const i of rows) {
    const k = bags[i], fell = i === lost, br = !fell && broken.has(i), name = BAG[k][lang].toUpperCase();
    font(g, 600, 27); g.fillStyle = fell || br ? C.soft : C.ink;
    const nw = Math.min(g.measureText(name).width, pw - 150);
    g.fillText(name, px, y, pw - 150);
    if (br || fell) {
      g.strokeStyle = C.red; g.lineWidth = 2.5; g.beginPath(); g.moveTo(px - 2, y - 9); g.lineTo(px + nw + 2, y - 9); g.stroke();
    }
    g.textAlign = 'right'; g.fillStyle = fell ? C.red : C.ink;
    font(g, 700, 27); g.fillText(fell ? t('res.fell') : `${num(BAG[k].kg, 3)} kg`, px + pw, y);
    g.textAlign = 'left';
    y += 38;
  }
  if (rows.length < bags.length) {
    font(g, 600, 27); g.fillStyle = C.soft; g.fillText(`+ ${bags.length - rows.length}…`, px, y); y += 38;
  }
  y += 2;
  g.save(); g.strokeStyle = C.soft; g.lineWidth = 2.5; g.setLineDash([9, 7]); g.beginPath(); g.moveTo(px, y); g.lineTo(px + pw, y); g.stroke(); g.restore();
  // net weight, on the scale's own digits
  y += 44;
  font(g, 700, 25); g.fillStyle = C.ink; g.fillText(t('res.neto'), px, y);
  y += 92;
  const kg = netKg(sim);
  font(g, 700, 88, SEG); g.textAlign = 'right';
  g.fillStyle = 'rgba(28,29,26,0.08)'; g.fillText('88.888', px + pw - 58, y);
  g.fillStyle = C.ink; g.fillText(kg.toFixed(3), px + pw - 58, y);
  font(g, 700, 34); g.fillText('kg', px + pw, y);
  g.textAlign = 'left';
  y += 52;
  font(g, 600, 25); g.fillStyle = C.soft;
  g.fillText(`${t('res.time')} ${mssUp(sim.end.t)}`, px, y);
  g.textAlign = 'right'; g.fillText(`${t('res.par')} ${mss(lv.par)}`, px + pw, y); g.textAlign = 'left';
  y += 26;
  const names = t('res.stars');
  for (let i = 0; i < 3; i++) {
    y += 38;
    check(g, px + 15, y - 9, 15, r.set[i]);
    font(g, 700, 25); g.fillStyle = r.set[i] ? C.ink : C.soft; g.fillText(names[i], px + 44, y);
  }
  // the barcode the scale prints: prefix 2, the level, the grams
  y += 30;
  const { code, bars } = ean13(lv.n, kg * 1000), m = 3.0, bh = 0.62 * m, bx = px + (pw - 113 * m) / 2;
  g.fillStyle = C.ink;
  for (const b of bars) g.fillRect(bx + (b.x + 9) * m, y, b.w * m, (b.tall ? 58 : 52) * bh);
  font(g, 600, 28); g.textAlign = 'center';
  const ty = y + 58 * bh + 22;
  g.fillText(code[0], bx + 4.5 * m, ty); g.fillText(code.slice(1, 7), bx + 33 * m, ty); g.fillText(code.slice(7), bx + 80 * m, ty);
  g.restore();
  // the seal, and the dare on a strip of label tape
  drawSeal(g, 262, 928, 132, won, t(won ? 'res.seal' : 'res.sealLose'));
  g.save(); g.translate(W / 2, 1262); g.rotate(R(-1.2));
  g.shadowColor = 'rgba(28,29,26,0.28)'; g.shadowBlur = 16; g.shadowOffsetY = 6;
  rrect(g, -480, -58, 960, 118, 12); g.fillStyle = C.label; g.fill(); g.shadowColor = 'transparent';
  g.textAlign = 'center'; g.fillStyle = C.ink;
  fit(g, t('share.dare'), 800, 56, FACE, 900); g.fillText(t('share.dare'), 0, 10);
  font(g, 600, 25); g.fillStyle = C.soft; g.fillText(r.url.replace(/^https?:\/\//, '').replace(/\/$/, ''), 0, 46);
  g.restore();
  return c;
}

export function shareText(sim) {
  const lang = getLang(), won = sim.end?.why === 'arrive', lv = sim.lv;
  let s;
  if (won) s = t(sim.stats.broken.length ? 'share.winBroken' : 'share.win', { n: lv.bags.length, kg: num(totalKg(lv), 1), time: mssUp(sim.end.t) });
  else s = t('share.lose', { bag: BAG[lv.bags[sim.end.bag]][lang].split(',')[0].toLowerCase() });
  return `${s} ${t('share.dare')}`;
}

export function cardFile(cv, name = 'un-solo-viaje.png') {
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
