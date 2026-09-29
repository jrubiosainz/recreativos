// Bodies and Sunday best. Everything is in head units: the head is ~1 wide with its centre at 0,0 and
// the ground G head units below it. In a front row only the chest and hands really show, so that is
// where the care goes: collars, lapels, jumper bands, pearls, hands that fidget while people chat and
// settle when they pose.
import { INK, LW, TAU, clamp, lerp, mix, shade, ell, dot, smooth, limb, clothShade, fabric, motif } from './ink.js';

// half-widths: shoulders, chest, waist, hips, neck; arm thickness; shoulder line; belly
export const BODY = {
  man: { sh: 0.62, ch: 0.6, wa: 0.48, hip: 0.47, neck: 0.14, arm: 0.2, y0: 0.64 },
  woman: { sh: 0.54, ch: 0.52, wa: 0.38, hip: 0.5, neck: 0.12, arm: 0.165, y0: 0.62 },
  elderF: { sh: 0.56, ch: 0.58, wa: 0.5, hip: 0.54, neck: 0.12, arm: 0.17, y0: 0.6 },
  elderM: { sh: 0.58, ch: 0.58, wa: 0.52, hip: 0.5, neck: 0.13, arm: 0.18, y0: 0.62 },
  paco: { sh: 0.66, ch: 0.7, wa: 0.7, hip: 0.6, neck: 0.16, arm: 0.21, y0: 0.6, belly: 0.14 },
  teen: { sh: 0.52, ch: 0.48, wa: 0.4, hip: 0.44, neck: 0.12, arm: 0.16, y0: 0.62 },
  kid: { sh: 0.44, ch: 0.43, wa: 0.4, hip: 0.42, neck: 0.11, arm: 0.14, y0: 0.57 },
  you: { sh: 0.57, ch: 0.55, wa: 0.46, hip: 0.46, neck: 0.13, arm: 0.18, y0: 0.63 },
};
export const bodyOf = (L) => BODY[L.body] || BODY.man;

// heights of the landmarks for a figure whose feet are at G
export function levels(L, G) {
  const B = bodyOf(L), y0 = B.y0, r = Math.max(1.4, G - y0);
  return { B, G, y0, yW: y0 + r * 0.35, yH: y0 + r * 0.45, yC: y0 + r * 0.52, yHem: y0 + r * (L.old ? 0.8 : 0.72) };
}
const fillInk = (g, c, lw = LW) => { g.fillStyle = c; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); };

// the outline of the torso down to yEnd, from the neck round the right shoulder and back up the left
function torsoPts(lv, yEnd, flare = 0) {
  const { B, y0, yW, yH } = lv, b = B.belly || 0;
  const R = [[B.neck + 0.03, y0 - 0.07], [B.sh * 0.74, y0 - 0.03], [B.sh, y0 + 0.1], [B.ch, y0 + 0.44], [B.wa + b, yW - 0.05]];
  if (yEnd > yW + 0.1) R.push([B.hip + b * 0.5 + flare * 0.5, Math.min(yH, yEnd - 0.05)]);
  R.push([Math.max(B.wa, B.hip * 0.98) + flare, yEnd], [B.hip * 0.45, yEnd + 0.012], [0, yEnd + 0.018]);
  const Lf = R.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
  return [...R, ...Lf];
}
export function torsoPath(g, lv, yEnd, flare) {
  const P = torsoPts(lv, yEnd, flare);
  g.beginPath(); g.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length; i++) {
    const [x, y] = P[i], [px, py] = P[i - 1];
    if (i === 1 || i === P.length - 1) g.lineTo(x, y);
    else g.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
  }
  g.lineTo(P[P.length - 1][0], P[P.length - 1][1]); g.closePath();
}
// fill a garment: cloth or pattern, then the afternoon light across it, then ink
function cloth(g, L, c, c2, pat) {
  g.fillStyle = fabric(g, pat, c, c2); g.fill();
  g.fillStyle = clothShade(g); g.fill();
  g.lineWidth = LW; g.strokeStyle = INK; g.stroke();
}
// run f clipped to the torso shape
function inside(g, lv, yEnd, f, flare) { g.save(); torsoPath(g, lv, yEnd, flare); g.clip(); f(); g.restore(); }
function folds(g, c, pts, a = 0.5, w = 0.014) {
  g.globalAlpha = a; g.strokeStyle = shade(c, -0.28); g.lineWidth = w; g.lineCap = 'round'; g.beginPath();
  for (const [x0, y0, cx, cy, x1, y1] of pts) { g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); }
  g.stroke(); g.globalAlpha = 1;
}

export function drawNeck(g, L, lv) {
  const { B, y0 } = lv, n = B.neck;
  g.beginPath(); g.moveTo(-n, 0.3); g.lineTo(-n * 1.05, y0 - 0.02); g.quadraticCurveTo(0, y0 + 0.06, n * 1.05, y0 - 0.02); g.lineTo(n, 0.3); g.closePath();
  g.fillStyle = L.skin; g.fill();
  g.save(); g.clip(); ell(g, 0, 0.36, n * 1.6, 0.1); g.fillStyle = shade(L.skin, -0.22); g.globalAlpha = 0.55; g.fill(); g.restore();
  g.beginPath(); g.moveTo(-n, 0.3); g.lineTo(-n * 1.05, y0 - 0.02); g.moveTo(n, 0.3); g.lineTo(n * 1.05, y0 - 0.02);
  g.lineWidth = LW; g.strokeStyle = INK; g.stroke();
}
// bare skin over the upper chest (under low necklines), shaped like the shoulders
function chest(g, L, lv, yTo) {
  inside(g, lv, lv.yW, () => {
    g.fillStyle = L.skin; g.fillRect(-1.2, lv.y0 - 0.2, 2.4, yTo - lv.y0 + 0.2);
    const gr = g.createLinearGradient(0, lv.y0 - 0.05, 0, lv.y0 + 0.2); gr.addColorStop(0, 'rgba(90,40,20,0.2)'); gr.addColorStop(1, 'rgba(90,40,20,0)');
    g.fillStyle = gr; g.fillRect(-1.2, lv.y0 - 0.2, 2.4, 0.5);
  });
}

