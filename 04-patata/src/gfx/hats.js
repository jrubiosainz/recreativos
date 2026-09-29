// Hats and things worn on the head: a paper cone at a birthday, a boater at a wedding, a boina in the
// village square, a Santa hat at Christmas, a communion wreath, a christening bonnet, a bridal veil.
// Coordinates are head units (the head is ~1 wide, its centre at 0,0); the whole head group is already
// tilted, so a hat only needs to follow the turn of the face.
import { INK, LW, TAU, shade, mix, ell, dot, smooth } from './ink.js';
import { ageOf } from './face.js';

const LIFT = { curly: 0.07, perm: 0.09, bigperm: 0.17, kidlong: 0.03, long: 0.03, pony: 0.02, waves: 0.05, gel: 0.02, dad: 0.03, quiff: 0.1, curtains: 0.03, bowl: 0.05 };
const topOf = (L) => -ageOf(L).ry - (LIFT[L.hair] || 0);
const fillInk = (g, c, lw = LW) => { g.fillStyle = c; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); };

function flower(g, x, y, r, petal, heart, n = 5, rot = 0) {
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    ell(g, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.36, a);
    g.fillStyle = petal; g.fill(); g.lineWidth = LW * 0.45; g.strokeStyle = INK; g.stroke();
  }
  dot(g, x, y, r * 0.28); g.fillStyle = heart; g.fill();
}
function leaf(g, x, y, r, a, c = '#5e8a3a') {
  ell(g, x + Math.cos(a) * r, y + Math.sin(a) * r, r, r * 0.42, a); g.fillStyle = c; g.fill();
  g.lineWidth = LW * 0.4; g.strokeStyle = INK; g.stroke();
}
// a frilly carnation: jagged rings of petals, darker towards the heart
function carnation(g, x, y, r, c) {
  for (let k = 0; k < 3; k++) {
    const rr = r * (1 - k * 0.28), n = 14 - k * 3;
    g.beginPath();
    for (let i = 0; i <= n * 2; i++) {
      const a = (i * Math.PI) / n + k * 0.4, q = i % 2 ? 0.78 : 1;
      const px = x + Math.cos(a) * rr * q, py = y + Math.sin(a) * rr * q * 0.9;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); fillInk(g, shade(c, -0.12 * k), LW * 0.5);
  }
}

const BACK = {
  veil(g, L, v, t) {
    const top = topOf(L), sw = Math.sin(t * 0.9) * 0.02;
    g.save(); g.globalAlpha = 0.62;
    smooth(g, [[-0.3, top + 0.1], [0, top - 0.02], [0.3, top + 0.1], [0.62, 0.5], [0.92 + sw, 1.35], [0.98 + sw, 2.0], [0, 2.1], [-0.98 + sw, 2.0], [-0.92 + sw, 1.35], [-0.62, 0.5]]);
    g.fillStyle = '#fbf8f4'; g.fill(); g.globalAlpha = 0.5; g.lineWidth = LW * 0.6; g.strokeStyle = '#b7aba0'; g.stroke();
    g.globalAlpha = 0.28; g.lineWidth = 0.014; g.beginPath();
    for (const s of [-1, 1]) for (const k of [0.45, 0.7]) { g.moveTo(s * 0.3, top + 0.2); g.quadraticCurveTo(s * (0.4 + k * 0.4), 0.8, s * (0.35 + k * 0.6) + sw, 1.95); }
    g.strokeStyle = '#9a8e84'; g.stroke(); g.restore();
  },
  bonnet(g, L) {
    ell(g, 0, -0.06, 0.62 * (L.w || 1), 0.62); fillInk(g, '#fbf7f0');
    g.fillStyle = '#e9e1d4'; for (let i = 0; i < 9; i++) { const a = Math.PI + 0.25 + i * 0.33; dot(g, Math.cos(a) * 0.52, -0.06 + Math.sin(a) * 0.52, 0.018); g.fill(); }
  },
};

