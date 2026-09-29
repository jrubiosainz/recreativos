// The level's still life, painted once per level and scale into an offscreen canvas: every solid and
// ledge tile, and the decor that never moves (signs, ladders, the kiosk, the pedestals). Each material
// is a pattern plus two edge habits: a lit lip where it faces the sky and the key line where it meets
// the air. Units inside the painters are tiles; the canvas is scaled once.
import { INK, rr, ell, hash2, popText } from './paint.js';
import { TAU } from '../util.js';

const SOLIDS = '#TCWMGBKRDSX', LEDGES = '-_=';
const BASE = {
  '#': ['#EFDFBE', '#E2CDA3'], T: ['#B7D3E4', '#9DBFD6'], C: ['#E9E3D6', '#D6CEBD'], W: ['#FAF6EC', '#EFE8D8'],
  M: ['#4A78C0', '#355EA2'], G: ['#9B6B45', '#7E5436'], B: ['#CF6C45', '#B9583A'], K: ['#F6D34A', '#F06A8E'],
  R: ['#F6D34A', '#E8B82E'], D: ['#C48A52', '#A87141'], S: ['#4F8A3A', '#3F7430'], X: ['#D8322A', '#B72821'],
};

export function paintStatic(level, map, px) {
  const W = map.w, H = map.h;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(W * px); cv.height = Math.ceil(H * px);
  const g = cv.getContext('2d');
  g.scale(px, px);
  const ch = (c, r) => (r >= 0 && r < H && c >= 0 && c < W ? level.map[r][c] || '.' : r >= H ? '#' : '.');
  const solid = (c, r) => SOLIDS.includes(ch(c, r)) || (r >= H) || c < 0 || c >= W;
  // decor that stands behind the tiles (the kiosk building, the slide, the lifeguard chair)
  // the pool's back wall, seen through the water
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (map.tiles[r * W + c] === 3) poolBack(g, c, r, (cc, rr2) => rr2 >= 0 && rr2 < H && cc >= 0 && cc < W && map.tiles[rr2 * W + cc] === 3);
  for (const d of level.decor || []) if (BEHIND[d.k]) BEHIND[d.k](g, d, level);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const k = ch(c, r);
    if (SOLIDS.includes(k)) paintSolid(g, k, c, r, ch, solid);
  }
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const k = ch(c, r);
    if (LEDGES.includes(k) && ch(c - 1, r) !== k) { let c1 = c; while (ch(c1 + 1, r) === k) c1++; paintLedge(g, k, c, c1 + 1, r, ch, solid); }
  }
  // key lines on every edge that meets the air
  g.strokeStyle = INK.key; g.lineWidth = 0.06; g.lineCap = 'round'; g.globalAlpha = 0.85;
  g.beginPath();
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (!SOLIDS.includes(ch(c, r))) continue;
    if (!solid(c, r - 1)) { g.moveTo(c, r); g.lineTo(c + 1, r); }
    if (!solid(c, r + 1) && r + 1 < H) { g.moveTo(c, r + 1); g.lineTo(c + 1, r + 1); }
    if (!solid(c - 1, r) && c > 0) { g.moveTo(c, r); g.lineTo(c, r + 1); }
    if (!solid(c + 1, r) && c + 1 < W) { g.moveTo(c + 1, r); g.lineTo(c + 1, r + 1); }
  }
  g.stroke(); g.globalAlpha = 1;
  for (const d of level.decor || []) if (FRONT[d.k]) FRONT[d.k](g, d, level, map);
  // shower pipes and fountains are furniture too
  for (const s of map.showers) showerPipe(g, s, ch);
  for (const f of map.fountains) fountain(g, f);
  return cv;
}

function poolBack(g, c, r, isW) {
  let d = 0; while (d < 20 && isW(c, r - d - 1)) d++;
  const f = Math.min(1, d / 6);
  g.fillStyle = `rgb(${Math.round(214 - 60 * f)},${Math.round(238 - 40 * f)},${Math.round(244 - 22 * f)})`;
  g.fillRect(c, r, 1.002, 1.002);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const u = hash2(c * 4 + i, r * 4 + j, 9);
    g.fillStyle = u > 0.9 ? 'rgba(60,120,180,0.28)' : `rgba(255,255,255,${0.1 + 0.16 * u})`;
    g.fillRect(c + i * 0.25 + 0.02, r + j * 0.25 + 0.02, 0.21, 0.21);
  }
  if (d === 0) {   // the waterline frieze
    for (let i = 0; i < 4; i++) { g.fillStyle = (c * 4 + i) % 2 ? INK.navy : '#FFFFFF'; g.fillRect(c + i * 0.25, r + 0.18, 0.25, 0.25); }
    g.fillStyle = INK.blue; g.fillRect(c, r + 0.43, 1.002, 0.06);
  }
  // a lane line down the middle of deep water
  if (d >= 2 && !isW(c, r + 1)) { g.fillStyle = 'rgba(29,47,111,0.55)'; g.fillRect(c, r + 0.55, 1.002, 0.22); }
}