// ---- below the waist ----
const DRESSY = { dress: 1, bride: 1, communion: 1 };
function shoe(g, x, y, s, c, heel) {
  ell(g, x, y, 0.15 * s, 0.07 * s); fillInk(g, c, LW * 0.8);
  ell(g, x - 0.04 * s, y - 0.025 * s, 0.06 * s, 0.018 * s); g.fillStyle = 'rgba(255,255,255,0.28)'; g.fill();
  if (heel) { g.beginPath(); g.moveTo(x - Math.sign(x) * 0.02, y + 0.04); g.lineTo(x - Math.sign(x) * 0.04, y + 0.12); g.lineWidth = 0.03; g.strokeStyle = c; g.stroke(); }
}
function bareLegs(g, L, lv, y1, sock) {
  const { G } = lv, tights = L.old || L.sex === 'f' && L.body !== 'kid' && L.body !== 'teen';
  const c = tights ? mix(L.skin, '#a07a66', 0.35) : L.skin;
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(s * 0.06, y1); g.lineTo(s * 0.27, y1); g.quadraticCurveTo(s * 0.26, (y1 + G) / 2, s * 0.2, G - 0.08);
    g.lineTo(s * 0.09, G - 0.08); g.quadraticCurveTo(s * 0.05, (y1 + G) / 2, s * 0.06, y1); g.closePath(); fillInk(g, c, LW * 0.8);
    if (sock) { g.beginPath(); g.rect(s * 0.21 - 0.075, G - 0.24, 0.15, 0.16); fillInk(g, '#f8f6f0', LW * 0.6); }
  }
  const heel = L.sex === 'f' && L.body !== 'kid';
  for (const s of [-1, 1]) shoe(g, s * 0.16, G - 0.05, heel ? 0.85 : 1, heel ? shade(L.top.c, -0.3) : '#3a2a22', heel);
}
function skirt(g, L, lv, c, c2, pat, yHem) {
  const { B, yW, G } = lv, w0 = B.wa + 0.02 + (B.belly || 0), w1 = B.hip + (yHem > G - 0.2 ? 0.34 : 0.14);
  const n = 6;
  g.beginPath(); g.moveTo(-w0, yW - 0.05); g.lineTo(w0, yW - 0.05);
  g.quadraticCurveTo(B.hip + 0.04, (yW + yHem) / 2, w1, yHem);
  for (let i = 1; i <= n; i++) { const x = w1 - (2 * w1 * i) / n, xm = x + w1 / n; g.quadraticCurveTo(xm, yHem + (i % 2 ? 0.035 : -0.01), x, yHem); }
  g.quadraticCurveTo(-B.hip - 0.04, (yW + yHem) / 2, -w0, yW - 0.05); g.closePath();
  cloth(g, L, c, c2, pat);
  folds(g, c, [[-0.1, yW + 0.2, -0.14, (yW + yHem) / 2, -0.22, yHem - 0.02], [0.14, yW + 0.25, 0.2, (yW + yHem) / 2, 0.3, yHem - 0.02], [-w1 * 0.7, yHem - 0.3, -w1 * 0.72, yHem - 0.15, -w1 * 0.8, yHem]], 0.35);
}
function trousers(g, L, lv, c, short) {
  const { B, yW, yH, yC, G } = lv, b = B.belly || 0, ya = short ? yC + 0.32 : G - 0.1, xa = short ? B.hip * 0.9 : B.hip * 0.62;
  g.beginPath(); g.moveTo(-(B.wa + b), yW - 0.06); g.lineTo(B.wa + b, yW - 0.06);
  g.quadraticCurveTo(B.hip + b * 0.5 + 0.02, yH, xa, ya); g.lineTo(short ? 0.1 : 0.08, ya); g.lineTo(0, yC);
  g.lineTo(short ? -0.1 : -0.08, ya); g.lineTo(-xa, ya); g.quadraticCurveTo(-(B.hip + b * 0.5 + 0.02), yH, -(B.wa + b), yW - 0.06); g.closePath();
  cloth(g, L, c);
  if (!short) folds(g, c, [[-B.hip * 0.42, yC + 0.1, -B.hip * 0.42, (yC + G) / 2, -B.hip * 0.38, G - 0.14], [B.hip * 0.42, yC + 0.1, B.hip * 0.42, (yC + G) / 2, B.hip * 0.38, G - 0.14]], 0.4, 0.01);
  if (short) bareLegs(g, L, lv, ya - 0.02, true);
  else for (const s of [-1, 1]) shoe(g, s * B.hip * 0.36, G - 0.05, 1, '#2a2220', false);
}
export function drawLegs(g, L, lv) {
  const T = L.top, k = T.kind;
  if (DRESSY[k]) {
    const long = k !== 'dress', yHem = long ? lv.G - 0.02 : lv.yHem;
    if (!long) bareLegs(g, L, lv, yHem - 0.1, L.body === 'kid');
    else for (const s of [-1, 1]) shoe(g, s * 0.16, lv.G - 0.02, 0.9, k === 'bride' ? '#f2ede4' : '#f6f3ee', false);
    skirt(g, L, lv, T.c, T.c2, T.pat, yHem);
  } else if (L.skirt) {
    bareLegs(g, L, lv, lv.yHem - 0.1, false);
    if (k !== 'blouse') skirt(g, L, lv, L.bot || '#333', null, null, lv.yHem);
  } else trousers(g, L, lv, L.bot || '#3a3632', L.body === 'kid' && L.sex === 'm');
}
// a tucked-in blouse sits under the skirt's waistband, so that skirt goes on after the top
export const skirtOver = (L) => L.skirt && L.top.kind === 'blouse';
export const drawSkirtOver = (g, L, lv) => skirt(g, L, lv, L.bot || '#333', null, null, lv.yHem);