const FRONT = {
  party(g, L, d, t) {
    const top = topOf(L);
    g.save(); g.translate(0.1 + d, top + 0.1); g.rotate(0.22 + Math.sin(t * 1.3) * 0.015);
    g.beginPath(); g.moveTo(-0.2, 0); g.lineTo(0, -0.56); g.lineTo(0.2, 0); g.quadraticCurveTo(0, 0.05, -0.2, 0); g.closePath();
    g.fillStyle = '#3b86d6'; g.fill();
    g.save(); g.clip(); g.fillStyle = '#f25c8c';
    for (let i = -3; i < 6; i++) { g.beginPath(); g.moveTo(-0.3, -i * 0.13); g.lineTo(0.3, -i * 0.13 - 0.16); g.lineTo(0.3, -i * 0.13 - 0.23); g.lineTo(-0.3, -i * 0.13 - 0.07); g.fill(); }
    g.fillStyle = '#ffe04d'; for (let i = 0; i < 5; i++) { dot(g, -0.1 + ((i * 37) % 20) / 100, -0.08 - i * 0.09, 0.016); g.fill(); }
    g.restore();
    g.lineWidth = LW; g.strokeStyle = INK; g.stroke();
    for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; ell(g, Math.cos(a) * 0.05, -0.57 + Math.sin(a) * 0.05, 0.05, 0.022, a); g.fillStyle = i % 2 ? '#ffe04d' : '#f2a33a'; g.fill(); }
    g.restore();
    g.lineWidth = 0.008; g.strokeStyle = 'rgba(200,60,110,0.8)'; g.beginPath();
    g.moveTo(-0.08 + d, top + 0.14); g.quadraticCurveTo(-0.46, 0.1, -0.2, 0.56); g.moveTo(0.3 + d, top + 0.16); g.quadraticCurveTo(0.48, 0.2, 0.2, 0.56); g.stroke();
  },
  straw(g, L, d) {
    const top = topOf(L), y = -0.35, c = '#e8cf8a';
    ell(g, d, y, 0.74, 0.12); fillInk(g, c);
    g.beginPath(); g.moveTo(-0.31 + d, y); g.bezierCurveTo(-0.33 + d, top - 0.04, -0.2 + d, top - 0.14, d, top - 0.14);
    g.bezierCurveTo(0.2 + d, top - 0.14, 0.33 + d, top - 0.04, 0.31 + d, y); g.closePath(); fillInk(g, shade(c, 0.04));
    g.beginPath(); g.moveTo(-0.315 + d, y - 0.02); g.lineTo(0.315 + d, y - 0.02); g.lineTo(0.31 + d, y - 0.1); g.lineTo(-0.31 + d, y - 0.1); g.closePath(); fillInk(g, '#4a3326', LW * 0.7);
    g.strokeStyle = shade(c, -0.18); g.lineWidth = 0.008; g.beginPath();
    for (let i = 0; i < 7; i++) { const yy = top - 0.08 + i * 0.03; g.moveTo(-0.26 + d, yy); g.lineTo(0.26 + d, yy); }
    g.stroke();
    g.beginPath(); g.ellipse(d, y, 0.74, 0.12, 0, 0.05, Math.PI - 0.05); g.lineWidth = LW; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.ellipse(d, y, 0.6, 0.085, 0, 0.1, Math.PI - 0.1); g.lineWidth = 0.008; g.strokeStyle = shade(c, -0.2); g.stroke();
  },
  boina(g, L, d) {
    const top = topOf(L), c = '#24242c';
    g.save(); g.translate(d * 1.2 + 0.03, top + 0.1); g.rotate(-0.12);
    ell(g, 0.02, -0.02, 0.58, 0.19); fillInk(g, c);
    ell(g, -0.12, -0.08, 0.3, 0.06, -0.08); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill();
    g.beginPath(); g.ellipse(0.02, 0.02, 0.5, 0.13, 0, 0.15, Math.PI - 0.15); g.lineWidth = 0.02; g.strokeStyle = '#3a2a22'; g.stroke();
    g.beginPath(); g.moveTo(0.02, -0.2); g.quadraticCurveTo(0.04, -0.27, 0.08, -0.28); g.lineWidth = 0.022; g.lineCap = 'round'; g.strokeStyle = c; g.stroke();
    g.restore();
  },
  santa(g, L, d, t) {
    const top = topOf(L), sw = Math.sin(t * 1.6) * 0.03, R = '#c8242c';
    g.beginPath(); g.moveTo(-0.46 + d, top + 0.2); g.bezierCurveTo(-0.4 + d, top - 0.36, 0.3 + d, top - 0.42, 0.6 + sw, top - 0.02);
    g.quadraticCurveTo(0.72 + sw, top + 0.2, 0.74 + sw, top + 0.36); g.quadraticCurveTo(0.6 + sw, top + 0.1, 0.46 + d, top + 0.2); g.closePath(); fillInk(g, R);
    g.beginPath(); g.moveTo(-0.3 + d, top - 0.1); g.quadraticCurveTo(0.1 + d, top - 0.3, 0.5, top - 0.06); g.lineWidth = 0.03; g.strokeStyle = shade(R, 0.25); g.stroke();
    for (let i = 0; i < 11; i++) { const x = -0.5 + i * 0.1 + d, yy = top + 0.22 + Math.sin(i * 2.3) * 0.015; dot(g, x, yy, 0.085); g.fillStyle = '#fbf7ef'; g.fill(); }
    g.beginPath(); g.moveTo(-0.55 + d, top + 0.3); g.quadraticCurveTo(d, top + 0.36, 0.55 + d, top + 0.3); g.lineWidth = LW * 0.6; g.strokeStyle = '#cfc6ba'; g.stroke();
    for (let i = 0; i < 7; i++) { const a = (i * TAU) / 7; dot(g, 0.75 + sw + Math.cos(a) * 0.05, top + 0.4 + Math.sin(a) * 0.05, 0.06); g.fillStyle = '#fbf7ef'; g.fill(); }
  },
  flowers(g, L, d) {
    const top = topOf(L), n = 9;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + 0.42 + (i * (Math.PI - 0.84)) / (n - 1), x = Math.cos(a) * 0.5 + d, y = top + 0.26 + Math.sin(a) * 0.26;
      leaf(g, x, y + 0.02, 0.045, a + 2.2);
    }
    for (let i = 0; i < n; i++) {
      const a = Math.PI + 0.42 + (i * (Math.PI - 0.84)) / (n - 1), x = Math.cos(a) * 0.5 + d, y = top + 0.26 + Math.sin(a) * 0.26;
      flower(g, x, y, i % 2 ? 0.075 : 0.09, '#fffdf8', i % 3 ? '#f2d36a' : '#f4b6c2', 5, i);
    }
  },
  veil(g, L, d) {
    const top = topOf(L);
    for (let i = 0; i < 9; i++) { const a = Math.PI + 0.55 + i * 0.255; dot(g, Math.cos(a) * 0.46 + d, top + 0.26 + Math.sin(a) * 0.22, 0.028); fillInk(g, '#fbf8f0', LW * 0.35); }
  },
  bonnet(g, L, d) {
    const w = L.w || 1;
    g.beginPath(); g.ellipse(d * 0.3, -0.04, 0.58 * w, 0.6, 0, Math.PI - 0.45, 2 * Math.PI + 0.45);
    g.quadraticCurveTo(0.42 * w + d, -0.28, 0.2 + d, -0.33); g.quadraticCurveTo(d, -0.36, -0.2 + d, -0.33); g.quadraticCurveTo(-0.42 * w + d, -0.28, -0.52 * w, 0.22);
    g.closePath(); fillInk(g, '#fbf7f0');
    for (let i = 0; i <= 12; i++) {
      const k = i / 12, x = (-0.5 + k) * 0.98 * w + d * (1 - Math.abs(k - 0.5)), y = -0.33 + Math.pow(Math.abs(k - 0.5) * 2, 2.2) * 0.52;
      dot(g, x, y, 0.05); fillInk(g, '#fffdf9', LW * 0.4);
    }
    g.lineWidth = 0.035; g.strokeStyle = '#bcd6ee'; g.lineCap = 'round'; g.beginPath();
    g.moveTo(-0.5 * w, 0.22); g.quadraticCurveTo(-0.36, 0.52, 0, 0.56); g.moveTo(0.5 * w, 0.22); g.quadraticCurveTo(0.36, 0.52, 0, 0.56); g.stroke();
    for (const s of [-1, 1]) { ell(g, s * 0.09, 0.56, 0.09, 0.05, s * 0.3); fillInk(g, '#bcd6ee', LW * 0.5); g.beginPath(); g.moveTo(s * 0.02, 0.58); g.quadraticCurveTo(s * 0.06, 0.66, s * 0.04, 0.74); g.lineWidth = 0.025; g.strokeStyle = '#bcd6ee'; g.stroke(); }
    dot(g, 0, 0.56, 0.03); fillInk(g, '#a9c8e6', LW * 0.4);
  },
  sunhat(g, L, d) {
    const top = topOf(L), c = '#fbf3d6', y = top + 0.24;
    g.beginPath(); g.moveTo(-0.34 + d, y); g.bezierCurveTo(-0.36 + d, top - 0.14, 0.36 + d, top - 0.14, 0.34 + d, y); g.closePath(); fillInk(g, c);
    g.beginPath(); g.moveTo(-0.66 + d, y + 0.14); g.quadraticCurveTo(-0.4 + d, y - 0.08, d, y - 0.06); g.quadraticCurveTo(0.4 + d, y - 0.08, 0.66 + d, y + 0.14);
    g.quadraticCurveTo(0.4 + d, y + 0.08, d, y + 0.1); g.quadraticCurveTo(-0.4 + d, y + 0.08, -0.66 + d, y + 0.14); g.closePath(); fillInk(g, shade(c, -0.03));
    g.setLineDash([0.02, 0.02]); g.lineWidth = 0.007; g.strokeStyle = shade(c, -0.3); g.beginPath();
    g.moveTo(-0.5 + d, y + 0.07); g.quadraticCurveTo(d, y - 0.02, 0.5 + d, y + 0.07); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#f2c84a'; for (let i = 0; i < 6; i++) { dot(g, -0.2 + i * 0.08 + d, top + 0.03 + ((i * 7) % 3) * 0.05, 0.022); g.fill(); }
  },
  shades(g, L, d) {
    const y = topOf(L) + 0.16, gold = '#d9a93a';
    g.lineWidth = 0.022; g.strokeStyle = gold; g.lineCap = 'round'; g.beginPath(); g.moveTo(-0.46 + d, y + 0.05); g.lineTo(-0.3 + d, y); g.moveTo(0.46 + d, y + 0.05); g.lineTo(0.3 + d, y);
    g.moveTo(-0.06 + d, y - 0.02); g.quadraticCurveTo(d, y - 0.05, 0.06 + d, y - 0.02); g.stroke();
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 0.05 + d, y - 0.045); g.lineTo(s * 0.31 + d, y - 0.055); g.quadraticCurveTo(s * 0.33 + d, y + 0.1, s * 0.2 + d, y + 0.1); g.quadraticCurveTo(s * 0.06 + d, y + 0.1, s * 0.05 + d, y - 0.045); g.closePath();
      const gr = g.createLinearGradient(0, y - 0.05, 0, y + 0.1); gr.addColorStop(0, '#f2b45a'); gr.addColorStop(0.45, '#d9546a'); gr.addColorStop(1, '#3a3a8a');
      g.fillStyle = gr; g.fill(); g.lineWidth = 0.026; g.strokeStyle = INK; g.stroke(); g.lineWidth = 0.014; g.strokeStyle = gold; g.stroke();
      g.beginPath(); g.moveTo(s * 0.11 + d, y - 0.01); g.lineTo(s * 0.22 + d, y - 0.025); g.lineWidth = 0.016; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.stroke();
    }
  },
  carnation(g, L, d) { const x = -0.44 + d * 1.6, y = topOf(L) + 0.3; leaf(g, x + 0.08, y + 0.1, 0.06, 0.6); leaf(g, x - 0.1, y + 0.08, 0.05, 2.4); carnation(g, x, y, 0.15, '#d21f2c'); },
  hairflower(g, L, d) { const x = 0.38 + d * 1.6, y = topOf(L) + 0.24; leaf(g, x - 0.06, y + 0.06, 0.05, 2.5); flower(g, x, y, 0.1, '#f7a6c0', '#f7e27a', 6, 0.3); },
};

export function drawHatBack(g, L, v, t) { const f = BACK[L.hat]; if (f) f(g, L, v, t); }
export function drawHatFront(g, L, v, t) { const f = FRONT[L.hat]; if (f) f(g, L, Math.sin(v.yaw) * 0.12, t); }