// ---------- solids ----------
function paintSolid(g, k, c, r, ch, solid) {
  const [a, b] = BASE[k] || BASE['#'];
  const up = !solid(c, r - 1), down = !solid(c, r + 1), h = hash2(c, r, k.charCodeAt(0));
  const topRow = (() => { let n = 0; while (n < 12 && ch(c, r - n - 1) === k) n++; return n; })();   // depth below this material's top
  g.save(); g.beginPath(); g.rect(c, r, 1.002, 1.002); g.clip();
  const grd = g.createLinearGradient(0, r, 0, r + 1); grd.addColorStop(0, a); grd.addColorStop(1, b);
  g.fillStyle = grd; g.fillRect(c, r, 1.002, 1.002);
  const depthShade = Math.min(0.28, topRow * 0.035);
  switch (k) {
    case '#': {   // deck slabs: one slab a tile, slightly uneven, a grout line
      g.fillStyle = `rgba(255,250,235,${0.25 + 0.2 * h})`; g.fillRect(c + 0.04, r + 0.04, 0.92, 0.92);
      g.strokeStyle = 'rgba(150,120,80,0.45)'; g.lineWidth = 0.035; g.strokeRect(c + 0.02, r + 0.02, 0.96, 0.96);
      for (let i = 0; i < 4; i++) { const u = hash2(c, r, 30 + i); g.fillStyle = 'rgba(160,130,90,0.22)'; ell(g, c + 0.15 + 0.7 * u, r + 0.2 + 0.6 * hash2(r, c, i), 0.02, 0.02); g.fill(); }
      if (up) { lip(g, c, r, '#FFFDF6', 0.26); if (ch(c, r + 1) !== '#' || true) band(g, c, r + 0.26, 0.18); }
      break;
    }
    case 'T': {   // pool wall: little mosaic tiles, a navy and white border band at the rim
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const u = hash2(c * 4 + i, r * 4 + j, 3); g.fillStyle = u > 0.86 ? 'rgba(90,140,190,0.45)' : `rgba(255,255,255,${0.12 + 0.2 * u})`; g.fillRect(c + i * 0.25 + 0.02, r + j * 0.25 + 0.02, 0.21, 0.21); }
      if (up) { lip(g, c, r, '#FFFDF6', 0.22); checker(g, c, r + 0.22, 0.28); }
      break;
    }
    case 'C': {   // board-marked concrete, rain stains under every lip
      g.strokeStyle = 'rgba(120,110,95,0.22)'; g.lineWidth = 0.025;
      g.beginPath(); g.moveTo(c, r + 0.5); g.lineTo(c + 1, r + 0.5); g.stroke();
      for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(110,100,85,${0.08 + 0.1 * hash2(c, r, i)})`; ell(g, c + hash2(c, r, 10 + i), r + hash2(r, c, 20 + i), 0.03, 0.03); g.fill(); }
      if (topRow < 3) { g.fillStyle = `rgba(120,105,80,${0.12 - topRow * 0.04})`; g.fillRect(c + 0.15 + 0.5 * h, r, 0.08, 1); }
      if (up) lip(g, c, r, '#F7F3EA', 0.16);
      break;
    }
    case 'W': {   // whitewash, with the blue zócalo along the bottom
      for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(220,210,190,0.35)'; ell(g, c + hash2(c, r, i), r + hash2(r, c, i + 5), 0.18, 0.1); g.fill(); }
      let toBottom = 0; while (toBottom < 8 && ch(c, r + toBottom + 1) === 'W') toBottom++;
      if (toBottom < 2) { g.fillStyle = INK.blue; g.fillRect(c, toBottom === 1 ? r + 0.4 : r, 1.002, toBottom === 1 ? 0.62 : 1.002); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(c, toBottom === 1 ? r + 0.4 : r, 1.002, 0.05); }
      if (up) lip(g, c, r, '#FFFFFF', 0.14);
      break;
    }
    case 'M': {   // lockers: a door every tile, two tiles tall, vents and a handle
      const door = topRow % 2;
      g.fillStyle = 'rgba(0,0,40,0.25)'; g.fillRect(c, r, 0.04, 1); g.fillRect(c + 0.96, r, 0.04, 1);
      if (door === 0) { g.fillStyle = 'rgba(0,0,40,0.5)'; for (let i = 0; i < 4; i++) g.fillRect(c + 0.25, r + 0.2 + i * 0.1, 0.5, 0.04); g.fillRect(c, r, 1, 0.04); }
      else { g.fillStyle = '#C9D3E0'; g.fillRect(c + 0.72, r + 0.1, 0.07, 0.3); g.fillStyle = `rgba(255,255,255,0.2)`; g.fillRect(c + 0.1, r, 0.06, 1); }
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(c + 0.08, r, 0.1, 1);
      if (up) lip(g, c, r, '#7FA6DE', 0.1);
      break;
    }
    case 'G': {   // lawn over earth
      if (depthShade) { g.fillStyle = `rgba(40,20,10,${depthShade})`; g.fillRect(c, r, 1.002, 1.002); }
      for (let i = 0; i < 3; i++) { g.fillStyle = `rgba(230,200,160,${0.25 * hash2(c, r, i)})`; ell(g, c + hash2(c, r, 40 + i), r + hash2(r, c, 50 + i), 0.05, 0.035); g.fill(); }
      if (up) grass(g, c, r);
      break;
    }
    case 'B': {   // brick, stretcher bond
      g.strokeStyle = 'rgba(245,225,200,0.75)'; g.lineWidth = 0.04;
      for (let j = 0; j < 4; j++) { const y = r + j * 0.25; g.beginPath(); g.moveTo(c, y); g.lineTo(c + 1, y); g.stroke(); const off = (j + r) % 2 ? 0 : 0.25; for (let x = off; x < 1; x += 0.5) { g.beginPath(); g.moveTo(c + x, y); g.lineTo(c + x, y + 0.25); g.stroke(); } }
      for (let j = 0; j < 4; j++) { g.fillStyle = `rgba(120,30,10,${0.15 * hash2(c, r, j)})`; g.fillRect(c, r + j * 0.25, 1, 0.25); }
      if (up) lip(g, c, r, '#E88A60', 0.1);
      break;
    }
    case 'K': {   // stacked kickboards
      const cols = ['#F6D34A', '#F06A8E', '#3BA0E0', '#7DC56A'];
      for (let j = 0; j < 4; j++) { const col = cols[(r * 4 + j) % 4]; g.fillStyle = col; g.beginPath(); rr(g, c - 0.02, r + j * 0.25 + 0.015, 1.04, 0.22, 0.08); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(c, r + j * 0.25 + 0.04, 1, 0.04); }
      break;
    }
    case 'D': {   // wooden planks
      g.strokeStyle = 'rgba(90,50,20,0.45)'; g.lineWidth = 0.03;
      for (let j = 1; j < 3; j++) { g.beginPath(); g.moveTo(c, r + j / 3); g.lineTo(c + 1, r + j / 3); g.stroke(); }
      g.strokeStyle = 'rgba(90,50,20,0.2)'; g.beginPath(); g.moveTo(c + 0.1, r + 0.15); g.quadraticCurveTo(c + 0.5, r + 0.1 + 0.1 * h, c + 0.9, r + 0.18); g.stroke();
      if (up) lip(g, c, r, '#E2A96C', 0.1);
      break;
    }
    case 'S': {   // hedge
      for (let i = 0; i < 7; i++) { const u = hash2(c, r, i); g.fillStyle = ['#3F7430', '#5E9A44', '#72AE52', '#4F8A3A'][i % 4]; ell(g, c + hash2(c, r, 60 + i), r + hash2(r, c, 70 + i), 0.18 + 0.1 * u, 0.15 + 0.08 * u); g.fill(); }
      if (up) { g.fillStyle = '#86C25E'; for (let i = 0; i < 3; i++) { ell(g, c + 0.2 + i * 0.3, r + 0.1, 0.18, 0.12); g.fill(); } }
      break;
    }
    case 'X': {   // red bottle crates: openings with green glass
      g.fillStyle = 'rgba(90,10,10,0.55)';
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.beginPath(); rr(g, c + 0.08 + i * 0.46, r + 0.1 + j * 0.44, 0.38, 0.34, 0.06); g.fill(); }
      if (up) { g.fillStyle = '#2F7A4A'; for (let i = 0; i < 3; i++) { g.beginPath(); rr(g, c + 0.12 + i * 0.28, r - 0.02, 0.16, 0.18, 0.05); g.fill(); } }
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(c, r + 0.02, 1, 0.05);
      break;
    }
    default:
  }
  if (depthShade && k !== 'G' && k !== 'T') { g.fillStyle = `rgba(60,40,30,${depthShade * 0.5})`; g.fillRect(c, r, 1.002, 1.002); }
  if (down && r + 1 < 999) { const sg = g.createLinearGradient(0, r + 0.75, 0, r + 1); sg.addColorStop(0, 'rgba(30,20,40,0)'); sg.addColorStop(1, 'rgba(30,20,40,0.25)'); g.fillStyle = sg; g.fillRect(c, r + 0.75, 1.002, 0.25); }
  g.restore();
}
function lip(g, c, r, col, h) {
  g.fillStyle = col; g.fillRect(c, r, 1.002, h);
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(c, r, 1.002, h * 0.3);
  g.fillStyle = 'rgba(40,30,60,0.18)'; g.fillRect(c, r + h, 1.002, 0.04);
}
function band(g, c, y, h) { checker(g, c, y, h); }
function checker(g, c, y, h) {
  const n = 4;
  for (let i = 0; i < n; i++) { g.fillStyle = (i + c * n) % 2 ? INK.white : INK.blue; g.fillRect(c + i / n, y, 1 / n + 0.002, h / 2); g.fillStyle = (i + c * n) % 2 ? INK.blue : INK.white; g.fillRect(c + i / n, y + h / 2, 1 / n + 0.002, h / 2); }
}
function grass(g, c, r) {
  g.fillStyle = '#6BAA44'; g.fillRect(c, r, 1.002, 0.3);
  g.fillStyle = '#8FCB5E'; g.fillRect(c, r, 1.002, 0.1);
  g.strokeStyle = '#4E8C34'; g.lineWidth = 0.035; g.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const x = c + (i + hash2(c, r, i)) / 6; g.beginPath(); g.moveTo(x, r + 0.28); g.lineTo(x + (hash2(r, c, i) - 0.5) * 0.12, r - 0.08 - 0.08 * hash2(c, i, r)); g.stroke(); }
}

// ---------- ledges ----------
function paintLedge(g, k, c0, c1, r, ch, solid) {
  const w = c1 - c0;
  if (k === '=') {   // a plank on brackets
    g.fillStyle = 'rgba(30,20,40,0.18)'; g.fillRect(c0 + 0.1, r + 0.34, w - 0.2, 0.08);
    for (const x of [c0 + 0.35, c1 - 0.35]) if (!solid(Math.floor(x), r + 1)) { g.fillStyle = '#8A8FA0'; g.beginPath(); g.moveTo(x - 0.05, r + 0.3); g.lineTo(x + 0.05, r + 0.3); g.lineTo(x, r + 0.7); g.closePath(); g.fill(); }
    g.beginPath(); rr(g, c0 - 0.04, r, w + 0.08, 0.32, 0.08);
    const gr = g.createLinearGradient(0, r, 0, r + 0.32); gr.addColorStop(0, '#E7B27A'); gr.addColorStop(1, '#A86C3C');
    g.fillStyle = gr; g.lineWidth = 0.05; g.strokeStyle = INK.key; g.stroke(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(c0, r + 0.03, w, 0.05);
    g.fillStyle = '#6E4A2A'; for (let x = c0 + 0.5; x < c1; x += 1) { ell(g, x, r + 0.17, 0.03, 0.03); g.fill(); }
  } else if (k === '-') {   // a chrome rung / a shelf
    g.beginPath(); rr(g, c0 - 0.02, r + 0.02, w + 0.04, 0.16, 0.08);
    const gr = g.createLinearGradient(0, r, 0, r + 0.18); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.5, '#B9C3CF'); gr.addColorStop(1, '#6F7A89');
    g.fillStyle = gr; g.lineWidth = 0.04; g.strokeStyle = INK.key; g.stroke(); g.fill();
    for (const x of [c0 + 0.08, c1 - 0.08]) { g.fillStyle = '#7C8796'; g.fillRect(x - 0.03, r + 0.16, 0.06, 0.12); }
  } else if (k === '_') {   // a white plastic sunbed: slats, a raised back, little legs
    const legBottom = (() => { let rr2 = r + 1; while (rr2 < r + 6 && !solid(c0, rr2)) rr2++; return rr2; })();
    g.fillStyle = '#C9C4B8'; for (const x of [c0 + 0.25, c1 - 0.25]) g.fillRect(x - 0.05, r + 0.2, 0.1, legBottom - r - 0.2);
    g.beginPath(); rr(g, c0, r, w, 0.26, 0.1); g.fillStyle = '#FFFFFF'; g.lineWidth = 0.05; g.strokeStyle = INK.key; g.stroke(); g.fill();
    g.fillStyle = 'rgba(120,130,150,0.35)'; for (let x = c0 + 0.2; x < c1 - 0.1; x += 0.22) g.fillRect(x, r + 0.04, 0.05, 0.18);
    g.save(); g.translate(c0 + 0.1, r + 0.05); g.rotate(-0.9); g.beginPath(); rr(g, 0, -0.13, 1.1, 0.24, 0.1); g.fillStyle = '#FFFFFF'; g.stroke(); g.fill(); g.restore();
  }
}

// ---------- furniture ----------
function showerPipe(g, s, ch) {
  const x = s.c + 0.5, y = s.r + 0.5;
  // the pipe goes up to whatever holds it (a roof, a wall), or stands on its own post
  let top = s.r; while (top > 0 && ch(s.c, top - 1) === '.') top--;
  const fromTop = top > 0 && top > s.r - 10;
  g.lineCap = 'round';
  g.strokeStyle = INK.key; g.lineWidth = 0.2;
  g.beginPath(); g.moveTo(x - 0.25, fromTop ? top : y - 0.6); g.lineTo(x - 0.25, y - 0.1); g.quadraticCurveTo(x - 0.25, y - 0.25, x, y - 0.2); g.stroke();
  g.strokeStyle = '#C8D2DE'; g.lineWidth = 0.12; g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = 0.035; g.stroke();
  g.beginPath(); g.moveTo(x - 0.3, y - 0.2); g.lineTo(x + 0.3, y - 0.2); g.lineTo(x + 0.4, y + 0.12); g.lineTo(x - 0.4, y + 0.12); g.closePath();
  const gr = g.createLinearGradient(x - 0.4, 0, x + 0.4, 0); gr.addColorStop(0, '#8E9AAA'); gr.addColorStop(0.35, '#FFFFFF'); gr.addColorStop(1, '#7C8898');
  g.fillStyle = gr; g.lineWidth = 0.05; g.strokeStyle = INK.key; g.stroke(); g.fill();
}
function fountain(g, f) {
  const x = f.x, y = f.y;
  g.beginPath(); rr(g, x - 0.28, y - 1.5, 0.56, 1.5, 0.08);
  const gr = g.createLinearGradient(x - 0.3, 0, x + 0.3, 0); gr.addColorStop(0, '#D9D2C2'); gr.addColorStop(0.4, '#F5F1E8'); gr.addColorStop(1, '#B9B09C');
  g.fillStyle = gr; g.lineWidth = 0.05; g.strokeStyle = INK.key; g.stroke(); g.fill();
  g.beginPath(); rr(g, x - 0.42, y - 1.62, 0.84, 0.2, 0.08); g.fillStyle = '#EDE7DA'; g.stroke(); g.fill();
  g.fillStyle = '#C8D2DE'; g.beginPath(); rr(g, x + 0.05, y - 1.8, 0.1, 0.2, 0.04); g.fill();
}

const SIGN = {
  noBomb: { es: ['PROHIBIDO', 'HACER BOMBAS'], en: ['NO', 'BOMBING'], icon: 'bomb' },
  noBounce: { es: ['PROHIBIDO', 'BOTAR'], en: ['NO', 'BOUNCING'], icon: 'bounce' },
  agua: { es: ['AGUA', 'POTABLE'], en: ['DRINKING', 'WATER'], icon: 'drop' },
  ducha: { es: ['DÚCHESE', 'ANTES'], en: ['SHOWER', 'FIRST'], icon: 'shower' },
  vestuarios: { es: ['VESTUARIOS'], en: ['CHANGING', 'ROOMS'], icon: null },
};
export let signLang = 'es';
export function setSignLang(l) { signLang = l; }

const BEHIND = {
  kiosk(g, d) {   // the chiringuito: the brick block is the kiosk; this is its face
    const { x0, x1, top, y } = d, w = x1 - x0;
    // striped awning over the counter
    const ay = top + 1.2;
    for (let i = 0; i < w * 2; i++) { g.fillStyle = i % 2 ? INK.white : INK.red; g.fillRect(x0 - 0.4 + i * 0.5 * (w + 0.8) / w, ay, 0.5 * (w + 0.8) / w + 0.01, 0.9); }
    g.beginPath(); for (let i = 0; i <= w * 2; i++) { const xx = x0 - 0.4 + i * 0.5 * (w + 0.8) / w; g.arc(xx + 0.25 * (w + 0.8) / w, ay + 0.9, 0.25 * (w + 0.8) / w, 0, Math.PI); }
    g.fillStyle = INK.red; g.fill();
  },
  slide(g, d) {   // the kiddie slide tower: rails for the rungs, posts under the deck, a railing
    const { x0, x1, top, y } = d, foot = y - 1;
    const post = (x, y0, y1, w, col) => {
      g.lineCap = 'round'; g.strokeStyle = INK.key; g.lineWidth = w + 0.1; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
      g.strokeStyle = col; g.lineWidth = w; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = w * 0.25; g.beginPath(); g.moveTo(x - w * 0.2, y0 + 0.1); g.lineTo(x - w * 0.2, y1 - 0.1); g.stroke();
    };
    post(x0 + 1.1, top - 0.4, foot, 0.2, INK.yellow); post(x0 + 2.95, top - 0.4, foot, 0.2, INK.yellow);
    post(x0 + 3.5, top + 0.3, foot, 0.34, INK.red); post(x1 - 0.5, top + 0.3, foot + 0.5, 0.34, INK.red);
    // cross braces
    g.strokeStyle = 'rgba(42,33,80,0.75)'; g.lineWidth = 0.08;
    g.beginPath(); g.moveTo(x0 + 3.5, top + 0.6); g.lineTo(x1 - 0.5, foot - 0.2); g.moveTo(x1 - 0.5, top + 0.6); g.lineTo(x0 + 3.5, foot - 0.2); g.stroke();
    // the railing on the platform, open at the far end
    g.strokeStyle = INK.key; g.lineWidth = 0.16; g.beginPath(); g.moveTo(x0 + 3.1, top - 1.6); g.lineTo(x0 + 5.3, top - 1.6); g.stroke();
    g.strokeStyle = INK.blue; g.lineWidth = 0.1; g.stroke();
    for (const x of [x0 + 3.2, x0 + 4.2, x0 + 5.2]) post(x, top - 1.6, top, 0.09, INK.blue);
  },
  lgChair(g, d) {   // the empty lifeguard chair (he's gone for a coffee)
    const { x0, x1, top, y } = d, cx = (x0 + x1) / 2;
    g.strokeStyle = INK.key; g.lineWidth = 0.28; g.lineCap = 'round';
    const legs = [[x0 + 0.8, y], [x1 - 0.8, y]];
    for (const [lx, ly] of legs) { g.beginPath(); g.moveTo(lx, ly); g.lineTo(cx + (lx - cx) * 0.55, top + 1.2); g.stroke(); }
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 0.18;
    for (const [lx, ly] of legs) { g.beginPath(); g.moveTo(lx, ly); g.lineTo(cx + (lx - cx) * 0.55, top + 1.2); g.stroke(); }
    for (let yy = top + 3; yy < y - 0.5; yy += 2.2) { g.strokeStyle = '#FFFFFF'; g.lineWidth = 0.14; g.beginPath(); const f = (yy - top) / (y - top); g.moveTo(cx - (cx - x0 - 0.8) * (0.55 + 0.45 * f), yy); g.lineTo(cx + (x1 - 0.8 - cx) * (0.55 + 0.45 * f), yy); g.stroke(); }
    // seat and backrest
    g.beginPath(); rr(g, cx - 1.6, top + 0.9, 3.2, 0.35, 0.1); g.fillStyle = '#FFFFFF'; g.lineWidth = 0.06; g.strokeStyle = INK.key; g.stroke(); g.fill();
    g.beginPath(); rr(g, cx + 0.9, top - 1.4, 0.35, 2.4, 0.1); g.stroke(); g.fill();
    // the red rescue buoy hanging off it
    g.lineWidth = 0.32; g.strokeStyle = INK.key; g.beginPath(); g.arc(x0 + 1.2, top + 4.2, 0.75, 0, TAU); g.stroke();
    g.lineWidth = 0.24; for (let i = 0; i < 8; i++) { g.strokeStyle = i % 2 ? INK.white : INK.red; g.beginPath(); g.arc(x0 + 1.2, top + 4.2, 0.75, i * TAU / 8, (i + 1) * TAU / 8); g.stroke(); }
  },
};

const FRONT = {
  sign(g, d) {
    const s = SIGN[d.id]; if (!s) return;
    const lines = s[signLang] || s.es, x = d.x, y = d.y;
    const w = 2.3, h = 0.55 + 0.42 * lines.length + (s.icon ? 0.9 : 0);
    const top = y - 1.6 - h;
    g.fillStyle = '#8B94A3'; g.fillRect(x - 0.06, top + h - 0.1, 0.12, y - (top + h) + 0.1);
    g.save(); g.translate(x, top); g.rotate(d.id === 'noBomb' ? -0.04 : 0.03);
    g.beginPath(); rr(g, -w / 2, 0, w, h, 0.12); g.fillStyle = INK.white; g.lineWidth = 0.07; g.strokeStyle = INK.key; g.stroke(); g.fill();
    g.strokeStyle = INK.red; g.lineWidth = 0.08; g.beginPath(); rr(g, -w / 2 + 0.1, 0.1, w - 0.2, h - 0.2, 0.08); g.stroke();
    let yy = 0.3;
    if (s.icon) {
      const cy = 0.72; g.save(); g.translate(0, cy);
      if (s.icon === 'bomb' || s.icon === 'bounce') {
        g.fillStyle = INK.navy; ell(g, 0, 0.02, 0.2, 0.2); g.fill();
        if (s.icon === 'bomb') { g.strokeStyle = INK.navy; g.lineWidth = 0.05; g.beginPath(); g.moveTo(-0.1, 0.18); g.lineTo(-0.1, 0.3); g.moveTo(0.1, 0.18); g.lineTo(0.1, 0.3); g.stroke(); }
        else { g.strokeStyle = INK.navy; g.lineWidth = 0.05; g.beginPath(); g.moveTo(-0.35, 0.34); g.quadraticCurveTo(0, 0.24, 0.35, 0.34); g.stroke(); }
        g.strokeStyle = INK.pool; g.lineWidth = 0.05; g.beginPath(); for (let i = -2; i <= 2; i++) { g.moveTo(i * 0.12, -0.28); g.lineTo(i * 0.16, -0.38); } g.stroke();
        g.strokeStyle = INK.red; g.lineWidth = 0.08; g.beginPath(); g.arc(0, 0, 0.4, 0, TAU); g.moveTo(-0.28, -0.28); g.lineTo(0.28, 0.28); g.stroke();
      } else if (s.icon === 'drop') {
        g.fillStyle = INK.pool; g.beginPath(); g.moveTo(0, -0.35); g.quadraticCurveTo(0.28, 0, 0.2, 0.15); g.arc(0, 0.12, 0.2, 0, Math.PI); g.quadraticCurveTo(-0.28, 0, 0, -0.35); g.fill();
      } else if (s.icon === 'shower') {
        g.fillStyle = '#8E9AAA'; g.fillRect(-0.25, -0.34, 0.5, 0.12); g.strokeStyle = INK.pool; g.lineWidth = 0.05; g.beginPath(); for (let i = -2; i <= 2; i++) { g.moveTo(i * 0.1, -0.18); g.lineTo(i * 0.14, 0.3); } g.stroke();
      }
      g.restore(); yy = 1.35;
    }
    g.fillStyle = INK.red; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const L of lines) { fitText(g, L, 0, yy, w - 0.4, 0.34); yy += 0.42; }
    g.restore();
  },
  ladder(g, d) {
    const { x, y0, y1 } = d;
    g.lineCap = 'round';
    for (const dx of [-0.45, 0.45]) { g.strokeStyle = INK.key; g.lineWidth = 0.16; g.beginPath(); g.moveTo(x + dx, y0); g.lineTo(x + dx, y1); g.stroke(); g.strokeStyle = '#D5DCE5'; g.lineWidth = 0.09; g.stroke(); }
    g.strokeStyle = '#B5BFCB'; g.lineWidth = 0.08;
    for (let yy = y0 + 0.5; yy < y1; yy += 1.2) { g.beginPath(); g.moveTo(x - 0.45, yy); g.lineTo(x + 0.45, yy); g.stroke(); }
    // closed: a chain and a sign
    if (d.closed !== false) {
      const cy = (y1 - 3);
      g.strokeStyle = '#6B6F78'; g.lineWidth = 0.05; for (let i = 0; i < 6; i++) { ell(g, x - 0.4 + i * 0.16, cy + Math.sin(i / 5 * Math.PI) * 0.18, 0.07, 0.04); g.stroke(); }
      g.beginPath(); rr(g, x - 0.9, cy + 0.1, 1.8, 0.8, 0.08); g.fillStyle = INK.yellow; g.lineWidth = 0.05; g.strokeStyle = INK.key; g.stroke(); g.fill();
      g.fillStyle = INK.navy; g.textAlign = 'center'; g.textBaseline = 'middle';
      const L = signLang === 'en' ? ['LADDER', 'CLOSED'] : ['ESCALERA', 'CERRADA'];
      fitText(g, L[0], x, cy + 0.32, 1.6, 0.26); fitText(g, L[1], x, cy + 0.64, 1.6, 0.26);
    }
  },
  pedestal(g, d) {
    const { x, y0, y1 } = d;
    g.beginPath(); rr(g, x - 0.35, y0, 0.7, y1 - y0, 0.06);
    const gr = g.createLinearGradient(x - 0.35, 0, x + 0.35, 0); gr.addColorStop(0, '#D6CEBD'); gr.addColorStop(0.4, '#F4F0E6'); gr.addColorStop(1, '#BDB29E');
    g.fillStyle = gr; g.lineWidth = 0.05; g.strokeStyle = INK.key; g.stroke(); g.fill();
  },
  bench(g, d) {
    const { x0, x1, y } = d;
    g.fillStyle = '#6F5A48'; for (const x of [x0 + 0.4, x1 - 0.4]) g.fillRect(x - 0.08, y - 1.1, 0.16, 1.1);
    g.beginPath(); rr(g, x0, y - 1.3, x1 - x0, 0.28, 0.08); g.fillStyle = '#C48A52'; g.lineWidth = 0.05; g.strokeStyle = INK.key; g.stroke(); g.fill();
    // a folded towel on it
    g.beginPath(); rr(g, x0 + 0.5, y - 1.62, 1.6, 0.34, 0.1); g.fillStyle = INK.white; g.stroke(); g.fill();
    g.fillStyle = INK.blue; g.fillRect(x0 + 0.9, y - 1.6, 0.18, 0.3); g.fillRect(x0 + 1.4, y - 1.6, 0.18, 0.3);
  },
  kiosk(g, d) {
    const { x0, x1, top } = d, w = x1 - x0;
    // HELADOS board on the roof
    const by = top - 2.1;
    g.fillStyle = '#6E6A63'; g.fillRect(x0 + 1, by + 1.6, 0.12, 0.5); g.fillRect(x1 - 1.12, by + 1.6, 0.12, 0.5);
    g.beginPath(); rr(g, x0 + 0.3, by, w - 0.6, 1.6, 0.2); g.fillStyle = INK.yellow; g.lineWidth = 0.08; g.strokeStyle = INK.key; g.stroke(); g.fill();
    g.save(); g.beginPath(); rr(g, x0 + 0.3, by, w - 0.6, 1.6, 0.2); g.clip();
    popText(g, signLang === 'en' ? 'ICE CREAM' : 'HELADOS', x0 + w / 2, by + 0.82, 1.0, { face: INK.red, side: '#8C1D17', key: INK.navy, rot: -0.03 });
    g.restore();
    // counter window with the price poster
    const wy = top + 2.6;
    g.beginPath(); rr(g, x0 + 0.8, wy, w - 1.6, 2.4, 0.1); g.fillStyle = '#2B2440'; g.fill();
    g.beginPath(); rr(g, x0 + 1.2, wy + 0.3, 2.2, 1.8, 0.06); g.fillStyle = INK.paper; g.fill();
    for (let i = 0; i < 3; i++) { g.fillStyle = [INK.pink, INK.yellow, '#8B5A3C'][i]; ell(g, x0 + 1.6 + i * 0.7, wy + 0.9, 0.22, 0.22); g.fill(); g.fillStyle = INK.red; ell(g, x0 + 1.6 + i * 0.7, wy + 1.6, 0.16, 0.16); g.fill(); }
    g.beginPath(); rr(g, x0 + 0.4, wy + 2.3, w - 0.8, 0.35, 0.08); g.fillStyle = INK.white; g.lineWidth = 0.05; g.strokeStyle = INK.key; g.stroke(); g.fill();
  },
  abuela() {},
};

export function fitText(g, text, x, y, maxW, size) {
  g.font = `700 ${size}px Kanit, system-ui, sans-serif`;
  const w = g.measureText(text).width;
  if (w > maxW) { g.save(); g.translate(x, y); g.scale(maxW / w, 1); g.fillText(text, 0, 0); g.restore(); }
  else g.fillText(text, x, y);
}