// ---- tops ----
function neckHole(g, L, lv, depth, w, rib) {
  const { y0 } = lv;
  g.beginPath(); g.moveTo(-w, y0 - 0.1); g.lineTo(-w, y0 - 0.07); g.quadraticCurveTo(0, y0 + depth * 2, w, y0 - 0.07); g.lineTo(w, y0 - 0.1); g.closePath();
  g.fillStyle = L.skin; g.fill();
  g.beginPath(); g.moveTo(-w, y0 - 0.07); g.quadraticCurveTo(0, y0 + depth * 2, w, y0 - 0.07);
  if (rib) { g.lineWidth = 0.05; g.strokeStyle = rib; g.stroke(); }
  g.lineWidth = LW; g.strokeStyle = INK; g.stroke();
}
function buttons(g, c, x, ys, r = 0.022) { for (const y of ys) { dot(g, x, y, r); g.fillStyle = c; g.fill(); g.lineWidth = LW * 0.35; g.strokeStyle = INK; g.stroke(); } }
function collar(g, c, lv, spread = 0.16, lw = LW) {
  const { B, y0 } = lv, n = B.neck;
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(s * n * 0.4, y0 - 0.1); g.lineTo(s * (n + 0.06), y0 - 0.1); g.lineTo(s * (n + spread), y0 + 0.08); g.lineTo(s * 0.015, y0 + 0.04); g.closePath();
    g.fillStyle = c; g.fill(); g.fillStyle = clothShade(g); g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke();
  }
}
function tie(g, c, y0, yTo) {
  g.beginPath(); g.moveTo(-0.045, y0 - 0.02); g.lineTo(0.045, y0 - 0.02); g.lineTo(0.035, y0 + 0.07); g.lineTo(-0.035, y0 + 0.07); g.closePath(); fillInk(g, shade(c, -0.08), LW * 0.7);
  g.beginPath(); g.moveTo(-0.035, y0 + 0.07); g.lineTo(0.035, y0 + 0.07); g.lineTo(0.075, yTo); g.lineTo(0, yTo + 0.08); g.lineTo(-0.075, yTo); g.closePath(); fillInk(g, c, LW * 0.7);
  g.beginPath(); g.moveTo(-0.01, y0 + 0.12); g.lineTo(0.03, yTo - 0.05); g.lineWidth = 0.012; g.strokeStyle = shade(c, 0.25); g.stroke();
}
const TOPS = {
  suit(g, L, lv) {
    const { B, y0, yH } = lv, T = L.top, c = T.c, yE = yH + 0.12, fem = L.sex === 'f', open = L.open;
    const vTip = y0 + (fem ? 0.46 : open ? 0.72 : 0.6), n = B.neck * 1.25;
    torsoPath(g, lv, yE); cloth(g, L, c);
    inside(g, lv, yE, () => {
      g.beginPath(); g.moveTo(-n - 0.04, y0 - 0.1); g.lineTo(0, vTip); g.lineTo(n + 0.04, y0 - 0.1); g.closePath(); g.fillStyle = T.c2 || '#f6f2e9'; g.fill();
      if (open) {
        g.beginPath(); g.moveTo(-n + 0.02, y0 - 0.1); g.lineTo(0, y0 + 0.5); g.lineTo(n - 0.02, y0 - 0.1); g.closePath(); g.fillStyle = L.skin; g.fill();
        g.strokeStyle = shade(L.hc || '#2b1d17', 0.1); g.lineWidth = 0.01; g.beginPath();
        for (let i = 0; i < 9; i++) { const x = -0.08 + (i % 3) * 0.08, y = y0 + 0.06 + Math.floor(i / 3) * 0.1; g.moveTo(x, y); g.quadraticCurveTo(x + 0.03, y - 0.03, x + 0.02, y + 0.03); }
        g.stroke();
        g.beginPath(); g.moveTo(-0.13, y0 - 0.02); g.quadraticCurveTo(0, y0 + 0.3, 0.13, y0 - 0.02); g.lineWidth = 0.02; g.strokeStyle = '#d9a93a'; g.stroke();
        dot(g, 0, y0 + 0.15, 0.04); fillInk(g, '#e8bd4a', LW * 0.5);
      }
    });
    if (!fem) open ? collar(g, T.c2 || '#f6f2e9', lv, 0.3) : collar(g, T.c2 || '#f6f2e9', lv, 0.12, LW * 0.8);
    if (L.tie && !open && !fem) tie(g, L.tie, y0, vTip - 0.1);
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * (n + 0.04), y0 - 0.1); g.lineTo(s * (n + 0.15), y0 - 0.03); g.lineTo(s * (n + 0.12), y0 + 0.14);
      g.lineTo(s * (n + 0.2), y0 + 0.2); g.quadraticCurveTo(s * 0.18, vTip - 0.1, 0, vTip); g.lineTo(s * (n + 0.04) * 0.2, lerp(y0 - 0.1, vTip, 0.8)); g.closePath();
      g.fillStyle = shade(c, 0.07); g.fill(); g.fillStyle = clothShade(g); g.fill(); g.lineWidth = LW * 0.85; g.strokeStyle = INK; g.stroke();
    }
    g.beginPath(); g.moveTo(0, vTip); g.quadraticCurveTo(0.01, vTip + 0.3, 0.02, vTip + 0.36);
    for (const s of [-1, 1]) { g.moveTo(0.02, vTip + 0.36); g.quadraticCurveTo(s * 0.05 + 0.02, yE - 0.1, s * 0.16, yE + 0.012); }
    for (const s of [-1, 1]) { g.moveTo(s * (B.hip * 0.35), yH - 0.02); g.lineTo(s * (B.hip * 0.35 + 0.18), yH - 0.04); }
    g.moveTo(-0.34, y0 + 0.36); g.lineTo(-0.2, y0 + 0.35);
    g.lineWidth = LW * 0.7; g.strokeStyle = INK; g.stroke();
    buttons(g, shade(c, -0.4), 0.03, fem ? [vTip + 0.06, vTip + 0.26] : [vTip + 0.1, vTip + 0.32]);
    folds(g, c, [[-B.ch * 0.8, y0 + 0.5, -B.ch * 0.6, y0 + 0.62, -B.ch * 0.66, y0 + 0.8], [B.ch * 0.8, y0 + 0.5, B.ch * 0.6, y0 + 0.62, B.ch * 0.66, y0 + 0.8]]);
  },
  shirt(g, L, lv) {
    const { B, y0, yH } = lv, T = L.top, c = T.c, yE = yH + 0.02, casual = T.sleeve === 'short';
    torsoPath(g, lv, yE); cloth(g, L, c, T.c2, T.pat);
    if (casual) { g.beginPath(); g.moveTo(-0.09, y0 - 0.08); g.lineTo(0, y0 + 0.18); g.lineTo(0.09, y0 - 0.08); g.closePath(); g.fillStyle = L.skin; g.fill(); }
    g.beginPath(); g.moveTo(0, y0 + (casual ? 0.18 : 0.04)); g.lineTo(0, yE); g.lineWidth = LW * 0.6; g.strokeStyle = INK; g.stroke();
    buttons(g, '#f4efe4', 0.025, [0.3, 0.52, 0.74, 0.96].map((k) => y0 + k).filter((y) => y < yE - 0.05 && (!casual || y > y0 + 0.25)), 0.018);
    g.beginPath(); g.rect(0.16, y0 + 0.28, 0.2, 0.2); g.moveTo(0.16, y0 + 0.33); g.lineTo(0.36, y0 + 0.33); g.lineWidth = LW * 0.55; g.strokeStyle = INK; g.stroke();
    collar(g, fabric(g, T.pat, c, T.c2), lv, casual ? 0.22 : 0.15);
    if (B.belly) { ell(g, 0.1, lv.yW - 0.1, 0.3, 0.2); g.fillStyle = 'rgba(255,248,230,0.1)'; g.fill(); }
    folds(g, c, [[-B.ch * 0.85, y0 + 0.48, -B.ch * 0.6, y0 + 0.58, -B.ch * 0.7, y0 + 0.78], [B.ch * 0.85, y0 + 0.48, B.ch * 0.6, y0 + 0.58, B.ch * 0.7, y0 + 0.78]]);
  },
  polo(g, L, lv) {
    const { B, y0, yH } = lv, T = L.top, c = T.c, yE = yH - 0.02;
    torsoPath(g, lv, yE); cloth(g, L, c);
    g.beginPath(); g.rect(-0.05, y0 - 0.02, 0.1, 0.28); g.fillStyle = shade(c, -0.06); g.fill(); g.lineWidth = LW * 0.6; g.strokeStyle = INK; g.stroke();
    buttons(g, '#e8e2d6', 0, [y0 + 0.08, y0 + 0.19], 0.018);
    collar(g, shade(c, 0.05), lv, 0.14, LW * 0.8);
    g.beginPath(); g.moveTo(0.2, y0 + 0.28); g.lineTo(0.3, y0 + 0.28); g.lineWidth = 0.02; g.strokeStyle = '#d8c070'; g.stroke();
    folds(g, c, [[-B.ch * 0.8, y0 + 0.5, -B.ch * 0.6, y0 + 0.6, -B.ch * 0.68, y0 + 0.8], [B.ch * 0.8, y0 + 0.5, B.ch * 0.6, y0 + 0.6, B.ch * 0.68, y0 + 0.8]]);
  },
  tee(g, L, lv) {
    const { B, y0, yH } = lv, T = L.top, c = T.c, yE = yH - 0.04;
    torsoPath(g, lv, yE); cloth(g, L, c, T.c2, T.pat);
    neckHole(g, L, lv, 0.05, B.neck * 1.35, shade(c, -0.1));
    if (L.id === 'lucia') {
      g.beginPath(); const x = 0.02, y = y0 + 0.36;
      g.moveTo(x, y + 0.1); g.bezierCurveTo(x - 0.16, y - 0.02, x - 0.06, y - 0.12, x, y - 0.03); g.bezierCurveTo(x + 0.06, y - 0.12, x + 0.16, y - 0.02, x, y + 0.1);
      fillInk(g, '#fff6fa', LW * 0.6);
    }
    folds(g, c, [[-B.ch * 0.8, y0 + 0.5, -B.ch * 0.6, y0 + 0.6, -B.ch * 0.66, y0 + 0.8], [B.ch * 0.8, y0 + 0.5, B.ch * 0.6, y0 + 0.6, B.ch * 0.66, y0 + 0.8]]);
  },
};
function ribBand(g, lv, yE, y1, c) {
  inside(g, lv, yE, () => {
    g.fillStyle = shade(c, -0.1); g.fillRect(-1.2, y1, 2.4, yE - y1 + 0.1);
    g.strokeStyle = shade(c, -0.24); g.lineWidth = 0.008; g.beginPath();
    for (let x = -1.1; x < 1.1; x += 0.045) { g.moveTo(x, y1 + 0.01); g.lineTo(x, yE + 0.05); }
    g.stroke(); g.beginPath(); g.moveTo(-1.2, y1); g.lineTo(1.2, y1); g.lineWidth = LW * 0.6; g.strokeStyle = INK; g.stroke();
  });
}
function twinkle(g, lv, yE, t, n = 10) {
  for (let i = 0; i < n; i++) {
    const h = Math.sin(i * 91.7) * 0.5 + 0.5, x = (h - 0.5) * 0.9, y = lv.y0 + 0.15 + ((i * 0.37) % 1) * (yE - lv.y0 - 0.2);
    const a = Math.pow(Math.max(0, Math.sin(t * 2.6 + i * 1.9)), 10), r = 0.05 * a;
    if (r < 0.004) continue;
    g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r);
    g.lineWidth = 0.012; g.strokeStyle = 'rgba(255,248,220,0.95)'; g.lineCap = 'round'; g.stroke();
  }
}
function sleeveless(g, L, lv, yE) {
  const { B, y0 } = lv, n = B.neck + 0.17;
  inside(g, lv, yE, () => {
    g.fillStyle = L.skin;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * n, y0 - 0.2); g.lineTo(s * 1.2, y0 - 0.2); g.lineTo(s * 1.2, y0 + 0.5); g.lineTo(s * B.ch * 0.94, y0 + 0.44); g.quadraticCurveTo(s * n, y0 + 0.36, s * n, y0 - 0.2); g.fill(); }
  });
  g.beginPath(); for (const s of [-1, 1]) { g.moveTo(s * n, y0 - 0.07); g.quadraticCurveTo(s * n, y0 + 0.36, s * B.ch * 0.94, y0 + 0.44); }
  g.lineWidth = LW * 0.8; g.strokeStyle = INK; g.stroke();
}
function vNeck(g, L, lv, depth, w) {
  const { y0 } = lv;
  g.beginPath(); g.moveTo(-w, y0 - 0.1); g.lineTo(-w, y0 - 0.07); g.quadraticCurveTo(-w * 0.3, y0 + depth * 0.5, 0, y0 + depth); g.quadraticCurveTo(w * 0.3, y0 + depth * 0.5, w, y0 - 0.07); g.lineTo(w, y0 - 0.1); g.closePath();
  g.fillStyle = L.skin; g.fill();
  g.beginPath(); g.moveTo(-w, y0 - 0.07); g.quadraticCurveTo(-w * 0.3, y0 + depth * 0.5, 0, y0 + depth); g.quadraticCurveTo(w * 0.3, y0 + depth * 0.5, w, y0 - 0.07);
  g.lineWidth = LW * 0.9; g.strokeStyle = INK; g.stroke();
}
Object.assign(TOPS, {
  jumper(g, L, lv) {
    const { B, y0, yH } = lv, T = L.top, c = T.c, yE = yH, argyle = T.pat === 'argyle';
    torsoPath(g, lv, yE); cloth(g, L, c, T.c2, argyle ? 'argyle' : null);
    if (!argyle && T.pat) {
      inside(g, lv, yE, () => {
        const y1 = y0 + 0.32, y2 = y0 + 0.66;
        g.fillStyle = T.c2; g.fillRect(-1.2, y1, 2.4, y2 - y1);
        g.fillStyle = c;
        for (const [yy, dir] of [[y1 + 0.005, 1], [y2 - 0.005, -1]]) { g.beginPath(); for (let x = -1.2; x < 1.2; x += 0.09) { g.moveTo(x, yy); g.lineTo(x + 0.045, yy + dir * 0.05); g.lineTo(x + 0.09, yy); } g.fill(); }
        for (let i = -3; i <= 3; i++) motif(g, T.pat, i * 0.27 + (T.pat === 'deer' ? -0.03 : 0), (y1 + y2) / 2 + 0.005, T.pat === 'snow' ? 0.19 : 0.21, c);
        if (T.pat === 'snow') { g.fillStyle = T.c2; for (let i = 0; i < 14; i++) { dot(g, -0.6 + ((i * 0.43) % 1.2), y2 + 0.12 + ((i * 0.29) % 0.5), 0.02); g.fill(); } }
        g.fillStyle = clothShade(g); g.fillRect(-1.2, y1, 2.4, y2 - y1);
      });
    }
    ribBand(g, lv, yE + 0.02, yE - 0.1, c);
    neckHole(g, L, lv, 0.04, B.neck * 1.32, shade(c, -0.12));
    if (L.collar) collar(g, L.collar, lv, 0.15, LW * 0.8);
    folds(g, c, [[-B.ch * 0.82, y0 + 0.5, -B.ch * 0.6, y0 + 0.62, -B.ch * 0.66, y0 + 0.82], [B.ch * 0.82, y0 + 0.5, B.ch * 0.6, y0 + 0.62, B.ch * 0.66, y0 + 0.82]], 0.35);
  },
  cardigan(g, L, lv) {
    const { B, y0, yH } = lv, T = L.top, c = T.c, yE = yH + 0.06, n = B.neck * 1.3;
    torsoPath(g, lv, yE); cloth(g, L, c);
    const open = [[-n, y0 - 0.1], [-0.07, y0 + 0.5], [-0.07, yE + 0.1], [0.07, yE + 0.1], [0.07, y0 + 0.5], [n, y0 - 0.1]];
    inside(g, lv, yE, () => {
      g.beginPath(); open.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = T.c2 || '#f0ece2'; g.fill();
      g.fillStyle = 'rgba(52,22,10,0.1)'; g.fill();
    });
    neckHole(g, L, lv, 0.03, B.neck * 1.05);
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * n, y0 - 0.1); g.lineTo(s * 0.07, y0 + 0.5); g.lineTo(s * 0.07, yE + 0.01);
      g.lineWidth = 0.05; g.strokeStyle = shade(c, -0.08); g.stroke(); g.lineWidth = LW * 0.7; g.strokeStyle = INK; g.stroke();
    }
    buttons(g, shade(c, 0.35), -0.1, [y0 + 0.58, y0 + 0.8, y0 + 1.02].filter((y) => y < yE - 0.05));
    for (const s of [-1, 1]) { g.beginPath(); g.rect(s * 0.34 - 0.1, yH - 0.2, 0.2, 0.16); g.lineWidth = LW * 0.5; g.strokeStyle = INK; g.stroke(); }
    ribBand(g, lv, yE + 0.02, yE - 0.08, c);
  },
  blouse(g, L, lv, t) {
    const { B, y0, yW, yH } = lv, T = L.top, c = T.c, yE = L.skirt ? yW + 0.08 : yH - 0.04;
    torsoPath(g, lv, yE); cloth(g, L, c, T.c2, T.pat === 'sequin' ? 'sequin' : T.pat);
    if (!T.pat) { ell(g, -0.22, y0 + 0.4, 0.08, 0.28, 0.1); g.fillStyle = 'rgba(255,240,235,0.16)'; g.fill(); }
    vNeck(g, L, lv, 0.26, B.neck * 1.5);
    if (T.pat === 'sequin') twinkle(g, lv, yE, t);
    folds(g, c, [[-B.ch * 0.8, y0 + 0.46, -B.ch * 0.5, y0 + 0.6, -B.wa * 0.7, yW], [B.ch * 0.8, y0 + 0.46, B.ch * 0.5, y0 + 0.6, B.wa * 0.7, yW]], 0.4);
  },
  dress(g, L, lv) {
    const { B, y0, yW } = lv, T = L.top, c = T.c, yE = yW + 0.04;
    torsoPath(g, lv, yE); cloth(g, L, c, T.c2, T.pat);
    if (T.sleeve === 'none') sleeveless(g, L, lv, yE);
    if (T.neck === 'v') vNeck(g, L, lv, 0.34, B.neck * 1.45); else neckHole(g, L, lv, 0.05, B.neck * 1.5);
    g.beginPath(); g.moveTo(-B.wa - 0.02, yW - 0.03); g.quadraticCurveTo(0, yW + 0.01, B.wa + 0.02, yW - 0.03);
    if (L.body === 'kid') { g.lineWidth = 0.07; g.strokeStyle = shade(c, -0.14); g.stroke(); }
    g.lineWidth = LW * 0.6; g.strokeStyle = INK; g.stroke();
    folds(g, c, [[-B.ch * 0.7, y0 + 0.44, -B.ch * 0.4, y0 + 0.56, -B.wa * 0.6, yW - 0.04], [B.ch * 0.7, y0 + 0.44, B.ch * 0.4, y0 + 0.56, B.wa * 0.6, yW - 0.04]], 0.35);
  },
  sailor(g, L, lv) {
    const { B, y0, yW } = lv, T = L.top, c = T.c, nv = T.c2 || '#23305a', yE = yW + 0.22, n = B.neck * 1.2;
    torsoPath(g, lv, yE); cloth(g, L, c);
    const out = [[-n, y0 - 0.1], [-B.sh * 0.92, y0 + 0.02], [-B.sh * 0.76, y0 + 0.24], [-0.1, y0 + 0.52], [0, y0 + 0.58], [0.1, y0 + 0.52], [B.sh * 0.76, y0 + 0.24], [B.sh * 0.92, y0 + 0.02], [n, y0 - 0.1]];
    g.beginPath(); out.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.lineTo(0, y0 + 0.4); g.closePath(); fillInk(g, nv, LW * 0.8);
    g.beginPath(); for (const s of [-1, 1]) { g.moveTo(s * (B.sh * 0.84), y0 + 0.04); g.lineTo(s * (B.sh * 0.7), y0 + 0.2); g.lineTo(s * 0.06, y0 + 0.47); }
    g.lineWidth = 0.018; g.strokeStyle = '#f6f2e9'; g.stroke();
    g.beginPath(); g.moveTo(-n, y0 - 0.1); g.lineTo(0, y0 + 0.4); g.lineTo(n, y0 - 0.1); g.closePath(); fillInk(g, '#f6f2e9', LW * 0.6);
    g.beginPath(); g.moveTo(-0.07, y0 + 0.2); g.lineTo(0.07, y0 + 0.2); g.lineWidth = 0.03; g.strokeStyle = nv; g.stroke();
    ell(g, 0, y0 + 0.48, 0.06, 0.045); fillInk(g, '#c8302c', LW * 0.6);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.02, y0 + 0.5); g.lineTo(s * 0.08, y0 + 0.66); g.lineTo(s * 0.03, y0 + 0.64); g.closePath(); fillInk(g, '#c8302c', LW * 0.5); }
  },
  bride(g, L, lv, t) {
    const { B, y0, yW } = lv, yE = yW + 0.04, W = '#fbf8f2';
    torsoPath(g, lv, yE); g.fillStyle = L.skin; g.fill(); g.lineWidth = LW; g.strokeStyle = INK; g.stroke();
    chest(g, L, lv, y0 + 0.2);
    const top = (s) => [[-B.ch * 1.1, y0 + 0.34], [-B.ch * 0.95, y0 + 0.3], [-0.2, y0 + 0.24], [0, y0 + 0.36], [0.2, y0 + 0.24], [B.ch * 0.95, y0 + 0.3], [B.ch * 1.1, y0 + 0.34]];
    inside(g, lv, yE, () => {
      g.beginPath(); const P = top(); g.moveTo(P[0][0], P[0][1]);
      g.quadraticCurveTo(-B.ch * 0.6, y0 + 0.2, -0.2, y0 + 0.24); g.quadraticCurveTo(-0.06, y0 + 0.26, 0, y0 + 0.36);
      g.quadraticCurveTo(0.06, y0 + 0.26, 0.2, y0 + 0.24); g.quadraticCurveTo(B.ch * 0.6, y0 + 0.2, B.ch * 1.1, y0 + 0.34);
      g.lineTo(1.2, yE + 0.2); g.lineTo(-1.2, yE + 0.2); g.closePath();
      g.fillStyle = W; g.fill(); g.fillStyle = clothShade(g); g.fill(); g.lineWidth = LW * 0.9; g.strokeStyle = INK; g.stroke();
      g.fillStyle = 'rgba(200,185,165,0.45)';
      for (let i = 0; i < 26; i++) { dot(g, -0.5 + ((i * 0.37) % 1), y0 + 0.42 + ((i * 0.23) % 1) * (yW - y0 - 0.4), 0.014); g.fill(); }
    });
    twinkle(g, lv, yE, t, 5);
  },
  communion(g, L, lv) {
    const { B, y0, yW } = lv, W = '#fbf8f2', yE = yW + 0.04;
    torsoPath(g, lv, yE); cloth(g, L, W);
    g.beginPath(); g.moveTo(-0.26, y0 + 0.5); g.lineTo(0, y0 + 0.62); g.lineTo(0.26, y0 + 0.5); g.lineWidth = 0.012; g.strokeStyle = 'rgba(160,140,120,0.5)'; g.stroke();
    neckHole(g, L, lv, 0.03, B.neck * 1.2);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.01, y0 - 0.05); g.bezierCurveTo(s * 0.02, y0 + 0.14, s * 0.28, y0 + 0.14, s * 0.26, y0 - 0.06); g.closePath(); fillInk(g, W, LW * 0.8); }
    g.beginPath(); g.moveTo(-0.1, y0 - 0.02); g.quadraticCurveTo(0, y0 + 0.2, 0.1, y0 - 0.02); g.lineWidth = 0.008; g.strokeStyle = '#c9a23a'; g.stroke();
    g.fillStyle = '#e0b84a'; g.fillRect(-0.012, y0 + 0.12, 0.024, 0.1); g.fillRect(-0.038, y0 + 0.145, 0.076, 0.022);
  },
});

// ---- things worn and carried ----
const ACC = {
  pearls(g, L, lv) {
    const { B, y0 } = lv, w = B.neck * 1.35, dy = L.top.kind === 'suit' ? 0.2 : 0.13;
    for (let i = 0; i <= 12; i++) {
      const k = i / 12, x = (k * 2 - 1) * w, y = y0 - 0.05 + (1 - Math.pow(k * 2 - 1, 2)) * dy;
      dot(g, x, y, 0.024); g.fillStyle = '#f8f3ea'; g.fill(); g.lineWidth = LW * 0.3; g.strokeStyle = '#8a7a6a'; g.stroke();
      dot(g, x - 0.007, y - 0.008, 0.007); g.fillStyle = '#ffffff'; g.fill();
    }
  },
  brooch(g, L, lv) {
    const x = 0.27, y = lv.y0 + 0.3;
    ell(g, x, y, 0.055, 0.045, 0.3); fillInk(g, '#d9ad45', LW * 0.5);
    ell(g, x, y, 0.028, 0.022, 0.3); g.fillStyle = '#2f7a5a'; g.fill(); dot(g, x - 0.008, y - 0.008, 0.007); g.fillStyle = '#fff'; g.fill();
  },
  kerchief(g, L, lv) {
    const { B, y0 } = lv, n = B.neck * 1.25, R = '#d21f2a';
    g.beginPath(); g.moveTo(-n - 0.05, y0 - 0.09); g.quadraticCurveTo(0, y0 + 0.05, n + 0.05, y0 - 0.09); g.lineTo(n, y0 - 0.02); g.lineTo(0.02, y0 + 0.4); g.lineTo(-n, y0 - 0.02); g.closePath(); fillInk(g, R, LW * 0.8);
    g.beginPath(); g.moveTo(-0.06, y0 + 0.12); g.lineTo(0.01, y0 + 0.36); g.lineWidth = 0.012; g.strokeStyle = shade(R, -0.3); g.stroke();
    ell(g, 0, y0 + 0.04, 0.06, 0.045); fillInk(g, shade(R, -0.08), LW * 0.6);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.03, y0 + 0.07); g.quadraticCurveTo(s * 0.1, y0 + 0.16, s * 0.07, y0 + 0.25); g.lineTo(s * 0.02, y0 + 0.18); g.closePath(); fillInk(g, R, LW * 0.5); }
  },
  suspenders(g, L, lv) {
    const { y0, yW } = lv, c = '#8a2a2e';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 0.3, y0 - 0.04); g.quadraticCurveTo(s * 0.3, (y0 + yW) / 2, s * 0.24, yW + 0.02);
      g.lineWidth = 0.075; g.strokeStyle = INK; g.stroke(); g.lineWidth = 0.05; g.strokeStyle = c; g.stroke();
      g.beginPath(); g.rect(s * 0.24 - 0.035, yW - 0.03, 0.07, 0.05); fillInk(g, '#c8c2b4', LW * 0.4);
    }
  },
  flower(g, L, lv) {
    const x = 0.3, y = lv.y0 + 0.22;
    ell(g, x + 0.04, y + 0.06, 0.05, 0.02, 0.9); fillInk(g, '#5e8a3a', LW * 0.4);
    for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; dot(g, x + Math.cos(a) * 0.028, y + Math.sin(a) * 0.028, 0.03); fillInk(g, '#fbf8f0', LW * 0.3); }
    dot(g, x, y, 0.015); g.fillStyle = '#f2d36a'; g.fill();
  },
};
function bouquet(g, x, y, t) {
  g.lineCap = 'round';
  for (const [dx, a] of [[-0.05, 0.3], [0.05, -0.2], [0, 0.05]]) {
    g.beginPath(); g.moveTo(x + dx, y + 0.1); g.bezierCurveTo(x + dx + 0.06 * Math.sin(t * 1.4 + a * 9), y + 0.35, x + dx - 0.05, y + 0.45, x + dx + 0.03 * Math.sin(t + a), y + 0.62);
    g.lineWidth = 0.03; g.strokeStyle = '#f4efe6'; g.stroke();
  }
  for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.95 + i * 0.32; ell(g, x + Math.cos(a) * 0.25, y + Math.sin(a) * 0.16 + 0.04, 0.09, 0.04, a); fillInk(g, '#5c8a44', LW * 0.4); }
  const R = [[0, -0.06, '#fbf6ee'], [-0.13, -0.02, '#f4c9cf'], [0.13, -0.02, '#f4c9cf'], [-0.07, 0.07, '#fbf6ee'], [0.07, 0.07, '#fdf2e6'], [-0.19, 0.07, '#fbf6ee'], [0.19, 0.07, '#fbf6ee'], [0, 0.1, '#f4c9cf']];
  for (const [dx, dy, c] of R) {
    dot(g, x + dx, y + dy, 0.075); fillInk(g, c, LW * 0.5);
    g.beginPath(); g.arc(x + dx, y + dy, 0.04, 0.5, 4.6); g.lineWidth = 0.01; g.strokeStyle = shade(c, -0.25); g.stroke();
  }
}
function missal(g, x, y) {
  g.save(); g.translate(x, y); g.rotate(-0.06);
  g.beginPath(); g.rect(-0.1, -0.13, 0.2, 0.26); fillInk(g, '#fbf7ee', LW * 0.7);
  g.fillStyle = '#e8e0cc'; g.fillRect(0.08, -0.12, 0.018, 0.24);
  g.fillStyle = '#d9ad45'; g.fillRect(-0.012, -0.07, 0.024, 0.12); g.fillRect(-0.04, -0.04, 0.08, 0.022);
  g.restore();
}
function fan(g, x, y, ang, c, open = 1) {
  const r = 0.36, span = 1.9 * open;
  g.save(); g.translate(x, y); g.rotate(ang);
  g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, -Math.PI / 2 - span / 2, -Math.PI / 2 + span / 2); g.closePath();
  g.fillStyle = c; g.fill();
  g.save(); g.clip(); g.fillStyle = mix(c, '#ffffff', 0.7);
  for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 - span / 2 + (i + 0.5) * (span / 9); dot(g, Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, 0.022); g.fill(); }
  g.restore();
  g.lineWidth = LW * 0.8; g.strokeStyle = INK; g.stroke();
  g.beginPath(); for (let i = 1; i < 9; i++) { const a = -Math.PI / 2 - span / 2 + (i * span) / 9; g.moveTo(0, 0); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.lineWidth = 0.008; g.strokeStyle = shade(c, -0.35); g.stroke();
  g.restore();
}
function nokia(g, x, y, t) {
  const gl = g.createRadialGradient(x, y - 0.3, 0.02, x, y - 0.3, 0.4); gl.addColorStop(0, 'rgba(150,230,140,0.22)'); gl.addColorStop(1, 'rgba(150,230,140,0)');
  g.fillStyle = gl; g.fillRect(x - 0.45, y - 0.7, 0.9, 0.8);
  g.save(); g.translate(x, y); g.rotate(-0.15);
  g.beginPath(); g.roundRect(-0.07, -0.15, 0.14, 0.3, 0.05); fillInk(g, '#243a6a', LW * 0.7);
  g.beginPath(); g.roundRect(-0.045, -0.12, 0.09, 0.06, 0.012); g.fillStyle = '#7fa6d8'; g.fill();
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(-0.05, 0.02, 0.1, 0.012);
  g.restore();
}

// ---- arms and hands ----
const SLEEVE = { long: 1, short: 0.42, none: 0, puff: 0 };
const lp = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
function hand(g, L, x, y, s, r, glove) {
  dot(g, x, y, r); fillInk(g, glove || L.skin, LW * 0.8);
  ell(g, x - s * r * 0.75, y - r * 0.35, r * 0.42, r * 0.3, s * 0.6); fillInk(g, glove || L.skin, LW * 0.6);
}
// carrying: elbow e and wrist w per arm, relative to the shoulder line y0; k is the side the held one's
// head is on. f and h say whether the forearm and the hand go behind what is carried or over it
const HOLD = {
  baby: (k, y0) => ({ [k]: { e: [k * 0.6, y0 + 0.65], w: [k * 0.12, y0 + 1.1], f: 0, h: 0 }, [-k]: { e: [-k * 0.55, y0 + 0.7], w: [-k * 0.1, y0 + 1.12], f: 1, h: 1 } }),
  toddler: (k, y0) => ({ [k]: { e: [k * 0.62, y0 + 0.65], w: [k * 0.9, y0 + 1.18], f: 0, h: 1 }, [-k]: { e: [-k * 0.2, y0 + 0.78], w: [k * 0.34, y0 + 1.12], f: 1, h: 1 } }),
  dog: (k, y0) => ({ [k]: { e: [k * 0.62, y0 + 0.65], w: [k * 0.2, y0 + 1.12], f: 0, h: 0 }, [-k]: { e: [-k * 0.25, y0 + 0.75], w: [k * 0.3, y0 + 1.0], f: 1, h: 1 } }),
};
export const holdRig = (o, y0) => { const H = o.hold || {}; return (HOLD[H.kind] || HOLD.baby)(H.side || 1, y0); };
// where each arm goes: shoulder a, bend c, wrist b, per side s (-1 screen left, 1 screen right)
export function armPose(L, v, o, lv) {
  const { B, y0 } = lv, sh = B.sh, t = o.t, st = o.st || {}, ph = o.ph || 0, posing = v.att === 'pose';
  const out = {}, rig = L.arms === 'hold' ? holdRig(o, y0) : null;
  for (const s of [-1, 1]) {
    const a = [s * (sh - B.arm * 0.5), y0 + 0.13];
    let c = [s * (sh + 0.05), y0 + 0.66], b = [s * (sh - 0.01), y0 + 1.16];
    const pose = L.arms;
    if (pose === 'front') { c = [s * (sh + 0.1), y0 + 0.92]; b = [s * 0.07, y0 + (posing ? 1.0 : 1.05)]; }
    else if (pose === 'bouquet') { c = [s * (sh + 0.08), y0 + 0.76]; b = [s * 0.06, y0 + 0.86]; }
    else if (rig) { c = [...rig[s].e]; b = [...rig[s].w]; c[1] += Math.sin(t * 1.3 + ph) * 0.01; b[1] += Math.sin(t * 1.3 + ph + 0.5) * 0.012; }
    if (L.top.kind === 'communion') { c = [s * (sh + 0.08), y0 + 0.86]; b = [s * 0.1, y0 + 0.95]; }
    if (pose === 'phone' && st.phone > 0) {
      const pc = s > 0 ? [sh + 0.03, y0 + 0.8] : [-(sh + 0.03), y0 + 0.82], pb = s > 0 ? [0.12, y0 + 0.5] : [-0.02, y0 + 0.56];
      c = lp(c, pc, st.phone); b = lp(b, pb, st.phone);
    }
    if (!posing && pose === 'side') { const w = Math.sin(t * 1.1 + ph + s); c[0] += w * 0.02; b[0] += w * 0.035; b[1] -= Math.abs(w) * 0.02; }
    if (!posing && pose === 'front') b[0] += Math.sin(t * 1.7 + ph) * 0.012;
    if (L.acc.includes('fan') && s > 0 && st.fan > 0) { c = lp(c, [sh + 0.12, y0 + 0.78], st.fan); b = lp(b, [sh * 0.62, y0 + 0.5], st.fan); }
    if (st.gest > 0 && s === (o.gs || 1) && pose !== 'hold' && pose !== 'bouquet') {
      c = lp(c, [s * (sh + 0.12), y0 + 0.8], st.gest);
      b = lp(b, [s * sh * 0.55, y0 + 0.62 - 0.07 * Math.sin(t * 6.3 + ph)], st.gest);
    }
    if (st.run > 0) {
      const q = Math.sin((o.rph || 0) + (s > 0 ? Math.PI : 0));
      c = lp(c, [s * (sh + 0.08), y0 + 0.5 - q * 0.12], st.run); b = lp(b, [s * sh * 0.45, y0 + 0.66 - q * 0.26], st.run);
    }
    if (v.quiver > 0) { b[0] += Math.sin(t * 37 + s * 3) * 0.006 * v.quiver; b[1] += Math.sin(t * 41 + s) * 0.005 * v.quiver; }
    out[s] = { s, a, c, b };
  }
  return out;
}
function sleeveOf(g, L) {
  const T = L.top, k = T.kind;
  if (k === 'bride') return { f: 0 };
  if (k === 'communion') return { f: 1, col: '#fbf8f2', puff: '#fbf8f2', glove: '#fbf8f2' };
  const col = fabric(g, T.pat === 'argyle' ? 'argyle' : k === 'jumper' ? null : T.pat, T.c, T.c2);
  return { f: SLEEVE[T.sleeve] ?? 1, col, puff: T.sleeve === 'puff' ? T.c : null, cuff: k === 'suit' ? T.c2 || '#f6f2e9' : k === 'jumper' || k === 'cardigan' ? shade(T.c, -0.1) : null };
}
function arm(g, L, lv, A, S, upperOnly) {
  const { B } = lv, w = B.arm;
  if (upperOnly) { limb(g, A.a, lp(A.a, A.c, 0.5), A.c, w, S.f > 0.3 ? S.col : L.skin, L.skin, S.f > 0.3 ? 1 : S.f * 2.2); return; }
  limb(g, A.a, A.c, A.b, w, S.col || L.skin, L.skin, S.f);
  if (S.cuff && S.f >= 1) {
    const q = lp(lp(A.a, A.c, 0.93), lp(A.c, A.b, 0.93), 0.93);
    dot(g, q[0], q[1], w * 0.5); fillInk(g, S.cuff, LW * 0.6);
  }
  if (S.puff) { ell(g, A.a[0] + A.s * 0.015, A.a[1] + 0.03, w * 0.78, w * 0.64, A.s * 0.4); fillInk(g, S.puff); g.fillStyle = clothShade(g); g.fill(); }
}
export function drawArms(g, L, v, o, lv) {
  const P = armPose(L, v, o, lv), S = sleeveOf(g, L), r = L.body === 'kid' ? 0.06 : 0.07, st = o.st || {}, t = o.t;
  const hold = L.arms === 'hold';
  for (const s of [-1, 1]) arm(g, L, lv, P[s], S, hold);
  if (hold) { forearms(g, L, v, o, lv, P, S, 0); return; }
  if (L.top.kind === 'communion') missal(g, 0, lv.y0 + 0.9);
  if (L.arms === 'phone' && st.phone > 0.4) nokia(g, 0.05, lv.y0 + 0.5, t);
  const fanC = L.id === 'abuela' ? '#1f1c24' : '#c8202a';
  if (L.acc.includes('fan') && st.fan <= 0.5) fan(g, P[1].b[0] - 0.02, P[1].b[1] + 0.02, -0.5, fanC, 0.18);
  for (const s of [-1, 1]) hand(g, L, P[s].b[0], P[s].b[1], s, r, S.glove);
  if (L.acc.includes('fan') && st.fan > 0.5) fan(g, P[1].b[0], P[1].b[1], -0.35 + Math.sin(t * 8.5) * 0.32, fanC, 1);
  if (L.arms === 'bouquet') bouquet(g, 0, lv.y0 + 0.72, t);
}
// the forearms of someone carrying a baby, a toddler or a dog: layer 0 goes behind what they carry
function forearms(g, L, v, o, lv, P, S, layer) {
  const rig = holdRig(o, lv.y0), r = 0.07, w = lv.B.arm * 0.92, S2 = S || sleeveOf(g, L), long = S2.f >= 1;
  for (const s of [-1, 1]) {
    const R = rig[s], A = P[s], e = A.c, b = A.b, dir = Math.sign(b[0] - e[0]) || -s;
    if (R.f === layer) {
      const m = lp(e, b, 0.5); m[1] += 0.03;
      limb(g, e, m, b, w, long ? S2.col : L.skin, L.skin, long ? 0.88 : 0);
      if (long && S2.cuff) { const q = lp(e, b, 0.86); dot(g, q[0], q[1], w * 0.5); fillInk(g, S2.cuff, LW * 0.6); }
    }
    if (R.h === layer) hand(g, L, b[0], b[1], -dir, r, S2.glove);
  }
}
export function drawArmsFront(g, L, v, o, lv) {
  forearms(g, L, v, o, lv, armPose(L, v, o, lv), null, 1);
}

export function drawBody(g, L, v, o, lv) {
  drawLegs(g, L, lv);
  drawNeck(g, L, lv);
  (TOPS[L.top.kind] || TOPS.tee)(g, L, lv, o.t);
  if (skirtOver(L)) drawSkirtOver(g, L, lv);
  for (const a of L.acc) if (ACC[a]) ACC[a](g, L, lv, o.t);
  drawArms(g, L, v, o, lv);
}
